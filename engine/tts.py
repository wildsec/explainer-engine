#!/usr/bin/env python3
"""Narration for an explainer project: Kokoro (bm_george, normal speed) -> narration.wav + timing.json.

usage: tts.py <project dir>     reads <project>/script.json, writes <project>/out/

timing.json = {"total": s, "beats": [{"id", "text", "start", "end", "words": [{"w", "start", "end"}]}]}
Beats drive the film (each beat's choreography is mapped onto its spoken span). Word times are estimated:
every sentence is synthesised on its own (exact start/end), words inside it are spread by length.
For frame-exact word times, a local Whisper alignment can replace the estimate later.

Kokoro model + venv come from ../setup.sh (explainer-engine/.venv, explainer-engine/voices/).
Also writes out/captions.srt (≈7-word lines from the word times) for the platforms.
Never speeds the voice up: if a video runs long, trim the script instead.
"""
import json, os, re, subprocess, sys, wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
VE = HERE.parent                      # explainer-engine/
VENV_PY = VE / ".venv/bin/python"
MODEL, VOICES = VE / "voices/kokoro-v1.0.onnx", VE / "voices/voices-v1.0.bin"
VOICE, LANG, SPEED = os.environ.get("KOKORO_VOICE", "bm_george"), "en-gb", 1.0
SR = 24000
LEAD, SENT_GAP, BEAT_GAP = 0.5, 0.22, 0.45

def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

def main(proj):
    import numpy as np, soundfile as sf
    from kokoro_onnx import Kokoro
    proj = Path(proj).resolve()
    spec = json.loads((proj / "script.json").read_text())
    out = proj / "out"; out.mkdir(exist_ok=True)
    tts = Kokoro(str(MODEL), str(VOICES))
    audio, t, beats = [np.zeros(int(SR * LEAD), dtype=np.float32)], LEAD, []
    for b in spec["beats"]:
        start, words = t, []
        sents = [s for s in re.split(r"(?<=[.!?])\s+", b["text"].strip()) if s]
        for i, s in enumerate(sents):
            a, sr = tts.create(s, voice=VOICE, speed=SPEED, lang=LANG)
            assert sr == SR
            a = np.asarray(a, dtype=np.float32)
            # trim Kokoro's own leading/trailing near-silence so word estimates line up
            nz = np.where(np.abs(a) > 0.01)[0]
            if len(nz): a = a[max(0, nz[0] - 240): nz[-1] + 1200]
            d = len(a) / SR
            ws = s.split(); weights = [len(w) + 2 for w in ws]; tot = sum(weights); acc = 0
            for w, wt in zip(ws, weights):
                words.append({"w": w, "start": round(t + d * acc / tot, 3), "end": round(t + d * (acc + wt) / tot, 3)}); acc += wt
            audio.append(a); t += d
            if i < len(sents) - 1:
                audio.append(np.zeros(int(SR * SENT_GAP), dtype=np.float32)); t += SENT_GAP
        beats.append({"id": b["id"], "text": b["text"], "start": round(start, 3), "end": round(t, 3), "words": words})
        gap = BEAT_GAP + b.get("pause", 0)
        audio.append(np.zeros(int(SR * gap), dtype=np.float32)); t += gap
    total = round(t + spec.get("tail", 1.5), 3)
    audio.append(np.zeros(int(SR * spec.get("tail", 1.5)), dtype=np.float32))
    raw = out / "narration-raw.wav"
    sf.write(str(raw), np.concatenate(audio), SR, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af",
                    "aresample=48000,highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=120,loudnorm=I=-14:TP=-1.5:LRA=7",
                    "-ar", "48000", str(out / "narration.wav")], check=True)
    raw.unlink()
    (out / "timing.json").write_text(json.dumps({"total": total, "beats": beats}, indent=1))
    srt, n = [], 1
    for b in beats:
        ws = b["words"]
        for i in range(0, len(ws), 7):
            c = ws[i:i + 7]
            srt.append(f"{n}\n{ts(c[0]['start'])} --> {ts(c[-1]['end'])}\n{' '.join(w['w'] for w in c)}\n"); n += 1
    (out / "captions.srt").write_text("\n".join(srt))
    print(f"{proj.name}: {total:.1f}s, {len(beats)} beats")

if __name__ == "__main__":
    if Path(sys.prefix) != VE / ".venv" and VENV_PY.exists():
        os.execv(str(VENV_PY), [str(VENV_PY), __file__, *sys.argv[1:]])
    if len(sys.argv) != 2: sys.exit("usage: tts.py <project dir>")
    main(sys.argv[1])

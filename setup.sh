#!/usr/bin/env bash
# One-time setup (idempotent): Node deps (puppeteer-core, three), Kokoro TTS (voice bm_george) in .venv + model files.
# Needs ffmpeg and Chromium (CHROME=/path/to/chrome to override). Everything is free and licensed for commercial use.
set -euo pipefail
cd "$(dirname "$0")"
command -v ffmpeg >/dev/null || { echo "need ffmpeg"; exit 1; }
[ -x "${CHROME:-/usr/bin/chromium}" ] || command -v chromium >/dev/null || { echo "need chromium (or set CHROME)"; exit 1; }
npm install --no-fund --no-audit
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/python -c "import kokoro_onnx, soundfile, numpy" 2>/dev/null || .venv/bin/pip install -q kokoro-onnx soundfile numpy
mkdir -p voices
KOKORO="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -s "voices/$f" ] || curl -fL "$KOKORO/$f" -o "voices/$f"
done
echo "ready. voice: kokoro bm_george · try: python3 engine/tts.py examples/last-programmers && node engine/render.mjs examples/last-programmers --stills"

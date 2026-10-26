#!/usr/bin/env bash
# Starts the XTTS-v2 server. The first run downloads the model (~1.8 GB) into ~/Library/Application Support/tts.
# XTTS-v2 weights are under the Coqui Public Model License (non-commercial); COQUI_TOS_AGREED accepts it non-interactively.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip setuptools wheel
  .venv/bin/pip install -r requirements.txt
fi
export COQUI_TOS_AGREED=1
exec .venv/bin/python server.py

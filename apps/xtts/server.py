"""XTTS-v2 voice-clone server for the lecture reader.

POST /tts  {"text": "...", "speed": 1.0, "voice": "akshatsir"}  ->  audio/wav (24 kHz mono, X-Duration header in seconds)
GET  /health                                                    ->  {"ok": true, "voices": [...]}

Each voice is a reference clip voices/<name>.wav, or a folder voices/<name>/ of clips (each up to ~30 s) that are
learned together; its speaker latents are computed once and cached.

Generated audio is kept in XTTS_CACHE_DIR, so a lecture is only synthesized once; on CPU synthesis is several times
slower than real time, and replays (or a second server sharing the cache) are served instantly.
"""

import hashlib
import io
import json
import os
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import torch
from TTS.api import TTS

HERE = Path(__file__).resolve().parent
VOICES_DIR = Path(os.environ.get("XTTS_VOICES_DIR", HERE / "voices"))
HOST = os.environ.get("XTTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("XTTS_PORT", "8020"))
# XTTS-v2 produces wrong audio on Apple MPS, so default to CUDA when present, otherwise CPU.
DEVICE = os.environ.get("XTTS_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
LANGUAGE = os.environ.get("XTTS_LANGUAGE", "en")
SAMPLE_RATE = 24000
MAX_CHARS = 3000
# Above ~0.65 XTTS sometimes trails off into "ah, ah" babble at the end of a sentence.
TEMPERATURE = float(os.environ.get("XTTS_TEMPERATURE", "0.55"))
CACHE_DIR = Path(os.environ.get("XTTS_CACHE_DIR", HERE / "cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

print(f"Loading XTTS-v2 on {DEVICE}…", flush=True)
model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(DEVICE).synthesizer.tts_model
lock = threading.Lock()
latents: dict = {}


def voice_clips(name: str):
    folder = VOICES_DIR / name
    if folder.is_dir():
        return sorted(str(p) for p in folder.glob("*.wav"))
    clip = VOICES_DIR / f"{name}.wav"
    return [str(clip)] if clip.is_file() else []


def voice_names():
    names = {p.stem for p in VOICES_DIR.glob("*.wav")} | {p.name for p in VOICES_DIR.iterdir() if p.is_dir()}
    return sorted(n for n in names if voice_clips(n))


def speaker(name: str):
    if name not in latents:
        clips = voice_clips(name)
        if not clips:
            raise KeyError(name)
        # The method's own defaults only listen to the first 6 s of the clip; use the model config (up to 30 s).
        latents[name] = model.get_conditioning_latents(
            audio_path=clips,
            gpt_cond_len=model.config.gpt_cond_len,
            gpt_cond_chunk_len=model.config.gpt_cond_chunk_len,
            max_ref_length=model.config.max_ref_len,
            librosa_trim_db=30,
            sound_norm_refs=True,
        )
    return latents[name]


def cache_path(text: str, voice: str, speed: float) -> Path:
    clips = [(Path(c).name, os.path.getmtime(c)) for c in voice_clips(voice)]
    key = json.dumps([voice, clips, LANGUAGE, TEMPERATURE, round(speed, 2), text])
    return CACHE_DIR / f"{hashlib.sha256(key.encode()).hexdigest()}.wav"


def cached_synthesize(text: str, voice: str, speed: float) -> bytes:
    path = cache_path(text, voice, speed)
    if path.is_file():
        return path.read_bytes()
    audio = synthesize(text, voice, speed)
    tmp = path.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
    tmp.write_bytes(audio)
    tmp.replace(path)
    return audio


def synthesize(text: str, voice: str, speed: float) -> bytes:
    with lock, torch.inference_mode():
        gpt_cond_latent, speaker_embedding = speaker(voice)
        out = model.inference(
            text,
            LANGUAGE,
            gpt_cond_latent,
            speaker_embedding,
            speed=speed,
            temperature=TEMPERATURE,
            enable_text_splitting=True,
        )
    samples = np.clip(np.asarray(out["wav"], dtype=np.float32), -1, 1)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes((samples * 32767).astype("<i2").tobytes())
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "device": DEVICE, "voices": voice_names()})
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/tts":
            return self._json(404, {"error": "Not found"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length") or 0)) or b"{}")
        except ValueError:
            return self._json(400, {"error": "Body must be JSON"})
        text = " ".join(str(body.get("text") or "").split())
        voice = str(body.get("voice") or "akshatsir")
        try:
            speed = min(2.0, max(0.5, float(body.get("speed") or 1)))
        except (TypeError, ValueError):
            speed = 1.0
        if not text:
            return self._json(400, {"error": "Nothing to read"})
        if len(text) > MAX_CHARS:
            return self._json(413, {"error": f"Text must be under {MAX_CHARS} characters"})
        try:
            audio = cached_synthesize(text, voice, speed)
        except KeyError:
            return self._json(404, {"error": f"Unknown voice '{voice}'"})
        except Exception as err:  # noqa: BLE001
            print(f"synthesis failed: {err!r}", flush=True)
            return self._json(500, {"error": "Synthesis failed"})
        frames = (len(audio) - 44) // 2
        self.send_response(200)
        self.send_header("content-type", "audio/wav")
        self.send_header("content-length", str(len(audio)))
        self.send_header("x-duration", f"{frames / SAMPLE_RATE:.3f}")
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}", flush=True)


if __name__ == "__main__":
    for name in voice_names():
        speaker(name)
        print(f"Voice ready: {name}", flush=True)
    print(f"XTTS server on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

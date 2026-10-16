#!/usr/bin/env python3
"""Produce an accessible 20-second audio demo without paid providers."""
import argparse
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

def run(args):
    subprocess.run(args, check=True)

def duration(path):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip())

def synthesize(text, target, model):
    if model.is_file():
        try:
            from piper import PiperVoice
            voice = PiperVoice.load(str(model))
            with wave.open(str(target), "wb") as wav:
                voice.synthesize_wav(text, wav)
            return "Piper neural narration"
        except Exception as error:
            print(f"Piper unavailable, using offline fallback: {error}")
    binary = shutil.which("espeak-ng") or shutil.which("espeak") or "espeak-ng"
    run([binary, "-v", "en-us+m3", "-s", "151", "-a", "180", "-w", str(target), text])
    return "eSpeak local narration"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--narration", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", type=Path, default=Path("/tmp/piper/en_US-lessac-medium.onnx"))
    args = parser.parse_args()
    spoken = " ".join(args.narration.read_text(encoding="utf-8").strip().split())
    if not 12 <= len(spoken.split()) <= 55:
        raise SystemExit("Narration needs 12–55 words")
    if not 19.5 <= duration(args.source) <= 20.5:
        raise SystemExit("Source must be a 20-second video")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        narration_wav = Path(directory) / "narration.wav"
        method = synthesize(spoken, narration_wav, args.model)
        voice_seconds = duration(narration_wav)
        if voice_seconds > 18.25:
            speed = voice_seconds / 18.25
            if speed > 1.8:
                raise SystemExit("Narration too long for 20-second demo")
            adjusted = Path(directory) / "narration-fit.wav"
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(narration_wav),
                 "-af", f"atempo={speed:.5f}", str(adjusted)])
            narration_wav = adjusted
            voice_seconds = duration(narration_wav)
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(args.source), "-i", str(narration_wav),
             "-filter_complex",
             "[0:a]volume=1.6[background];"
             "[1:a]adelay=950:all=1,highpass=f=85,lowpass=f=11000,"
             "acompressor=threshold=-20dB:ratio=2.5:attack=10:release=160,"
             "volume=1.3,apad=whole_dur=20[voice];"
             "[background][voice]amix=inputs=2:duration=first:dropout_transition=0,"
             "alimiter=limit=0.92[out]",
             "-map", "0:v:0", "-map", "[out]",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
             "-movflags", "+faststart", "-t", "20", str(args.output)])
    length = duration(args.output)
    codec = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "a",
        "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(args.output)
    ], text=True).strip()
    assert 19.5 <= length <= 20.5, length
    assert "aac" in codec, "Expected AAC voice audio track"
    print(f"{method}: narration {voice_seconds:.2f}s, video {length:.2f}s; {args.output.stat().st_size} bytes")

if __name__ == "__main__":
    main()

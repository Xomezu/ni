#!/usr/bin/env python3
"""Estimate chart Offset (seconds) by aligning onset energy to the beat grid."""
from __future__ import annotations
import argparse, re, subprocess
from pathlib import Path
import numpy as np

def load_mono(path, sr=44100):
    raw = subprocess.check_output([
        "ffmpeg","-v","error","-i",str(path),"-ac","1","-ar",str(sr),"-f","f32le","-"
    ])
    return np.frombuffer(raw, dtype=np.float32), sr

def onset_env(audio, sr, hop=512, win=2048):
    e = []
    for i in range(0, len(audio) - win, hop):
        e.append(np.sqrt(np.mean(audio[i:i+win]**2)))
    e = np.asarray(e)
    onset = np.maximum(0.0, np.diff(e, prepend=e[0]))
    return onset, hop

def best_offset(onset, hop, sr, bpm, search_s=3.0, analyze_s=90.0):
    beat = 60.0 / bpm
    n = min(len(onset), int(analyze_s * sr / hop))
    best = None
    for off_ms in range(0, int(search_s * 1000), 5):
        off = off_ms / 1000.0
        score = 0.0
        for i in range(n):
            t = i * hop / sr
            phase = ((t - off) / beat) % 1.0
            dist = min(phase, 1.0 - phase)
            score += float(onset[i]) * (1.0 - 2.0 * dist) ** 2
        if best is None or score > best[0]:
            best = (score, off_ms / 1000.0)
    return best[1], best[0]

def set_chart_offset(chart_path: Path, offset: float):
    text = chart_path.read_text()
    text2, n = re.subn(r"(Offset\s*=\s*)-?\d+(\.\d+)?", rf"\g<1>{offset:.3f}", text, count=1)
    if n == 0:
        raise SystemExit("Offset field not found")
    chart_path.write_text(text2)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--audio", type=Path, required=True)
    p.add_argument("--chart", type=Path, required=True)
    p.add_argument("--bpm", type=float, required=True)
    p.add_argument("--apply", action="store_true")
    args = p.parse_args()
    audio, sr = load_mono(args.audio)
    onset, hop = onset_env(audio, sr)
    # try nearby BPMs too
    candidates = []
    for bpm in np.arange(args.bpm - 1.5, args.bpm + 1.6, 0.25):
        off, score = best_offset(onset, hop, sr, float(bpm))
        candidates.append((score, float(bpm), off))
    candidates.sort(reverse=True)
    print("Top BPM/offset candidates:")
    for score, bpm, off in candidates[:8]:
        print(f"  bpm={bpm:.2f} offset={off:.3f}s score={score:.1f}")
    best = candidates[0]
    print(f"RECOMMENDED bpm={best[1]:.2f} Offset={best[2]:.3f}")
    if args.apply:
        set_chart_offset(args.chart, best[2])
        print(f"Applied Offset={best[2]:.3f} to {args.chart}")

if __name__ == "__main__":
    main()

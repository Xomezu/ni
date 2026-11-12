#!/usr/bin/env python3
"""Convert a GM drum-channel MIDI into a Clone Hero 4-lane Pro drums .chart.

Usage:
  python midi_drums_to_chart.py input.mid --audio song.mp3 --out "Song Name"
"""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from collections import defaultdict
from pathlib import Path

import mido

# GM drum pitch -> (lane, cymbal_marker_or_None)
# Lanes: 0 kick, 1 red, 2 yellow, 3 blue, 4 green
# Cymbal markers: 66 yellow, 67 blue, 68 green
DEFAULT_MAP = {
    35: (0, None),
    36: (0, None),
    37: (1, None),
    38: (1, None),
    40: (1, None),
    42: (2, 66),
    44: (2, 66),
    46: (2, 66),
    50: (2, None),
    48: (2, None),
    47: (2, None),
    45: (3, None),
    43: (4, None),
    41: (4, None),
    51: (3, 67),
    53: (3, 67),
    59: (3, 67),
    49: (4, 68),
    57: (4, 68),
    52: (4, 68),
    55: (3, 67),
}


def resolve_tick(items):
    by_lane = defaultdict(list)
    for lane, cym, vel, pitch in items:
        by_lane[lane].append((cym, vel, pitch))
    out = []
    for lane, group in by_lane.items():
        cyms = [g for g in group if g[0] is not None]
        toms = [g for g in group if g[0] is None]
        chosen = max(cyms if (cyms and toms) else group, key=lambda g: g[1])
        cym, vel, _pitch = chosen
        out.append((lane, cym, vel >= 120, vel <= 60))
    return out


def reduce_hard(resolved, res):
    out = {}
    for t, items in resolved.items():
        kept = []
        for lane, cym, accent, _ghost in items:
            if lane == 2 and cym == 66:
                rel = t - 600 if t >= 600 else t
                if rel % (res // 2) != 0 and not accent:
                    others = [x for x in items if not (x[0] == 2 and x[1] == 66)]
                    if not others:
                        continue
            kept.append((lane, cym, accent, False))
        if kept:
            out[t] = kept
    return out


def reduce_medium(resolved, res):
    out = {}
    for t, items in resolved.items():
        kept = []
        for lane, cym, _accent, _ghost in items:
            rel = t - 600 if t >= 600 else t
            if lane == 0:
                if rel % (res // 2) == 0 or t < 600:
                    kept.append((lane, cym, False, False))
            elif lane == 1:
                kept.append((lane, cym, False, False))
            elif cym is not None:
                if cym == 66:
                    if rel % res == 0:
                        kept.append((lane, cym, False, False))
                else:
                    kept.append((lane, cym, False, False))
            elif rel % (res // 2) == 0:
                kept.append((lane, cym, False, False))
        if kept:
            out[t] = kept
    return out


def reduce_easy(resolved, res):
    out = {}
    for t, items in resolved.items():
        kept = []
        for lane, cym, _accent, _ghost in items:
            rel = t - 600 if t >= 600 else t
            beat = (rel // res) % 4 if t >= 600 else -1
            if lane == 0 and (t < 600 or (beat in (0, 2) and rel % res == 0)):
                kept.append((0, None, False, False))
            elif lane == 1 and (t < 600 or (beat in (1, 3) and rel % res == 0)):
                kept.append((1, None, False, False))
            elif cym == 68 and rel % res == 0:
                kept.append((lane, cym, False, False))
        if kept:
            out[t] = kept
    return out


def emit_track(name, resolved, sp_phrases=None, dynamics=True):
    lines = [f"[{name}]", "{"]
    events = []
    for t, items in resolved.items():
        for lane, cym, accent, ghost in items:
            events.append((t, "N", lane, 0))
            if cym is not None:
                events.append((t, "N", cym, 0))
            if dynamics and accent and lane != 0:
                accent_id = {1: 34, 2: 35, 3: 36, 4: 37}.get(lane)
                if accent_id:
                    events.append((t, "N", accent_id, 0))
            if dynamics and ghost and lane != 0:
                ghost_id = {1: 40, 2: 41, 3: 42, 4: 43}.get(lane)
                if ghost_id:
                    events.append((t, "N", ghost_id, 0))
    if sp_phrases:
        for start, length in sp_phrases:
            events.append((start, "S", 2, length))
    events.sort(key=lambda e: (e[0], 0 if e[1] == "N" else 1, e[2], e[3]))
    for t, kind, a, b in events:
        lines.append(f"  {t} = {kind} {a} {b}")
    lines.append("}")
    return "\n".join(lines)


def audio_duration_ms(path: Path | None, fallback_s: float) -> int:
    if path and path.exists():
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nw=1:nk=1",
                str(path),
            ],
            text=True,
        ).strip()
        return int(float(out) * 1000)
    return int(fallback_s * 1000)


def convert(midi_path: Path, out_dir: Path, audio: Path | None, meta: dict):
    mid = mido.MidiFile(str(midi_path))
    res = mid.ticks_per_beat

    abs_t = 0
    tempos = []
    timesigs = []
    notes = []
    for msg in mido.merge_tracks(mid.tracks):
        abs_t += msg.time
        if msg.type == "set_tempo":
            tempos.append((abs_t, msg.tempo))
        elif msg.type == "time_signature":
            timesigs.append((abs_t, msg.numerator, msg.denominator))
        elif msg.type == "note_on" and msg.velocity > 0:
            notes.append((abs_t, msg.note, msg.velocity))
    if not tempos:
        tempos = [(0, 500000)]
    if not timesigs:
        timesigs = [(0, 4, 4)]

    expert_raw = defaultdict(list)
    unmapped = defaultdict(int)
    for tick, pitch, vel in notes:
        if pitch not in DEFAULT_MAP:
            unmapped[pitch] += 1
            continue
        lane, cym = DEFAULT_MAP[pitch]
        expert_raw[tick].append((lane, cym, vel, pitch))
    expert = {t: resolve_tick(v) for t, v in expert_raw.items()}
    hard = reduce_hard(expert, res)
    medium = reduce_medium(expert, res)
    easy = reduce_easy(expert, res)

    bar = res * 4
    last_note = max(expert) if expert else 0
    sp = []
    for n in (8, 20, 32, 44, 56, 64):
        start = 600 + bar * n
        length = bar * 4
        if start + length < last_note - bar:
            sp.append((start, length))

    sync_events = []
    for t, us in tempos:
        sync_events.append((t, f"B {int(round(mido.tempo2bpm(us) * 1000))}"))
    for t, num, den in timesigs:
        exp = int(round(math.log2(den)))
        sync_events.append((t, f"TS {num}" if den == 4 else f"TS {num} {exp}"))
    sync_events.sort(key=lambda x: (x[0], 0 if x[1].startswith("TS") else 1))

    sync = ["[SyncTrack]", "{"]
    for t, body in sync_events:
        sync.append(f"  {t} = {body}")
    sync.append("}")

    events = ["[Events]", "{"]
    for t, name in [
        (0, "section Intro"),
        (600 + bar * 4, "section Verse 1"),
        (600 + bar * 12, "section Chorus 1"),
        (600 + bar * 20, "section Verse 2"),
        (600 + bar * 28, "section Chorus 2"),
        (600 + bar * 40, "section Bridge"),
        (600 + bar * 52, "section Final"),
    ]:
        if t <= last_note:
            events.append(f'  {t} = E "{name}"')
    events.append(f'  {last_note + res} = E "end"')
    events.append("}")

    song = f"""[Song]
{{
  Name = "{meta['name']}"
  Artist = "{meta['artist']}"
  Album = "{meta['album']}"
  Genre = "{meta['genre']}"
  Year = "{meta['year']}"
  Charter = "{meta['charter']}"
  Offset = 0
  Resolution = {res}
  Player2 = bass
  Difficulty = 0
  PreviewStart = 45000
  PreviewEnd = 75000
  MediaType = "cd"
  MusicStream = "song.mp3"
}}"""

    chart = "\n".join(
        [
            song,
            "\n".join(sync),
            "\n".join(events),
            emit_track("ExpertDrums", expert, sp_phrases=sp, dynamics=True),
            emit_track("HardDrums", hard, dynamics=False),
            emit_track("MediumDrums", medium, dynamics=False),
            emit_track("EasyDrums", easy, dynamics=False),
            "",
        ]
    )

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "notes.chart").write_text(chart, encoding="utf-8")
    duration_ms = audio_duration_ms(audio, mid.length)
    ini = f"""[song]
name = {meta['name']}
artist = {meta['artist']}
album = {meta['album']}
genre = {meta['genre']}
year = {meta['year']}
charter = {meta['charter']}
diff_drums = 3
diff_drums_real = 4
pro_drums = True
song_length = {duration_ms}
preview_start_time = 45000
loading_phrase = Pro drums chart converted from MuseScore/GM drum MIDI. Playtest offset if needed.
"""
    (out_dir / "song.ini").write_text(ini, encoding="utf-8")
    shutil.copy2(midi_path, out_dir / "source_drums.mid")
    if audio and audio.exists():
        shutil.copy2(audio, out_dir / "song.mp3")

    print(f"Wrote {out_dir}")
    if unmapped:
        print("Unmapped pitches:", dict(unmapped))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("midi", type=Path)
    p.add_argument("--audio", type=Path, default=None)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--name", default="Unknown Song")
    p.add_argument("--artist", default="Unknown Artist")
    p.add_argument("--album", default="")
    p.add_argument("--genre", default="Rock")
    p.add_argument("--year", default="")
    p.add_argument("--charter", default="Cursor Agent (MIDI transcription)")
    args = p.parse_args()
    convert(
        args.midi,
        args.out,
        args.audio,
        {
            "name": args.name,
            "artist": args.artist,
            "album": args.album,
            "genre": args.genre,
            "year": args.year,
            "charter": args.charter,
        },
    )


if __name__ == "__main__":
    main()

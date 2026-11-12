#!/usr/bin/env python3
"""Convert a GM drum MIDI into a Clone Hero 4-lane Pro drums song pack.

Fast path:
  python charts/tools/midi_drums_to_chart.py song.mid --audio song.mp3 \\
    --name "Song" --artist "Artist" --zip
"""

from __future__ import annotations

import argparse
import math
import re
import shutil
import subprocess
import zipfile
from collections import defaultdict
from pathlib import Path

import mido

# GM pitch -> (lane, cymbal_marker_or_None)
# 0 kick, 1 red, 2 yellow, 3 blue, 4 green
# cym markers: 66 Y, 67 B, 68 G
DEFAULT_MAP = {
    35: (0, None),
    36: (0, None),
    37: (1, None),
    38: (1, None),
    39: (1, None),  # clap -> snare lane
    40: (1, None),
    42: (2, 66),  # closed HH
    44: (2, 66),  # pedal HH
    46: (2, 66),  # open HH
    50: (2, None),  # high tom
    48: (2, None),  # hi-mid tom
    47: (2, None),  # low-mid tom
    45: (3, None),  # low tom
    43: (4, None),  # high floor
    41: (4, None),  # low floor
    51: (3, 67),  # ride
    53: (3, 67),  # ride bell
    59: (3, 67),  # ride 2
    49: (2, 66),  # crash 1 -> yellow (pairs with crash2 for Y+G doubles)
    57: (4, 68),  # crash 2 -> green (common timekeeping / right crash)
    52: (3, 67),  # china -> blue
    55: (3, 67),  # splash -> blue
}


def slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name).strip()
    s = re.sub(r"[\s_]+", "_", s)
    return s or "song_pack"


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


def measure_ticks(res: int, timesigs: list[tuple[int, int, int]], tick: int) -> int:
    """Length in ticks of the measure containing `tick`."""
    num, den = 4, 4
    for t, n, d in timesigs:
        if t <= tick:
            num, den = n, d
        else:
            break
    # quarter-note resolution * beats in measure
    beat_ticks = res * 4 // den
    return beat_ticks * num


def first_note_tick(resolved: dict) -> int:
    return min(resolved) if resolved else 0


def reduce_hard(resolved, res, grid_origin: int):
    out = {}
    eighth = res // 2
    for t, items in resolved.items():
        kept = []
        for lane, cym, accent, _ghost in items:
            if lane == 2 and cym == 66:
                rel = t - grid_origin
                if rel % eighth != 0 and not accent:
                    others = [x for x in items if not (x[0] == 2 and x[1] == 66)]
                    if not others:
                        continue
            kept.append((lane, cym, accent, False))
        if kept:
            out[t] = kept
    return out


def reduce_medium(resolved, res, grid_origin: int):
    out = {}
    eighth = res // 2
    for t, items in resolved.items():
        kept = []
        for lane, cym, _accent, _ghost in items:
            rel = t - grid_origin
            if lane == 0:
                if rel % eighth == 0:
                    kept.append((lane, cym, False, False))
            elif lane == 1:
                kept.append((lane, cym, False, False))
            elif cym is not None:
                if cym == 66:
                    if rel % res == 0:
                        kept.append((lane, cym, False, False))
                else:
                    kept.append((lane, cym, False, False))
            elif rel % eighth == 0:
                kept.append((lane, cym, False, False))
        if kept:
            out[t] = kept
    return out


def reduce_easy(resolved, res, grid_origin: int):
    out = {}
    for t, items in resolved.items():
        kept = []
        for lane, cym, _accent, _ghost in items:
            rel = t - grid_origin
            if rel % res != 0 and t != grid_origin:
                continue
            beat = ((rel // res) % 4) if rel >= 0 else 0
            if lane == 0 and beat in (0, 2):
                kept.append((0, None, False, False))
            elif lane == 1 and beat in (1, 3):
                kept.append((1, None, False, False))
            elif cym in (66, 67, 68) and beat == 0:
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


def guess_sp_phrases(resolved, res, timesigs, count=6):
    if not resolved:
        return []
    origin = first_note_tick(resolved)
    last = max(resolved)
    bar = measure_ticks(res, timesigs, origin)
    # start a few bars after first hit
    starts = []
    t = origin + bar * 4
    while t + bar * 4 < last - bar and len(starts) < count:
        starts.append((t, bar * 4))
        t += bar * 12
    return starts


def convert(midi_path: Path, out_dir: Path, audio: Path | None, meta: dict, note_map=None):
    note_map = note_map or DEFAULT_MAP
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
        if pitch not in note_map:
            unmapped[pitch] += 1
            continue
        lane, cym = note_map[pitch]
        expert_raw[tick].append((lane, cym, vel, pitch))
    expert = {t: resolve_tick(v) for t, v in expert_raw.items()}
    grid_origin = first_note_tick(expert)
    # snap grid origin to beat before first note for reductions
    grid_origin = (grid_origin // res) * res

    hard = reduce_hard(expert, res, grid_origin)
    medium = reduce_medium(expert, res, grid_origin)
    easy = reduce_easy(expert, res, grid_origin)
    sp = guess_sp_phrases(expert, res, timesigs)

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

    last_note = max(expert) if expert else 0
    bar0 = measure_ticks(res, timesigs, grid_origin)
    events = ["[Events]", "{"]
    for i, label in enumerate(
        [
            "Intro",
            "Verse 1",
            "Chorus 1",
            "Verse 2",
            "Chorus 2",
            "Bridge",
            "Final",
        ]
    ):
        t = 0 if i == 0 else grid_origin + bar0 * (4 + (i - 1) * 8)
        if t <= last_note:
            events.append(f'  {t} = E "section {label}"')
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
diff_drums = 4
diff_drums_real = 5
pro_drums = True
song_length = {duration_ms}
preview_start_time = 45000
loading_phrase = Pro drums from MuseScore/GM MIDI. Playtest offset if needed.
"""
    (out_dir / "song.ini").write_text(ini, encoding="utf-8")
    shutil.copy2(midi_path, out_dir / "source_drums.mid")
    if audio and audio.exists():
        dest = out_dir / "song.mp3"
        if audio.suffix.lower() == ".mp3":
            shutil.copy2(audio, dest)
        else:
            subprocess.check_call(
                ["ffmpeg", "-y", "-i", str(audio), "-codec:a", "libmp3lame", "-q:a", "2", str(dest)]
            )

    readme = f"""# {meta['name']} — Clone Hero Pro Drums

Copy this folder into your Clone Hero `Songs` directory and rescan.

- Pro drums (`pro_drums = True`)
- Difficulties: Expert / Hard / Medium / Easy
- Source: MuseScore/GM drum MIDI
"""
    (out_dir / "README.md").write_text(readme, encoding="utf-8")

    def count_notes(resolved):
        n = sum(len(v) for v in resolved.values())
        c = sum(1 for items in resolved.values() for lane, cym, *_ in items if cym is not None)
        return n, c, len(resolved)

    stats = {
        "expert": count_notes(expert),
        "hard": count_notes(hard),
        "medium": count_notes(medium),
        "easy": count_notes(easy),
        "unmapped": dict(unmapped),
        "bpm": mido.tempo2bpm(tempos[0][1]),
        "first_note_tick": first_note_tick(expert),
        "sp": sp,
    }
    return stats


def write_zip(out_dir: Path, zip_path: Path):
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(out_dir.rglob("*")):
            if p.is_file() and p.name != "source_drums.mid":
                zf.write(p, arcname=str(Path(out_dir.name) / p.relative_to(out_dir)))
    return zip_path


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("midi", type=Path)
    p.add_argument("--audio", type=Path, default=None)
    p.add_argument("--out", type=Path, default=None, help="Song folder path")
    p.add_argument("--name", default="Unknown Song")
    p.add_argument("--artist", default="Unknown Artist")
    p.add_argument("--album", default="")
    p.add_argument("--genre", default="Rock")
    p.add_argument("--year", default="")
    p.add_argument("--charter", default="Cursor Agent (MIDI transcription)")
    p.add_argument("--zip", action="store_true", help="Also write a downloadable zip next to --out / workspace root")
    p.add_argument("--zip-path", type=Path, default=None)
    args = p.parse_args()

    out = args.out or Path("charts") / args.name
    stats = convert(
        args.midi,
        out,
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
    print(f"Wrote {out}")
    for label in ("expert", "hard", "medium", "easy"):
        n, c, ticks = stats[label]
        print(f"  {label}: {n} pads, {c} cymbals, {ticks} ticks")
    print(f"  bpm={stats['bpm']:.3f} first_note_tick={stats['first_note_tick']} sp={len(stats['sp'])}")
    if stats["unmapped"]:
        print("  Unmapped:", stats["unmapped"])

    if args.zip:
        zpath = args.zip_path or Path(f"{slugify(args.name)}_CloneHero.zip")
        write_zip(out, zpath)
        # also copy to artifacts for chat visibility
        art = Path("/opt/cursor/artifacts")
        if art.exists():
            shutil.copy2(zpath, art / zpath.name)
        print(f"Zip: {zpath.resolve()}")


if __name__ == "__main__":
    main()

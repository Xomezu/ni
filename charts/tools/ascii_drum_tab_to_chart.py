#!/usr/bin/env python3
"""
Hit-for-hit ASCII drum tab → Clone Hero Pro drums .chart

Every playable kit stroke in the source becomes a note. No thinning,
collapsing rolls/fills, or Expert approximations.

Lane map (4-lane Pro):
  BD → 0 kick
  SD/ES → 1 red snare
  HH → 2 yellow cymbal (66)
  RC/CR → 3 blue cymbal (67)   [crash-ride treated as ride/blue]
  CC → 4 green cymbal (68)
  ST → 2 yellow tom
  LT → 3 blue tom
  FT → 4 green tom
Tambourine (TB) is omitted (not a kit pad).
"""
from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path

RES = 480  # ticks per beat (quarter)
DIVS = 16  # columns per bar in these tabs
TICK_PER_COL = RES // (DIVS // 4)  # 16ths → 120 ticks

KIT_LINES = ("CC", "CR", "RC", "HH", "TB", "ES", "SD", "BD", "ST", "LT", "FT")

# Digitized / non-kit section names (case-insensitive startswith match)
DEFAULT_SKIP_PREFIXES = (
    "intro",
    "verse 1",
    "verse 2",
    "verse 3",
    "transition 3",
)


def parse_sections(tab_text: str):
    """Yield (section_name, list_of_bars) where each bar is {line: 16-char cells}."""
    lines = tab_text.splitlines()
    section = "Preamble"
    bars: list[dict[str, str]] = []
    # Accumulate parallel instrument rows into bars
    # Pattern: rows like "CC x-------|" repeating; blank line or section header ends group
    pending: dict[str, list[str]] = defaultdict(list)

    def flush_pending():
        nonlocal pending, bars
        if not pending:
            return
        # All instruments should have same number of bar chunks
        n = max(len(v) for v in pending.values())
        for i in range(n):
            bar = {}
            for inst, chunks in pending.items():
                if i < len(chunks):
                    bar[inst] = chunks[i]
            if bar:
                bars.append(bar)
        pending = defaultdict(list)

    def emit_section():
        nonlocal section, bars
        flush_pending()
        if bars:
            yield section, bars
        bars = []

    header_re = re.compile(
        r"^(Intro|Verse\s*\d+|Transition\s*\d+|Bridge\s*\d+|Chorus\s*\d+|Guitar solo|Outro)\s*:?\s*$",
        re.I,
    )
    row_re = re.compile(r"^([A-Z]{2})\s+(.+)$")

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            flush_pending()
            continue
        hm = header_re.match(line.strip())
        if hm:
            yield from emit_section()
            section = hm.group(1).strip()
            # normalize spacing: "Verse 1"
            section = re.sub(r"\s+", " ", section)
            # Title-case-ish
            section = section[0].upper() + section[1:]
            if section.lower().startswith("guitar"):
                section = "Guitar solo"
            continue
        rm = row_re.match(line)
        if not rm:
            continue
        inst, rest = rm.group(1), rm.group(2)
        if inst not in KIT_LINES:
            continue
        # Split on | into bar cells; keep only 16-char content (pad/truncate)
        parts = [p for p in rest.split("|") if p.strip() != "" or p == ""]
        # rest like "----------------|----------------|" → split gives cells
        cells = rest.split("|")
        # drop trailing empty after final |
        if cells and cells[-1].strip() == "":
            cells = cells[:-1]
        for cell in cells:
            cell = cell.replace(" ", "")
            # allow shorter/longer; normalize to 16
            if len(cell) < DIVS:
                cell = cell + "-" * (DIVS - len(cell))
            elif len(cell) > DIVS:
                cell = cell[:DIVS]
            pending[inst].append(cell)
    yield from emit_section()


def cell_hits(ch: str) -> bool:
    return ch not in ("-", " ")


def map_hit(inst: str, ch: str) -> list[tuple[int, bool]]:
    """Return list of (pad, is_tom). is_tom False → emit cymbal marker for 2/3/4."""
    if not cell_hits(ch):
        return []
    if inst in ("BD",):
        return [(0, False)]
    if inst in ("SD", "ES"):
        return [(1, False)]
    if inst == "HH":
        return [(2, False)]  # yellow cym
    if inst in ("RC", "CR"):
        return [(3, False)]  # blue cym
    if inst == "CC":
        return [(4, False)]  # green cym
    if inst == "ST":
        return [(2, True)]
    if inst == "LT":
        return [(3, True)]
    if inst == "FT":
        return [(4, True)]
    return []  # TB etc.


def section_is_skipped(name: str, skip_prefixes: tuple[str, ...]) -> bool:
    n = name.lower().strip()
    return any(n.startswith(p) for p in skip_prefixes)


ACOUSTIC_INST = ("CC", "CR", "RC", "SD", "ST", "LT", "FT", "BD")


def bar_has_acoustic_kit(bar: dict[str, str]) -> bool:
    """True if bar uses real kit voices (not only HH/ES/TB electronic groove)."""
    for inst in ("CC", "CR", "RC", "SD", "ST", "LT", "FT"):
        cells = bar.get(inst, "-" * DIVS)
        if any(cell_hits(c) for c in cells):
            return True
    return False


def instruments_for_bar(
    section: str, bar: dict[str, str], skip_prefixes: tuple[str, ...]
) -> set[str]:
    """Which instrument rows to emit for this bar (hit-for-hit within that set)."""
    if not section_is_skipped(section, skip_prefixes):
        return set(bar.keys()) - {"TB"}
    # Digitized section: only acoustic lead-in content (rolls/fills), not ES/HH/TB
    if not bar_has_acoustic_kit(bar):
        return set()
    return {inst for inst in bar if inst in ACOUSTIC_INST}


def build_notes(
    sections: list[tuple[str, list[dict[str, str]]]],
    skip_prefixes: tuple[str, ...],
    start_at_section: str | None = None,
):
    """
    Build absolute-tick notes from the start of the tab (or from start_at_section).
    Skipped digitized bars contribute time but no notes (unless acoustic lead-in).
    Returns notes dict tick→set of (pad, is_tom), events list, first_note_tick.
    """
    notes: dict[int, set[tuple[int, bool]]] = defaultdict(set)
    events: list[tuple[int, str]] = []
    tick = 0
    started = start_at_section is None
    first_note = None

    for name, bars in sections:
        if not started:
            if name.lower() == start_at_section.lower():
                started = True
            else:
                continue
        events.append((tick, name))
        for bar in bars:
            insts = instruments_for_bar(name, bar, skip_prefixes)
            if insts:
                for col in range(DIVS):
                    t = tick + col * TICK_PER_COL
                    for inst in insts:
                        cells = bar.get(inst)
                        if not cells:
                            continue
                        ch = cells[col]
                        for pad, is_tom in map_hit(inst, ch):
                            notes[t].add((pad, is_tom))
                            if first_note is None:
                                first_note = t
            tick += DIVS * TICK_PER_COL
    return notes, events, first_note, tick


def shift_to_zero(notes, events, first_note):
    """Shift so first note is at tick 0 (Clone Hero friendly with Offset)."""
    if first_note is None or first_note == 0:
        return notes, events, 0
    notes2 = {t - first_note: v for t, v in notes.items()}
    events2 = [(max(0, t - first_note), n) for t, n in events]
    # drop events that were before first note (keep one at 0 if needed)
    events2 = [(t, n) for t, n in events2 if t >= 0]
    return notes2, events2, first_note


def write_chart(
    path: Path,
    notes: dict[int, set[tuple[int, bool]]],
    events: list[tuple[int, str]],
    *,
    name: str,
    artist: str,
    album: str,
    year: str,
    genre: str,
    bpm: float,
    offset: float,
    charter: str,
    music: str = "song.mp3",
    end_tick: int | None = None,
):
    cym_marker = {2: 66, 3: 67, 4: 68}
    lines = []
    lines.append("[Song]")
    lines.append("{")
    lines.append(f'  Name = "{name}"')
    lines.append(f'  Artist = "{artist}"')
    lines.append(f'  Album = "{album}"')
    lines.append(f'  Genre = "{genre}"')
    lines.append(f'  Year = "{year}"')
    lines.append(f'  Charter = "{charter}"')
    lines.append(f"  Offset = {offset:.3f}")
    lines.append(f"  Resolution = {RES}")
    lines.append("  Player2 = bass")
    lines.append("  Difficulty = 0")
    lines.append("  PreviewStart = 90000")
    lines.append("  PreviewEnd = 120000")
    lines.append('  MediaType = "cd"')
    lines.append(f'  MusicStream = "{music}"')
    lines.append("}")
    lines.append("[SyncTrack]")
    lines.append("{")
    lines.append("  0 = TS 4")
    lines.append(f"  0 = B {int(round(bpm * 1000))}")
    lines.append("}")
    lines.append("[Events]")
    lines.append("{")
    for t, ev in events:
        lines.append(f'  {t} = E "section {ev}"')
    if end_tick is not None:
        lines.append(f'  {end_tick} = E "end"')
    lines.append("}")
    lines.append("[ExpertDrums]")
    lines.append("{")
    # Star power on alternating bridge/chorus/solo section starts (2 bars)
    sp_at: dict[int, int] = {}
    sp_ticks = [
        t
        for t, ev in events
        if any(k in ev.lower() for k in ("bridge", "chorus", "solo"))
    ]
    for i, t in enumerate(sp_ticks):
        if i % 2 == 0:
            sp_at[t] = 8 * RES

    for t in sorted(set(notes) | set(sp_at)):
        if t in sp_at:
            lines.append(f"  {t} = S 2 {sp_at[t]}")
        if t not in notes:
            continue
        pads = notes[t]
        # resolve tom vs cym on same pad: prefer tom if both
        by_pad: dict[int, bool] = {}
        for pad, is_tom in pads:
            if pad not in by_pad:
                by_pad[pad] = is_tom
            else:
                by_pad[pad] = by_pad[pad] or is_tom
        for pad in sorted(by_pad):
            is_tom = by_pad[pad]
            lines.append(f"  {t} = N {pad} 0")
            if pad in cym_marker and not is_tom:
                lines.append(f"  {t} = N {cym_marker[pad]} 0")
    lines.append("}")
    path.write_text("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tab", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--bpm", type=float, default=82.0)
    ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--name", default="Wounded")
    ap.add_argument("--artist", default="Third Eye Blind")
    ap.add_argument("--album", default="Blue")
    ap.add_argument("--year", default="1999")
    ap.add_argument("--genre", default="Alternative")
    ap.add_argument("--charter", default="Cursor Agent (hit-for-hit from Chris Rippin drum tab)")
    ap.add_argument(
        "--start-at",
        default="Transition 1",
        help="First section to include on the timeline (earlier digitized parts omitted)",
    )
    ap.add_argument(
        "--skip-prefix",
        action="append",
        default=None,
        help="Section name prefixes to treat as digitized (notes skipped unless acoustic). Repeatable.",
    )
    args = ap.parse_args()
    skip = tuple(p.lower() for p in (args.skip_prefix or list(DEFAULT_SKIP_PREFIXES)))
    # Always skip early verses/intro; also skip Transition 1 body except rolls —
    # Transition 1 is mostly empty + roll, so include the section but skip_prefixes
    # should NOT include transition 1 (we'd lose the roll). Transition 4 similar.
    # Add transition 4 to skip prefixes for electronic body; acoustic roll still emits.
    if args.skip_prefix is None:
        skip = DEFAULT_SKIP_PREFIXES + ("transition 4",)

    sections = list(parse_sections(args.tab.read_text()))
    print("Sections found:")
    for name, bars in sections:
        print(f"  {name}: {len(bars)} bars")

    notes, events, first_note, end_tick = build_notes(
        sections, skip_prefixes=skip, start_at_section=args.start_at
    )
    print(f"Raw first_note tick={first_note} end={end_tick} unique ticks={len(notes)}")
    notes, events, shift = shift_to_zero(notes, events, first_note)
    end2 = end_tick - shift if first_note is not None else end_tick
    # count pad hits
    total = sum(len(v) for v in notes.values())
    print(f"Shifted by {shift}; note-pad hits={total}; events={events[:4]}...")
    write_chart(
        args.out,
        notes,
        events,
        name=args.name,
        artist=args.artist,
        album=args.album,
        year=args.year,
        genre=args.genre,
        bpm=args.bpm,
        offset=args.offset,
        charter=args.charter,
        end_tick=end2,
    )
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()

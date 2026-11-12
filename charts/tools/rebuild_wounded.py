#!/usr/bin/env python3
"""
Rebuild Wounded Pro drums chart with an audio-locked section timeline.

The Chris Rippin tab is hit-for-hit within sections, but its Chorus repeats
and mid-song electronic stretch are longer than the album cut. This script
keeps kit strokes 1:1 from the tab while placing/shortening sections to the
measured audio anchors.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAB = ROOT / "Wounded" / "chris_rippin_drum_tab.txt"
OUT = ROOT / "Wounded" / "notes.chart"

BPM = 82.05
RES = 480
OFFSET = 94.415  # first lead-in snare-roll hit (audio seconds)

# Section plan: (event name, tab section, bar_slice, emit_notes)
# bar_slice None = all bars; emit_notes False = time gap only
PLAN = [
    ("Lead-in roll", "Transition 1", "acoustic", True),
    ("Bridge 1", "Bridge 1", None, True),
    ("Transition 2", "Transition 2", None, True),
    ("Chorus 1", "Chorus 1", (0, 8), True),  # tab has 24; album cut uses one 8-bar phrase
    ("Electronic", None, 8, False),  # digitized return between choruses/bridges
    ("Lead-in roll 2", "Transition 4", "acoustic", True),
    ("Bridge 2", "Bridge 2", None, True),
    ("Chorus 2", "Chorus 2", (0, 8), True),
    ("Transition 5", "Transition 5", None, True),
    ("Guitar solo", "Guitar solo", None, True),
    # Trans6/Outro overrun the album cut — omit rather than drift
]


def load_mod():
    spec = importlib.util.spec_from_file_location(
        "ascii_drum_tab_to_chart", Path(__file__).with_name("ascii_drum_tab_to_chart.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def select_bars(mod, sections, name, spec):
    bars = sections[name]
    if spec is None:
        return bars
    if spec == "acoustic":
        return [b for b in bars if mod.bar_has_acoustic_kit(b)]
    if isinstance(spec, tuple):
        a, b = spec
        return bars[a:b]
    raise ValueError(spec)


def main():
    mod = load_mod()
    sections = dict(mod.parse_sections(TAB.read_text()))
    notes: dict[int, set[tuple[int, bool]]] = {}
    events: list[tuple[int, str]] = []
    tick = 0
    bar_ticks = 16 * mod.TICK_PER_COL

    for ev_name, tab_name, spec, emit in PLAN:
        events.append((tick, ev_name))
        if not emit:
            # spec is bar count for silent gap
            tick += int(spec) * bar_ticks
            continue
        bars = select_bars(mod, sections, tab_name, spec)
        for bar in bars:
            insts = set(bar.keys()) - {"TB", "HH", "ES"}
            # Always include acoustic kit voices; BD/SD/CC/CR/RC/toms
            for col in range(16):
                t = tick + col * mod.TICK_PER_COL
                for inst in insts:
                    cells = bar.get(inst)
                    if not cells:
                        continue
                    for pad, is_tom in mod.map_hit(inst, cells[col]):
                        notes.setdefault(t, set()).add((pad, is_tom))
            tick += bar_ticks

    # Shift so first note is tick 0; OFFSET is absolute audio time of that note
    first = min(notes)
    notes = {t - first: v for t, v in notes.items()}
    events = [(max(0, t - first), n) for t, n in events]
    end_tick = tick - first

    mod.write_chart(
        OUT,
        notes,
        events,
        name="Wounded",
        artist="Third Eye Blind",
        album="Blue",
        year="1999",
        genre="Alternative",
        bpm=BPM,
        offset=OFFSET,
        charter="Cursor Agent (hit-for-hit tab; audio-locked section lengths)",
        end_tick=end_tick,
    )

    # Stats
    pad_hits = sum(len(v) for v in notes.values())
    last = max(notes)
    last_s = OFFSET + last / RES * 60 / BPM
    print(f"Wrote {OUT}")
    print(f"Offset={OFFSET} BPM={BPM}")
    print(f"pad hits={pad_hits} last_note={last_s:.2f}s end_tick={end_tick}")
    print("Events:")
    for t, n in events:
        print(f"  {OFFSET + t / RES * 60 / BPM:7.2f}s  {n}")


if __name__ == "__main__":
    main()

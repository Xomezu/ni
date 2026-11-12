#!/usr/bin/env python3
"""
Rebuild Wounded.

Rules:
- Offset 0 so the song audio plays from the start
- NO drum notes until the Bridge lead-in roll (~1:27)
- Kit phrases audio-anchored so the Trans2 end roll lands on the
  audible roll around 2:08
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAB = ROOT / "Wounded" / "chris_rippin_drum_tab.txt"
OUT = ROOT / "Wounded" / "notes.chart"

BPM = 82.05
RES = 480
BAR_SEC = 60.0 / BPM * 4
COL_SEC = 60.0 / BPM / 4

# Locked so: kit enter ~1:27, Trans2 end-fill snare roll ~2:08
KIT_FIRST_HIT = 87.45  # lead-in roll first snare
ROLL1_BAR = KIT_FIRST_HIT - 4 * COL_SEC
BRIDGE1 = KIT_FIRST_HIT + 12 * COL_SEC  # downbeat after 12 sixteenths of roll
BRIDGE1_BARS = 6  # album spacing between kit enter and Trans2
TRANS2 = BRIDGE1 + BRIDGE1_BARS * BAR_SEC
CHORUS1 = TRANS2 + 8 * BAR_SEC
# Digitized return — silence (no notes)
ROLL2_BAR = 195.130
BRIDGE2 = 196.055
TRANS5 = 216.900
SOLO = 238.496
OUTRO_T = 260.441


def load_mod():
    spec = importlib.util.spec_from_file_location(
        "ascii_drum_tab_to_chart", Path(__file__).with_name("ascii_drum_tab_to_chart.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def emit_bar(mod, notes, bar, bar_start_sec, offset):
    for col in range(16):
        t_sec = bar_start_sec + col * COL_SEC
        tick = int(round((t_sec - offset) / (60.0 / BPM) * RES))
        if tick < 0:
            continue
        for inst, cells in bar.items():
            if inst in ("TB", "HH", "ES"):
                continue  # no electronic notes — kit only after enter
            for pad, is_tom in mod.map_hit(inst, cells[col]):
                notes.setdefault(tick, set()).add((pad, is_tom))


def main():
    mod = load_mod()
    sections = dict(mod.parse_sections(TAB.read_text()))
    notes: dict[int, set[tuple[int, bool]]] = {}
    events: list[tuple[int, str]] = []
    offset = 0.0

    def add_event(t_sec: float, name: str):
        tick = int(round((t_sec - offset) / (60.0 / BPM) * RES))
        events.append((max(0, tick), name))

    add_event(0.0, "Intro (no drums)")
    add_event(KIT_FIRST_HIT, "Kit enter (lead-in roll)")

    plan = [
        ("Lead-in roll", [b for b in sections["Transition 1"] if mod.bar_has_acoustic_kit(b)], ROLL1_BAR),
        ("Bridge 1", sections["Bridge 1"][:BRIDGE1_BARS], BRIDGE1),
        ("Transition 2", sections["Transition 2"], TRANS2),
        ("Chorus 1", sections["Chorus 1"][:8], CHORUS1),
        ("Lead-in roll 2", [b for b in sections["Transition 4"] if mod.bar_has_acoustic_kit(b)], ROLL2_BAR),
        ("Bridge 2", sections["Bridge 2"], BRIDGE2),
        ("Transition 5", sections["Transition 5"], TRANS5),
        ("Guitar solo", sections["Guitar solo"], SOLO),
        ("Outro", sections["Outro"], OUTRO_T),
    ]

    for name, bars, t0 in plan:
        add_event(t0, name)
        for bi, bar in enumerate(bars):
            emit_bar(mod, notes, bar, t0 + bi * BAR_SEC, offset)

    if not notes:
        raise SystemExit("no notes")

    first = min(notes)
    first_sec = offset + first / RES * 60 / BPM
    assert first_sec >= 86.0, f"notes too early: {first_sec}"

    end_tick = max(notes) + RES * 4
    fill_snare = TRANS2 + 7 * BAR_SEC + 2 * COL_SEC

    mod.write_chart(
        OUT,
        notes,
        sorted(events, key=lambda x: x[0]),
        name="Wounded",
        artist="Third Eye Blind",
        album="Blue",
        year="1999",
        genre="Alternative",
        bpm=BPM,
        offset=offset,
        charter="Cursor Agent (no notes until kit enter ~1:27; 2:08 fill locked)",
        end_tick=end_tick,
    )

    print(f"Wrote {OUT}")
    print(f"BPM={BPM} Offset={offset}")
    print(f"first note ≈ {first_sec:.2f}s (1:{first_sec%60:05.2f})")
    print(f"Trans2 fill snare ≈ {fill_snare:.2f}s (2:{fill_snare%60:05.2f})")
    print(f"pad hits={sum(len(v) for v in notes.values())}")
    for t, n in sorted(events, key=lambda x: x[0]):
        sec = offset + t / RES * 60 / BPM
        print(f"  {int(sec)//60}:{sec%60:05.2f}  {n}")


if __name__ == "__main__":
    main()

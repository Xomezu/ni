#!/usr/bin/env python3
"""
Rebuild Wounded — full song from the start.

- Keeps the beginning: electronic intro/verse percussion is charted (HH/ES/BD).
- Full acoustic kit enters on the Bridge lead-in snare roll (~1:34 on this audio).
- Kit section lengths are audio-anchored so rolls sit in the correct parts of the song.
- Tab strokes stay hit-for-hit inside each used phrase.
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
COL_SEC = 60.0 / BPM / 4  # 16th

# Measured against charts/Wounded/song.mp3
ELEC_START = 17.650  # repeating verse groove locks here
ROLL1_BAR = 93.690  # lead-in roll bar start (first hit ≈ 94.42)
BRIDGE1 = ROLL1_BAR + BAR_SEC  # ≈ 96.615
# After 4-bar Bridge 1 (album cut; tab writes 8)
TRANS2 = BRIDGE1 + 4 * BAR_SEC
CHORUS1 = TRANS2 + 8 * BAR_SEC
# Digitized return — silent gap until second lead-in
ROLL2_BAR = 193.850
BRIDGE2 = ROLL2_BAR + BAR_SEC
# Extended outro refrain (album has no second “chorus” block like the tab)
TRANS5 = BRIDGE2 + 8 * BAR_SEC
SOLO = TRANS5 + 8 * BAR_SEC
OUTRO = SOLO + 8 * BAR_SEC


def load_mod():
    spec = importlib.util.spec_from_file_location(
        "ascii_drum_tab_to_chart", Path(__file__).with_name("ascii_drum_tab_to_chart.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def emit_bar(mod, notes, bar, bar_start_sec, offset, include_elec: bool):
    for col in range(16):
        t_sec = bar_start_sec + col * COL_SEC
        tick = int(round((t_sec - offset) / (60.0 / BPM) * RES))
        if tick < 0:
            continue
        for inst, cells in bar.items():
            if inst == "TB":
                continue
            if not include_elec and inst in ("HH", "ES"):
                continue
            for pad, is_tom in mod.map_hit(inst, cells[col]):
                notes.setdefault(tick, set()).add((pad, is_tom))


def main():
    mod = load_mod()
    sections = dict(mod.parse_sections(TAB.read_text()))
    notes: dict[int, set[tuple[int, bool]]] = {}
    events: list[tuple[int, str]] = []

    # Offset 0 → chart timeline matches the song from the start
    offset = 0.0

    def add_event(t_sec: float, name: str):
        tick = int(round((t_sec - offset) / (60.0 / BPM) * RES))
        events.append((max(0, tick), name))

    # --- Beginning: electronic groove through kit entry ---
    # Fill ELEC_START → ROLL1_BAR with repeating Verse-1 2-bar cell (hit-for-hit).
    groove = sections["Verse 1"][:2]
    n_elec_bars = int(round((ROLL1_BAR - ELEC_START) / BAR_SEC))
    add_event(ELEC_START, "Intro / Verses (electronic)")
    # Split event labels roughly like the tab
    third = max(1, n_elec_bars // 3)
    for i in range(n_elec_bars):
        t0 = ELEC_START + i * BAR_SEC
        if i == third:
            add_event(t0, "Verse")
        if i == 2 * third:
            add_event(t0, "Transition")
        emit_bar(mod, notes, groove[i % 2], t0, offset, include_elec=True)

    # --- Kit: audio-anchored phrases ---
    plan = [
        ("Lead-in roll", [b for b in sections["Transition 1"] if mod.bar_has_acoustic_kit(b)], ROLL1_BAR, False),
        ("Bridge 1", sections["Bridge 1"][:4], BRIDGE1, False),
        ("Transition 2", sections["Transition 2"], TRANS2, False),
        ("Chorus 1", sections["Chorus 1"][:8], CHORUS1, False),
        ("Lead-in roll 2", [b for b in sections["Transition 4"] if mod.bar_has_acoustic_kit(b)], ROLL2_BAR, False),
        ("Bridge 2", sections["Bridge 2"], BRIDGE2, False),
        ("Transition 5", sections["Transition 5"], TRANS5, False),
        ("Guitar solo", sections["Guitar solo"], SOLO, False),
        ("Outro", sections["Outro"], OUTRO, False),
    ]
    add_event(ROLL1_BAR + 4 * COL_SEC, "Kit enter (lead-in roll)")
    for name, bars, t0, elec in plan:
        add_event(t0, name)
        for bi, bar in enumerate(bars):
            emit_bar(mod, notes, bar, t0 + bi * BAR_SEC, offset, include_elec=elec)

    if not notes:
        raise SystemExit("no notes")

    # Keep absolute timeline (Offset=0); do not shift first note to 0
    end_tick = max(notes) + RES * 4
    # Deduplicate events at same tick (keep last label order unique-ish)
    events_sorted = sorted(events, key=lambda x: x[0])

    mod.write_chart(
        OUT,
        notes,
        events_sorted,
        name="Wounded",
        artist="Third Eye Blind",
        album="Blue",
        year="1999",
        genre="Alternative",
        bpm=BPM,
        offset=offset,
        charter="Cursor Agent (full song; kit from lead-in roll; audio-anchored)",
        end_tick=end_tick,
    )

    first_tick = min(notes)
    first_sec = offset + first_tick / RES * 60 / BPM
    kit_sec = ROLL1_BAR + 4 * COL_SEC
    print(f"Wrote {OUT}")
    print(f"BPM={BPM} Offset={offset}")
    print(f"first note ≈ {first_sec:.2f}s | kit lead-in hit ≈ {kit_sec:.2f}s | bridge ≈ {BRIDGE1:.2f}s")
    print(f"pad hits={sum(len(v) for v in notes.values())}")
    for t, n in events_sorted:
        print(f"  {offset + t / RES * 60 / BPM:7.2f}s  {n}")


if __name__ == "__main__":
    main()

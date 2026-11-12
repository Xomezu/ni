# Clone Hero Pro Drums — Standing Chart Standard

This document governs **all future drum charts** in this project (not only Wounded).
Reference packs in `charts/references/` are training data. Learn patterns from them;
do **not** copy outliers blindly. Goal: charts that feel like playing the real song.

## Sources of truth (priority order)
1. **What a drummer plays** (studio/live kit) — sheet music, drum MIDI, trusted transcriptions
2. **The song audio** — sync, kit entry time, feel
3. **Reference CH/RB charts** — style, density, pro lane habits (vet for quality)
4. Never invent simplified “rhythm game” parts that omit real rolls/fills

## Hard rules
1. **4-lane Pro drums**
   - Kick / Red snare / Y–B–G pads
   - Y/B/G are **cymbals by default**; mark toms only when toms are played
   - Typical map: hats→Y cym, ride→B cym, crash→G cym (adjust for motion/contrast)
2. **Sheet-accurate mapping**
   - Every playable kit hit on the sheet should appear (including snare rolls hit-for-hit)
   - Do not collapse rolls, flams, or fills into a few placeholder notes
3. **Kit entry**
   - No notes before the real kit enters
   - Skip digitized/electronic non-kit intros unless they are clearly meant as kit parts
4. **Sync**
   - Lock BPM/tempo map to audio
   - Compute Offset from kit entry / onset alignment before shipping
   - Playtest window: median hit error should be tight mid-song
5. **Consistency over any single reference**
   - Prefer fair sticking/motion on a Pro kit
   - Same instrument → same lane within a song section unless contrast requires a change
6. **Difficulties**
   - Expert = full musical part (sheet-faithful)
   - Hard/Med/Easy = reductions of Expert, not separate guesses
7. **Deliverable**
   - `notes.chart` + `song.ini` (`pro_drums = True`) + user audio
   - Credit sheet/MIDI source in charter/loading phrase

## Workflow for every new song
1. Gather sheet/MIDI transcription + audio
2. Identify real kit entry timestamp
3. Map kit → Pro lanes (rolls intact)
4. Sync Offset/BPM to audio
5. Generate lower diffs + SP
6. Compare feel against reference habits (not note-for-note copy)
7. Ship zip only after sync check

## Reference library
See `charts/references/STYLE_NOTES.md` for per-chart stats from ingested Harmonix/community packs.

**Known outliers (do not copy blindly):**
- **Late kit entry** (Battery ~43s, AJFA ~33s, Running Free ~29s) — fine when the song truly waits; not a reason to delay kit that starts earlier.
- **Yellow-only / no blue cym** (Let There Be Rock) — hats-dominated mapping; still use blue for ride/contrast when the kit has it.
- **Extreme tom-marker sustains** (Rhiannon ~95% tom ratio) — likely a charting quirk; keep tom ratio near the library median (~6%) unless the song is actually tom-heavy.
- **Roll density swings** (Everlong/Brightside ~87–88 roll phrases vs many dense charts with 0) — write rolls when the recording has them; absence in a ref is not permission to omit them.
- **Lane color bias varies song-to-song** — match the real kit first; refs are habit checks, not note-for-note laws.

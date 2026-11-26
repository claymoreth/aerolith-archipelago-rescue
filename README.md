# AEROLITH: ARCHIPELAGO RESCUE

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/claymoreth/aerolith-archipelago-rescue/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/claymoreth/aerolith-archipelago-rescue/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D arcade flight game built with Three.js for the [best-flight-game-20261126-0057 bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly the original Aerolith K-1 Kestrel bush plane across a tropical archipelago: five islands, a volcano, a lighthouse, palm beaches, drifting clouds — and three missions that actually test your flying.

## Missions

1. **Ring Run** (4:00) — fly through 5 glowing rings in order. Each ring is +100, plus a time bonus.
2. **Supply Drop** (5:00) — fly to Far Atoll and press Space to drop supplies inside the marked zone.
3. **Volcano Rescue** (6:00) — fly low over the Volcano Isle helipad to pick up a stranded hiker, then fly home and make a precision landing on the home runway. Landing accuracy is scored from centreline offset, touchdown zone, speed, sink rate and heading.
4. **Free Flight** — no timer, no score pressure. Explore the islands.

## Controls

| Key | Action |
| --- | --- |
| W / S | Throttle up / down |
| Arrow Up / Down | Pitch |
| Arrow Left / Right | Roll |
| Q / E | Yaw (rudder) |
| Space | Drop supplies (M2) |
| C | Toggle chase / cockpit camera |
| P | Pause |
| R | Restart mission |
| M | Mute |
| Enter | Start (from menu) |
| 1–4 | Pick mission (from menu) |
| Mouse drag | Look around |

## Flying notes

- You need speed above ~28 kt or the wing stalls and you sink. Takeoff speed is ~55 kt — hold W on the runway, then pull up.
- Fuel burns with throttle. Run dry and you glide: find a beach or the runway.
- A hard impact with terrain or water ends the mission. Land gently, slow, and on the centreline for a high accuracy score.

## Run locally

```sh
# Node 22
npx tsc serve.ts --module nodenext --target es2022 --outDir /tmp/aerolith-serve
# or simply serve game/ with any static server on port 8080
```

Then open `http://localhost:8080/` and pick a mission.

## Tech

- Three.js r187 (vendored locally, no network references in the game)
- Deterministic seeded world generation (seed 1)
- Procedural WebAudio engine/wind/chimes — no audio files
- InstancedMesh palms, 2048 shadow map, fog for depth — targets 60 FPS on desktop

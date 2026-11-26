// AEROLITH: ARCHIPELAGO RESCUE — build entrypoint (Node 22, stdlib only).
// Copies the game and screenshots into the output directory, then writes
// dossier.json describing the submission for the make.fun harness.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.MAKEFUN_BOT_DIR
  ? resolve(process.env.MAKEFUN_BOT_DIR)
  : here;
const out = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

mkdirSync(out, { recursive: true });

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(gameDir)) {
  cpSync(gameDir, join(out, 'game'), { recursive: true });
}
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

const dossier = await buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(out, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n');
console.log('AEROLITH dossier written to ' + join(out, 'dossier.json'));

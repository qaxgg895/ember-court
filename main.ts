// Ember Court, the hand-in (Node 22, standard library only): the game is this
// directory's game/ folder — plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library, no network request) — and this
// program hands it in. It copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads, with
// the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// The gate's own limits, checked here before anything is handed in, so a bad
// screenshot or an oversized index.html fails loudly on this machine instead
// of quietly on the server: 3 to 4 screenshots, each a whole PNG or JPEG of at
// most 256 KiB, and game/index.html a regular file of at most 1 MiB.
const shotNames = existsSync(shotsDir) ? readdirSync(shotsDir).sort() : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`screenshots/ holds ${shotNames.length} images, the gate wants 3 or 4`);
}
for (const name of shotNames) {
  const file = join(shotsDir, name);
  const stats = statSync(file);
  if (!stats.isFile()) throw new Error(`screenshots/${name} is not a regular file`);
  if (!/\.(png|jpe?g)$/i.test(name)) throw new Error(`screenshots/${name} is not a PNG or JPEG`);
  if (stats.size > 262144) throw new Error(`screenshots/${name} is ${stats.size} bytes, over the 256 KiB cap`);
}
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: the entry has no game to hand in');
}
const indexStats = statSync(join(gameDir, 'index.html'));
if (!indexStats.isFile() || indexStats.size > 1048576) {
  throw new Error('game/index.html is not a regular file or is over the 1 MiB cap');
}

/** Count the regular files under a directory, recursively. */
function countFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    count += entry.isDirectory() ? countFiles(path) : entry.isFile() ? 1 : 0;
  }
  return count;
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Ember Court handed in: ${countFiles(gameDir)} game files, ${shotNames.length} screenshots (${shotNames.join(', ')})`);

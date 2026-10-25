#!/usr/bin/env node
// Compile every dream cycle config (this repo's own dream.config.json plus
// targets/*.dream.json) into docs/dream-cycle/compiled/<name>.md. These mirrors
// are build outputs; packages/compile/src/targets.test.ts fails if any drifts
// from what compile() produces. Paste a mirror into its scheduled task to deploy.
//   node scripts/compile-targets.mjs           write mirrors
//   node scripts/compile-targets.mjs --check   exit 1 if any mirror is stale
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { compile } from '../packages/compile/dist/index.js';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'docs/dream-cycle/compiled');
const check = process.argv.includes('--check');
const sources = [['ruvnet-dream-machine', join(root, 'dream.config.json')]];
for (const f of readdirSync(join(root, 'targets')).filter((f) => f.endsWith('.dream.json')).sort()) {
  sources.push([basename(f, '.dream.json'), join(root, 'targets', f)]);
}
mkdirSync(out, { recursive: true });
let stale = 0;
for (const [name, path] of sources) {
  const prompt = compile(JSON.parse(readFileSync(path, 'utf8')));
  const dest = join(out, `${name}.md`);
  if (check) {
    if (!existsSync(dest) || readFileSync(dest, 'utf8') !== prompt) {
      console.error(`stale: ${dest}`);
      stale++;
    }
  } else {
    writeFileSync(dest, prompt);
    console.log(`compiled ${name} (${prompt.length} bytes)`);
  }
}
process.exit(stale ? 1 : 0);

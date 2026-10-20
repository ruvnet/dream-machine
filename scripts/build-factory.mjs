#!/usr/bin/env node
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const target = new URL('packages/cli/dist/', root);
mkdirSync(new URL('factory/', target), { recursive: true });
for (const name of ['software-factory.mjs', 'factory/core.mjs', 'factory/artifacts.mjs', 'factory/gist.mjs']) {
  copyFileSync(new URL(`scripts/${name}`, root), new URL(name, target));
}
console.log(`Factory CLI copied to ${fileURLToPath(target)}`);

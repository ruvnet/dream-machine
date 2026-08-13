#!/usr/bin/env node
/** The real executable: wires `run` to the process + node fs. */
import { readFile, writeFile } from 'node:fs/promises';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { run, type IO } from './index.js';

const exec = promisify(execCb);

const io: IO = {
  readFile: (p) => readFile(p, 'utf8'),
  writeFile: (p, c) => writeFile(p, c, 'utf8'),
  now: () => new Date().toISOString().slice(0, 10),
  env: process.env,
  exec: async (cmd) => {
    try {
      // 10x Node's 1 MiB default maxBuffer: a verbose `bench: npm test` run in a larger
      // monorepo can plausibly exceed the default, which would otherwise reject and get
      // misclassified as `blocked` even though the entrypoint is genuinely live.
      const { stdout, stderr } = await exec(cmd, { maxBuffer: 10 * 1024 * 1024 });
      return { code: 0, stdout, stderr };
    } catch (e) {
      const err = e as { code?: unknown; stdout?: string; stderr?: string };
      // Some exec failures (e.g. ERR_CHILD_PROCESS_STDOUT_MAXBUFFER) set `code` to a
      // string, not a number — coerce defensively so ExecResult's `code: number` contract
      // actually holds at runtime.
      const code = typeof err.code === 'number' ? err.code : 1;
      return { code, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
  },
};

run(process.argv.slice(2), io).then((r) => {
  if (r.out) process.stdout.write(r.out);
  if (r.err) process.stderr.write(r.err);
  process.exit(r.code);
});

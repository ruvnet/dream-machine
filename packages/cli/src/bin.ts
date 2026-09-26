#!/usr/bin/env node
/** The real executable: wires `run` to the process + node fs. */
import { readFile, writeFile, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { exec as execCb, execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { run, type IO } from './index.js';

const exec = promisify(execCb);
const execFile = promisify(execFileCb);

async function readEvidenceFile(path: string): Promise<string> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 24 * 1024 * 1024) throw new Error('INVALID_INPUT');
    const bytes = await handle.readFile();
    if (bytes.length > 24 * 1024 * 1024) throw new Error('INVALID_INPUT');
    return bytes.toString('utf8');
  } finally {
    await handle.close();
  }
}

const io: IO = {
  readFile: (p) => readFile(p, 'utf8'),
  readEvidenceFile,
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
  execFile: async (file, args) => {
    try {
      // Deliberately no `shell: true` — argv reaches the child process as-is,
      // never interpreted by a shell. See entrypoint.ts's tokenizeCommand.
      const { stdout, stderr } = await execFile(file, args, { maxBuffer: 10 * 1024 * 1024 });
      return { code: 0, stdout, stderr };
    } catch (e) {
      const err = e as { code?: unknown; stdout?: string; stderr?: string };
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

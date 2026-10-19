#!/usr/bin/env node
/** The real executable: wires `run` to the process + node fs. */
import { readFile, writeFile, open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { exec as execCb, execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
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

/** Factory, not a singleton, so tests can construct one against real child processes. */
export function createIO(): IO {
  return {
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
        const err = e as { code?: unknown; stdout?: string; stderr?: string; message?: string };
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
        const err = e as { code?: unknown; stdout?: string; stderr?: string; message?: string };
        const code = typeof err.code === 'number' ? err.code : 1;
        // Reproduced live 2026-09-27: a real exit code is always numeric. A
        // non-numeric `code` (e.g. 'ENOENT', 'EACCES') means the child never
        // actually spawned. Unlike `exec` above (a shell absorbs a missing
        // command into a real numeric exit code plus a shell-authored stderr
        // line — confirmed live: code 127 + "sh: 1: <cmd>: not found"),
        // `execFile` has no shell to do that: both stdout and stderr come
        // back as empty strings, and only `err.message` ("spawn <file>
        // ENOENT") carries the diagnostic. Falling through with the bare
        // empty stderr would make classifyEntrypointResult report "exited 1
        // with no stderr" — indistinguishable from a command that ran and
        // failed silently, when the entrypoint never ran at all.
        const stderr = err.stderr || (typeof err.code === 'number' ? undefined : err.message) || '';
        return { code, stdout: err.stdout ?? '', stderr };
      }
    },
  };
}

/**
 * True only when this file is the actual process entry point, never when it
 * is `import`-ed (e.g. by `bin.test.ts`, for `createIO()`). Deliberately not
 * the bare `import.meta.url === \`file://${process.argv[1]}\`` idiom this
 * repo's own ADR-0002 diagnosed as broken: this package's own `bin` field
 * (`dream-machine: dist/bin.js`) means `npm`/`npx` reach this file through a
 * symlink, so `process.argv[1]` and `import.meta.url` can point at the same
 * file via two different paths and fail a bare string comparison. Resolving
 * both through `realpath` first is exactly the fix ADR-0002 called for.
 */
async function isEntryPoint(): Promise<boolean> {
  if (!process.argv[1]) return false;
  try {
    const [self, invoked] = await Promise.all([
      realpath(fileURLToPath(import.meta.url)),
      realpath(process.argv[1]),
    ]);
    return self === invoked;
  } catch {
    return false;
  }
}

isEntryPoint().then((isMain) => {
  if (!isMain) return;
  run(process.argv.slice(2), createIO()).then((r) => {
    if (r.out) process.stdout.write(r.out);
    if (r.err) process.stderr.write(r.err);
    process.exit(r.code);
  });
});

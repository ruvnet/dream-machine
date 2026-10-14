import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIO } from './bin.js';

// bin.ts is the real IO wiring behind every CLI command (`verify-entrypoint`,
// `verify-entrypoints`, `witness stamp`, ...) — until 2026-09-27 it had zero
// test coverage. These exercise real child processes (no mocking): the whole
// point is proving what Node's `exec`/`execFile` actually hand back on a
// genuine spawn failure, which a mock would have to assume correctly anyway.

describe('createIO().execFile', () => {
  it('reports a live command as code 0 with real stdout', async () => {
    const io = createIO();
    const result = await io.execFile!('node', ['--version']);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toMatch(/^v\d/);
  });

  it('reports a command that spawns and exits nonzero unchanged (not a spawn failure)', async () => {
    const io = createIO();
    const result = await io.execFile!('node', ['-e', 'process.exit(3)']);
    expect(result.code).toBe(3);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('surfaces the real spawn diagnostic when the command does not exist (reproduces 2026-09-27 finding)', async () => {
    const io = createIO();
    const result = await io.execFile!('dream-machine-nightly-nonexistent-xyz', ['a', 'b']);
    // Before the fix: `code: 1, stdout: '', stderr: ''` — indistinguishable
    // from a command that ran and silently exited 1.
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/ENOENT/);
    expect(result.stderr).toMatch(/dream-machine-nightly-nonexistent-xyz/);
  });
});

describe('createIO().exec', () => {
  it('reports a live command as code 0 with real stdout', async () => {
    const io = createIO();
    const result = await io.exec!('echo hi');
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('hi');
  });

  it('already turns a missing command into a real numeric exit code and shell stderr (unaffected by this fix)', async () => {
    const io = createIO();
    const result = await io.exec!('dream-machine-nightly-nonexistent-xyz');
    expect(result.code).toBe(127);
    expect(result.stderr).toMatch(/dream-machine-nightly-nonexistent-xyz/);
  });
});

// The entry-point guard (`isEntryPoint()`) is unexported and load-bearing:
// get it wrong and the real CLI silently stops dispatching at all (the
// exact failure class this repo's own ADR-0002 documents for a different
// package). Verified by actually spawning the *built* dist/bin.js — the
// literal way this repo's own nightly pipeline invokes it — both directly
// and through a symlink (reproducing the npm/npx `bin`-field symlink shape
// ADR-0002 describes). Flagged by tonight's independent critic as the one
// gap worth closing before merge (2026-09-27 review).
describe('bin.js entry-point dispatch (built dist, spawned as a real process)', () => {
  const distBin = fileURLToPath(new URL('../dist/bin.js', import.meta.url));
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  });

  it('dispatches when invoked directly, the real deployment path', () => {
    const stdout = execFileSync(process.execPath, [distBin, 'version'], { encoding: 'utf8' });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('still dispatches when reached through a symlink (the npm/npx `bin`-field shape)', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'dream-machine-bin-symlink-'));
    const link = join(tmpDir, 'dream-machine');
    symlinkSync(distBin, link);
    const stdout = execFileSync(process.execPath, [link, 'version'], { encoding: 'utf8' });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

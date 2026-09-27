import { describe, it, expect } from 'vitest';
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

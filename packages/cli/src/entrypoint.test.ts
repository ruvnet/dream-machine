import { describe, it, expect } from 'vitest';
import { classifyEntrypointResult, tokenizeCommand, looksLikeCompoundCommand } from './entrypoint.js';

describe('tokenizeCommand', () => {
  it('splits a plain command on whitespace', () => {
    expect(tokenizeCommand('npm test')).toEqual(['npm', 'test']);
  });

  it('keeps a double-quoted segment as one token', () => {
    expect(tokenizeCommand('npx @metaharness/darwin evolve . --sandbox mock')).toEqual([
      'npx',
      '@metaharness/darwin',
      'evolve',
      '.',
      '--sandbox',
      'mock',
    ]);
    expect(tokenizeCommand('echo "hello world" --flag')).toEqual(['echo', 'hello world', '--flag']);
  });

  it('does not treat shell metacharacters specially — they stay literal argv text', () => {
    // The whole point: `&&` here must reach the child process as one inert token,
    // never as a shell operator chaining a second command (reproduces #17's
    // 2026-08-17 injection probe: `echo hi && touch PWNED`).
    expect(tokenizeCommand('echo hi && touch PWNED')).toEqual(['echo', 'hi', '&&', 'touch', 'PWNED']);
  });

  it('collapses repeated whitespace and trims', () => {
    expect(tokenizeCommand('  npm   test  ')).toEqual(['npm', 'test']);
  });

  it('returns an empty array for a blank command', () => {
    expect(tokenizeCommand('')).toEqual([]);
    expect(tokenizeCommand('   ')).toEqual([]);
  });
});

describe('looksLikeCompoundCommand', () => {
  it('flags this repo\'s own real darwin entry as compound (reproduces PR #116 review)', () => {
    const argv = tokenizeCommand('rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox mock');
    expect(looksLikeCompoundCommand(argv)).toBe(true);
  });

  it('flags a leading control operator', () => {
    expect(looksLikeCompoundCommand(tokenizeCommand('&& echo hi'))).toBe(true);
  });

  it('flags ;, |, ||, and & the same way as && (as a standalone, whitespace-separated token)', () => {
    // tokenizeCommand splits on whitespace only, so this check only catches a control
    // operator that appears as its own token (`cmd1 ; cmd2`) — the same known,
    // whitespace-based scope tokenizeCommand's own doc comment already discloses.
    // `cmd1;cmd2` (no surrounding spaces) is not caught; every real evaluatorEntrypoints
    // value observed in this repo uses spaced operators (e.g. `rm ... && npx ...`).
    expect(looksLikeCompoundCommand(tokenizeCommand('echo hi ; echo bye'))).toBe(true);
    expect(looksLikeCompoundCommand(tokenizeCommand('echo hi | cat'))).toBe(true);
    expect(looksLikeCompoundCommand(tokenizeCommand('echo hi || echo bye'))).toBe(true);
    expect(looksLikeCompoundCommand(tokenizeCommand('echo hi &'))).toBe(true);
  });

  it('does not flag a plain single command', () => {
    expect(looksLikeCompoundCommand(tokenizeCommand('npm test'))).toBe(false);
    expect(looksLikeCompoundCommand(tokenizeCommand('npx @metaharness/darwin evolve . --sandbox mock'))).toBe(false);
  });

  it('does not flag an operator character embedded inside a larger token', () => {
    // Only a standalone `&&`/`;`/`|`/`||`/`&` token counts — a package name or
    // flag that happens to contain one of these characters mid-string does not.
    expect(looksLikeCompoundCommand(['echo', 'a&b'])).toBe(false);
  });
});

describe('classifyEntrypointResult', () => {
  it('flags a nonzero exit as blocked (reproduces npx @metaharness/flywheel: no bin field)', () => {
    const r = classifyEntrypointResult({
      code: 1,
      stdout: '',
      stderr: 'npm error could not determine executable to run',
    });
    expect(r.verdict).toBe('blocked');
    expect(r.reason).toContain('could not determine executable to run');
  });

  it('flags exit 0 + empty stdout/stderr as suspicious-silent (reproduces npx @metaharness/redblue)', () => {
    const r = classifyEntrypointResult({ code: 0, stdout: '', stderr: '' });
    expect(r.verdict).toBe('suspicious-silent');
    expect(r.reason).toContain('indistinguishable from');
  });

  it('flags exit 0 + whitespace-only output as suspicious-silent, not live', () => {
    const r = classifyEntrypointResult({ code: 0, stdout: '  \n\t', stderr: '' });
    expect(r.verdict).toBe('suspicious-silent');
  });

  it('treats exit 0 + real stdout as live (reproduces npx @metaharness/darwin --version usage text)', () => {
    const r = classifyEntrypointResult({
      code: 0,
      stdout: 'usage: metaharness-darwin <evolve|bench|security> …',
      stderr: '',
    });
    expect(r.verdict).toBe('live');
  });

  it('treats exit 0 + stderr-only output as live (bench entrypoint may log to stderr)', () => {
    const r = classifyEntrypointResult({ code: 0, stdout: '', stderr: 'warning: slow test detected' });
    expect(r.verdict).toBe('live');
  });

  it('flags a leftover-state collision as stale-state, not blocked (reproduces `npx @metaharness/darwin evolve . --sandbox mock` run twice in the same checkout)', () => {
    const r = classifyEntrypointResult({
      code: 1,
      stdout: '',
      stderr:
        'Error: darwin: autonomous or generated child id already exists: g1_v0\n' +
        '    at evolve (file:///.../node_modules/@metaharness/darwin/dist/evolve.js:280:27)',
    });
    expect(r.verdict).toBe('stale-state');
    expect(r.reason).toContain('already exists');
    expect(r.reason).toContain('Clear that state and re-run');
  });

  it('does not flag an unrelated nonzero-exit failure as stale-state', () => {
    const r = classifyEntrypointResult({ code: 1, stdout: '', stderr: 'npm error could not determine executable to run' });
    expect(r.verdict).toBe('blocked');
  });
});

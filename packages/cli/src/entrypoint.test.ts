import { describe, it, expect } from 'vitest';
import { classifyEntrypointResult, tokenizeCommand } from './entrypoint.js';

describe('tokenizeCommand', () => {
  it('splits plain whitespace-separated commands (this repo’s real entrypoints)', () => {
    expect(tokenizeCommand('npm test')).toEqual(['npm', 'test']);
    expect(tokenizeCommand('npx @metaharness/darwin evolve --sandbox mock')).toEqual([
      'npx',
      '@metaharness/darwin',
      'evolve',
      '--sandbox',
      'mock',
    ]);
  });

  it('keeps a double-quoted segment as one token', () => {
    expect(tokenizeCommand('echo "hello world" --flag')).toEqual(['echo', 'hello world', '--flag']);
  });

  it('never re-splits on shell metacharacters — they become literal argv text, not shell syntax', () => {
    expect(tokenizeCommand('npm test && rm -rf /')).toEqual(['npm', 'test', '&&', 'rm', '-rf', '/']);
    expect(tokenizeCommand('echo $(whoami)')).toEqual(['echo', '$(whoami)']);
  });

  it('collapses repeated whitespace and trims', () => {
    expect(tokenizeCommand('  npm   test  ')).toEqual(['npm', 'test']);
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
});

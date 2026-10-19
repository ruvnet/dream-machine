import { describe, it, expect } from 'vitest';
import { classifyEntrypointResult, tokenizeCommand, looksLikeCompoundCommand, invokesShellInterpreter } from './entrypoint.js';

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

  it('does NOT flag a shell-interpreter escape hiding behind -c (the gap invokesShellInterpreter exists for)', () => {
    // tokenizeCommand's double-quote handling correctly folds the whole -c payload
    // into one token, so `&&`/`;`/`|` never appear as a standalone argv entry here —
    // this check alone is blind to the live-reproduced bypass below.
    expect(looksLikeCompoundCommand(tokenizeCommand('sh -c "echo a && echo b"'))).toBe(false);
  });
});

describe('invokesShellInterpreter', () => {
  it('flags sh/bash/zsh/dash/ash/ksh given -c', () => {
    for (const shell of ['sh', 'bash', 'zsh', 'dash', 'ash', 'ksh']) {
      expect(invokesShellInterpreter([shell, '-c', 'echo a && echo b'])).toBe(true);
    }
  });

  it('flags a path to an interpreter, not just a bare basename', () => {
    expect(invokesShellInterpreter(['/bin/bash', '-c', 'echo a && echo b'])).toBe(true);
    expect(invokesShellInterpreter(['/usr/bin/sh', '-c', 'echo hi'])).toBe(true);
  });

  it('flags -c anywhere in the remaining args, not only immediately after the interpreter', () => {
    expect(invokesShellInterpreter(['sh', '-x', '-c', 'echo hi'])).toBe(true);
  });

  it('reproduces the live finding: wrapping darwin\'s entrypoint in sh -c hides && from looksLikeCompoundCommand', () => {
    const argv = tokenizeCommand('sh -c "echo PWNED > out.txt && npx @metaharness/darwin@latest evolve"');
    expect(looksLikeCompoundCommand(argv)).toBe(false);
    expect(invokesShellInterpreter(argv)).toBe(true);
  });

  it('does not flag a plain, non-shell command', () => {
    expect(invokesShellInterpreter(tokenizeCommand('npm test'))).toBe(false);
    expect(invokesShellInterpreter(tokenizeCommand('npx @metaharness/darwin evolve . --sandbox mock'))).toBe(false);
  });

  it('does not flag a shell interpreter invoked without -c (e.g. an interactive/login shell)', () => {
    expect(invokesShellInterpreter(['bash', '-i'])).toBe(false);
    expect(invokesShellInterpreter(['bash'])).toBe(false);
  });

  it('does not flag a package or argument that merely contains "sh" or "-c" as a substring', () => {
    expect(invokesShellInterpreter(['npx', 'cowsay-cli', '-config', 'x'])).toBe(false);
    expect(invokesShellInterpreter(['bash-completion-helper', '-c', 'x'])).toBe(false);
  });

  it('returns false for an empty argv', () => {
    expect(invokesShellInterpreter([])).toBe(false);
  });

  // Widened same night after an independent critic live-reproduced a bypass of the
  // first (argv[0]-only) draft: a wrapper command whose OWN semantics spawn `sh -c`
  // internally, with the shell buried deeper in argv, not at argv[0].

  it('flags a shell buried in argv via find -exec (the critic\'s live-reproduced bypass)', () => {
    const argv = tokenizeCommand('find . -maxdepth 0 -exec sh -c "touch PWNED && echo pwned" {} +');
    expect(argv[0]).toBe('find'); // confirms this is NOT caught by an argv[0]-only check
    expect(invokesShellInterpreter(argv)).toBe(true);
  });

  it('flags the same pattern via xargs/parallel-style wrapping', () => {
    expect(invokesShellInterpreter(tokenizeCommand('xargs -I{} sh -c "touch PWNED" --'))).toBe(true);
  });

  it('accepted, disclosed false-positive trade-off: inert "sh"/"-c" strings passed as literal arguments to an unrelated program also block', () => {
    // No shell is actually invoked here — echo just prints its argv — but the wider
    // scan cannot distinguish this from a real sh -c wrapper without knowing what each
    // program does with its own arguments. Fail-closed, same posture as
    // looksLikeCompoundCommand; not a shape any real entrypoint in this repo uses.
    expect(invokesShellInterpreter(['echo', 'sh', '-c'])).toBe(true);
  });

  // Widened a second time same night: a fresh, independent round-3 critic (no
  // context from round 2) live-reproduced two more real bypasses of the round-2 fix.

  it('flags su -c (round-3 critic finding: not a shell basename, but its own -c spawns one)', () => {
    expect(invokesShellInterpreter(['su', '-c', 'touch PWNED && echo pwned'])).toBe(true);
    expect(invokesShellInterpreter(['su', 'alice', '-c', 'touch PWNED && echo pwned'])).toBe(true);
  });

  it('does not flag su without -c', () => {
    expect(invokesShellInterpreter(['su', 'alice'])).toBe(false);
  });

  it('flags env -S hiding a nested "sh -c" inside one quoted argument (round-3 critic finding)', () => {
    // tokenizeCommand folds env -S's whole argument into ONE token — the same
    // quoting trick the original bug used, one level of indirection deeper. GNU
    // coreutils' env -S/--split-string word-splits that token into a fresh argv and
    // re-execs it, so it must be recursively re-tokenized and re-scanned.
    const argv = tokenizeCommand('env -S "sh -c \'touch PWNED && echo pwned\'"');
    expect(invokesShellInterpreter(argv)).toBe(true);
  });

  it('disclosed, not-fixed gap: the glued --split-string=<value> form is not detected (tokenizeCommand itself mis-splits it)', () => {
    // tokenizeCommand's own doc comment already discloses that a quote embedded
    // mid-token (not at the very start of a whitespace-delimited chunk) is not
    // special — confirmed here: this does not come out as a clean nested command
    // token at all, so there is nothing reliable for invokesShellInterpreter to
    // recurse into. Documented as a known gap, not silently assumed safe.
    const argv = tokenizeCommand('env --split-string="sh -c \'touch PWNED\'"');
    expect(argv).not.toContain('sh');
    expect(invokesShellInterpreter(argv)).toBe(false);
  });

  it('does not flag env used for its ordinary purpose (no split-string flag)', () => {
    expect(invokesShellInterpreter(['env', 'FOO=bar', 'npm', 'test'])).toBe(false);
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

  it('does not flag an unrelated "already exists" failure from a non-darwin entrypoint as stale-state', () => {
    // classifyEntrypointResult is shared across every configured evaluatorEntrypoints
    // value (bench, flywheel, redblue, darwin, ...) — a real bench-test failure whose
    // message happens to contain the generic phrase "already exists" for an unrelated
    // reason must still classify as a genuine failure (blocked), not benign leftover
    // darwin state to "clear and re-run".
    const r = classifyEntrypointResult({
      code: 1,
      stdout: '',
      stderr: "AssertionError: expected createUser to succeed, but user 'alice' already exists",
    });
    expect(r.verdict).toBe('blocked');
    expect(r.reason).toContain('already exists');
  });

  it('still flags the exact darwin child-id collision as stale-state after the regex narrowing', () => {
    const r = classifyEntrypointResult({
      code: 1,
      stdout: '',
      stderr: 'Error: darwin: autonomous or generated child id already exists: g2_v5',
    });
    expect(r.verdict).toBe('stale-state');
    expect(r.reason).toContain('Clear that state and re-run');
  });
});

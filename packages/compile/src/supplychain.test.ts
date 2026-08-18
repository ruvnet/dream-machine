import { describe, it, expect } from 'vitest';
import { findUnpinnedNpxInvocations } from './supplychain.js';

describe('findUnpinnedNpxInvocations', () => {
  it('flags this repo\'s real, current darwin entrypoint (reproduces dream.config.json)', () => {
    const findings = findUnpinnedNpxInvocations([], {
      bench: 'npm test',
      darwin: 'npx @metaharness/darwin evolve --sandbox mock',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      source: 'evaluatorEntrypoints.darwin',
      packageSpec: '@metaharness/darwin',
    });
  });

  it('does not flag a pinned scoped package', () => {
    const findings = findUnpinnedNpxInvocations([], {
      darwin: 'npx @metaharness/darwin@0.9.2 evolve --sandbox mock',
    });
    expect(findings).toHaveLength(0);
  });

  it('flags an explicit @latest tag the same as no pin at all', () => {
    const findings = findUnpinnedNpxInvocations(['npx cowsay@latest hi'], {});
    expect(findings).toHaveLength(1);
    expect(findings[0].packageSpec).toBe('cowsay@latest');
  });

  it('does not flag a pinned unscoped package', () => {
    const findings = findUnpinnedNpxInvocations(['npx cowsay@1.2.3 hi'], {});
    expect(findings).toHaveLength(0);
  });

  it('skips flags like -y when locating the package spec', () => {
    const findings = findUnpinnedNpxInvocations(['npx -y @metaharness/redblue'], {});
    expect(findings).toHaveLength(1);
    expect(findings[0].packageSpec).toBe('@metaharness/redblue');
  });

  it('ignores commands with no npx token at all', () => {
    const findings = findUnpinnedNpxInvocations(
      ['npm ci && npm run build', 'npm test --silent 2>&1 | tail -5 || true'],
      { bench: 'npm test' },
    );
    expect(findings).toHaveLength(0);
  });

  it('reports the source path for both probes and entrypoints', () => {
    const findings = findUnpinnedNpxInvocations(['npx foo'], { darwin: 'npx @scope/bar' });
    const sources = findings.map((f) => f.source).sort();
    expect(sources).toEqual(['controlPlaneProbes[0]', 'evaluatorEntrypoints.darwin']);
  });

  it('does not flag undefined/empty entrypoints', () => {
    const findings = findUnpinnedNpxInvocations([], { bench: undefined, flywheel: '' });
    expect(findings).toHaveLength(0);
  });

  // Regression tests for issues found by an independent critic review of this same
  // candidate (2026-08-18): `--package=`/`-p` names the package npx actually resolves,
  // which can differ from the bin-name token that follows it on the command line.

  it('does not flag a --package= invocation whose real spec is pinned (false-positive regression)', () => {
    const findings = findUnpinnedNpxInvocations([], {
      darwin: 'npx --package=@metaharness/darwin@0.9.2 darwin-evolve --sandbox mock',
    });
    expect(findings).toHaveLength(0);
  });

  it('flags a --package= invocation whose real spec is unpinned even if the bin name looks pinned (false-negative regression)', () => {
    const findings = findUnpinnedNpxInvocations([], {
      darwin: 'npx --package=@metaharness/darwin run@1.0',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].packageSpec).toBe('@metaharness/darwin');
  });

  it('honors the short -p flag the same way as --package=', () => {
    const findings = findUnpinnedNpxInvocations(['npx -p @scope/pkg@1.0.0 cmd'], {});
    expect(findings).toHaveLength(0);
  });

  it('scans npm exec as an alias for npx (scope-gap regression)', () => {
    const findings = findUnpinnedNpxInvocations(['npm exec @metaharness/darwin evolve'], {});
    expect(findings).toHaveLength(1);
    expect(findings[0].packageSpec).toBe('@metaharness/darwin');
  });

  it('does not flag a local file invocation (misleading-message regression)', () => {
    const findings = findUnpinnedNpxInvocations(['npx ./scripts/tool.js'], {});
    expect(findings).toHaveLength(0);
  });

  it('does not flag a direct git/URL package spec', () => {
    const findings = findUnpinnedNpxInvocations(
      ['npx git+https://github.com/foo/bar.git', 'npx github:foo/bar'],
      {},
    );
    expect(findings).toHaveLength(0);
  });
});

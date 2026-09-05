import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createEnvironmentReconstructionReceipt,
  type EnvironmentReconstructionManifest,
  type ReconstructionArtifact,
} from './reconstruction.js';

const TRAJECTORY_DIGEST = 'a'.repeat(64);
const CONTENT_A = 'b'.repeat(64);
const CONTENT_B = 'c'.repeat(64);

function artifact(overrides: Partial<ReconstructionArtifact> = {}): ReconstructionArtifact {
  return {
    path: 'src/index.ts',
    contentDigest: CONTENT_A,
    source: 'trajectory',
    required: true,
    verified: true,
    ...overrides,
  };
}

function manifest(overrides: Partial<EnvironmentReconstructionManifest> = {}): EnvironmentReconstructionManifest {
  return {
    schemaVersion: 1,
    trajectoryDigest: TRAJECTORY_DIGEST,
    sourceCommit: '7933c3599abe22df5290f4609d1f93f598feb3de',
    artifacts: [artifact()],
    gaps: [],
    ...overrides,
  };
}

describe('environment reconstruction receipts', () => {
  it('marks a fully verified recovered environment task sufficient', () => {
    const receipt = createEnvironmentReconstructionReceipt(manifest());
    expect(receipt.taskSufficient).toBe(true);
    expect(receipt.recoveredArtifacts).toBe(1);
    expect(receipt.inferredArtifacts).toBe(0);
    expect(receipt.verifiedArtifacts).toBe(1);
    expect(receipt.requiredGaps).toBe(0);
    expect(receipt.authority).toBe('none');
    expect(receipt.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same digest regardless of artifact and gap ordering', () => {
    const left = manifest({
      artifacts: [
        artifact({ path: 'z/file.ts' }),
        artifact({ path: 'a/file.ts', contentDigest: CONTENT_B, source: 'repository' }),
      ],
      gaps: [
        { path: 'z/missing.dat', reason: 'binary-unavailable', required: false },
        { path: 'a/missing.dat', reason: 'not-observed', required: false },
      ],
    });
    const right = manifest({
      artifacts: [...left.artifacts].reverse(),
      gaps: [...left.gaps].reverse(),
    });
    expect(createEnvironmentReconstructionReceipt(left).manifestDigest).toBe(
      createEnvironmentReconstructionReceipt(right).manifestDigest,
    );
  });

  it('keeps unverified completion output from becoming task sufficient', () => {
    const receipt = createEnvironmentReconstructionReceipt(
      manifest({ artifacts: [artifact({ source: 'completion', verified: false, required: false })] }),
    );
    expect(receipt.taskSufficient).toBe(false);
    expect(receipt.inferredArtifacts).toBe(1);
  });

  it('keeps required gaps from becoming task sufficient', () => {
    const receipt = createEnvironmentReconstructionReceipt(
      manifest({ gaps: [{ path: 'package-lock.json', reason: 'not-observed', required: true }] }),
    );
    expect(receipt.taskSufficient).toBe(false);
    expect(receipt.requiredGaps).toBe(1);
  });

  it('rejects parent path traversal', () => {
    expect(() =>
      createEnvironmentReconstructionReceipt(manifest({ artifacts: [artifact({ path: '../secret' })] })),
    ).toThrow(/relative POSIX|normalized/);
  });

  it('rejects absolute and backslash paths', () => {
    expect(() =>
      createEnvironmentReconstructionReceipt(manifest({ artifacts: [artifact({ path: '/etc/passwd' })] })),
    ).toThrow(/relative POSIX/);
    expect(() =>
      createEnvironmentReconstructionReceipt(manifest({ artifacts: [artifact({ path: 'src\\index.ts' })] })),
    ).toThrow(/relative POSIX/);
  });

  it('rejects duplicate reconstruction paths', () => {
    expect(() =>
      createEnvironmentReconstructionReceipt(
        manifest({ artifacts: [artifact(), artifact({ contentDigest: CONTENT_B })] }),
      ),
    ).toThrow(/duplicate reconstruction path/);
  });

  it('rejects a path represented as both an artifact and a gap', () => {
    expect(() =>
      createEnvironmentReconstructionReceipt(
        manifest({ gaps: [{ path: 'src/index.ts', reason: 'not-observed', required: false }] }),
      ),
    ).toThrow(/both artifact and gap/);
  });

  it('rejects malformed provenance digests', () => {
    expect(() =>
      createEnvironmentReconstructionReceipt(manifest({ trajectoryDigest: 'NOT-A-DIGEST' })),
    ).toThrow(/trajectoryDigest/);
    expect(() =>
      createEnvironmentReconstructionReceipt(
        manifest({ artifacts: [artifact({ contentDigest: 'd'.repeat(63) })] }),
      ),
    ).toThrow(/contentDigest/);
  });

  it('rejects resource exhaustion before canonicalization', () => {
    const artifacts = Array.from({ length: 4097 }, (_, index) =>
      artifact({ path: `files/${index}`, required: false }),
    );
    expect(() => createEnvironmentReconstructionReceipt(manifest({ artifacts }))).toThrow(
      /artifacts exceeds maximum/,
    );
  });

  describe('locale-independent canonicalization', () => {
    // These paths sort differently under ICU collation than under UTF-16
    // code units: en-US yields `_x,a,ä,B`, sv-SE yields `_x,a,B,ä`, while
    // code-unit order is `B,_x,a,ä`. The reviewer measured two different
    // manifest digests for the same manifest on en_US vs sv_SE hosts when
    // the sort used `localeCompare`.
    const LOCALE_SENSITIVE_PATHS = ['a', 'B', 'ä', '_x'];
    const CODE_UNIT_ORDER = ['B', '_x', 'a', 'ä'];
    // Golden digest, computed once after the fix; must hold on every host.
    const GOLDEN_DIGEST = 'fd561e1671096cfa7953cd3186e591bd3c06c566adf3fd586e6cfbad6ef5ec52';

    function localeSensitiveManifest(paths: readonly string[]): EnvironmentReconstructionManifest {
      return {
        schemaVersion: 1,
        trajectoryDigest: TRAJECTORY_DIGEST,
        artifacts: paths.map((path) => artifact({ path })),
        gaps: [],
      };
    }

    it('fixture discriminates: locale order differs from code-unit order', () => {
      const localeOrder = [...LOCALE_SENSITIVE_PATHS].sort((left, right) => left.localeCompare(right));
      expect(localeOrder).not.toEqual(CODE_UNIT_ORDER);
      const codeUnitOrder = [...LOCALE_SENSITIVE_PATHS].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      );
      expect(codeUnitOrder).toEqual(CODE_UNIT_ORDER);
    });

    it('digest equals sha256 of the manifest canonicalized in code-unit order', () => {
      const receipt = createEnvironmentReconstructionReceipt(localeSensitiveManifest(LOCALE_SENSITIVE_PATHS));
      const expectedCanonical = JSON.stringify({
        schemaVersion: 1,
        trajectoryDigest: TRAJECTORY_DIGEST,
        sourceCommit: null,
        baseImageDigest: null,
        artifacts: CODE_UNIT_ORDER.map((path) => ({
          path,
          contentDigest: CONTENT_A,
          source: 'trajectory',
          required: true,
          verified: true,
        })),
        gaps: [],
      });
      const expectedDigest = createHash('sha256').update(expectedCanonical).digest('hex');
      expect(receipt.manifestDigest).toBe(expectedDigest);
      expect(receipt.manifestDigest).toBe(GOLDEN_DIGEST);
    });

    it('digest is independent of input order and of the process locale', () => {
      const localeOrder = [...LOCALE_SENSITIVE_PATHS].sort((left, right) => left.localeCompare(right));
      const digests = new Set(
        [LOCALE_SENSITIVE_PATHS, localeOrder, [...LOCALE_SENSITIVE_PATHS].reverse(), CODE_UNIT_ORDER].map(
          (paths) => createEnvironmentReconstructionReceipt(localeSensitiveManifest(paths)).manifestDigest,
        ),
      );
      // The golden value was recorded with LC_ALL unset (Intl locale en-US).
      // Whatever LC_ALL / Intl locale this process runs under (CI, sv_SE,
      // C), the digest must not move.
      expect([...digests]).toEqual([GOLDEN_DIGEST]);
    });

    it('gaps are canonicalized with the same code-unit order', () => {
      const gaps = LOCALE_SENSITIVE_PATHS.map((path) => ({
        path: `gap/${path}`,
        reason: 'not-observed' as const,
        required: false,
      }));
      const left = createEnvironmentReconstructionReceipt({
        ...localeSensitiveManifest([]),
        artifacts: [artifact()],
        gaps,
      });
      const right = createEnvironmentReconstructionReceipt({
        ...localeSensitiveManifest([]),
        artifacts: [artifact()],
        gaps: [...gaps].sort((a, b) => a.path.localeCompare(b.path)),
      });
      expect(left.manifestDigest).toBe(right.manifestDigest);
    });
  });
});

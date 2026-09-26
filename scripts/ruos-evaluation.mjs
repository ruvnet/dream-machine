/**
 * Source-tree compatibility entry point. The implementation is shared with
 * the packaged `dream-machine ruos verify` command so policy cannot drift.
 */
import { readFileSync, openSync, fstatSync, closeSync, constants } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  digest,
  evaluateDocuments,
  evaluateObservation,
  evaluatePair,
  invalidInputReceipt,
  receiptExitCode,
} from '../packages/cli/src/ruos-evaluation.mjs';

export { digest, evaluateObservation, evaluatePair };

function readEvidence(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 24 * 1024 * 1024) throw new Error('INVALID_INPUT');
    const bytes = readFileSync(fd);
    if (bytes.length > 24 * 1024 * 1024) throw new Error('INVALID_INPUT');
    return JSON.parse(bytes.toString('utf8'));
  } finally {
    closeSync(fd);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let receipt;
  try {
    if (process.argv.length !== 4) throw new Error('INVALID_INPUT');
    receipt = evaluateDocuments(readEvidence(process.argv[2]), readEvidence(process.argv[3]));
  } catch {
    receipt = invalidInputReceipt();
  }
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  process.exitCode = receiptExitCode(receipt);
}

/** Read-only ruOS transport readiness. This is never a promotion receipt. */
import { createHash } from 'node:crypto';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const MACHINE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

function payload(result) {
  if (!result || result.isError === true) return null;
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
  // Some MCP transports return only the JSON text fallback.
  const blocks = Array.isArray(result.content) ? result.content.filter((c) => c?.type === 'text') : [];
  if (blocks.length !== 1 || typeof blocks[0].text !== 'string' || blocks[0].text.length > 65536) return null;
  try { return JSON.parse(blocks[0].text); } catch { return null; }
}

export function inspectRuosPreflight(execResult, screenshotResult) {
  const reasons = [];
  const run = payload(execResult);
  if (!run || run.status !== 'ok') reasons.push('EXEC_UNAVAILABLE');
  else if (run.exitCode === null || run.exitCode === undefined) reasons.push('EXIT_CODE_MISSING');
  else if (run.exitCode !== 0) reasons.push('EXEC_FAILED');
  if (run?.completionVersion !== 1 || run?.completionVerified !== true) reasons.push('COMPLETION_UNVERIFIED');

  const images = screenshotResult?.isError === true || !Array.isArray(screenshotResult?.content) ? [] :
    screenshotResult.content.filter((c) => c?.type === 'image');
  let screenshotSha256 = null;
  if (images.length !== 1) reasons.push('PIXELS_MISSING');
  else {
    const { data, mimeType } = images[0];
    if (typeof data !== 'string' || data.length > 12 * 1024 * 1024 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
      reasons.push('PIXELS_INVALID');
    } else {
      const bytes = Buffer.from(data, 'base64');
      const png = mimeType === 'image/png' && bytes.length >= 45 &&
        bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
        bytes.toString('ascii', 12, 16) === 'IHDR' &&
        bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0 &&
        bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'));
      const jpeg = mimeType === 'image/jpeg' && bytes.length >= 32 &&
        bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
      if (png || jpeg) screenshotSha256 = sha256(bytes);
      else reasons.push('PIXELS_INVALID');
    }
  }
  return {
    schema: 'dream-ruos-preflight/v1',
    scope: 'transport-readiness-only',
    verdict: reasons.length ? 'INCONCLUSIVE' : 'ACCEPT',
    reasons,
    screenshotSha256,
    exitCode: Number.isInteger(run?.exitCode) ? run.exitCode : null,
    authority: 'none',
    mergeEligible: false,
    limitations: ['not-tenant-isolation-proof', 'not-human-takeover-proof', 'not-workload-evaluation', 'image-envelope-check-only'],
  };
}

/** Host supplies its authorized MCP dispatcher. No network or credentials here.
 * The fixed read-only probe cannot execute candidate-selected commands.
 * Callers own the bounded timeout of their MCP dispatcher; never retry actions.
 */
export async function collectRuosPreflight(callTool, machine) {
  if (!MACHINE.test(machine ?? '')) throw new Error('INVALID_MACHINE');
  const results = await Promise.allSettled([
    callTool('desktop_exec', { machine, command: 'true', timeout_secs: 15 }),
    callTool('computer_screenshot', { machine }),
  ]);
  return inspectRuosPreflight(
    results[0].status === 'fulfilled' ? results[0].value : null,
    results[1].status === 'fulfilled' ? results[1].value : null,
  );
}

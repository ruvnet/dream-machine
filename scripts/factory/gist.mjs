import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha = text => createHash('sha256').update(text).digest('hex');
// Deliberately accepts only a generated public report, not arbitrary workspace files.
export function gistRequest(report, { repo, commit }) {
  if (repo !== 'ruvnet/dream-machine' || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid public repository or commit');
  if (typeof report !== 'string' || !report.startsWith('# ') || Buffer.byteLength(report) > 100000) throw new Error('Invalid report');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|hf_[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})|(?:token|password|secret|api[_-]?key)\s*[:=]\s*["']?[^\s"']{12,}|https?:\/\/[^\s/]+:[^\s/]+@/i.test(report)) throw new Error('Report contains a possible credential; publication blocked');
  const body = `${report}\n\nSource revision: https://github.com/${repo}/commit/${commit}\nReport SHA256: ${sha(report)}\n`;
  return { description: `Dream Machine factory ${commit.slice(0, 12)} ${sha(report).slice(0, 12)}`, public: true, files: { 'factory-report.md': { content: body } } };
}

// The caller reviews the exact request digest; this does not certify source claims.
// gh retains host authentication. No token is accepted, returned or put in argv.
export function publishGist(request, expectedDigest, { run = execFileSync } = {}) {
  if (sha(JSON.stringify(request)) !== expectedDigest) throw new Error('Gist request digest does not match reviewed request');
  const content = request?.files?.['factory-report.md']?.content;
  if (typeof content !== 'string') throw new Error('Invalid gist request');
  const footer = content.match(/\n\nSource revision: https:\/\/github\.com\/(ruvnet\/dream-machine)\/commit\/([a-f0-9]{40})\nReport SHA256: ([a-f0-9]{64})\n$/);
  if (!footer) throw new Error('Missing gist provenance');
  const report = content.slice(0, footer.index);
  if (sha(report) !== footer[3]) throw new Error('Report digest mismatch');
  const canonical = gistRequest(report, { repo:footer[1], commit:footer[2] });
  if (JSON.stringify(canonical) !== JSON.stringify(request)) throw new Error('Invalid or altered gist request');
  let login;
  try { login = run('gh', ['api', 'user', '--jq', '.login'], { encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:30000 }).trim(); }
  catch { throw new Error('GitHub identity check failed'); }
  if (login !== 'ruvnet') throw new Error('Gist publication requires the ruvnet GitHub identity');
  // Reconcile a previous or uncertain attempt before creating anything.
  let listed;
  try { listed = JSON.parse(run('gh', ['api', 'gists?per_page=100', '--paginate', '--slurp'], { encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:30000, maxBuffer:2*1024*1024 })); }
  catch { throw new Error('Gist reconciliation failed; no publication attempted'); }
  if (!Array.isArray(listed) || listed.some(page=>!Array.isArray(page))) throw new Error('Invalid gist inventory');
  const matches = listed.flat().filter(g=>g?.description === request.description);
  if (matches.length > 1) throw new Error('Duplicate gist receipts; reconcile before publishing');
  if (matches.length === 1) {
    const id = matches[0].id;
    if (!/^[a-f0-9]+$/.test(id ?? '')) throw new Error('Invalid gist id');
    let existing;
    try { existing=JSON.parse(run('gh', ['api', `gists/${id}`], { encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:30000, maxBuffer:200000 })); }
    catch { throw new Error('Existing gist verification failed'); }
    if (existing.owner?.login !== login || existing.public !== true || existing.files?.['factory-report.md']?.content !== content || Object.keys(existing.files ?? {}).length !== 1 || existing.html_url !== `https://gist.github.com/ruvnet/${id}`) throw new Error('Existing gist conflicts with request');
    return { url:existing.html_url, id, requestDigest:expectedDigest, reused:true };
  }
  let response;
  try { response = JSON.parse(run('gh', ['api', '--method', 'POST', 'gists', '--input', '-'], { input:JSON.stringify(request), encoding:'utf8', stdio:['pipe','pipe','pipe'], timeout:30000, maxBuffer:200000 })); }
  catch { throw new Error('Gist publication uncertain or failed; reconcile account gists before retrying'); }
  if (response.owner?.login !== login || response.public !== true || !/^https:\/\/gist\.github\.com\/ruvnet\/[a-f0-9]+$/.test(response.html_url ?? '')) throw new Error('Gist response invalid; reconcile before retrying');
  return { url:response.html_url, id:response.id, requestDigest:expectedDigest };
}
export { sha as digest };

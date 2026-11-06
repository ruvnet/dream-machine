/** Deterministic, offline documentation; observations never authorize promotion. */
const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const md = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#+.!|>~-]/g, '\\$&');
function line(value, label, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new TypeError(`Invalid ${label}`);
  return value;
}
function sourceUrl(value) {
  const raw = line(value, 'source URL', 2048);
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || /[<>"\s]/.test(raw)) throw new TypeError('Sources require public HTTPS URLs without credentials');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) throw new TypeError('Sources require public host names');
  return url.href.replace(/[()]/g, c => encodeURIComponent(c).replace('(', '%28').replace(')', '%29'));
}
export function renderArtifacts({repo, title, hypothesis, sources = [], results = []}) {
  line(repo, 'npm package', 214);
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(repo)) throw new TypeError('repo must be an exact npm package name');
  line(title, 'title', 160); line(hypothesis, 'hypothesis');
  if (!Array.isArray(sources) || sources.length > 50 || !Array.isArray(results) || results.length > 100) throw new TypeError('Invalid artifact arrays');
  const citations = sources.map((s, i) => {
    const item = typeof s === 'string' ? {url:s, title:`Source ${i + 1}`} : s;
    if (!item || typeof item !== 'object') throw new TypeError('Invalid source');
    return `${i + 1}. [${md(line(item.title ?? `Source ${i + 1}`, 'source title', 300))}](${sourceUrl(item.url)})`;
  }).join('\n') || 'No research sources supplied.';
  const observations = results.map((r, i) => {
    if (typeof r === 'string') return `${i + 1}. ${md(line(r, 'result'))}`;
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new TypeError('Invalid result');
    return `${i + 1}. ${md(line(JSON.stringify(r), 'result', 8000))}`;
  }).join('\n') || 'No measured results supplied. The proposal is unvalidated.';
  const evidence = `## Observations\n\n${observations}\n\nThese are supplied observations, not independently verified evidence or promotion authority. The evidence verifier, existing checks, held out evaluation and human review remain required.\n`;
  const readme = `# ${md(title)}\n\n![Animated process introduction](introduction.svg)\n\n${md(hypothesis)}\n\nStatus: proposed candidate. Publication and deployment are not implied.\n\n## Install\n\nAfter an approved release exists:\n\n\`\`\`sh\nnpm install ${repo}\n\`\`\`\n\n## Validate\n\nRun in the Dream Machine factory repository:\n\n\`\`\`sh\nnpm run check\nnode --test scripts/factory-artifacts.test.mjs\nnode scripts/software-factory.mjs verify EVIDENCE.json factory.config.json\n\`\`\`\n\n${evidence}\n## Sources\n\n${citations}\n\n## Limitations\n\nResearch freshness, benchmark provenance, licensing and target package compatibility need review. A generated introduction illustrates the process; it does not certify results.\n`;
  const adr = `# ADR: ${md(title)}\n\nStatus: proposed\n\n## Context\n\n${md(hypothesis)}\n\n## Decision proposal\n\nEvaluate one isolated candidate through the existing Dream Machine compile pipeline. Record baseline and held out results, preserve provenance and reject regressions. Generate documentation deterministically. Open a draft PR for human review.\n\n${evidence}\n## Consequences\n\nAdditional evaluation cost buys reproducible evidence. Worker access excludes publication keys. Reviewed main and a separate trusted release workflow control npm publication. No model, metric or generated artifact grants merge or release authority.\n\n## Sources\n\n${citations}\n`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 400" role="img" aria-labelledby="title desc"><title id="title">${xml(title)}</title><desc id="desc">${xml(hypothesis)}. Research, implement, measure, review, then release through a separate trusted workflow.</desc><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="100" y1="226" x2="900" y2="226"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><style>.flow{stroke-dasharray:10 12;animation:travel 3s linear infinite}.pulse{animation:glow 4s ease-in-out infinite}@keyframes travel{to{stroke-dashoffset:-88}}@keyframes glow{50%{opacity:.5}}@media(prefers-reduced-motion:reduce){.flow,.pulse{animation:none}}</style><rect width="1000" height="400" rx="24" fill="#090d1b"/><rect x="1" y="1" width="998" height="398" rx="24" fill="none" stroke="#29304b"/><text x="48" y="57" fill="#22d3ee" font-family="sans-serif" font-size="13" letter-spacing="4">DREAM MACHINE / SOFTWARE FACTORY</text><text x="48" y="105" fill="#f1f5ff" font-family="sans-serif" font-size="29">${xml(title.length > 52 ? title.slice(0, 49) + "…" : title)}</text><text x="48" y="139" fill="#a7b0c9" font-family="sans-serif" font-size="16">${xml(hypothesis.length > 92 ? hypothesis.slice(0, 89) + "…" : hypothesis)}</text><path class="flow" d="M130 226H870" fill="none" stroke="url(#g)" stroke-width="3"/>${['Research','Implement','Measure','Review','Release'].map((label,i)=>{const x=50+i*185;return `<g><rect x="${x}" y="191" width="155" height="70" rx="12" fill="#12192e" stroke="${i===4?'#22d3ee':'#7862cb'}"/><circle class="pulse" style="animation-delay:${i*0.6}s" cx="${x+20}" cy="214" r="3" fill="#22d3ee"/><text x="${x+18}" y="244" fill="#f1f5ff" font-family="sans-serif" font-size="18">${label}</text></g>`;}).join('')}<text x="48" y="313" fill="#a7b0c9" font-family="sans-serif" font-size="15">Baseline + held out evaluation + existing tests + provenance</text><text x="48" y="345" fill="#8de9ec" font-family="sans-serif" font-size="14">Draft PR → reviewed main → separate trusted publication</text><text x="48" y="376" fill="#7c879f" font-family="sans-serif" font-size="12">Conceptual process illustration. Not evidence of an executed release.</text></svg>`;
  const gist = `# ${md(title)}: candidate report\n\n${md(hypothesis)}\n\n${evidence}\n## Public sources\n\n${citations}\n\nPublication requires explicit sanitization review. Exclude credentials, private research, customer data, internal URLs and unpublished security findings.\n`;
  return {readme, adr, svg, gist};
}

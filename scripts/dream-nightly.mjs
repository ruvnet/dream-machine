#!/usr/bin/env node
/**
 * dream-nightly — a self-contained GitHub Actions "dream" for repos that want
 * the loop without a cloud agent session.
 *
 * Scope (honest): this runs the RESEARCH + HYPOTHESIS half of the pipeline from
 * a plain CI runner, using an OpenRouter model. It does NOT build a candidate,
 * run bounded Darwin, or self-evaluate against a benchmark — those need the
 * agentic cloud session (`/schedule`). So every night here is deliberately an
 * `INCONCLUSIVE` research night: it files a witnessed research issue and appends
 * one ledger row. With no OPENROUTER_API_KEY it degrades to `LLM_EVAL=blocked`
 * and still files an honest research-skipped note — never a fabricated result.
 *
 * Env: OPENROUTER_API_KEY (optional), OPENROUTER_MODEL (default a cheap model),
 *      GH_TOKEN (for gh), DREAM_CONFIG (default dream.config.json),
 *      DREAM_DATE (override for reproducible tests).
 * Usage: node scripts/dream-nightly.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const DRY = process.argv.includes('--dry-run');
const CONFIG = process.env.DREAM_CONFIG || 'dream.config.json';
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const KEY = process.env.OPENROUTER_API_KEY || '';
const LEDGER = 'docs/dream-cycle/LEDGER.md';

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
}
function shSafe(cmd, args) {
  try { return sh(cmd, args); } catch { return ''; }
}

function tonight() {
  const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
  const date = process.env.DREAM_DATE || new Date().toISOString().slice(0, 10);
  const dayint = Number(date.replace(/-/g, ''));
  const slot = dayint % cfg.slots.length;
  const { deep, scan } = cfg.slots[slot];
  const commit = shSafe('git', ['rev-parse', 'HEAD']) || '0'.repeat(40);
  return { cfg, date, slot, deep, scan, commit };
}

async function research(ctx) {
  if (!KEY) {
    return {
      blocked: true,
      body: `**LLM_EVAL=blocked** — no \`OPENROUTER_API_KEY\` is configured, so no model-backed research ran tonight. This is an honest research-skipped night for the \`${ctx.deep}\` surface, not a fabricated finding. Add the secret to enable nightly research.`,
      finding: `research skipped (no API key) on ${ctx.deep}`,
    };
  }
  const sys =
    'You are the research half of the Dream Machine nightly loop. Be terse, technical, evidence-driven. ' +
    'Grade every external claim A (reproducible/official) / B (vendor, cross-checked) / C (single-source). ' +
    'Never fabricate benchmark numbers.';
  const user =
    `Repository: ${ctx.cfg.repo}. Tonight's deep surface: "${ctx.deep}"; scan surfaces: ${(ctx.scan || []).join(', ')}.\n\n` +
    `Produce, in under 350 words:\n` +
    `1. What's new in ${ctx.date.slice(0, 4)} for this surface (2-4 bullets, each with an A/B/C grade).\n` +
    `2. One FALSIFIABLE hypothesis in the exact form: "Given <workload>, when <change> is applied, then <metric> should improve vs <baseline>, subject to <invariant>."\n` +
    `3. One concrete, small, testable candidate direction (no code, one sentence).\n` +
    `Do not claim anything was measured — this is research only.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
      'HTTP-Referer': 'https://github.com/ruvnet/dream-machine',
      'X-Title': 'Dream Machine Nightly (GitHub Actions)',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      max_tokens: 700,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { blocked: true, body: `**LLM_EVAL=blocked** — OpenRouter request failed (${res.status}). ${t.slice(0, 200)}`, finding: `research failed (${res.status}) on ${ctx.deep}` };
  }
  const json = await res.json();
  const body = json.choices?.[0]?.message?.content?.trim() || '(empty model response)';
  // Prefer the hypothesis line as the finding; else the first substantive line.
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const hypo = lines.find((l) => /^Given\b/i.test(l.replace(/^["*_\s]+/, '')));
  const firstProse = lines.find((l) => !/^#{1,6}\s|^[-*]\s*$/.test(l)) || `research on ${ctx.deep}`;
  const finding = (hypo || firstProse).replace(/^[#>*_\-\s"]+/, '').slice(0, 80);
  return { blocked: false, body, finding, usage: json.usage };
}

function witness(reportPath, commit) {
  const reportHash = createHash('sha256').update(readFileSync(reportPath)).digest('hex');
  const w = createHash('sha256').update(reportHash + commit).digest('hex');
  return { reportHash, witness: w };
}

async function main() {
  const ctx = tonight();
  console.log(`Tonight: DATE=${ctx.date} DEEP=${ctx.deep} SCAN=${(ctx.scan || []).join(',')} SLOT=${ctx.slot} COMMIT=${ctx.commit.slice(0, 8)}`);

  const r = await research(ctx);
  const evaluated = r.blocked ? 'blocked' : 'no';
  const verdict = 'INCONCLUSIVE'; // GHA dream-lite is always research-only
  const cost = r.usage ? ` (${r.usage.total_tokens} tokens)` : '';

  const reportPath = `/tmp/dream-nightly-${ctx.date}.md`;
  const report = [
    `# ${ctx.deep} — nightly research (${ctx.date})`,
    ``,
    `> Dream Machine nightly (GitHub Actions, research-only). Model: ${r.blocked ? 'none' : MODEL}${cost}.`,
    `> This is the research + hypothesis half of the pipeline. Candidate evaluation,`,
    `> bounded Darwin, and the promotion gate run in the agentic \`/schedule\` cloud`,
    `> session, not here — so tonight's verdict is INCONCLUSIVE by construction.`,
    ``,
    r.body,
    ``,
    `## Witness`,
    `- session commit: \`${ctx.commit}\``,
  ].join('\n');
  writeFileSync(reportPath, report + '\n');
  const w = witness(reportPath, ctx.commit);
  writeFileSync(reportPath, report + `\n- report sha256: \`${w.reportHash}\`\n- witness: \`${w.witness}\`\n`);

  const finding = r.finding || `research on ${ctx.deep}`;
  const title = `[Dream Cycle ${ctx.date}] ${ctx.deep}: ${finding}`;

  if (DRY) {
    console.log('--- DRY RUN ---');
    console.log(title);
    console.log(report);
    console.log(`ledger row → verdict=${verdict} evaluated=${evaluated} witness=${w.witness.slice(0, 8)}`);
    return;
  }

  // File the research issue.
  let issueRef = 'LOCAL';
  try {
    const url = sh('gh', ['issue', 'create', '--title', title, '--body-file', reportPath, '--label', 'dream-cycle', '--label', 'research']);
    issueRef = '#' + (url.match(/\/issues\/(\d+)/)?.[1] ?? '');
    console.log('issue:', url);
  } catch (e) {
    console.log('issue creation skipped:', String(e).split('\n')[0]);
  }

  // Append + commit one ledger row on a branch, then open a draft PR.
  const priorFates = shSafe('bash', ['-lc', `tail -n 3 ${LEDGER} 2>/dev/null | head -n 1`]).slice(0, 40) || 'first night';
  execFileSync('node', ['packages/cli/dist/bin.js', 'ledger', 'append',
    '--path', LEDGER, '--date', ctx.date, '--deep', ctx.deep,
    '--finding', finding, '--issue', issueRef, '--pr', 'NONE',
    '--evaluated', evaluated, '--verdict', verdict, '--witness', w.witness.slice(0, 8),
    '--priorFates', priorFates], { stdio: 'inherit' });

  const branch = `dream/${ctx.date}-${ctx.deep}`;
  sh('git', ['config', 'user.name', 'dream-machine[bot]']);
  sh('git', ['config', 'user.email', 'dream-machine@users.noreply.github.com']);
  shSafe('git', ['checkout', '-b', branch]);
  sh('git', ['add', LEDGER]);
  sh('git', ['commit', '-m', `dream(${ctx.deep}): ${issueRef} ${finding}`]);
  sh('git', ['push', '-u', 'origin', branch, '--force-with-lease']);
  try {
    const pr = sh('gh', ['pr', 'create', '--draft', '--title', `${title} (research)`,
      '--body', `Nightly research (GitHub Actions). See ${issueRef}.\n\nVerdict: INCONCLUSIVE (research-only). **Do not self-merge** — human review required.\n\nWitness: \`${w.witness}\``,
      '--label', 'dream-cycle']);
    console.log('draft PR:', pr);
  } catch (e) {
    console.log('PR creation skipped:', String(e).split('\n')[0]);
  }

  console.log(`Done. Issue ${issueRef} (evaluated=${evaluated}, verdict=${verdict}). Witness: ${w.witness}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

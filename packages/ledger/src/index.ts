/**
 * @dream-machine/ledger
 *
 * The ledger is the Dream Machine's only durable cross-night memory. Every
 * nightly run appends exactly one row to `docs/dream-cycle/LEDGER.md`, a
 * fixed 10-column GitHub-flavored-markdown table:
 *
 *   | Date | Deep | Finding | Issue | PR | Evaluated? | Verdict | Effect | Witness | Prior-night fates |
 *
 * This module parses, validates, and appends rows deterministically, and turns
 * the accumulated history into the STEP 1.1 "learning signals" that steer the
 * next night — instead of the model re-deriving them from prose every time.
 */

import { createHash } from 'node:crypto';

export const LEDGER_COLUMNS = [
  'Date',
  'Deep',
  'Finding',
  'Issue',
  'PR',
  'Evaluated?',
  'Verdict',
  'Effect',
  'Witness',
  'Prior-night fates',
] as const;

export type Verdict = 'ACCEPT' | 'REJECT' | 'INCONCLUSIVE';
export type Evaluated = 'yes' | 'no' | 'blocked';

export interface LedgerRow {
  date: string; // YYYY-MM-DD
  deep: string;
  finding: string;
  issue: string; // "#123" | "LOCAL" | "NONE"
  pr: string; // "#123" | "NONE"
  evaluated: Evaluated | string;
  verdict: Verdict | string;
  effect: string;
  witness: string; // short prefix, e.g. "398c71a6"
  priorFates: string;
}

const HEADER = `| ${LEDGER_COLUMNS.join(' | ')} |`;
const DIVIDER = `| ${LEDGER_COLUMNS.map(() => '---').join(' | ')} |`;

/** The empty ledger — header + divider, ready for the first append. */
export function emptyLedger(): string {
  return `${HEADER}\n${DIVIDER}\n`;
}

function splitRow(line: string): string[] {
  // Trim the leading/trailing pipe, then split on unescaped pipes.
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isDivider(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s/g, '')));
}

/** Escape a cell value so it cannot break the table (pipes/newlines). */
export function escapeCell(value: string): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function rowToCells(row: LedgerRow): string[] {
  return [
    row.date,
    row.deep,
    row.finding,
    row.issue,
    row.pr,
    row.evaluated,
    row.verdict,
    row.effect,
    row.witness,
    row.priorFates,
  ].map(escapeCell);
}

function cellsToRow(cells: string[]): LedgerRow {
  const [date, deep, finding, issue, pr, evaluated, verdict, effect, witness, priorFates] = cells;
  return {
    date: date ?? '',
    deep: deep ?? '',
    finding: finding ?? '',
    issue: issue ?? '',
    pr: pr ?? '',
    evaluated: evaluated ?? '',
    verdict: verdict ?? '',
    effect: effect ?? '',
    witness: witness ?? '',
    priorFates: priorFates ?? '',
  };
}

export interface ParseResult {
  rows: LedgerRow[];
  /** Non-fatal issues (malformed rows skipped, wrong column count, etc.). */
  warnings: string[];
  /**
   * Parallel to `rows`: true when that row's raw line had exactly
   * `LEDGER_COLUMNS.length` cells. A `false` entry means the row was
   * defensively padded/truncated by `cellsToRow` and its field values may be
   * shifted or missing — `verifyLedger` treats this as fatal for enforced
   * rows (see `VerifyOptions.sinceRow`), since a column-count mismatch is
   * exactly the kind of corruption a structural gate exists to catch.
   */
  wellFormed: boolean[];
}

/** Parse a LEDGER.md string into typed rows (skips header/divider/blank lines). */
export function parseLedger(markdown: string): ParseResult {
  const rows: LedgerRow[] = [];
  const warnings: string[] = [];
  const wellFormed: boolean[] = [];
  const lines = markdown.split(/\r?\n/);
  let seenHeader = false;
  for (const line of lines) {
    if (!line.trim() || !line.includes('|')) continue;
    const cells = splitRow(line);
    if (isDivider(cells)) continue;
    // First pipe-row is the header.
    if (!seenHeader) {
      seenHeader = true;
      if (cells[0]?.toLowerCase() !== 'date') {
        warnings.push(`first table row is not the expected header (got "${cells[0]}")`);
      }
      continue;
    }
    if (cells.length !== LEDGER_COLUMNS.length) {
      warnings.push(`row has ${cells.length} columns, expected ${LEDGER_COLUMNS.length}: ${line.trim()}`);
      // Pad/truncate defensively so a malformed row is still readable.
      wellFormed.push(false);
    } else {
      wellFormed.push(true);
    }
    rows.push(cellsToRow(cells));
  }
  return { rows, warnings, wellFormed };
}

/** Render a single row as a markdown table line. */
export function renderRow(row: LedgerRow): string {
  return `| ${rowToCells(row).join(' | ')} |`;
}

/**
 * Append a row to a ledger string, creating the header if absent. Guarantees
 * exactly one row is added and the schema is unchanged (property-tested).
 */
export function appendRow(markdown: string, row: LedgerRow): string {
  const base = markdown && markdown.trim().length ? markdown.replace(/\s*$/, '') : emptyLedger().replace(/\s*$/, '');
  return `${base}\n${renderRow(row)}\n`;
}

export const VERDICTS: readonly string[] = ['ACCEPT', 'REJECT', 'INCONCLUSIVE'];
export const EVALS: readonly string[] = ['yes', 'no', 'blocked'];

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when `s` matches YYYY-MM-DD *and* is a real calendar date. The regex
 * shape alone accepts impossible dates like `2026-99-99` or `2026-02-30`,
 * which then silently counted as valid "nights" in every signal derived
 * from row dates (caught in review: they inflated distinctDatesInWindow /
 * lastRowDate / daysSinceLastRow / ledgerStale, and passed verifyLedger).
 */
function isValidCalendarDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export interface VerifyOptions {
  /**
   * 1-indexed row number to start enforcement from (default 1 = every row,
   * byte-identical prior behavior). Rows before `sinceRow` are parsed and
   * counted in `rowCount` but never contribute errors — lets CI gate future
   * drift without first repairing already-accepted historical debt (see
   * issues #48/#58: 37 legacy rows, 40 known/accepted schema violations from
   * pre-single-repo-schema "portfolio" nights, closed as accepted debt
   * 2026-09-07). Out-of-range values (< 1) are clamped to 1.
   */
  sinceRow?: number;
  /**
   * sha256 hex digest of the canonical legacy prefix (rows `1..sinceRow-1`),
   * from `legacyPrefixDigest()`. `sinceRow` alone anchors the grandfathered
   * boundary to an ORDINAL POSITION, not to specific content: inserting or
   * deleting a row anywhere before the boundary shifts every row after it,
   * so a newly inserted bad row can land below `sinceRow` (grandfathered)
   * while a previously-enforced row shifts to a position that's never
   * actually been checked. When `legacyPrefixDigest` is supplied and doesn't
   * match the actual prefix, verification fails closed: it reports the
   * mismatch as an error and enforces every row (as if `sinceRow` were 1),
   * rather than silently trusting a boundary that may no longer point at the
   * content it was frozen against. Omit to keep today's ordinal-only trust
   * (unchanged default behavior).
   */
  legacyPrefixDigest?: string;
}

/**
 * Canonical sha256 hex digest of `rows[0..sinceRow-2]` (the rows grandfathered
 * by `sinceRow`), computed by re-rendering each row through `renderRow` (so
 * incidental whitespace in the source file can't produce a false mismatch)
 * and hashing the joined result. Recompute this whenever `sinceRow` moves
 * forward, and pass it to `verifyLedger` as `legacyPrefixDigest` to anchor
 * the grandfathered boundary to content, not just position.
 */
export function legacyPrefixDigest(rows: LedgerRow[], sinceRow: number): string {
  const prefix = rows.slice(0, Math.max(0, sinceRow - 1));
  const canonical = prefix.map(renderRow).join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

/** Structurally verify a ledger: header present, verdicts/evaluated in range. */
export function verifyLedger(markdown: string, opts: VerifyOptions = {}): VerifyResult {
  const errors: string[] = [];
  const { rows, warnings, wellFormed } = parseLedger(markdown);
  let sinceRow = Math.max(1, opts.sinceRow ?? 1);
  if (!markdown.includes(HEADER.replace(/\s/g, '')) && !/\|\s*Date\s*\|/.test(markdown)) {
    errors.push('ledger is missing the Date header row');
  }
  if (opts.legacyPrefixDigest !== undefined) {
    const actual = legacyPrefixDigest(rows, sinceRow);
    if (actual !== opts.legacyPrefixDigest) {
      errors.push(
        `legacy prefix digest mismatch (expected ${opts.legacyPrefixDigest}, got ${actual}) — ` +
          `rows 1..${sinceRow - 1} no longer match the frozen grandfathered content; refusing to ` +
          `trust the sinceRow boundary and verifying every row instead`,
      );
      sinceRow = 1;
    }
  }
  rows.forEach((r, i) => {
    const rowNum = i + 1;
    if (rowNum < sinceRow) return;
    if (!wellFormed[i]) {
      errors.push(`row ${rowNum}: malformed — wrong column count (expected ${LEDGER_COLUMNS.length})`);
    }
    if (!VERDICTS.includes(r.verdict)) {
      errors.push(`row ${rowNum}: verdict "${r.verdict}" not in ${VERDICTS.join('|')}`);
    }
    if (!EVALS.includes(r.evaluated)) {
      errors.push(`row ${rowNum}: evaluated "${r.evaluated}" not in ${EVALS.join('|')}`);
    }
    if (!isValidCalendarDate(r.date)) {
      errors.push(`row ${rowNum}: date "${r.date}" is not a valid calendar date (YYYY-MM-DD)`);
    }
  });
  return { ok: errors.length === 0, errors, warnings, rowCount: rows.length };
}

// ---------------------------------------------------------------------------
// STEP 1.1 learning signals — deterministic library code, not LLM re-derivation.
// ---------------------------------------------------------------------------

export interface LearningSignals {
  /** No candidate PR merged in the last `window` nights → prefer tiny candidates. */
  zeroMergeStreak: boolean;
  /** A finding substring seen in >= 3 prior rows → duplicate direction, rotate. */
  duplicateDirections: string[];
  /** >= 3 consecutive gist self-scores < 5 → reduce to a single deep surface. */
  lowScoreStreak: boolean;
  /** Long run of evaluated=blocked → bias to no-model-call candidates. */
  blockedEvalStreak: boolean;
  /** Count of nights considered. */
  nightsConsidered: number;
  /**
   * Distinct calendar dates among the windowed rows (`nightsConsidered` rows).
   * The window is a raw row-count slice, not a calendar-night slice: a night
   * whose row was re-appended later (e.g. once its real PR/issue number
   * became known) consumes two window slots for one real night. Observed on
   * the real committed ledger: the last 14 rows cover only 11 distinct
   * dates. Compare against `nightsConsidered` to tell whether "N nights" in
   * `zeroMergeStreak`/`blockedEvalStreak` is trustworthy or inflated by
   * duplicate/re-appended rows.
   */
  distinctDatesInWindow: number;
  /**
   * Most recent valid row date (YYYY-MM-DD), or null if the ledger has no
   * dated rows. The nightly cron runs daily, but every candidate PR ships its
   * ledger row on its own branch — a row lands on `main` only once that PR
   * merges. A local checkout's ledger can silently go stale for many real
   * nights while `zeroMergeStreak` holds, undermining every signal above
   * (duplicateDirections in particular: a night can't rotate away from a
   * direction it can't see).
   */
  lastRowDate: string | null;
  /** Days between `today` and `lastRowDate` (0 if same day), or null if there is no dated row. */
  daysSinceLastRow: number | null;
  /** true when daysSinceLastRow exceeds `staleAfterDays` — treat every signal above as unreliable. */
  ledgerStale: boolean;
  /**
   * Currently-open, unmerged dream-cycle candidate PR count, echoed straight
   * from `openCandidateCount` (null when the caller didn't supply one).
   * `zeroMergeStreak` says whether ANY of the last `window` nights' PRs
   * merged; it cannot tell "nothing has been proposed lately" apart from
   * "N proposals are sitting open and unreviewed" — both read as the same
   * boolean. A live GitHub check knows which one it is; this field lets that
   * count reach the same dashboard `zeroMergeStreak` already reaches.
   */
  reviewBacklogSize: number | null;
}

export interface SignalOptions {
  /** How many trailing nights to consider for merge/blocked streaks. */
  window?: number;
  /** Recent gist self-scores (0–10), most-recent last. */
  recentScores?: number[];
  /** Which PR numbers actually merged (so we can detect the zero-merge streak). */
  mergedPrNumbers?: Set<string>;
  /** Today's date (YYYY-MM-DD) for staleness. Defaults to no staleness check when omitted. */
  today?: string;
  /** Days tolerated between the ledger's last row and `today` before it's "stale". Default 1 (nightly cron). */
  staleAfterDays?: number;
  /**
   * Finding text from currently-open, unmerged dream-cycle PRs (e.g. their
   * titles), supplied by the caller after a live GitHub check. `duplicateDirections`
   * only ever sees rows already merged into LEDGER.md on main, so a repeated
   * direction proposed across several still-open draft PRs is invisible to it
   * until one of them lands — by which point duplicate work may already be
   * done. Passing those findings here lets the same detector count them
   * alongside merged-row findings. Omit for byte-identical prior behavior.
   */
  pendingFindings?: string[];
  /**
   * Count of currently-open, unmerged dream-cycle candidate PRs (e.g. open
   * PRs whose head branch matches `branchPrefix`), from a live GitHub check
   * the caller already ran. Omit for `reviewBacklogSize: null` (byte-identical
   * prior behavior — this option adds a field, it changes no existing one).
   */
  openCandidateCount?: number;
}

/** Whole days between two YYYY-MM-DD dates (UTC, `to` minus `from`). */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function prNumber(pr: string): string | null {
  const m = pr.match(/#?(\d+)/);
  return m ? m[1] : null;
}

/** Normalize a finding string to the same first-6-words key used for duplicate-direction detection. */
function directionKey(finding: string): string {
  return finding.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).slice(0, 6).join(' ').trim();
}

/** Compute the STEP 1.1 learning signals from parsed rows. */
export function learningSignals(rows: LedgerRow[], opts: SignalOptions = {}): LearningSignals {
  const window = opts.window ?? 14;
  const recent = rows.slice(-window);

  // Zero-merge streak: no PR in the window is known-merged.
  const merged = opts.mergedPrNumbers;
  const prsInWindow = recent.map((r) => prNumber(r.pr)).filter((n): n is string => !!n);
  const zeroMergeStreak =
    prsInWindow.length > 0 && (!merged || prsInWindow.every((n) => !merged.has(n)));

  // Duplicate directions: normalized finding text repeated >= 3 times, counting
  // both merged ledger rows and (optionally) still-open PRs' pending findings.
  const counts = new Map<string, number>();
  const bumpDirection = (finding: string) => {
    const key = directionKey(finding);
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const r of rows) bumpDirection(r.finding);
  for (const f of opts.pendingFindings ?? []) bumpDirection(f);
  const duplicateDirections = [...counts.entries()].filter(([, c]) => c >= 3).map(([k]) => k);

  // Low-score streak: last 3 scores all < 5.
  const scores = opts.recentScores ?? [];
  const lastThree = scores.slice(-3);
  const lowScoreStreak = lastThree.length === 3 && lastThree.every((s) => s < 5);

  // Blocked-eval streak: majority of the window blocked, and last 3 all blocked.
  const lastThreeEvals = recent.slice(-3).map((r) => r.evaluated);
  const blockedEvalStreak =
    recent.length >= 3 && lastThreeEvals.length === 3 && lastThreeEvals.every((e) => e === 'blocked');

  // Distinct calendar dates within the windowed rows (see field doc above).
  const distinctDatesInWindow = new Set(recent.map((r) => r.date).filter(isValidCalendarDate)).size;

  // Staleness: the newest valid row date, regardless of row order.
  const validDates = rows.map((r) => r.date).filter(isValidCalendarDate);
  const lastRowDate = validDates.length ? validDates.reduce((max, d) => (d > max ? d : max)) : null;
  const today = opts.today;
  const staleAfterDays = opts.staleAfterDays ?? 1;
  const daysSinceLastRow = lastRowDate && today ? daysBetween(lastRowDate, today) : null;
  const ledgerStale = daysSinceLastRow !== null && daysSinceLastRow > staleAfterDays;

  const reviewBacklogSize = opts.openCandidateCount ?? null;

  return {
    zeroMergeStreak,
    duplicateDirections,
    lowScoreStreak,
    blockedEvalStreak,
    nightsConsidered: recent.length,
    distinctDatesInWindow,
    lastRowDate,
    daysSinceLastRow,
    ledgerStale,
    reviewBacklogSize,
  };
}

/** Verdict distribution over a ledger — used by the TUI and dashboard. */
export function verdictStats(rows: LedgerRow[]): Record<string, number> {
  const stats: Record<string, number> = { ACCEPT: 0, REJECT: 0, INCONCLUSIVE: 0, other: 0 };
  for (const r of rows) {
    if (r.verdict in stats) stats[r.verdict] += 1;
    else stats.other += 1;
  }
  return stats;
}

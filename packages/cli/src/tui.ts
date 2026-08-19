/**
 * The Dream Machine TUI — a dependency-free ANSI dashboard rendered from a
 * ledger. `renderDashboard` is pure (ledger string → framebuffer string) so it
 * can be snapshot-tested and turned into an SVG "termshot" without a terminal.
 */
import { parseLedger, verdictStats, learningSignals, type LedgerRow } from '@dream-machine/ledger';

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  violet: '\x1b[38;5;99m',
  gray: '\x1b[38;5;245m',
};

function verdictColor(v: string): string {
  if (v === 'ACCEPT') return C.green;
  if (v === 'REJECT') return C.red;
  if (v === 'INCONCLUSIVE') return C.yellow;
  return C.gray;
}

const ANSI_TOKEN = '\\x1b\\[[0-9;]*m';
// Matches either one ANSI SGR escape or exactly one Unicode code point (the
// `u` flag makes `[^]` consume a full astral code point instead of one UTF-16
// surrogate half; `[^]` rather than `.` so line terminators aren't silently
// dropped from the token stream — the old raw-index `.slice()` preserved
// them verbatim, and the tokenizer should too).
const TOKEN_RE = new RegExp(`${ANSI_TOKEN}|[^]`, 'gu');

/**
 * Terminal display width for a single code point. Not a full Unicode
 * text-segmentation implementation (no grapheme-cluster collapsing for
 * multi-codepoint emoji sequences) — but each base emoji is width 2 and each
 * joiner/modifier is width 0, which is enough to keep fixed-width box
 * rendering aligned. Ranges: combining marks / variation selectors / ZWJ /
 * skin-tone modifiers (0), CJK / Hangul / fullwidth forms / most emoji (2),
 * everything else (1).
 */
function codePointWidth(cp: number): number {
  if (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    cp === 0x200d ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0x1f3fb && cp <= 0x1f3ff)
  ) {
    return 0;
  }
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

/** Real terminal column width of a string, ignoring embedded ANSI SGR codes. */
export function displayWidth(s: string): number {
  let width = 0;
  for (const tok of s.match(TOKEN_RE) ?? []) {
    if (tok.charCodeAt(0) === 0x1b) continue;
    width += codePointWidth(tok.codePointAt(0)!);
  }
  return width;
}

export function pad(s: string, n: number): string {
  const total = displayWidth(s);
  if (total <= n) return s + ' '.repeat(n - total);

  // Truncate to n-1 columns of visible content, append '…', then keep any
  // ANSI codes that follow the cut point (e.g. a trailing reset) instead of
  // severing them mid-sequence the way a raw index slice would.
  let out = '';
  let width = 0;
  let cut = false;
  for (const tok of s.match(TOKEN_RE) ?? []) {
    if (tok.charCodeAt(0) === 0x1b) {
      out += tok;
      continue;
    }
    if (cut) continue;
    const w = codePointWidth(tok.codePointAt(0)!);
    if (width + w > n - 1) {
      out += '…';
      width += 1;
      cut = true;
      continue;
    }
    out += tok;
    width += w;
  }
  return out + ' '.repeat(Math.max(0, n - width));
}

export interface DashboardOptions {
  /** Disable ANSI color (for termshot / non-tty). */
  noColor?: boolean;
  /** How many recent nights to show. */
  limit?: number;
  /** Repo name for the header. */
  repo?: string;
}

/** Render the dashboard framebuffer from a ledger markdown string. */
export function renderDashboard(ledgerMd: string, opts: DashboardOptions = {}): string {
  const c = opts.noColor ? new Proxy({}, { get: () => '' }) as typeof C : C;
  const { rows } = parseLedger(ledgerMd);
  const stats = verdictStats(rows);
  const signals = learningSignals(rows);
  const limit = opts.limit ?? 10;
  const recent = rows.slice(-limit).reverse();
  const total = rows.length;

  const lines: string[] = [];
  const W = 78;
  const bar = '─'.repeat(W);
  lines.push(`${c.violet}╭${bar}╮${c.reset}`);
  const title = `☾ DREAM MACHINE${opts.repo ? `  ·  ${opts.repo}` : ''}`;
  lines.push(`${c.violet}│${c.reset} ${c.bold}${c.cyan}${pad(title, W - 2)}${c.reset} ${c.violet}│${c.reset}`);
  lines.push(`${c.violet}├${bar}┤${c.reset}`);

  // Stats row.
  const statLine =
    `${c.gray}nights${c.reset} ${c.bold}${total}${c.reset}   ` +
    `${c.green}● ${stats.ACCEPT} accept${c.reset}   ` +
    `${c.red}● ${stats.REJECT} reject${c.reset}   ` +
    `${c.yellow}● ${stats.INCONCLUSIVE} inconclusive${c.reset}`;
  lines.push(`${c.violet}│${c.reset} ${pad(statLine, W - 2)} ${c.violet}│${c.reset}`);
  lines.push(`${c.violet}├${bar}┤${c.reset}`);

  if (recent.length === 0) {
    lines.push(`${c.violet}│${c.reset} ${pad(`${c.dim}no dream nights yet — the ledger is empty${c.reset}`, W - 2)} ${c.violet}│${c.reset}`);
  } else {
    lines.push(`${c.violet}│${c.reset} ${c.dim}${pad('DATE        DEEP                 VERDICT        FINDING', W - 2)}${c.reset} ${c.violet}│${c.reset}`);
    for (const r of recent) {
      const row =
        `${pad(r.date, 11)} ` +
        `${c.magenta}${pad(r.deep, 20)}${c.reset} ` +
        `${verdictColor(r.verdict)}${pad(r.verdict, 14)}${c.reset} ` +
        `${pad(r.finding, 28)}`;
      lines.push(`${c.violet}│${c.reset} ${pad(row, W - 2)} ${c.violet}│${c.reset}`);
    }
  }

  // Signals footer.
  lines.push(`${c.violet}├${bar}┤${c.reset}`);
  const sig: string[] = [];
  if (signals.zeroMergeStreak) sig.push(`${c.yellow}⚠ zero merges in ${signals.nightsConsidered} nights${c.reset}`);
  if (signals.blockedEvalStreak) sig.push(`${c.yellow}⚠ eval blocked streak${c.reset}`);
  if (signals.lowScoreStreak) sig.push(`${c.yellow}⚠ low-score streak${c.reset}`);
  if (signals.duplicateDirections.length) sig.push(`${c.yellow}⚠ ${signals.duplicateDirections.length} duplicate direction(s)${c.reset}`);
  const sigLine = sig.length ? sig.join('   ') : `${c.green}✓ signals nominal${c.reset}`;
  lines.push(`${c.violet}│${c.reset} ${pad(sigLine, W - 2)} ${c.violet}│${c.reset}`);
  lines.push(`${c.violet}│${c.reset} ${pad(`${c.dim}evaluation is not promotion · the machine never merges · a human does${c.reset}`, W - 2)} ${c.violet}│${c.reset}`);
  lines.push(`${c.violet}╰${bar}╯${c.reset}`);

  return lines.join('\n');
}

/** Group rows by deep surface — small helper the dashboard/analytics can use. */
export function bySurface(rows: LedgerRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.deep] = (out[r.deep] ?? 0) + 1;
  return out;
}

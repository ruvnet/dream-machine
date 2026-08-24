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

function pad(s: string, n: number): string {
  const clean = s.replace(/\x1b\[[0-9;]*m/g, '');
  if (clean.length > n) return s.slice(0, Math.max(0, n - 1)) + '…';
  return s + ' '.repeat(n - clean.length);
}

export interface DashboardOptions {
  /** Disable ANSI color (for termshot / non-tty). */
  noColor?: boolean;
  /** How many recent nights to show. */
  limit?: number;
  /** Repo name for the header. */
  repo?: string;
  /**
   * PR numbers confirmed merged (e.g. via the GitHub API), so the zero-merge
   * signal reflects real state instead of defaulting to "nothing merged".
   * See `learningSignals`' `mergedPrNumbers` option.
   */
  mergedPrNumbers?: Set<string>;
}

/** Render the dashboard framebuffer from a ledger markdown string. */
export function renderDashboard(ledgerMd: string, opts: DashboardOptions = {}): string {
  const c = opts.noColor ? new Proxy({}, { get: () => '' }) as typeof C : C;
  const { rows } = parseLedger(ledgerMd);
  const stats = verdictStats(rows);
  const signals = learningSignals(rows, { mergedPrNumbers: opts.mergedPrNumbers });
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

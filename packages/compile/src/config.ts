/**
 * The `dream.config` schema — the per-repo delta set that, together with the
 * canonical template, fully determines a target's nightly routine prompt.
 */

export interface DreamSlot {
  /** The deep-dive surface for this rotation slot. */
  deep: string;
  /** Two lighter scan surfaces. */
  scan: [string, string] | string[];
}

export interface BuildStep {
  /** Shell command to build the checkout, e.g. "npm ci && npm run build". */
  cmd: string;
  /** If true, a wasm/NAPI build failure is a recorded degradation, not a stop. */
  degradeOnWasmFailure?: boolean;
}

export interface EvaluatorEntrypoints {
  /** Command/glob for the benchmark corpus, e.g. an experiments run script. */
  bench?: string;
  /** Flywheel gate entrypoint, if the target ships one. */
  flywheel?: string;
  /** Darwin evolution entrypoint. */
  darwin?: string;
  /** Red/blue adversarial entrypoint. */
  redblue?: string;
}

export type AdrConvention = '3-digit' | '4-digit' | { pad: number; dir: string };

export interface RuosEvaluation {
  enabled: true;
  /** Dedicated isolated desktop identifier; never a command or URL. */
  machine: string;
  requireScreenshot: true;
  /** Evidence freshness limit, 60 seconds through 24 hours. */
  maxReceiptAgeSeconds: number;
}

export interface DreamConfig {
  /** Target repo, "owner/name". */
  repo: string;
  /** 5-field UTC cron. Minimum interval 1 hour. */
  cron: string;
  /** Rotation slots, keyed by `date % slots.length`. */
  slots: DreamSlot[];
  /** Bonus deep-dives keyed by day-of-year modulus, e.g. { "25": "vertical-packs" }. */
  bonusModuli?: Record<string, string>;
  /** Shell probes for STEP 0.5 control-plane discovery. */
  controlPlaneProbes?: string[];
  /** Optional build step run before discovery. */
  buildStep?: BuildStep;
  /** Where the real evaluators live. */
  evaluatorEntrypoints?: EvaluatorEntrypoints;
  /** ADR numbering + directory convention for STEP 19. */
  adrConvention?: AdrConvention;
  /** Competitor list injected into STEP 3 research. */
  competitors?: string[];
  /** Extra repo-specific disciplines (e.g. "adr-250-proof-ladder"). */
  extraDisciplines?: string[];
  /** Path to the durable ledger. Default docs/dream-cycle/LEDGER.md. */
  ledgerPath?: string;
  /** Branch prefix for candidate branches. Default "dream/". */
  branchPrefix?: string;
  /** Issue labels. Default ["dream-cycle","research"]. */
  labels?: string[];
  /** If true, the guarded auto-merge policy is described in the PR step. */
  autoMerge?: boolean;
  /** Optional independent desktop evaluation; never grants promotion authority. */
  ruosEvaluation?: RuosEvaluation;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const CRON_RE = /^(\S+\s+){4}\S+$/;
const FIXED_MINUTE_RE = /^(?:[0-9]|[1-5][0-9])$/;

/** Validate a dream.config, returning structured errors (never throws). */
export function validateConfig(config: Partial<DreamConfig>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.repo || !/^[\w.-]+\/[\w.-]+$/.test(config.repo)) {
    errors.push('repo must be "owner/name"');
  }
  if (typeof config.cron !== 'string' || !CRON_RE.test(config.cron.trim())) {
    errors.push('cron must be a 5-field expression');
  } else {
    const [minute] = config.cron.trim().split(/\s+/);
    if (!FIXED_MINUTE_RE.test(minute)) {
      errors.push('cron minute field must be a single value from 0 to 59; minimum interval is 1 hour');
    }
  }
  if (!config.slots || config.slots.length === 0) {
    errors.push('at least one rotation slot is required');
  } else {
    config.slots.forEach((s, i) => {
      if (!s.deep) errors.push(`slot ${i}: missing "deep" surface`);
      if (!s.scan || s.scan.length < 1) warnings.push(`slot ${i}: no scan surfaces`);
    });
  }
  if (config.bonusModuli) {
    for (const [k, v] of Object.entries(config.bonusModuli)) {
      if (!/^\d+$/.test(k)) errors.push(`bonusModuli key "${k}" must be an integer`);
      if (typeof v !== 'string' || v.trim().length === 0) {
        errors.push(`bonusModuli["${k}"] must be a non-empty string`);
      }
    }
  }
  if (config.adrConvention && typeof config.adrConvention === 'object') {
    const { pad, dir } = config.adrConvention;
    if (!Number.isInteger(pad) || pad < 1) {
      errors.push('adrConvention.pad must be a positive integer');
    }
    if (typeof dir !== 'string' || dir.trim().length === 0) {
      errors.push('adrConvention.dir must be a non-empty string');
    }
  }
  if (config.ruosEvaluation !== undefined) {
    const r = config.ruosEvaluation;
    if (r === null || typeof r !== 'object' || Array.isArray(r)) {
      errors.push('ruosEvaluation must be an object');
    } else {
      const allowed = ['enabled', 'machine', 'requireScreenshot', 'maxReceiptAgeSeconds'];
      if (Object.keys(r).some(k => !allowed.includes(k))) errors.push('ruosEvaluation contains unknown fields');
      if (r.enabled !== true) errors.push('ruosEvaluation.enabled must be true; omit the option to disable');
      if (typeof r.machine !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(r.machine)) {
        errors.push('ruosEvaluation.machine must be an opaque safe identifier of 1 to 128 characters');
      }
      if (r.requireScreenshot !== true) errors.push('ruosEvaluation.requireScreenshot must be true');
      if (!Number.isInteger(r.maxReceiptAgeSeconds) || r.maxReceiptAgeSeconds < 60 || r.maxReceiptAgeSeconds > 86400) {
        errors.push('ruosEvaluation.maxReceiptAgeSeconds must be an integer from 60 to 86400');
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Fill defaults over a partial config after validation passes. */
export function withDefaults(config: DreamConfig): Required<Omit<DreamConfig, 'buildStep' | 'bonusModuli' | 'ruosEvaluation'>> &
  Pick<DreamConfig, 'buildStep' | 'bonusModuli' | 'ruosEvaluation'> {
  return {
    repo: config.repo,
    cron: config.cron.trim(),
    slots: config.slots,
    bonusModuli: config.bonusModuli,
    buildStep: config.buildStep,
    controlPlaneProbes: config.controlPlaneProbes ?? [],
    evaluatorEntrypoints: config.evaluatorEntrypoints ?? {},
    adrConvention: config.adrConvention ?? '4-digit',
    competitors: config.competitors ?? ['LangGraph', 'AutoGen', 'CrewAI', 'OpenAI Agents SDK', 'DSPy/GEPA'],
    extraDisciplines: config.extraDisciplines ?? [],
    ledgerPath: config.ledgerPath ?? 'docs/dream-cycle/LEDGER.md',
    branchPrefix: config.branchPrefix ?? 'dream/',
    labels: config.labels ?? ['dream-cycle', 'research'],
    autoMerge: config.autoMerge ?? false,
    ...(config.ruosEvaluation === undefined ? {} : { ruosEvaluation: { ...config.ruosEvaluation } }),
  };
}

/** A sensible starter config for a new target repo. */
export function defaultConfig(repo: string): DreamConfig {
  return {
    repo,
    cron: '0 8 * * *',
    slots: [
      { deep: 'correctness', scan: ['performance', 'tests'] },
      { deep: 'security', scan: ['dependencies', 'secrets'] },
      { deep: 'architecture', scan: ['docs', 'api'] },
      { deep: 'performance', scan: ['memory', 'latency'] },
      { deep: 'developer-experience', scan: ['ci', 'tooling'] },
    ],
    bonusModuli: { '25': 'roadmap-review' },
    controlPlaneProbes: ['npm run --silent 2>/dev/null || true', 'ls package.json && cat package.json | head -40'],
    buildStep: { cmd: 'npm ci && npm run build', degradeOnWasmFailure: true },
    evaluatorEntrypoints: { bench: 'npm test' },
    adrConvention: '4-digit',
    competitors: ['LangGraph', 'AutoGen', 'CrewAI', 'OpenAI Agents SDK', 'DSPy/GEPA'],
    ledgerPath: 'docs/dream-cycle/LEDGER.md',
    branchPrefix: 'dream/',
    labels: ['dream-cycle', 'research'],
    autoMerge: false,
  };
}

export function adrDir(conv: AdrConvention): string {
  if (typeof conv === 'object') return conv.dir;
  return 'docs/adrs';
}
export function adrPad(conv: AdrConvention): number {
  if (typeof conv === 'object') return conv.pad;
  return conv === '3-digit' ? 3 : 4;
}

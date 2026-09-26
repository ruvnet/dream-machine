export interface RuosReceipt {
  schemaVersion: 1;
  status: 'ACCEPT' | 'REJECT' | 'INCONCLUSIVE';
  reasons: string[];
  authority: 'none';
  mergeEligible: false;
  scope: string;
  [key: string]: unknown;
}

export function digest(value: unknown): string;
export function validateImageBytes(bytes: Buffer, mime: unknown): boolean;
export function evaluateObservation(observation: unknown, policy: unknown, nowMs?: number): RuosReceipt;
export function evaluatePair(baseline: unknown, candidate: unknown, policy: unknown, nowMs?: number): RuosReceipt;
export function evaluateDocuments(input: unknown, policy: unknown, nowMs?: number): RuosReceipt;
export function invalidInputReceipt(): RuosReceipt;
export function receiptExitCode(receipt: RuosReceipt): number;

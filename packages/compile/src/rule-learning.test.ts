import { describe, it, expect } from 'vitest';
import { evaluateRuleCandidates, executeRule, verifyRuleReceipt, ruleHash, type RuleCandidate, type Transition } from './rule-learning.js';
const c: RuleCandidate = { schemaVersion: 1, candidateId: 'action', rulebook: 'Add action to x.', program: [{op:'addAction',key:'x'}] };
const t: Transition = {state:{x:1},action:2,nextState:{x:3}};
describe('bounded rule learning', () => {
  it('replays exact transitions with deterministic immutable receipts', () => {
    const input = structuredClone(c); const a=evaluateRuleCandidates([input],[t],[t])[0]!;
    expect(a.accepted).toBe(true); expect(verifyRuleReceipt(a)).toBe(true);
    expect(evaluateRuleCandidates([c],[t],[t])[0]).toEqual(a);
    input.rulebook='changed'; expect(a.candidate.rulebook).toBe(c.rulebook);
    a.accepted=false; expect(verifyRuleReceipt(a)).toBe(false);
  });
  it('rejects failed hidden probes and binds a repair to its counterexample', () => {
    const wrong={...c,program:[{op:'add' as const,key:'x',value:1}]};
    const parent=evaluateRuleCandidates([wrong],[t],[t])[0]!; expect(parent.accepted).toBe(false);
    const repair={...c,parentReceiptHash:parent.receiptHash,counterexampleHash:ruleHash(t)};
    const child=evaluateRuleCandidates([repair],[t],[t],[parent])[0]!;
    expect(verifyRuleReceipt(child,[parent])).toBe(true);
    expect(() => evaluateRuleCandidates([repair],[t],[t])).toThrow();
    expect(() => evaluateRuleCandidates([{...repair,counterexampleHash:'a'.repeat(64)}],[t],[t],[parent])).toThrow();
    expect(verifyRuleReceipt({...child,failures:['forged']},[parent])).toBe(false);
    const forged=structuredClone(parent);
    forged.candidate.parentReceiptHash='' as string;
    expect(() => evaluateRuleCandidates([c],[t],[t],[forged])).toThrow();
  });
  it('rejects malformed ops, arithmetic overflow, dangerous keys and accessors', () => {
    expect(() => executeRule({...c,program:[{op:'eval',key:'x'}] as never},{x:1},1)).toThrow();
    expect(() => executeRule(c,{x:Number.MAX_SAFE_INTEGER},1)).toThrow();
    expect(() => executeRule(c,JSON.parse('{"__proto__":1}'),1)).toThrow();
    expect(() => executeRule(c,{get x(): number {throw Error('must not execute');}},1)).toThrow('Accessors');
    expect(() => executeRule({...c,extra:1} as RuleCandidate,{x:1},1)).toThrow();
    expect(() => executeRule(c,{x:Infinity},1)).toThrow();
  });
  it('enforces bounded populations, programs, prose and nonempty host probes', () => {
    expect(() => evaluateRuleCandidates([c],[t],[])).toThrow();
    expect(() => evaluateRuleCandidates([c],Array(2),Array(2))).toThrow();
    expect(() => evaluateRuleCandidates(Array(17).fill(c),[t],[t])).toThrow();
    expect(() => executeRule({...c,program:Array(33).fill(c.program[0])},{x:1},1)).toThrow();
    expect(() => executeRule({...c,rulebook:'😀'.repeat(1025)},{x:1},1)).toThrow();
    expect(() => evaluateRuleCandidates([c,c],[t],[t])).toThrow();
    const extra=[t]; Object.defineProperty(extra,'hidden',{value:1});
    expect(() => evaluateRuleCandidates([c],extra,[t])).toThrow();
    const getters=[t]; Object.defineProperty(getters,'0',{get(){throw Error('executed');}});
    expect(() => evaluateRuleCandidates([c],getters,[t])).toThrow('dense');
  });
  it('competes on unseen synthetic transitions across three families and five seeds', () => {
    for (const op of ['add','multiply','addAction'] as const) for(let seed=1;seed<=5;seed++) {
      const good={...c,candidateId:op,program:[op==='addAction'?{op,key:'x'}:{op,key:'x',value:2}]};
      const make=(x:number):Transition=>({state:{x},action:seed,nextState:executeRule(good,{x},seed)});
      const receipts=evaluateRuleCandidates([good,{...c,candidateId:'wrong',program:[{op:'set',key:'x',value:-999}]}],[make(seed)],[make(seed+10)]);
      expect(receipts.map(r=>r.accepted)).toEqual([true,false]);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { inferRuleCandidates, evaluateRuleCandidates, type Transition } from './rule-learning.js';
const t=(x:number,next:number,action=1):Transition=>({state:{x},action,nextState:{x:next}});
describe('observation-only finite rule proposer',()=>{
  it('infers an affine rule without a supplied solution and integrates held-out evaluation',()=>{
    const observed=[t(2,7),t(5,13)];
    const result=inferRuleCandidates(observed);
    expect(result.searchComplete).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(evaluateRuleCandidates(result.candidates,observed,[t(10,23)]).every(r=>r.accepted)).toBe(true);
    expect(inferRuleCandidates(observed)).toEqual(result);
  });
  it('retains ambiguous compatible explanations instead of asserting certainty',()=>{
    const result=inferRuleCandidates([t(2,4,2)]);
    expect(result.compatibleHypotheses).toBeGreaterThan(1);
    const receipts=evaluateRuleCandidates(result.candidates,[t(2,4,2)],[t(3,6,1)]);
    expect(receipts.some(r=>r.accepted)).toBe(true);
    expect(receipts.some(r=>!r.accepted)).toBe(true);
  });
  it('reports no explanation for an unrepresentable nonlinear mapping',()=>{
    const result=inferRuleCandidates([t(2,4),t(3,9),t(4,16)]);
    expect(result.candidates).toEqual([]); expect(result.searchComplete).toBe(true);
  });
  it('caps work and reports incomplete search, validates options and arrays',()=>{
    const result=inferRuleCandidates([t(2,4)],{maxHypotheses:1});
    expect(result.testedHypotheses).toBe(1); expect(result.searchComplete).toBe(false);
    expect(()=>inferRuleCandidates([t(2,4)],{maxHypotheses:4097})).toThrow();
    expect(()=>inferRuleCandidates([t(2,4)],{constants:Array(2)})).toThrow();
    expect(()=>inferRuleCandidates([t(2,4)],{constants:[Infinity]})).toThrow();
    expect(()=>inferRuleCandidates([t(2,4)],{hiddenProbes:[]} as never)).toThrow();
  });
  it('does not mutate observation data and ignores object field insertion order',()=>{
    const input=[t(2,7),t(5,13)]; const copy=structuredClone(input);
    inferRuleCandidates(input); expect(input).toEqual(copy);
    const a={state:{x:2,y:8},action:1,nextState:{x:4,y:8}};
    const b={state:{y:8,x:2},action:1,nextState:{y:8,x:4}};
    expect(inferRuleCandidates([a])).toEqual(inferRuleCandidates([b]));
  });
});

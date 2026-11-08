import {evaluateRuleCandidates,executeRule,ruleHash} from '../packages/compile/dist/rule-learning.js';
/** Research-only scoped surrogate. Caller owns oracle identity and public data classification. */
export function validatedRuleCache({candidate,training,confirmation,scope,auditEvery=10,bounds}) {
  if(typeof scope!=='string'||!scope||!Number.isInteger(auditEvery)||auditEvery<1||auditEvery>10||confirmation.length<20)throw Error('Invalid cache policy');
  const inputs=new Set(training.map(t=>ruleHash({state:t.state,action:t.action})));
  const probeInputs=new Set(confirmation.map(t=>ruleHash({state:t.state,action:t.action})));
  if(probeInputs.size!==confirmation.length||confirmation.some(t=>inputs.has(ruleHash({state:t.state,action:t.action}))))throw Error('Independent confirmation required');
  if(!evaluateRuleCandidates([candidate],training,confirmation)[0].accepted)throw Error('Unconfirmed rule');
  if(!bounds||!Object.keys(bounds).length||Object.values(bounds).some(b=>!Array.isArray(b)||b.length!==2||!b.every(Number.isSafeInteger)||b[0]>b[1]))throw Error('Invalid bounds');
  const frozen=structuredClone(candidate),ranges=structuredClone(bounds);let calls=0,revoked=false;
  const events=[];
  return {events,async predict(state,action,currentScope,oracle){
    const input={...state,action};const n=++calls;
    const supported=currentScope===scope&&!revoked&&Object.keys(input).sort().join()===Object.keys(ranges).sort().join()&&Object.entries(input).every(([k,v])=>Number.isSafeInteger(v)&&v>=ranges[k][0]&&v<=ranges[k][1]);
    let predicted=null;if(supported){try{predicted=executeRule(frozen,state,action);}catch{}}
    const audit=predicted!==null&&n%auditEvery===0;
    let actual=null;if(predicted===null||audit)actual=await oracle(structuredClone(state),action);
    const drift=audit&&ruleHash(actual)!==ruleHash(predicted);if(drift)revoked=true;
    const output=actual??predicted;
    events.push({sequence:n,inputHash:ruleHash({state,action}),candidateHash:ruleHash(frozen),scopeMatch:currentScope===scope,audit,drift,revoked,source:actual!==null?'oracle':'learned',outputHash:ruleHash(output)});
    return output;
  }};
}

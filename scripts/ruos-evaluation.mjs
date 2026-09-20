/**
 * ruOS evidence schema v1. Trusted policy is supplied independently of PR evidence.
 * policy: {schemaVersion:1, bindings:{candidateCommit,baseCommit,sourceCommit,
 * evaluatorDigest,runNonce,machineId,workloadDigest,environmentDigest},
 * expectedTenant, assertionIds:string[], caseIds:string[], ttlMs,
 * maxFutureSkewMs,minSamples,maxLatencyRegression,maxCostRegression,maxSuccessDrop}.
 * Commit values are 40 lowercase hex; digests are 64 lowercase hex. Bounds are
 * nonnegative finite numbers; minSamples is a positive integer, TTL positive.
 * observation: {schemaVersion:1,bindings:{...policy.bindings,policyDigest:digest(policy)},
 * timestampMs,status:'ok',exitCode:0,tenant:{id,verified:true},
 * assertions:[{id,pass:boolean}], screenshot:{encoding:'base64',mime,data,sha256},
 * humanTakeover:false,contaminated:false,cases:[{id,samples,latencyMs,cost,successRate}]}.
 * PNG/JPEG bytes receive bounded structural validation, NOT visual verification.
 * Assertions must come from a trusted independent runner; hashes are binding, not
 * authentication. This module cannot establish collector trust or grant authority.
 * completionVersion:1 and completionVerified:true must be supplied by an authenticated executor completion
 * collector, never inferred from stdout. Collector trust is external to this parser.
 * Observations require arm:'baseline' / arm:'candidate' and executedCommit equal
 * to the trusted baseCommit / candidateCommit respectively.
 * CLI: node scripts/ruos-evaluation.mjs observation.json trusted-policy.json
 * Pair input is {baseline,candidate}; output never copies arbitrary input strings.
 */
import { createHash } from 'node:crypto';
import { readFileSync, openSync, fstatSync, closeSync, constants } from 'node:fs';
import { pathToFileURL } from 'node:url';

function canonical(value) {
  let nodes=0;
  const seen=new Set();
  const walk=(v,depth)=>{
    if(++nodes>10000||depth>32)throw new Error('INVALID_JSON_VALUE');
    if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);
    if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
    if(!v||typeof v!=='object'||seen.has(v))throw new Error('INVALID_JSON_VALUE');
    seen.add(v);
    let out;
    if(Array.isArray(v)){
      if(Object.getPrototypeOf(v)!==Array.prototype||Object.getOwnPropertySymbols(v).length||Object.keys(v).length!==v.length||Object.getOwnPropertyNames(v).length!==v.length+1)throw new Error('INVALID_JSON_VALUE');
      const parts=[];
      for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!Object.hasOwn(d,'value'))throw new Error('INVALID_JSON_VALUE');parts.push(walk(d.value,depth+1));}
      out='['+parts.join(',')+']';
    }
    else {
      if(Object.getPrototypeOf(v)!==Object.prototype||Object.getOwnPropertySymbols(v).length)throw new Error('INVALID_JSON_VALUE');
      const keys=Object.keys(v).sort();
      if(Object.getOwnPropertyNames(v).length!==keys.length)throw new Error('INVALID_JSON_VALUE');
      if(keys.some(k=>!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value')))throw new Error('INVALID_JSON_VALUE');
      out='{'+keys.map(k=>JSON.stringify(k)+':'+walk(v[k],depth+1)).join(',')+'}';
    }
    seen.delete(v);return out;
  };
  return walk(value,0);
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const hash = value => createHash('sha256').update(value).digest('hex');
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v,keys) => object(v) && Object.keys(v).every(k=>keys.includes(k) && Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));
const hex = (v,n) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const token = v => typeof v === 'string' && /^[A-Za-z0-9_.:/@-]{1,200}$/.test(v);
const nonnegative = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const ids = v => Array.isArray(v) && v.length > 0 && v.length <= 1000 && v.every(token) && new Set(v).size === v.length;
const bindingKeys = ['candidateCommit','baseCommit','sourceCommit','evaluatorDigest','runNonce','machineId','workloadDigest','environmentDigest'];
function validPolicy(p) {
  return exact(p,['schemaVersion','bindings','expectedTenant','assertionIds','caseIds','ttlMs','maxFutureSkewMs','minSamples','maxLatencyRegression','maxCostRegression','maxSuccessDrop']) && p.schemaVersion === 1 && exact(p.bindings,bindingKeys) &&
    bindingKeys.every(k => k.endsWith('Commit') ? hex(p.bindings[k],40) : k.endsWith('Digest') ? hex(p.bindings[k],64) : token(p.bindings[k])) &&
    token(p.expectedTenant) && ids(p.assertionIds) && ids(p.caseIds) &&
    ['ttlMs','maxFutureSkewMs','maxLatencyRegression','maxCostRegression','maxSuccessDrop'].every(k=>nonnegative(p[k])) &&
    p.ttlMs > 0 && p.ttlMs<=86400000 && p.maxFutureSkewMs<=60000 && p.maxLatencyRegression<=1 && p.maxCostRegression<=1 && p.minSamples<=1000000 && p.maxSuccessDrop <= 1 && Number.isSafeInteger(p.minSamples) && p.minSamples > 0;
}
function result(status,reasons) { return {schemaVersion:1,status,reasons:[...new Set(reasons)].sort(),authority:'none',mergeEligible:false,scope:'observation-contract',performanceImprovementClaimed:false,policyDigest:null,observationDigest:null,baselineDigest:null,candidateDigest:null,evaluatedAtMs:null,validUntilMs:null}; }
function screenshotValid(s) {
  if (!exact(s,['encoding','mime','data','sha256']) || s.encoding !== 'base64' || typeof s.data !== 'string' || s.data.length > 16*1024*1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s.data)) return false;
  const b=Buffer.from(s.data,'base64');
  if (b.length < 24 || !hex(s.sha256,64) || hash(b)!==s.sha256) return false;
  if (s.mime==='image/png') {
    if (!b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) return false;
    let pos=8, ihdr=false, idat=false;
    while(pos+12<=b.length){
      const n=b.readUInt32BE(pos); if(n>b.length-pos-12) return false;
      const type=b.toString('ascii',pos+4,pos+8);
      if(!ihdr){if(type!=='IHDR'||n!==13||!b.readUInt32BE(pos+8)||!b.readUInt32BE(pos+12))return false;ihdr=true;}
      if(type==='IDAT' && n>0) idat=true;
      pos+=n+12;
      if(type==='IEND') return n===0 && idat && pos===b.length;
    }
    return false;
  }
  if(s.mime==='image/jpeg') {
    if(b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)return false;
    let p=2, frame=false;
    while(p+4<b.length){
      if(b[p++]!==255)return false;
      while(b[p]===255)p++;
      const marker=b[p++]; if(p+2>b.length)return false; const n=b.readUInt16BE(p);
      if(n<2||p+n>b.length)return false;
      if([192,193,194].includes(marker)){if(n<8||!b.readUInt16BE(p+3)||!b.readUInt16BE(p+5))return false;frame=true;}
      if(marker===218)return frame && n>=6 && p+n<b.length-2;
      p+=n;
    }
  }
  return false;
}
function evaluateObservationRaw(o,p,nowMs=Date.now()) {
  const reject=[],missing=[];
  if(!validPolicy(p)||!nonnegative(nowMs))return result('REJECT',['INVALID_POLICY']);
  let policyDigest;
  try { policyDigest=digest(p); } catch { return result('REJECT',['INVALID_POLICY']); }
  if(!object(o))return result('INCONCLUSIVE',['MISSING_OBSERVATION']);
  if(!exact(o,['schemaVersion','arm','executedCommit','completionVersion','completionVerified','bindings','timestampMs','status','exitCode','tenant','assertions','screenshot','humanTakeover','contaminated','cases']))reject.push('INVALID_SCHEMA');
  if(o.completionVersion!==1||o.completionVerified!==true)missing.push('MISSING_COMPLETION_PROVENANCE');
  if(o.schemaVersion!==1)reject.push('INVALID_SCHEMA');
  if(!['baseline','candidate'].includes(o.arm))reject.push('INVALID_PAIR_ARMS');
  else if(o.executedCommit!==p.bindings[o.arm==='baseline'?'baseCommit':'candidateCommit'])reject.push('EXECUTED_COMMIT_MISMATCH');
  if(!object(o.bindings))missing.push('MISSING_BINDINGS');
  else if(!exact(o.bindings,[...bindingKeys,'policyDigest']))reject.push('BINDING_MISMATCH');
  else if([...bindingKeys,'policyDigest'].some(k=>o.bindings[k] !== (k==='policyDigest'?policyDigest:p.bindings[k])))reject.push('BINDING_MISMATCH');
  if(o.timestampMs===undefined)missing.push('MISSING_TIMESTAMP');
  else if(!nonnegative(o.timestampMs)||o.timestampMs>nowMs+p.maxFutureSkewMs)reject.push('INVALID_TIMESTAMP');
  else if(nowMs-o.timestampMs>p.ttlMs)missing.push('STALE_OBSERVATION');
  if(o.status===undefined||o.exitCode===undefined||o.exitCode===null)missing.push('MISSING_EXECUTION_RESULT');
  else if(o.status!=='ok'||o.exitCode!==0)reject.push('EXECUTION_FAILED');
  if(object(o.tenant)&&!exact(o.tenant,['id','verified']))reject.push('INVALID_SCHEMA');
  if(!object(o.tenant)||o.tenant.verified!==true)missing.push('UNVERIFIED_TENANT');
  if(object(o.tenant)&&o.tenant.id!==undefined&&o.tenant.id!==p.expectedTenant)reject.push('TENANT_MISMATCH');
  if(object(o.tenant)&&o.tenant.id===undefined)missing.push('MISSING_TENANT');
  for(const key of ['humanTakeover','contaminated']) {
    if(o[key]===true)reject.push(key==='humanTakeover'?'HUMAN_TAKEOVER':'CONTAMINATED');
    else if(o[key]!==false)missing.push('MISSING_ISOLATION_EVIDENCE');
  }
  if(!Array.isArray(o.assertions))missing.push('MISSING_ASSERTIONS');
  else if(o.assertions.length>1000)reject.push('INVALID_ASSERTIONS');
  else {
    const seen=new Set();
    for(const a of o.assertions){
      if(!exact(a,['id','pass'])||!p.assertionIds.includes(a.id)||seen.has(a.id)){reject.push('INVALID_ASSERTIONS');continue;}
      seen.add(a.id);
      if(a.pass===false)reject.push('ASSERTION_FAILED');else if(a.pass!==true)missing.push('INCOMPLETE_ASSERTIONS');
    }
    if(p.assertionIds.some(id=>!seen.has(id)))missing.push('MISSING_ASSERTIONS');
  }
  if(o.screenshot===undefined||o.screenshot===null)missing.push('MISSING_SCREENSHOT');
  else if(!screenshotValid(o.screenshot))reject.push('INVALID_SCREENSHOT');
  if(!Array.isArray(o.cases))missing.push('MISSING_CASES');
  else if(o.cases.length>1000)reject.push('INVALID_CASES');
  else {
    const seen=new Set();
    for(const c of o.cases){
      if(!exact(c,['id','samples','latencyMs','cost','successRate'])||!p.caseIds.includes(c.id)||seen.has(c.id)){reject.push('INVALID_CASES');continue;}
      seen.add(c.id);
      if(!Number.isSafeInteger(c.samples)||c.samples<0||!['latencyMs','cost','successRate'].every(k=>nonnegative(c[k]))||c.successRate>1)reject.push('INVALID_METRICS');
      else if(c.samples<p.minSamples)missing.push('INSUFFICIENT_SAMPLES');
    }
    if(p.caseIds.some(id=>!seen.has(id)))missing.push('MISSING_CASES');
  }
  return result(reject.length?'REJECT':missing.length?'INCONCLUSIVE':'ACCEPT',[...reject,...missing]);
}
function evaluatePairRaw(b,c,p,nowMs=Date.now()) {
  const br=evaluateObservation(b,p,nowMs),cr=evaluateObservation(c,p,nowMs);
  if(br.status==='REJECT'||cr.status==='REJECT')return result('REJECT',[...br.reasons,...cr.reasons]);
  if(br.status!=='ACCEPT'||cr.status!=='ACCEPT')return result('INCONCLUSIVE',[...br.reasons,...cr.reasons]);
  if(b.arm!=='baseline'||c.arm!=='candidate')return result('REJECT',['INVALID_PAIR_ARMS']);
  const reasons=[];
  for(const id of p.caseIds){
    const x=b.cases.find(v=>v.id===id),y=c.cases.find(v=>v.id===id);
    if(y.latencyMs>x.latencyMs*(1+p.maxLatencyRegression))reasons.push('LATENCY_REGRESSION');
    if(y.cost>x.cost*(1+p.maxCostRegression))reasons.push('COST_REGRESSION');
    if(x.successRate-y.successRate>p.maxSuccessDrop+Number.EPSILON)reasons.push('SUCCESS_REGRESSION');
  }
  return result(reasons.length?'REJECT':'ACCEPT',reasons);
}
// Receipts bind exact canonical evidence. Hashes are not signatures: consumers must
// authenticate the collector, recheck current policy/commits and enforce expiry.
const safeDigest = value => { try { return digest(value); } catch { return null; } };
function receiptBindings(policy,observations,nowMs) {
  if(!validPolicy(policy)||!nonnegative(nowMs))return {};
  const policyDigest=safeDigest(policy);
  if(!policyDigest)return {};
  const deadlines=observations.map(o=>object(o)&&nonnegative(o.timestampMs)&&Number.isFinite(o.timestampMs+policy.ttlMs)?Math.min(o.timestampMs+policy.ttlMs,nowMs+policy.ttlMs):null);
  return {policyDigest,evaluatedAtMs:nowMs,validUntilMs:deadlines.every(v=>v!==null)?Math.min(...deadlines):null};
}
export function evaluateObservation(o,p,nowMs=Date.now()) {
  if(safeDigest(p)===null)return result('REJECT',['INVALID_POLICY']);
  if(o!==undefined&&safeDigest(o)===null)return result('REJECT',['INVALID_SCHEMA']);
  const r=evaluateObservationRaw(o,p,nowMs);
  const bindings=receiptBindings(p,[o],nowMs);
  return {...r,...bindings,observationDigest:bindings.policyDigest?safeDigest(o):null};
}
export function evaluatePair(b,c,p,nowMs=Date.now()) {
  if(safeDigest(p)===null)return {...result('REJECT',['INVALID_POLICY']),scope:'paired-regression'};
  if((b!==undefined&&safeDigest(b)===null)||(c!==undefined&&safeDigest(c)===null))return {...result('REJECT',['INVALID_SCHEMA']),scope:'paired-regression'};
  const r=evaluatePairRaw(b,c,p,nowMs);
  const bindings=receiptBindings(p,[b,c],nowMs);
  return {...r,...bindings,scope:'paired-regression',baselineDigest:bindings.policyDigest?safeDigest(b):null,candidateDigest:bindings.policyDigest?safeDigest(c):null};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  let receipt;
  try {
    if(process.argv.length!==4)throw new Error();
    const read=p=>{const fd=openSync(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const st=fstatSync(fd);if(!st.isFile()||st.size>24*1024*1024)throw new Error();const b=readFileSync(fd);if(b.length>24*1024*1024)throw new Error();return JSON.parse(b.toString('utf8'));}finally{closeSync(fd);}};
    const input=read(process.argv[2]),policy=read(process.argv[3]);
    if(object(input)&&('baseline'in input||'candidate'in input)&&!exact(input,['baseline','candidate']))throw new Error();
    receipt=object(input)&&('baseline'in input||'candidate'in input)?evaluatePair(input.baseline,input.candidate,policy):evaluateObservation(input,policy);
  }catch{receipt=result('REJECT',['INVALID_INPUT']);}
  process.stdout.write(JSON.stringify(receipt)+'\n');
  process.exitCode=receipt.status==='ACCEPT'?0:receipt.status==='REJECT'?1:2;
}

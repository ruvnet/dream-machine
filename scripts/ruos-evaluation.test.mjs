import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { digest,evaluateObservation,evaluatePair } from './ruos-evaluation.mjs';
const now=100000;
function fixture(){
 const p={schemaVersion:1,bindings:{candidateCommit:'a'.repeat(40),baseCommit:'b'.repeat(40),sourceCommit:'c'.repeat(40),evaluatorDigest:'d'.repeat(64),runNonce:'nonce-123',machineId:'isolated-1',workloadDigest:'e'.repeat(64),environmentDigest:'f'.repeat(64)},expectedTenant:'test-tenant',assertionIds:['button','persisted'],caseIds:['overview'],ttlMs:1000,maxFutureSkewMs:0,minSamples:10,maxLatencyRegression:0.05,maxCostRegression:0.05,maxSuccessDrop:0};
 const data='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA1sAAAAASUVORK5CYII=';
 const o={schemaVersion:1,arm:'baseline',completionVersion:1,completionVerified:true,executedCommit:p.bindings.baseCommit,bindings:{...p.bindings,policyDigest:digest(p)},timestampMs:now,status:'ok',exitCode:0,tenant:{id:p.expectedTenant,verified:true},assertions:p.assertionIds.map(id=>({id,pass:true})),screenshot:{encoding:'base64',mime:'image/png',data,sha256:createHash('sha256').update(Buffer.from(data,'base64')).digest('hex')},humanTakeover:false,contaminated:false,cases:[{id:'overview',samples:10,latencyMs:100,cost:1,successRate:1}]};
 return {p,o};
}
test('valid observation is accepted without authority',()=>{const {p,o}=fixture();const r=evaluateObservation(o,p,now);assert.equal(r.status,'ACCEPT');assert.deepEqual(r.reasons,[]);assert.equal(r.authority,'none');assert.equal(r.mergeEligible,false);assert.equal(r.scope,'observation-contract');assert.equal(r.observationDigest,digest(o));assert.equal(r.policyDigest,digest(p));assert.equal(r.evaluatedAtMs,now);assert.equal(r.validUntilMs,now+p.ttlMs);});
for(const [name,mutate,status,reason] of [
 ['broken button',o=>o.assertions[0].pass=false,'REJECT','ASSERTION_FAILED'],
 ['wrong tenant',o=>o.tenant.id='other','REJECT','TENANT_MISMATCH'],
 ['unverified tenant',o=>o.tenant.verified=false,'INCONCLUSIVE','UNVERIFIED_TENANT'],
 ['missing tenant id',o=>delete o.tenant.id,'INCONCLUSIVE','MISSING_TENANT'],
 ['missing screenshot',o=>delete o.screenshot,'INCONCLUSIVE','MISSING_SCREENSHOT'],
 ['URL screenshot',o=>o.screenshot={url:'https://example.invalid/p.png'},'REJECT','INVALID_SCREENSHOT'],
 ['tampered image',o=>o.screenshot.sha256='0'.repeat(64),'REJECT','INVALID_SCREENSHOT'],
 ['stale SHA',o=>o.bindings.baseCommit='0'.repeat(40),'REJECT','BINDING_MISMATCH'],
 ['stale receipt',o=>o.timestampMs=now-1001,'INCONCLUSIVE','STALE_OBSERVATION'],
 ['future receipt',o=>o.timestampMs=now+1,'REJECT','INVALID_TIMESTAMP'],
 ['modified policy binding',o=>o.bindings.policyDigest='0'.repeat(64),'REJECT','BINDING_MISMATCH'],
 ['negative cost',o=>o.cases[0].cost=-1,'REJECT','INVALID_METRICS'],
 ['NaN latency',o=>o.cases[0].latencyMs=NaN,'REJECT','INVALID_SCHEMA'],
 ['infinite latency',o=>o.cases[0].latencyMs=Infinity,'REJECT','INVALID_SCHEMA'],
 ['duplicate assertion',o=>o.assertions.push(o.assertions[0]),'REJECT','INVALID_ASSERTIONS'],
 ['missing assertion',o=>o.assertions.pop(),'INCONCLUSIVE','MISSING_ASSERTIONS'],
 ['null exit with SUCCESS stdout',o=>{o.exitCode=null;},'INCONCLUSIVE','MISSING_EXECUTION_RESULT'],
 ['human takeover',o=>o.humanTakeover=true,'REJECT','HUMAN_TAKEOVER'],
 ['contamination',o=>o.contaminated=true,'REJECT','CONTAMINATED'],
 ['missing isolation',o=>delete o.contaminated,'INCONCLUSIVE','MISSING_ISOLATION_EVIDENCE'],
 ['too few samples',o=>o.cases[0].samples=1,'INCONCLUSIVE','INSUFFICIENT_SAMPLES'],
 ['duplicate case',o=>o.cases.push(o.cases[0]),'REJECT','INVALID_CASES'],
 ['missing case',o=>o.cases=[],'INCONCLUSIVE','MISSING_CASES'],
])test(name,()=>{const {p,o}=fixture();mutate(o);const r=evaluateObservation(o,p,now);assert.equal(r.status,status);assert.ok(r.reasons.includes(reason));assert.equal(r.mergeEligible,false);});
test('policy modification invalidates receipt',()=>{const {p,o}=fixture();p.maxCostRegression=10;assert.equal(evaluateObservation(o,p,now).status,'REJECT');});
test('invalid trusted policy fails closed',()=>{const {p,o}=fixture();delete p.minSamples;assert.deepEqual(evaluateObservation(o,p,now).reasons,['INVALID_POLICY']);});
test('stable canonical policy digest',()=>{assert.equal(digest({b:2,a:1}),digest({a:1,b:2}));assert.throws(()=>digest({a:NaN}));});
test('paired frozen evaluation accepts improvement',()=>{const {p,o}=fixture();const c=structuredClone(o);c.arm='candidate';c.executedCommit=p.bindings.candidateCommit;c.cases[0].latencyMs=90;assert.equal(evaluatePair(o,c,p,now).status,'ACCEPT');});
for(const [field,value,reason] of [['latencyMs',106,'LATENCY_REGRESSION'],['cost',1.06,'COST_REGRESSION'],['successRate',0.9,'SUCCESS_REGRESSION']])test('pair '+reason,()=>{const {p,o}=fixture();const c=structuredClone(o);c.arm='candidate';c.executedCommit=p.bindings.candidateCommit;c.cases[0][field]=value;assert.ok(evaluatePair(o,c,p,now).reasons.includes(reason));});
test('changed workload rejected even with passing cases',()=>{const {p,o}=fixture();const c=structuredClone(o);c.arm='candidate';c.executedCommit=p.bindings.candidateCommit;c.bindings.workloadDigest='0'.repeat(64);assert.equal(evaluatePair(o,c,p,now).status,'REJECT');});
test('same arm cannot be compared to itself',()=>{const {p,o}=fixture();assert.deepEqual(evaluatePair(o,o,p,now).reasons,['INVALID_PAIR_ARMS']);});
test('malformed PNG with correct byte digest rejected',()=>{const {p,o}=fixture();const b=Buffer.alloc(40);o.screenshot.data=b.toString('base64');o.screenshot.sha256=createHash('sha256').update(b).digest('hex');assert.ok(evaluateObservation(o,p,now).reasons.includes('INVALID_SCREENSHOT'));});
test('secrets are absent from receipt',()=>{const {p,o}=fixture();o.stdout='SECRET';o.token='SECRET';assert.ok(!JSON.stringify(evaluateObservation(o,p,now)).includes('SECRET'));});

test('wrong execution commit fails closed',()=>{const {p,o}=fixture();o.executedCommit=p.bindings.candidateCommit;assert.ok(evaluateObservation(o,p,now).reasons.includes('EXECUTED_COMMIT_MISMATCH'));});

test('legacy success with zero exit lacks completion provenance',()=>{const {p,o}=fixture();delete o.completionVersion;delete o.completionVerified;assert.equal(evaluateObservation(o,p,now).status,'INCONCLUSIVE');});
test('false completion verification fails closed',()=>{const {p,o}=fixture();o.completionVerified=false;assert.equal(evaluateObservation(o,p,now).status,'INCONCLUSIVE');});
test('unbounded policy lifetime rejected',()=>{const {p,o}=fixture();p.ttlMs=86400001;assert.equal(evaluateObservation(o,p,now).status,'REJECT');});
test('unknown policy field rejected',()=>{const {p,o}=fixture();p.override=true;assert.equal(evaluateObservation(o,p,now).status,'REJECT');});
test('unknown observation field rejected',()=>{const {p,o}=fixture();o.override=true;assert.equal(evaluateObservation(o,p,now).status,'REJECT');});
test('canonical rejects cycles and getters without calling them',()=>{const c={};c.c=c;assert.throws(()=>digest(c));let invoked=false;const g={get secret(){invoked=true;return 1;}};assert.throws(()=>digest(g));assert.equal(invoked,false);});

test('CLI returns bounded receipt with exit 0, 1, 2 and refuses symlinks', async()=>{
 const {mkdtempSync,writeFileSync,symlinkSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'ruos-evidence-'));
 try {
  const {p,o}=fixture();o.timestampMs=Date.now();
  const input=join(dir,'observation.json'),policy=join(dir,'policy.json');
  writeFileSync(policy,JSON.stringify(p));
  const run=path=>spawnSync(process.execPath,['scripts/ruos-evaluation.mjs',path,policy],{encoding:'utf8',timeout:3000});
  writeFileSync(input,JSON.stringify(o));assert.equal(run(input).status,0);
  o.assertions[0].pass=false;writeFileSync(input,JSON.stringify(o));assert.equal(run(input).status,1);
  o.assertions[0].pass=true;delete o.screenshot;writeFileSync(input,JSON.stringify(o));assert.equal(run(input).status,2);
  const link=join(dir,'linked.json');symlinkSync(input,link);const linked=run(link);assert.equal(linked.status,1);assert.deepEqual(JSON.parse(linked.stdout).reasons,['INVALID_INPUT']);
  writeFileSync(input,'{"secret":"NEVER_ECHO"');const bad=run(input);assert.equal(bad.status,1);assert.ok(!bad.stdout.includes('NEVER_ECHO'));assert.equal(bad.stderr,'');
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('receipt binds substituted evidence even when both observations pass',()=>{const {p,o}=fixture();const r=evaluateObservation(o,p,now);o.cases[0].latencyMs=99;const changed=evaluateObservation(o,p,now);assert.equal(changed.status,'ACCEPT');assert.notEqual(r.observationDigest,changed.observationDigest);});
test('pair receipt binds both arms and does not claim performance improvement',()=>{const {p,o}=fixture();const c=structuredClone(o);c.arm='candidate';c.executedCommit=p.bindings.candidateCommit;const r=evaluatePair(o,c,p,now);assert.equal(r.status,'ACCEPT');assert.equal(r.scope,'paired-regression');assert.equal(r.baselineDigest,digest(o));assert.equal(r.candidateDigest,digest(c));assert.equal(r.observationDigest,null);assert.equal(r.performanceImprovementClaimed,false);c.cases[0].cost=0.9;assert.notEqual(evaluatePair(o,c,p,now).candidateDigest,r.candidateDigest);});
test('receipt policy mismatch rejects and records actual evaluated policy',()=>{const {p,o}=fixture();const prior=digest(p);p.maxCostRegression=0.01;const r=evaluateObservation(o,p,now);assert.equal(r.status,'REJECT');assert.notEqual(r.policyDigest,prior);assert.equal(r.policyDigest,digest(p));});
test('malformed policy has bounded null receipt bindings',()=>{const {p,o}=fixture();p.extra=true;const r=evaluateObservation(o,p,now);assert.equal(r.policyDigest,null);assert.equal(r.observationDigest,null);assert.equal(r.validUntilMs,null);});

test('inherited observation cannot accept with null digest',()=>{const {p,o}=fixture();const r=evaluateObservation(Object.create(o),p,now);assert.equal(r.status,'REJECT');assert.equal(r.observationDigest,null);});
test('observation getter is never invoked',()=>{const {p,o}=fixture();let called=false;Object.defineProperty(o,'status',{enumerable:true,get(){called=true;return 'ok';}});assert.equal(evaluateObservation(o,p,now).status,'REJECT');assert.equal(called,false);});
test('policy getter is never invoked',()=>{const {p,o}=fixture();let called=false;Object.defineProperty(p,'schemaVersion',{enumerable:true,get(){called=true;return 1;}});assert.equal(evaluateObservation(o,p,now).status,'REJECT');assert.equal(called,false);});
test('symbols, sparse arrays and array accessors are rejected',()=>{for(const mutate of [o=>o[Symbol('x')]=1,o=>delete o.assertions[0],o=>Object.defineProperty(o.assertions,'0',{get(){throw Error('invoked');}})]){const {p,o}=fixture();mutate(o);assert.equal(evaluateObservation(o,p,now).status,'REJECT');}});

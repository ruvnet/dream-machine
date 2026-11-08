/** Public synthetic workload using real filesystem and SQLite operations. No production adoption. */
import {mkdtemp,writeFile,appendFile,stat,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {learnWithHF} from './hf-rule-learning.mjs';import {validatedRuleCache} from './validated-rule-cache.mjs';import {executeRule,ruleHash,inferRuleCandidates} from '../packages/compile/dist/rule-learning.js';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const config={model:'openai/gpt-oss-120b',provider:'groq',responseMode:'json_object',reasoningEffort:'low',maxCalls:2,maxOutputTokens:2048,timeoutMs:20000,maxCostUsd:.02,inputUsdPerMillion:.15,outputUsdPerMillion:.60};
const families=['framed_file','sqlite_batch'];
async function oracle(f,s,a){
 if(![s.x,a].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=4096))throw Error('Bounds');
 if(f==='framed_file'){const d=await mkdtemp(join(tmpdir(),'hf-surr-'));try{const p=join(d,'data');await writeFile(p,Buffer.alloc(s.x));await appendFile(p,'HDR'+'λ🙂a'.repeat(a));return {x:(await stat(p)).size};}finally{await rm(d,{recursive:true,force:true});}}
 const script='import sqlite3,sys,json\nc=sqlite3.connect(":memory:")\nc.execute("CREATE TABLE t(x)")\nc.executemany("INSERT INTO t VALUES (?)",[(i,) for i in range(int(sys.argv[1]))])\nc.executemany("INSERT INTO t VALUES (?)",[(i,) for i in range(int(sys.argv[2])*3+1)])\nprint(json.dumps({"x":c.execute("SELECT COUNT(*) FROM t").fetchone()[0]}))';
 return JSON.parse(execFileSync('python3',['-c',script,String(s.x),String(a)],{encoding:'utf8'}));
}
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(xs.length*p)-1)];
const rows=[];const start=performance.now();
for(const family of families){
 const training=[];for(const [x,action] of [[0,0],[1,0],[0,1],[2,3]])training.push({state:{x},action,nextState:await oracle(family,{x},action)});
 const proposal=await learnWithHF(training,config);const candidate=proposal.candidate;
 // Inputs fixed by protocol before generation; contents never passed to proposer.
 const confirmation=[];for(let i=0;i<20;i++){const x=41+i*13,action=(i*7)%23;confirmation.push({state:{x},action,nextState:await oracle(family,{x},action)});}
 const search=inferRuleCandidates(training,{maxCandidates:1}).candidates[0];
 const searchCorrect=confirmation.filter(t=>search&&ruleHash(executeRule(search,t.state,t.action))===ruleHash(t.nextState)).length;
 let cache;try{cache=validatedRuleCache({candidate,training,confirmation,scope:family+':v1',auditEvery:10,bounds:{x:[0,4096],action:[0,4096]}});}catch{rows.push({family,proposal,training,confirmation,accepted:false});continue;}
 const traces=[],baselineMs=[],learnedMs=[];let oracleCalls=0,correct=0,handCorrect=0;
 const directBaseline=(s,a)=>({x:s.x+(family==='framed_file'?7*a+3:3*a+1)});
 for(let i=0;i<100;i++){
  const state={x:601+((i*79)%1700)},action=29+((i*17)%131);
  let t=performance.now();const expected=await oracle(family,state,action);baselineMs.push(performance.now()-t);
  t=performance.now();const output=await cache.predict(state,action,family+':v1',async(s,a)=>{oracleCalls++;return oracle(family,s,a)});learnedMs.push(performance.now()-t);
  correct+=Number(ruleHash(expected)===ruleHash(output));handCorrect+=Number(ruleHash(expected)===ruleHash(directBaseline(state,action)));traces.push({state,action,expected,output});
 }
 // Drift is introduced on an audit boundary and must revoke subsequent predictions.
 const drift=[];for(let i=0;i<11;i++)await cache.predict({x:500+i},9,family+':v1',async(s,a)=>{const v=await oracle(family,s,a);return {x:v.x+1}}).then(output=>drift.push(output));
 const driftEvents=cache.events.slice(100);const detected=driftEvents.some(e=>e.drift);const revoked=driftEvents.at(-1).revoked&&driftEvents.at(-1).source==='oracle';
 rows.push({family,accepted:true,training,confirmation,proposal,searchCorrect,handAuthoredCorrect:handCorrect,workloadCorrect:correct,workloadTotal:100,oracleCalls,setupCalls:24,lifetimeCalls:24+oracleCalls,referenceOnlyCalls:100,interactionReduction:1-(24+oracleCalls)/100,baselineP95Ms:percentile(baselineMs,.95),learnedP95Ms:percentile(learnedMs,.95),baselineTotalMs:baselineMs.reduce((a,b)=>a+b),learnedTotalMs:learnedMs.reduce((a,b)=>a+b),driftDetected:detected,revokedAfterDrift:revoked,maximumUnauditedCalls:9,traces,events:cache.events});
}
const sourceFiles=['benchmark-hf-surrogate.mjs','hf-rule-learning.mjs','validated-rule-cache.mjs'];const sources={};for(const f of sourceFiles)sources[f]=hash(await readFile(new URL(f,import.meta.url),'utf8'));
const body={schema:'hf-surrogate-evidence/v1',createdAt:new Date().toISOString(),node:process.version,sources,rows,durationMs:performance.now()-start,productionPromotion:false,limits:'Two small local workloads share affine arithmetic. No superiority over hand-authored formulas, no weight training, no broad research acceptance. Reference-only verification calls and drift probes are extra measurement costs. Up to nine changed-environment predictions may precede the next audit; use only shadow mode until risk approved.'};
const report={...body,receiptHash:hash(body)};await writeFile(process.argv[2]??'hf-surrogate-evidence.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({receiptHash:report.receiptHash,rows:rows.map(({training,confirmation,proposal,traces,events,...r})=>({...r,attempts:proposal.attempts.map(({candidate,...a})=>a)}))}));

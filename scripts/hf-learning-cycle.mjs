import {mkdir,open,readFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {learnWithHF} from './hf-rule-learning.mjs';
import {evaluateRuleCandidates,inferRuleCandidates,ruleHash,executeRule} from '../packages/compile/dist/rule-learning.js';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
/** A quarantined research ledger, deliberately without production promotion credentials. */
export async function runCycle(spec,directory,{proposer=learnWithHF}={}) {
  if(spec.schemaVersion!==1||!Array.isArray(spec.tasks)||spec.tasks.length<1||spec.tasks.length>3||!Number.isFinite(spec.config?.maxCostUsd)||spec.config.maxCostUsd<=0)throw Error('Invalid cycle');
  const ids=new Set();
  for(const t of spec.tasks){
    if(typeof t.id!=='string'||!/^[a-z0-9_]{1,64}$/.test(t.id)||ids.has(t.id))throw Error('Task identity');ids.add(t.id);
    // Existing evaluator validates all task and baseline data before any disclosure.
    evaluateRuleCandidates([t.baseline],t.training,t.confirmation);
    const seen=new Set(t.training.map(x=>ruleHash({state:x.state,action:x.action})));
    if(t.confirmation.some(x=>seen.has(ruleHash({state:x.state,action:x.action}))))throw Error('Split overlap');
  }
  const sourceHash=digest(await Promise.all([new URL(import.meta.url),new URL("./hf-rule-learning.mjs",import.meta.url),new URL("../packages/compile/dist/rule-learning.js",import.meta.url)].map(p=>readFile(p,"utf8"))));
  const specHash=digest({spec,sourceHash});await mkdir(directory,{recursive:true,mode:0o700});
  const lock=await open(join(directory,'cycle.lock'),'wx',0o600);
  try{
    const receiptPath=join(directory,specHash+'.json');
    try{const cached=JSON.parse(await readFile(receiptPath,'utf8'));const {receiptHash,...body}=cached;if(digest(body)!==receiptHash||cached.specHash!==specHash)throw Error('Receipt integrity');return {...cached,reused:true};}catch(e){if(e.code!=='ENOENT')throw e;}
    let remaining=spec.config.maxCostUsd;const results=[];
    for(const t of spec.tasks){
      const inferred=inferRuleCandidates(t.training,{maxCandidates:1}).candidates[0]??null;
      const proposal=await proposer(structuredClone(t.training),{...spec.config,maxCostUsd:remaining});
      if(!Number.isFinite(proposal.reservedUsd)||proposal.reservedUsd<0||proposal.reservedUsd>remaining)throw Error('Accounting violation');
      remaining-=proposal.reservedUsd;
      const candidate=proposal.candidate; // Freeze before independent confirmation; no feedback from this split.
      const score=c=>c?t.confirmation.reduce((n,x)=>{try{return n+Number(ruleHash(executeRule(c,x.state,x.action))===ruleHash(x.nextState));}catch{return n;}},0):0;
      const checked=candidate?evaluateRuleCandidates([candidate],t.training,t.confirmation)[0]:null;
      const candidateCorrect=score(candidate),baselineCorrect=score(t.baseline),searchCorrect=score(inferred);
      results.push({task:t.id,trainingHash:ruleHash(t.training),confirmationHash:ruleHash(t.confirmation),candidate,candidateHash:candidate?ruleHash(candidate):null,baselineCorrect,searchCorrect,candidateCorrect,total:t.confirmation.length,exactReplay:checked?.accepted??false,discoveryStatus:proposal.status,attempts:proposal.attempts,reservedUsd:proposal.reservedUsd,verdict:checked?.accepted&&candidateCorrect>Math.max(baselineCorrect,searchCorrect)?'EXPERIMENTAL_GAIN':'NO_GAIN'});
    }
    const body={schemaVersion:1,specHash,sourceHash,createdAt:new Date().toISOString(),results,reservedUsd:spec.config.maxCostUsd-remaining,billedCostUsd:null,promotion:'NOT_AUTHORIZED',learning:'candidate refinement and quarantined evidence; no weight training'};
    const receipt={...body,receiptHash:digest(body)};
    const temp=receiptPath+'.tmp';const f=await open(temp,'wx',0o600);try{await f.writeFile(JSON.stringify(receipt,null,2));await f.sync();}finally{await f.close();}await rename(temp,receiptPath);
    return receipt;
  }finally{await lock.close();await rm(join(directory,'cycle.lock'));}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [specPath,directory]=process.argv.slice(2);if(!specPath||!directory)throw Error('Usage: node scripts/hf-learning-cycle.mjs spec.json evidence-directory');
  const text=await readFile(specPath,'utf8');if(Buffer.byteLength(text)>262144)throw Error('Spec size');
  const receipt=await runCycle(JSON.parse(text),directory);console.log(JSON.stringify(receipt));
}

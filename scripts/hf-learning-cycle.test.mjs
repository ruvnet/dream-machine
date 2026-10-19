import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runCycle} from './hf-learning-cycle.mjs';
const rule={schemaVersion:1,candidateId:'a',rulebook:'action',program:[{op:'addAction',key:'x'}]};
const spec=()=>({schemaVersion:1,config:{maxCostUsd:.01},tasks:[{id:'add',baseline:rule,training:[{state:{x:1},action:2,nextState:{x:3}}],confirmation:[{state:{x:5},action:3,nextState:{x:8}}]}]});
const proposal=async()=>({candidate:rule,status:'proposed',attempts:[],reservedUsd:.001});
async function temp(fn){const d=await mkdtemp(join(tmpdir(),'hf-cycle-'));try{await fn(d);}finally{await rm(d,{recursive:true,force:true});}}
test('records ties without promotion and reuses exact receipt without paid calls',()=>temp(async d=>{let calls=0;const p=async()=>{calls++;return proposal()};const a=await runCycle(spec(),d,{proposer:p});const b=await runCycle(spec(),d,{proposer:p});assert.equal(calls,1);assert.equal(a.results[0].verdict,'NO_GAIN');assert.equal(a.promotion,'NOT_AUTHORIZED');assert.equal(b.reused,true)}));
test('confirmation never reaches proposer',()=>temp(async d=>{await runCycle(spec(),d,{proposer:async(train,config)=>{assert.deepEqual(train,spec().tasks[0].training);assert.equal(config.confirmation,undefined);return proposal()}})}));
test('split overlap rejected before calling provider',()=>temp(async d=>{const s=spec();s.tasks[0].confirmation=s.tasks[0].training;await assert.rejects(runCycle(s,d,{proposer:()=>{throw Error('should not call')}}),/overlap/)}));
test('lock prevents simultaneous writers',()=>temp(async d=>{await writeFile(join(d,'cycle.lock'),'');await assert.rejects(runCycle(spec(),d,{proposer:proposal}),/EEXIST/)}));
test('candidate failing confirmation is not retained as gain',()=>temp(async d=>{const s=spec();s.tasks[0].confirmation[0].nextState.x=9;const r=await runCycle(s,d,{proposer:proposal});assert.equal(r.results[0].verdict,'NO_GAIN');assert.equal(r.results[0].exactReplay,false)}));
test('receipt tampering fails closed',()=>temp(async d=>{const a=await runCycle(spec(),d,{proposer:proposal});await writeFile(join(d,a.specHash+'.json'),JSON.stringify({...a,promotion:'YES'}));await assert.rejects(runCycle(spec(),d,{proposer:proposal}),/integrity/)}));

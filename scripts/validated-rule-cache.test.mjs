import {test} from 'node:test';import assert from 'node:assert/strict';import {validatedRuleCache} from './validated-rule-cache.mjs';
const candidate={schemaVersion:1,candidateId:'fixture',rulebook:'add action',program:[{op:'addAction',key:'x'}]};
const t=x=>({state:{x},action:1,nextState:{x:x+1}});
const opts={candidate,training:[t(0)],confirmation:Array.from({length:20},(_,i)=>t(i+1)),scope:'v1',bounds:{x:[0,100],action:[0,10]},auditEvery:2};
test('learned cache audits and revokes on drift',async()=>{const c=validatedRuleCache(opts);let calls=0;const oracle=async(s,a)=>{calls++;return {x:s.x+a+1}};assert.deepEqual(await c.predict({x:30},1,'v1',oracle),{x:31});assert.deepEqual(await c.predict({x:31},1,'v1',oracle),{x:33});assert.deepEqual(await c.predict({x:32},1,'v1',oracle),{x:34});assert.equal(calls,2);assert.equal(c.events[1].drift,true)});
test('scope and range changes use oracle immediately',async()=>{const c=validatedRuleCache(opts);let n=0;const oracle=async()=>{n++;return {x:99}};await c.predict({x:30},1,'v2',oracle);await c.predict({x:101},1,'v1',oracle);assert.equal(n,2)});
test('invalid evidence and duplicate probes rejected',()=>{assert.throws(()=>validatedRuleCache({...opts,confirmation:Array(20).fill(t(1))}));assert.throws(()=>validatedRuleCache({...opts,confirmation:Array.from({length:20},(_,i)=>({...t(i+1),nextState:{x:0}}))}))});

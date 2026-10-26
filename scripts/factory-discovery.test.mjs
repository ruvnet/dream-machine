import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validatePortfolio,retrieve,collectDiscovery,rankCandidates,ENDPOINTS} from './factory-discovery.mjs';
const config=JSON.parse(await readFile(new URL('../factory.portfolio.json',import.meta.url),'utf8'));
const response=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
const now=new Date('2026-10-11T17:00:00Z');
test('configuration rejects arbitrary network sources and expanded limits',()=>{
 assert.equal(validatePortfolio(config),config);
 for(const c of [{...config,sources:['https://localhost/']},{...config,maxHnItems:21},{...config,limits:{...config.limits,candidatesPerDay:2}},{...config,publication:{...config.publication,requiresProductRegistration:false}}])assert.throws(()=>validatePortfolio(c));
});
test('fetch boundary denies unknown host before network, redirect, size and timeout',async()=>{
 let calls=0;await assert.rejects(retrieve('https://evil.test',{fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
 assert.equal((await retrieve(ENDPOINTS.hn,{fetchImpl:async()=>new Response('[]',{status:302})})).status,'error');
 assert.equal((await retrieve(ENDPOINTS.hn,{fetchImpl:async()=>new Response('x'.repeat(262145),{headers:{'content-type':'application/json'}})})).status,'error');
 assert.equal((await retrieve(ENDPOINTS.hn,{fetchImpl:async()=>new Promise(()=>{}),timeoutMs:5})).status,'error');
});
test('HN fanout is bounded and never fetches story supplied destinations',async()=>{
 const calls=[];const d=await collectDiscovery({...config,sources:['hn'],maxHnItems:2},{now,fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');if(url===ENDPOINTS.hn)return response([1,2,3]);const id=Number(url.match(/item\/(\d+)/)[1]);return response({id,type:'story',title:'README usability',url:'http://127.0.0.1/secret',time:now.getTime()/1000-60,score:300,descendants:30});}});
 assert.equal(calls.length,3);assert.equal(d.entries.length,2);assert.ok(d.records.every(r=>r.sha256?.length===64&&!('body'in r)));assert.equal(d.entries[0].evidenceKind,'trend');assert.equal(rankCandidates(d).selected,'readme-proof');assert.equal(rankCandidates(d).executionAuthorized,false);assert.equal(rankCandidates(d).planDigest,rankCandidates(d).planDigest);
});
test('source failures and dates remain explicit, launch is not trend evidence',async()=>{
 const d=await collectDiscovery({...config,sources:['producthunt','papers']},{now,fetchImpl:async url=>url===ENDPOINTS.producthunt?new Response('blocked',{status:403}):response([{paper:{id:'1234.00001',title:'README agent'}}])});
 assert.equal(d.records[0].status,'error');assert.equal(d.entries[0].publishedAt,null);assert.equal(d.entries[0].evidenceKind,'research');assert.equal(rankCandidates(d).selected,null);
});
test('malformed HN item identity and stale trends cannot nominate products',async()=>{
 const d=await collectDiscovery({...config,sources:['hn']},{now,fetchImpl:async url=>response(url===ENDPOINTS.hn?[1]:{id:2,type:'story',title:'README'})});assert.equal(d.entries.length,0);assert.equal(d.records[1].status,'error');
 assert.equal(rankCandidates({fetchedAt:now.toISOString(),entries:[{title:'README',evidenceKind:'trend',publishedAt:'2020-01-01T00:00:00Z'}]}).selected,null);
});

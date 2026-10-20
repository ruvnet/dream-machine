import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateConfig,collectResearch,compileFactory,assessEvidence} from './factory/core.mjs';
const config=JSON.parse(readFileSync(new URL('../factory.config.json',import.meta.url)));
const copy=()=>structuredClone(config);
const evidence=()=>({schemaVersion:1,repo:config.repo,commit:'a'.repeat(40),benchmark:{metric:config.metric.name,direction:'lower',datasetHash:'b'.repeat(64),environmentHash:'c'.repeat(64),baseline:{samples:[100,100,100],mean:100},candidate:{samples:[80,80,80],mean:80}},tests:{passed:20,total:20,failed:0},security:{critical:0,high:0},artifacts:{readme:'README.md',adr:'docs/adr/001.md',svg:'docs/factory.svg'},review:{independent:true,approved:true}});
test('strict limits and SSRF rejection',()=>{
 assert.equal(validateConfig(config),config);
 for(const url of ['http://api.github.com/repos/a/b/releases','https://127.0.0.1','https://api.github.com@localhost','https://api.github.com/repos/a/b/releases?x=y','https://huggingface.co/api/daily_papers/../secrets','https://export.arxiv.org/api/query?max_results=100']) {const c=copy();c.sources=[url];assert.throws(()=>validateConfig(c));}
 for(const mutate of [c=>c.sources=[],c=>c.maxSources=11,c=>c.limits.maxInferenceUsd=Infinity,c=>c.release.automaticStable=true,c=>c.metric.minImprovementPercent=NaN]) {const c=copy();mutate(c);assert.throws(()=>validateConfig(c));}
});
test('bounded research records hash without invented dates',async()=>{
 const r=await collectResearch(config,{fetchImpl:async()=>new Response('{"title":"test"}',{headers:{'content-type':'application/json'}}),now:new Date('2026-10-11T00:00:00Z')});
 assert.equal(r.usable,true);assert.match(r.sources[0].contentHash,/^[a-f0-9]{64}$/);assert.equal(r.sources[0].publicationDate,null);assert.equal(r.sources[0].untrustedData,true);assert.match(compileFactory(config,r),/Candidate workers never merge/);
});
test('network failure, truncation, malformed and oversized responses fail closed',async()=>{
 for(const fetchImpl of [async()=>{throw Error('secret error');},async()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'100'}}),async()=>new Response('{',{headers:{'content-type':'application/json'}}),async()=>new Response('x'.repeat(262145),{headers:{'content-type':'text/plain'}}),async()=>new Response('',{headers:{'content-type':'text/plain'}})]) {
 const r=await collectResearch(config,{fetchImpl});assert.equal(r.usable,false);assert.throws(()=>compileFactory(config,r));assert.ok(!JSON.stringify(r).includes('secret error'));
 }
});
test('valid evidence qualifies for review but never publication',()=>{const r=assessEvidence(evidence(),config);assert.equal(r.eligible,true);assert.equal(r.publishAuthorized,false);assert.equal(r.improvementPercent,20);});
test('incomplete and falsified measurements fail closed',()=>{
 assert.equal(assessEvidence({},config).eligible,false);
 for(const mutate of [e=>e.benchmark.candidate.mean=1,e=>e.benchmark.candidate.samples=[NaN,1,1],e=>e.benchmark.baseline.mean=Infinity,e=>e.benchmark.candidate.samples=[80],e=>e.tests.failed=1,e=>e.security.high=1,e=>delete e.review,e=>e.commit='latest',e=>e.artifacts.adr='../secret',e=>e.benchmark.candidate={samples:[99,99,99],mean:99}]) {const e=evidence();mutate(e);assert.equal(assessEvidence(e,config).eligible,false);}
});
test('release dates classify freshness from source fields',async()=>{
 const c=copy();c.sources=[config.sources[1]];
 const r=await collectResearch(c,{now:new Date('2026-10-11T00:00:00Z'),fetchImpl:async()=>new Response(JSON.stringify([{tag_name:'v1',published_at:'2026-10-10T00:00:00Z',html_url:'https://github.com/ruvnet/ruflo/releases/tag/v1'},{tag_name:'v0',published_at:null}]),{headers:{'content-type':'application/json'}})});
 assert.equal(r.sources[0].entries[0].freshness,'recent');assert.equal(r.sources[0].entries[1].freshness,'unverified');
 assert.match(compileFactory(c,r),/do NOT grant spending authority/);
 for(const mutate of [r=>r.sources[0].url='https://localhost/',r=>r.sources[0].contentHash='bad',r=>r.collectedAt='invalid',r=>r.sources[0]=null,r=>r.sources[0].untrustedData=false]) {const changed=structuredClone(r);mutate(changed);assert.throws(()=>compileFactory(c,changed));}
});
test('redirects and streaming overflow are rejected',async()=>{
 for(const fetchImpl of [async()=>({ok:true,redirected:true}),async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(140000));c.enqueue(new Uint8Array(140000));c.close();}}),{headers:{'content-type':'text/plain'}})]) {assert.equal((await collectResearch(config,{fetchImpl})).usable,false);}
 for(const url of ['https://api.github.com.evil.example/repos/a/b/releases','https://api.github.com/repos/a/b/releases?per_page=11','https://api.github.com/repos/a/b/releases?per_page=5&per_page=5']) {const c=copy();c.sources=[url];assert.throws(()=>validateConfig(c));}
 assert.equal(assessEvidence(null,config).eligible,false);
});
test('overflowing improvement cannot qualify for review',()=>{
 const c=copy();c.metric.direction='higher';
 const e=evidence();e.benchmark.direction='higher';
 e.benchmark.baseline={samples:[1e-300,1e-300,1e-300],mean:1e-300};
 e.benchmark.candidate={samples:[1e100,1e100,1e100],mean:1e100};
 const result=assessEvidence(e,c);assert.equal(result.eligible,false);assert.ok(result.reasons.includes('insufficient improvement'));
});

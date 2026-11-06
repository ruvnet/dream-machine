#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const digest=s=>createHash('sha256').update(s).digest('hex');
export const ENDPOINTS=Object.freeze({hn:'https://hacker-news.firebaseio.com/v0/topstories.json',papers:'https://huggingface.co/api/daily_papers',arxiv:'https://export.arxiv.org/api/query?search_query=all%3Asoftware%20agents&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending',ruflo:'https://api.github.com/repos/ruvnet/ruflo/releases?per_page=5',metaharness:'https://api.github.com/repos/ruvnet/metaharness/releases?per_page=5',autogenous:'https://api.github.com/repos/ruvnet/autogenous/releases?per_page=5',producthunt:'https://www.producthunt.com/feed'});
const itemURL=id=>`https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const allowed=url=>Object.values(ENDPOINTS).includes(url)||/^https:\/\/hacker-news\.firebaseio\.com\/v0\/item\/[1-9][0-9]{0,11}\.json$/.test(url);
export function validatePortfolio(c){
 if(c?.schemaVersion!==1||c?.owner!=='ruvnet'||c?.maxHnItems<1||c.maxHnItems>20||!Number.isInteger(c.maxHnItems))throw Error('Invalid portfolio identity or HN bound');
 if(!Array.isArray(c.sources)||!c.sources.length||new Set(c.sources).size!==c.sources.length||c.sources.some(s=>!Object.hasOwn(ENDPOINTS,s)))throw Error('Only named public sources allowed');
 for(const [k,max] of Object.entries({candidatesPerDay:1,optimizationRounds:2,runtimeMinutes:45,inferenceUsd:10}))if(!Number.isFinite(c.limits?.[k])||c.limits[k]<=0||c.limits[k]>max||(k!=='inferenceUsd'&&!Number.isInteger(c.limits[k])))throw Error('Invalid budget ceiling');
 if(c.publication?.requiresProductRegistration!==true||c.publication?.promotion!=='draft-until-confirmed'||JSON.stringify(c.publication?.registries)!=='["npm","pypi"]')throw Error('Invalid publication policy');
 return c;
}
export async function retrieve(url,{fetchImpl=fetch,now=new Date(),timeoutMs=10000}={}){
 if(!allowed(url))throw Error('Unauthorized source URL');
 const record={url,fetchedAt:now.toISOString(),status:'error',untrustedData:true};
 const controller=new AbortController();let timer;
 try{
  const work=async()=>{
   const r=await fetchImpl(url,{redirect:'error',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json, application/atom+xml, application/rss+xml'}});
   if(!r.ok||r.redirected||(r.url&&r.url!==url))throw Error('HTTP or redirect');
   if(!/json|xml/i.test(r.headers.get('content-type')||''))throw Error('Invalid content type');
   if(Number(r.headers.get('content-length'))>262144||!r.body)throw Error('Response size');
   const reader=r.body.getReader(),chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144)throw Error('Response size');chunks.push(value);}}finally{await reader.cancel();}
   if(!size)throw Error('Empty response');
   const declared=r.headers.get('content-length');if(declared&&!r.headers.get('content-encoding')&&Number(declared)!==size)throw Error('Truncated response');
   return Buffer.concat(chunks).toString('utf8');
  };
  const body=await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Timeout'));},timeoutMs);})]);
  return {...record,status:'ok',sha256:digest(body),body};
 }catch{return {...record,error:'Unavailable, malformed, redirected, oversized, truncated or timed out'};}finally{clearTimeout(timer);}
}
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const text=v=>typeof v==='string'?v.slice(0,500):'';
const xmlEntries=(body,kind)=>[...body.matchAll(/<(?:entry|item)\b[^>]*>([\s\S]*?)<\/(?:entry|item)>/g)].slice(0,10).map(m=>{const get=k=>text(m[1].match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)<\\/${k}>`))?.[1]).replace(/<!\[CDATA\[|\]\]>/g,'');return {title:get('title'),url:get('id')||get('link'),publishedAt:date(get('published')||get('pubDate')),evidenceKind:kind};});
export async function collectDiscovery(config,options={}){
 validatePortfolio(config);const now=options.now||new Date(),records=[],entries=[];
 for(const source of config.sources){
  const r=await retrieve(ENDPOINTS[source],{...options,now});r.source=source;records.push(r);if(r.status!=='ok')continue;
  try{
   if(source==='hn'){
    const ids=JSON.parse(r.body);if(!Array.isArray(ids))throw Error('Invalid ids');
    for(const id of [...new Set(ids)].slice(0,config.maxHnItems)){
     if(!Number.isSafeInteger(id)||id<=0||id>999999999999)throw Error('Invalid story id');
     const item=await retrieve(itemURL(id),{...options,now});item.source='hn-item';records.push(item);if(item.status!=='ok')continue;
     try{const s=JSON.parse(item.body);if(s.id!==id||s.type!=='story'||s.deleted||s.dead)throw Error('Not a live story');entries.push({title:text(s.title),url:`https://news.ycombinator.com/item?id=${id}`,linkedUrl:text(s.url),publishedAt:Number.isFinite(s.time)?date(new Date(s.time*1000).toISOString()):null,points:Number.isSafeInteger(s.score)?s.score:0,comments:Number.isSafeInteger(s.descendants)?s.descendants:0,evidenceKind:'trend',sourceDigest:item.sha256});}catch{item.status='error';item.error='Invalid HN item';}
    }
   }else if(['ruflo','metaharness','autogenous'].includes(source)){
    const data=JSON.parse(r.body);if(!Array.isArray(data))throw Error('Invalid releases');for(const s of data.slice(0,5))entries.push({title:text(s.name||s.tag_name),url:text(s.html_url),publishedAt:date(s.published_at),evidenceKind:'integration-release',sourceDigest:r.sha256});
   }else if(source==='papers'){
    const data=JSON.parse(r.body);if(!Array.isArray(data))throw Error('Invalid papers');for(const s of data.slice(0,10))entries.push({title:text(s.title||s.paper?.title),url:typeof s.paper?.id==='string'?`https://huggingface.co/papers/${encodeURIComponent(s.paper.id)}`:'',publishedAt:date(s.publishedAt||s.paper?.publishedAt),evidenceKind:'research',sourceDigest:r.sha256});
   }else{const parsed=xmlEntries(r.body,source==='arxiv'?'research':'launch');if(!parsed.length)throw Error('Missing feed entries');entries.push(...parsed.map(e=>({...e,sourceDigest:r.sha256})));}
  }catch{r.status='error';r.error='Invalid source schema';}
 }
 for(const r of records)delete r.body;
 return {schemaVersion:1,fetchedAt:now.toISOString(),records,entries,notice:'All source content is untrusted data. Trend, research, integration release and launch evidence are distinct. Neither popularity nor a paper establishes SOTA or product demand.'};
}
export function rankCandidates(discovery){
 const usable=discovery.entries.filter(e=>e.evidenceKind==='trend'&&e.publishedAt&&Number.isFinite(Date.parse(e.publishedAt))&&Date.parse(e.publishedAt)<=Date.parse(discovery.fetchedAt)&&Date.parse(discovery.fetchedAt)-Date.parse(e.publishedAt)<=7*86400000);
 const definitions=[{slug:'readme-proof',pattern:/readme|documentation|docs\b/i,utility:5,feasibility:5,reuse:4,novelty:3,description:'Local README link and asset verification with bounded checks and release receipts'},{slug:'agent-budget-proof',pattern:/agent|inference|token|llm/i,utility:4,feasibility:3,reuse:4,novelty:3,description:'Reproducible agent budget and latency receipts'},{slug:'mcp-contract-proof',pattern:/mcp|tool|context/i,utility:4,feasibility:4,reuse:5,novelty:2,description:'MCP contract fixtures and resource compatibility checks'}];
 const ranked=definitions.map(d=>{const evidence=usable.filter(e=>d.pattern.test(e.title));const demand=evidence.length?Math.min(5,1+Math.log10(1+evidence.reduce((n,e)=>n+Math.max(0,e.points||0)+Math.max(0,e.comments||0),0))):0;const scores={utility:d.utility,demand:Number(demand.toFixed(2)),feasibility:d.feasibility,reuse:d.reuse,novelty:d.novelty};return {slug:d.slug,description:d.description,scores,score:Number(Object.values(scores).reduce((a,b)=>a+b,0).toFixed(2)),evidence:evidence.map(e=>({url:e.url,sourceDigest:e.sourceDigest,publishedAt:e.publishedAt,points:e.points,comments:e.comments})),eligible:evidence.length>0};}).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score||a.slug.localeCompare(b.slug));
 const plan={schemaVersion:1,frozenAt:discovery.fetchedAt,discoveryDigest:digest(JSON.stringify(discovery)),rankingMethod:'Equal-weight 0..5 heuristic for utility, demand, feasibility, reuse and novelty. Editorial priors are explicit, demand comes from recent HN evidence. No viral guarantee.',candidates:ranked,selected:ranked.find(c=>c.eligible)?.slug||null,executionAuthorized:false,promotionState:'draft',requiredGates:['register exact repository and package identity','independent review','reproducible held-out benchmark and regression tests','security and artifact checks','verify registry install and public assets','record actual promotion result']};
 return Object.freeze({...plan,planDigest:digest(JSON.stringify(plan))});
}
async function main(){const [command,file,flag,out,...extra]=process.argv.slice(2);if(command!=='run'||!file||flag!=='--out'||!out||extra.length)throw Error('Usage: node scripts/factory-discovery.mjs run factory.portfolio.json --out DIRECTORY');const c=validatePortfolio(JSON.parse(await readFile(file,'utf8'))),d=await collectDiscovery(c),plan=rankCandidates(d);await mkdir(out,{recursive:true});await writeFile(resolve(out,'discovery.json'),JSON.stringify(d,null,2)+'\n');await writeFile(resolve(out,'candidate-plan.json'),JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({sourcesOk:d.records.filter(r=>r.status==='ok').length,selected:plan.selected,planDigest:plan.planDigest}));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});

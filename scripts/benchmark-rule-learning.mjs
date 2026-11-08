import { performance } from 'node:perf_hooks';
import { evaluateRuleCandidates, executeRule } from '../packages/compile/dist/rule-learning.js';
const samples=[]; let accepted=0;
for(let run=0;run<100;run++) {
  const start=performance.now();
  for(const op of ['add','multiply','addAction']) for(let seed=1;seed<=5;seed++) {
    const good={schemaVersion:1,candidateId:op,rulebook:'Synthetic operation fixture',program:[op==='addAction'?{op,key:'x'}:{op,key:'x',value:2}]};
    const bad={...good,candidateId:'wrong',program:[{op:'set',key:'x',value:-999}]};
    const make=x=>({state:{x},action:seed,nextState:executeRule(good,{x},seed)});
    const result=evaluateRuleCandidates([good,bad],[make(seed)],[make(seed+10)]);
    if(!result[0].accepted || result[1].accepted) throw Error('Synthetic selection failed');
    accepted++;
  }
  samples.push(performance.now()-start);
}
samples.sort((a,b)=>a-b);
console.log(JSON.stringify({kind:'synthetic correctness and local latency only',node:process.version,iterations:100,cellsPerIteration:15,candidatesPerCell:2,observationsPerCell:1,probesPerCell:1,correctSelections:accepted,p50BatchMs:samples[49],p95BatchMs:samples[94],researchAcceptance:'not evaluated',interactionSavings:'not measured'},null,2));

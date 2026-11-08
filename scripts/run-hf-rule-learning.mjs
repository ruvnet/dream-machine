import {readFile} from 'node:fs/promises';
import {learnWithHF} from './hf-rule-learning.mjs';
// Files contain public training data and nonsecret settings only. Credential stays in env.
const [observationsPath,configPath]=process.argv.slice(2);
if(!observationsPath||!configPath)throw Error('Usage: node scripts/run-hf-rule-learning.mjs observations.json config.json');
for(const path of [observationsPath,configPath]){const {stat}=await import('node:fs/promises');if((await stat(path)).size>65536)throw Error('Input file limit');}
const result=await learnWithHF(JSON.parse(await readFile(observationsPath,'utf8')),JSON.parse(await readFile(configPath,'utf8')));
console.log(JSON.stringify(result,null,2));
if(result.status==='blocked')process.exitCode=2;

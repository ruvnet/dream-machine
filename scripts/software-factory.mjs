#!/usr/bin/env node
import { realpathSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, fstatSync, constants, lstatSync, existsSync } from 'node:fs';
import { resolve, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig, collectResearch, compileFactory, assessEvidence } from './factory/core.mjs';
import { renderArtifacts } from './factory/artifacts.mjs';
import { gistRequest, publishGist, digest } from './factory/gist.mjs';

const HELP = `dream-machine-factory: evidence-gated software factory support

research CONFIG --out DIR              Fetch bounded primary research records
compile CONFIG --research FILE --out FILE  Compile host-agent instructions
render INPUT --out DIR                Generate README, ADR, SVG and gist draft
verify EVIDENCE CONFIG                Assess evidence (never grants publication)
gist-plan INPUT --out FILE             Build public gist request from {report,repo,commit}
gist-publish INPUT --digest SHA256     Publish exact reviewed gist via ruvnet gh identity

A scheduled host agent executes implementation and tests. These commands do not
start an autonomous process, enforce provider billing, merge or publish npm.
npm publication runs through the separate trusted release workflow.
`;
function read(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 1024*1024) throw new Error('Input must be a regular file at most 1 MiB');
    const buf = readFileSync(fd);
    if (buf.length > 1024*1024) throw new Error('Input exceeds 1 MiB');
    return JSON.parse(buf.toString('utf8'));
  } finally { closeSync(fd); }
}
function safeParents(path) {
  const absolute = resolve(path);
  let current = parse(absolute).root;
  for (const part of absolute.slice(current.length).split('/').filter(Boolean)) {
    current = resolve(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('Output may not traverse symlinks');
  }
  return absolute;
}
function output(path, content) {
  const full = safeParents(path);
  mkdirSync(dirname(full), { recursive:true, mode:0o700 });
  writeFileSync(full, content, { flag:'wx', mode:0o600 });
}
function getOptions(args) {
  const positional=[], options={};
  for (let i=0;i<args.length;i++) {
    const value=args[i];
    if (value.startsWith('--')) {
      if (!['--out','--research','--digest'].includes(value) || value in options || !args[i+1] || args[i+1].startsWith('--')) throw new Error('Invalid options');
      options[value] = args[++i];
    } else positional.push(value);
  }
  return {positional,options};
}
export async function main(args) {
  if (!args.length || args[0] === '--help' || args[0] === 'help') { process.stdout.write(HELP); return 0; }
  const [command,...rest]=args, {positional:p,options:o}=getOptions(rest);
  const requireArgs = (n,required=[],allowed=required) => {
    if (p.length!==n || required.some(k=>!o[k]) || Object.keys(o).some(k=>!allowed.includes(k))) throw new Error('Incorrect arguments; use --help');
  };
  if (command==='research') {
    requireArgs(1,['--out']);
    const research=await collectResearch(validateConfig(read(p[0])));
    output(resolve(o['--out'],'research.json'),JSON.stringify(research,null,2)+'\n');
    process.stdout.write(JSON.stringify({usable:research.usable,sources:research.sources.map(s=>({url:s.url,status:s.status})),output:resolve(o['--out'],'research.json')})+'\n');
    return research.usable?0:2;
  }
  if (command==='compile') {
    requireArgs(1,['--research','--out']);
    output(o['--out'],compileFactory(read(p[0]),read(o['--research'])));
    process.stdout.write('Compiled factory supplement. Execute alongside the existing Dream Machine pipeline.\n');
    return 0;
  }
  if (command==='render') {
    requireArgs(1,['--out']);
    const artifacts=renderArtifacts(read(p[0]));
    const names={readme:'README.md',adr:'ADR.md',svg:'introduction.svg',gist:'gist.md'};
    const manifest={schemaVersion:1,status:'draft',files:{}};
    // Create a fresh directory: no partially overwritten prior edition.
    const target=safeParents(o['--out']);
    mkdirSync(dirname(target),{recursive:true,mode:0o700}); mkdirSync(target,{mode:0o700});
    for (const [kind,content] of Object.entries(artifacts)) {
      output(resolve(target,names[kind]),content); manifest.files[names[kind]]=digest(content);
    }
    output(resolve(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    process.stdout.write(JSON.stringify(manifest)+'\n'); return 0;
  }
  if (command==='verify') {
    requireArgs(2);
    const result=assessEvidence(read(p[0]),read(p[1]));
    process.stdout.write(JSON.stringify(result,null,2)+'\n'); return result.eligible?0:2;
  }
  if (command==='gist-plan') {
    requireArgs(1,['--out']);
    const input=read(p[0]); const request=gistRequest(input.report,input);
    output(o['--out'],JSON.stringify(request,null,2)+'\n');
    process.stdout.write(JSON.stringify({requestDigest:digest(JSON.stringify(request)),status:'requires_content_review'})+'\n'); return 0;
  }
  if (command==='gist-publish') {
    requireArgs(1,['--digest']);
    const request=read(p[0]);
    process.stdout.write(JSON.stringify(publishGist(request,o['--digest']))+'\n'); return 0;
  }
  throw new Error('Unknown command; use --help');
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(()=>{
    // Never print input, provider error bodies or credential-bearing transport details.
    process.stderr.write('Factory command failed. Check arguments, input schema, output collision, identity or connectivity; use --help.\n'); process.exitCode=1;
  });
}

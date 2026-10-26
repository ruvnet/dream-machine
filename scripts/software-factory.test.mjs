import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gistRequest, publishGist, digest } from './factory/gist.mjs';
const dir=()=>mkdtempSync(join(tmpdir(),'factory-e2e-'));
const cli=(...args)=>execFileSync(process.execPath,['scripts/software-factory.mjs',...args],{encoding:'utf8'});
const fixture={repo:'dream-machine',title:'Evidence factory',hypothesis:'Primary evidence can improve candidate selection.',sources:[{title:'npm trusted publishing',url:'https://docs.npmjs.com/trusted-publishers/'}],results:[]};
test('render CLI generates complete hashed assets and refuses overwrite',()=>{
  const d=dir(), input=join(d,'input.json'),out=join(d,'artifacts');
  writeFileSync(input,JSON.stringify(fixture)); cli('render',input,'--out',out);
  const manifest=JSON.parse(readFileSync(join(out,'manifest.json'),'utf8'));
  for(const [name,hash] of Object.entries(manifest.files)) assert.equal(digest(readFileSync(join(out,name),'utf8')),hash);
  assert.match(readFileSync(join(out,'README.md'),'utf8'),/introduction.svg/);
  const again=spawnSync(process.execPath,['scripts/software-factory.mjs','render',input,'--out',out]); assert.notEqual(again.status,0);
});
test('CLI refuses output symlink traversal and symlink input',()=>{
  const d=dir(),input=join(d,'input.json'),link=join(d,'alias');writeFileSync(input,JSON.stringify(fixture));symlinkSync(d,link);
  assert.notEqual(spawnSync(process.execPath,['scripts/software-factory.mjs','render',input,'--out',join(link,'out')]).status,0);
  assert.equal(existsSync(join(d,'out')),false);
  symlinkSync(input,join(d,'symlink.json'));
  assert.notEqual(spawnSync(process.execPath,['scripts/software-factory.mjs','render',join(d,'symlink.json'),'--out',join(d,'out')]).status,0);
});
test('malformed candidate evidence exits nonzero and cannot authorize publishing',()=>{
  const d=dir(), input=join(d,'bad.json');writeFileSync(input,'{}');
  const result=spawnSync(process.execPath,['scripts/software-factory.mjs','verify',input,'factory.config.json'],{encoding:'utf8'});
  assert.equal(result.status,2);assert.equal(JSON.parse(result.stdout).publishAuthorized,false);
});
test('gist plan blocks likely credentials, binds report and commit',()=>{
  const request=gistRequest('# Report\nPublic synthetic result only.',{repo:'ruvnet/dream-machine',commit:'a'.repeat(40)});
  assert.equal(request.public,true);assert.match(request.files['factory-report.md'].content,/Report SHA256/);
  assert.throws(()=>gistRequest('# report\n'+'hf_'+'x'.repeat(30),{repo:'ruvnet/dream-machine',commit:'a'.repeat(40)}));
  assert.throws(()=>gistRequest('# report',{repo:'private/repo',commit:'a'.repeat(40)}));
});
test('gist publisher rejects wrong identity and digest before mutation',()=>{
  const request=gistRequest('# Public report',{repo:'ruvnet/dream-machine',commit:'a'.repeat(40)});let calls=0;
  assert.throws(()=>publishGist(request,'b'.repeat(64),{run:()=>{calls++;}}));assert.equal(calls,0);
  assert.throws(()=>publishGist(request,digest(JSON.stringify(request)),{run:()=>{calls++;return 'other-user';}}),/identity/);assert.equal(calls,1);
});
test('gist publisher checks canonical remote owner and URL',()=>{
  const request=gistRequest('# Public report',{repo:'ruvnet/dream-machine',commit:'a'.repeat(40)});let calls=0;
  const result=publishGist(request,digest(JSON.stringify(request)),{run:(_cmd,args,options)=>{
    calls++;if(args.includes('user'))return 'ruvnet';if(args.includes('--paginate'))return '[[]]';assert.equal(options.input,JSON.stringify(request));
    return JSON.stringify({owner:{login:'ruvnet'},public:true,id:'123abc',html_url:'https://gist.github.com/ruvnet/123abc'});
  }});assert.equal(calls,3);assert.equal(result.url,'https://gist.github.com/ruvnet/123abc');
});

test('gist publish entry rejects crafted credential request even with correct digest',()=>{
 const request={description:'anything',public:true,files:{'factory-report.md':{content:'# report '+ 'hf_'+'x'.repeat(30)}}};
 let calls=0;assert.throws(()=>publishGist(request,digest(JSON.stringify(request)),{run:()=>{calls++;}}));assert.equal(calls,0);
});
test('gist replay reuses exact prior publication without a POST',()=>{
 const request=gistRequest('# Public report',{repo:'ruvnet/dream-machine',commit:'a'.repeat(40)});let mutations=0;
 const result=publishGist(request,digest(JSON.stringify(request)),{run:(_cmd,args)=>{
 if(args.includes('user'))return 'ruvnet';
 if(args.includes('--paginate'))return JSON.stringify([[{id:'123abc',description:request.description}]]);
 if(args.includes('POST'))mutations++;
 return JSON.stringify({owner:{login:'ruvnet'},public:true,id:'123abc',html_url:'https://gist.github.com/ruvnet/123abc',files:request.files});
 }});assert.equal(result.reused,true);assert.equal(mutations,0);
});

test('npm-style symlink invokes the factory command',()=>{
 const link=join(dir(),'dream-machine-factory');
 symlinkSync(new URL('./software-factory.mjs',import.meta.url),link);
 const help=execFileSync(process.execPath,[link,'--help'],{encoding:'utf8'});
 assert.match(help,/dream-machine-factory: evidence-gated/);
 const invalid=spawnSync(process.execPath,[link,'unknown-command']);
 assert.equal(invalid.status,1);
});

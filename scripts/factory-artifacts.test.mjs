import test from 'node:test';
import assert from 'node:assert/strict';
import {renderArtifacts} from './factory/artifacts.mjs';
const input = {repo:'@ruvnet/example',title:'Factory',hypothesis:'Evaluate a candidate',sources:[{title:'Research',url:'https://example.org/paper'}]};
test('deterministic artifacts preserve proposed and evidence boundaries',()=>{
 const a=renderArtifacts(input); assert.deepEqual(a,renderArtifacts(input));
 assert.match(a.readme,/npm install @ruvnet\/example/); assert.match(a.readme,/No measured results supplied/);
 assert.match(a.adr,/Status: proposed/); assert.match(a.gist,/not independently verified/);
});
test('XML payload stays escaped and Markdown cannot create headings or links',()=>{
 const a=renderArtifacts({...input,title:'<script>alert("x")</script> # [x](javascript:evil)',hypothesis:'& <foreignObject>hello</foreignObject>'});
 assert.ok(!a.svg.includes('<script>')); assert.ok(!a.svg.includes('<foreignObject>'));
 assert.match(a.svg,/&lt;script&gt;/); assert.match(a.readme,/\\#/); assert.match(a.readme,/\\\[/);
 assert.throws(()=>renderArtifacts({...input,title:'Safe\n# injected'}),/Invalid title/);
});
test('rejects unsafe citation schemes, credentials, local URLs and shell package payloads',()=>{
 for(const url of ['javascript:alert(1)','http://example.org','https://user:pass@example.org','https://localhost/x','https://127.0.0.1/x','https://service.internal/x']) assert.throws(()=>renderArtifacts({...input,sources:[url]}));
 for(const repo of ['foo;curl evil','foo\nwhoami','$(env)','--global']) assert.throws(()=>renderArtifacts({...input,repo}));
});
test('SVG is accessible, self contained and has reduced motion fallback',()=>{
 const {svg}=renderArtifacts(input);
 assert.match(svg,/<title id="title">/); assert.match(svg,/<desc id="desc">/);
 assert.match(svg,/@media\(prefers-reduced-motion:reduce\)/); assert.match(svg,/animation:none/);
 assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\bon\w+=|\bhref=/i);
});
test('results are observations even when supplied with promotion claims',()=>{
 const {readme}=renderArtifacts({...input,results:[{passed:true,promote:true}]});
 assert.match(readme,/not independently verified evidence or promotion authority/);
 assert.match(readme,/Status: proposed candidate/);
});
test('SVG attribute payloads remain text and source links cannot break Markdown',()=>{
 const payload='" onload="alert(1) & <image href="https://evil.example/x"/>';
 const a=renderArtifacts({...input,title:payload,sources:[{title:'[trap](javascript:evil)',url:'https://example.org/a(b)'}]});
 assert.doesNotMatch(a.svg,/<image\b|" onload="/);
 assert.match(a.svg,/&quot; onload=&quot;/);
 assert.match(a.readme,/https:\/\/example.org\/a%28b%29/);
 assert.match(a.readme,/!\[Animated process introduction\]\(introduction.svg\)/);
 assert.throws(()=>renderArtifacts({...input,sources:['https://example.org/">evil']}));
});

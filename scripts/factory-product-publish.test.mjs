import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('product publisher enforces trusted policies and reconciles uncertain results offline', () => {
const result = execFileSync('python3', ['-B', '-c', String.raw`
import importlib.util, io, json, tarfile, hashlib, tempfile, os, subprocess, types
spec=importlib.util.spec_from_file_location('p','scripts/factory-product-publish.py'); p=importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
def reject(fn):
    try: fn()
    except (ValueError,OSError,TypeError): return
    raise AssertionError('unsafe input accepted')
policy={'name':'@ruvnet/readme-proof','repo':'https://github.com/ruvnet/readme-proof','bins':{'readme-proof':'dist/cli.js'},'allowedFiles':['package/package.json','package/dist/cli.js'],'maxBytes':1048576}
assert p.validate_policy(policy)==policy
for change in [{'name':'../bad'}, {'repo':'https://evil.example/repo'}, {'maxBytes':True}, {'allowedFiles':['package/../secret']}, {'bins':{'tool':'../outside'}}]:
    reject(lambda: p.validate_policy(dict(policy,**change)))
with tempfile.TemporaryDirectory() as root:
    os.chmod(root,0o700); path=root+'/product.json'
    with open(path,'w') as f: json.dump(policy,f)
    os.chmod(path,0o600)
    assert p.load_policy(path,root,os.getuid())==policy
    reject(lambda:p.load_policy(path,root,os.getuid()+1))
    os.chmod(path,0o644); reject(lambda:p.load_policy(path,root,os.getuid())); os.chmod(path,0o600)
    os.symlink(path,root+'/link'); reject(lambda:p.load_policy(root+'/link',root,os.getuid()))
    os.chmod(root,0o755); reject(lambda:p.load_policy(path,root,os.getuid()))
def archive(change=None,extra=None):
    manifest={'name':policy['name'],'repository':policy['repo'],'version':'0.1.0-next.1','bin':policy['bins']}; manifest.update(change or {})
    files={'package/package.json':json.dumps(manifest).encode(),'package/dist/cli.js':b'console.log("ok")'};files.update(extra or {})
    stream=io.BytesIO()
    with tarfile.open(fileobj=stream,mode='w:gz',format=tarfile.USTAR_FORMAT) as tar:
        for name,data in files.items():
            entry=tarfile.TarInfo(name);entry.size=len(data);tar.addfile(entry,io.BytesIO(data))
    return stream.getvalue()
data=archive();sha=hashlib.sha256(data).hexdigest();version='0.1.0-next.1'
integrity=p.validate_archive(data,sha,version,policy)
for change in [{'name':'other'},{'repository':'https://github.com/other/repo'},{'optionalDependencies':{}},{'scripts':{}},{'publishConfig':{}},{'peerDependencies':{}},{'bundledDependencies':[]}]:
    bad=archive(change); reject(lambda:p.validate_archive(bad,hashlib.sha256(bad).hexdigest(),version,policy))
bad=archive(extra={'package/secret':b'x'});reject(lambda:p.validate_archive(bad,hashlib.sha256(bad).hexdigest(),version,policy))
reject(lambda:p.validate_archive(data,sha,'0.1.0',policy))
p.shutil.which=lambda *args,**kwargs:'/usr/bin/npm'
for mode in ['nonzero','timeout','zero']:
    calls=[]
    def query(path):
        calls.append(path)
        if len(calls)==1:return None
        if path.endswith('dist-tags'):return {'next':version}
        return {'dist':{'integrity':integrity}}
    def invoke(argv,**kwargs):
        assert 'NODE_AUTH_TOKEN' in kwargs['env'] and len(kwargs['env'])==6
        assert kwargs['stdout']==subprocess.DEVNULL and kwargs['stderr']==subprocess.PIPE
        assert '--ignore-scripts' in argv
        assert 'secret-test-token' not in ' '.join(argv)
        config=open(kwargs['env']['NPM_CONFIG_USERCONFIG']).read()
        assert ('$' + '{NODE_AUTH_TOKEN}') in config and 'secret-test-token' not in config
        if mode=='timeout':raise subprocess.TimeoutExpired('npm',120)
        return types.SimpleNamespace(returncode=1 if mode=='nonzero' else 0, stderr=b'npm error code E403\nnpm error token secret-test-token\n')
    receipt=p.publish(policy,data,sha,version,query=query,invoke=invoke,sleep=lambda _:None,token_loader=lambda:'secret-test-token')
    assert receipt['status']=='VERIFIED',receipt
    assert 'secret-test-token' not in json.dumps(receipt)
    assert receipt['npmErrorCode']==(None if mode=='timeout' else 'E403')
assert p.reconcile(policy['name'],version,integrity,query=lambda _:None,sleep=lambda _:None,attempts=2)=='UNCONFIRMED'
assert p.reconcile(policy['name'],version,integrity,query=lambda _:{'dist':{'integrity':'wrong'}},sleep=lambda _:None)=='REGISTRY_CONFLICT'
assert p.reconcile(policy['name'],version,integrity,query=lambda path: {'next':'other'} if path.endswith('dist-tags') else {'dist':{'integrity':integrity}},sleep=lambda _:None,attempts=2)=='UNCONFIRMED'
assert p.publish(policy,data,sha,version,query=lambda _:{'dist':{'integrity':'wrong'}},token_loader=lambda:(_ for _ in ()).throw(AssertionError('token accessed')))['status']=='REGISTRY_CONFLICT'
print('product boundary assertions passed')
`], {encoding:'utf8',timeout:10000});
assert.match(result,/product boundary assertions passed/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('ruOS publishing boundary rejects unsafe tokens, files and archives without network', () => {
  const output = execFileSync('python3', ['-B', '-c', String.raw`
import importlib.util, os, tempfile, json, tarfile, io, hashlib
spec = importlib.util.spec_from_file_location('publisher', 'scripts/ruos-npm-publish.py')
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
def reject(fn):
    try: fn()
    except (ValueError, OSError): return
    raise AssertionError('unsafe input accepted')
token = 'npm_' + 'a' * 40
assert p.parse_token('export NPM_TOKEN="' + token + '"\nOTHER=$(do-not-run)') == token
for text in ['', 'NPM_TOKEN=x', 'NPM_TOKEN=$(id)', 'NPM_TOKEN="unterminated', 'NPM_TOKEN=' + token + '\nNPM_TOKEN=' + token, 'NPM_TOKEN=' + token + '; echo leak']:
    reject(lambda: p.parse_token(text))
with tempfile.TemporaryDirectory() as d:
    path = d + '/binding'
    with open(path, 'w') as f: f.write('NPM_TOKEN=' + token)
    os.chmod(path, 0o600)
    assert p.load_token(path, os.getuid()) == token
    reject(lambda: p.load_token(path, os.getuid() + 1))
    os.chmod(path, 0o644); reject(lambda: p.load_token(path, os.getuid()))
    os.chmod(path, 0o600); os.symlink(path, d + '/link')
    reject(lambda: p.load_token(d + '/link', os.getuid()))
    with open(path, 'w') as f: f.write('x' * 262145)
    reject(lambda: p.load_token(path, os.getuid()))
def archive(extra=None, changes=None, link=False):
    files = {name: b'ok' for name in p.FILES}
    manifest = {'name':'dream-machine','version':'0.1.3-rc.1','bin':{'dream-machine':'dist/bin.js','dream-machine-factory':'dist/software-factory.mjs'}}
    manifest.update(changes or {})
    files['package/package.json'] = json.dumps(manifest).encode()
    files.update(extra or {})
    stream=io.BytesIO()
    with tarfile.open(fileobj=stream, mode='w:gz', format=tarfile.USTAR_FORMAT) as tar:
        for name, data in files.items():
            entry=tarfile.TarInfo(name); entry.size=len(data)
            if link and name=='package/LICENSE': entry.type=tarfile.SYMTYPE; entry.linkname='/etc/passwd'; entry.size=0
            tar.addfile(entry, io.BytesIO(data))
    return stream.getvalue()
def check(data, version='0.1.3-rc.1'):
    return p.validate_archive(data, hashlib.sha256(data).hexdigest(), version)
assert check(archive()).startswith('sha512-')
reject(lambda: check(archive(), '0.1.3'))
reject(lambda: p.validate_archive(archive(), 'a'*64, '0.1.3-rc.1'))
for args in [({'package/.npmrc':b'bad'},None,False), ({'../secret':b'bad'},None,False), (None,{'name':'bad'},False), (None,{'scripts':{}},False), (None,{'dependencies':{}},False), (None,None,True)]:
    reject(lambda: check(archive(*args)))
reject(lambda: p.NoRedirect().redirect_request(None,None,302,'',{},'https://evil.invalid'))
print('safe boundary assertions passed')
`], { encoding: 'utf8', timeout: 10000 });
  assert.match(output, /safe boundary assertions passed/);
});

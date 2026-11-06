#!/usr/bin/env python3
"""Bounded ruOS npm publisher. Tokens never leave process memory or child env."""
import base64
import hashlib
import io
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

REGISTRY = 'https://registry.npmjs.org'
BINDING = '/run/user/1000/ruos-env'
VERSION = re.compile(r'^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)$')
FILES = {'package/package.json', 'package/README.md', 'package/LICENSE', 'package/dist/bin.js', 'package/dist/index.js', 'package/dist/software-factory.mjs', 'package/dist/factory/core.mjs', 'package/dist/factory/artifacts.mjs', 'package/dist/factory/gist.mjs'}


def parse_token(text):
    found = []
    for line in text.splitlines():
        # Ignore all other bindings without interpreting their contents.
        if not re.match(r'^\s*(?:export\s+)?NPM_TOKEN(?:\s*=|\s|$)', line):
            continue
        try:
            words = shlex.split(line, comments=True, posix=True)
        except ValueError:
            raise ValueError('Malformed NPM_TOKEN binding') from None
        if words and words[0] == 'export':
            words = words[1:]
        if len(words) != 1 or not words[0].startswith('NPM_TOKEN='):
            raise ValueError('Malformed NPM_TOKEN binding')
        value = words[0][len('NPM_TOKEN='):]
        if not re.fullmatch(r'[A-Za-z0-9_\-]{16,512}', value):
            raise ValueError('Invalid NPM_TOKEN format')
        found.append(value)
    if len(found) != 1:
        raise ValueError('Exactly one NPM_TOKEN binding required')
    return found[0]


def load_token(path=BINDING, expected_uid=1000):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        metadata = os.fstat(fd)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != expected_uid or stat.S_IMODE(metadata.st_mode) != 0o600 or metadata.st_size > 262144:
            raise ValueError('Unsafe protected binding metadata')
        data = os.read(fd, 262145)
        if len(data) > 262144:
            raise ValueError('Protected binding too large')
        return parse_token(data.decode('utf-8'))
    finally:
        os.close(fd)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Registry redirects prohibited')


def request(path, token=None):
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(urllib.request.Request(REGISTRY + path, headers=headers), timeout=15) as response:
            data = response.read(1048577)
            if len(data) > 1048576:
                raise ValueError('Registry response too large')
            return json.loads(data)
    except urllib.error.HTTPError as error:
        if error.code == 404 and token is None:
            return None
        raise ValueError('Registry request failed HTTP ' + str(error.code)) from None


def validate_archive(data, expected, version):
    if not VERSION.fullmatch(version):
        raise ValueError('Only prerelease semver publication permitted')
    if not re.fullmatch(r'[a-f0-9]{64}', expected) or hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('Tarball digest mismatch')
    # Streaming decompression has a hard output bound before tarfile parsing.
    import gzip
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as compressed:
        raw = compressed.read(32 * 1024 * 1024 + 1)
    if len(raw) > 32 * 1024 * 1024:
        raise ValueError('Archive too large')
    entries = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        for entry in archive:
            if not entry.isreg() or entry.name not in FILES or entry.name in entries or entry.pax_headers:
                raise ValueError('Disallowed archive entry')
            body = archive.extractfile(entry).read()
            if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|npm_[A-Za-z0-9]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}', body):
                raise ValueError('Possible credential in package')
            entries[entry.name] = body
        end = archive.offset
    if len(raw) % 512 or len(raw) < end + 1024 or any(raw[end:]):
        raise ValueError('Invalid archive terminator or trailing data')
    if set(entries) != FILES:
        raise ValueError('Missing package files')
    manifest = json.loads(entries['package/package.json'])
    if manifest.get('name') != 'dream-machine' or manifest.get('version') != version or 'scripts' in manifest or 'dependencies' in manifest or manifest.get('bin') != {'dream-machine': 'dist/bin.js', 'dream-machine-factory': 'dist/software-factory.mjs'}:
        raise ValueError('Invalid package manifest')
    return 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()


def main(args):
    if args == ['preflight']:
        response = request('/-/whoami', load_token())
        username = response.get('username')
        if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', username):
            raise ValueError('Invalid registry identity')
        print(json.dumps({'status': 'authenticated', 'username': username}))
        return
    if len(args) != 4 or args[0] != 'publish':
        raise ValueError('Usage: preflight | publish <tarball> <sha256> <prerelease-version>')
    _, path, expected, version = args
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError('Tarball must be regular file')
        data = os.read(fd, 32 * 1024 * 1024 + 1)
    finally:
        os.close(fd)
    if len(data) > 32 * 1024 * 1024:
        raise ValueError('Compressed archive too large')
    integrity = validate_archive(data, expected, version)
    existing = request('/dream-machine/' + version)
    if existing is not None and existing.get('dist', {}).get('integrity') != integrity:
        raise ValueError('Existing version has different integrity')
    if existing is None:
        npm = shutil.which('npm', path='/usr/local/bin:/usr/bin:/bin')
        if not npm:
            raise ValueError('npm unavailable in trusted system path')
        token = load_token()
        with tempfile.TemporaryDirectory(prefix='ruos-npm-') as home:
            # Copy inspected bytes to private staging to prevent source-path races.
            artifact = os.path.join(home, 'release.tgz')
            with open(artifact, 'xb') as output:
                output.write(data)
            config = os.path.join(home, '.npmrc')
            with open(config, 'x') as output:
                output.write('registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\nignore-scripts=true\n')
            os.chmod(config, 0o600)
            env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': home, 'NPM_CONFIG_USERCONFIG': config, 'NPM_CONFIG_CACHE': os.path.join(home, 'cache'), 'NODE_AUTH_TOKEN': token, 'NPM_CONFIG_LOGS_MAX': '0'}
            result = subprocess.run([npm, 'publish', artifact, '--ignore-scripts', '--access', 'public', '--tag', 'next', '--registry', REGISTRY], cwd=home, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120, check=False)
            if result.returncode != 0:
                raise ValueError('npm publication failed; inspect registry permissions or token policy securely')
    for attempt in range(12):
        observed = request('/dream-machine/' + version)
        if observed is not None and observed.get('dist', {}).get('integrity') == integrity:
            print(json.dumps({'status': 'verified', 'name': 'dream-machine', 'version': version, 'integrity': integrity, 'alreadyPublished': existing is not None, 'provenance': 'unsupported outside GitHub OIDC'}))
            return
        time.sleep(5)
    raise ValueError('Registry integrity verification timed out')


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except Exception as error:
        # Never emit exception text: dependencies may include credentials or bodies.
        print(json.dumps({'status': 'failed', 'reason': type(error).__name__}), file=sys.stderr)
        sys.exit(1)

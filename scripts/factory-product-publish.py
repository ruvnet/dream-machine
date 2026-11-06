#!/usr/bin/env python3
"""Bounded product publisher; token reader adapted from reviewed ruos-npm-publish.py."""
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
POLICY_ROOT = '/home/ruv/.config/dream-factory/policies'


def load_policy(path, root=POLICY_ROOT, uid=1000):
    if os.path.dirname(os.path.abspath(path)) != root:
        raise ValueError('POLICY_LOCATION')
    rootfd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        info = os.fstat(rootfd)
        if info.st_uid != uid or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError('POLICY_ROOT_PERMISSIONS')
        fd = os.open(os.path.basename(path), os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=rootfd)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != uid or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > 65536:
                raise ValueError('POLICY_PERMISSIONS')
            policy = json.loads(os.read(fd, 65537))
        finally:
            os.close(fd)
    finally:
        os.close(rootfd)
    return validate_policy(policy)


def validate_policy(p):
    if set(p) != {'name', 'repo', 'bins', 'allowedFiles', 'maxBytes'}:
        raise ValueError('POLICY_FIELDS')
    if not re.fullmatch(r'(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]{0,213}', p['name']):
        raise ValueError('POLICY_NAME')
    if not re.fullmatch(r'https://github.com/ruvnet/[A-Za-z0-9_.-]+', p['repo']):
        raise ValueError('POLICY_REPO')
    if type(p['maxBytes']) is not int or not 1 <= p['maxBytes'] <= 32 * 1024 * 1024:
        raise ValueError('POLICY_SIZE')
    files = p['allowedFiles']
    if not isinstance(files, list) or not files or len(files) > 100 or len(set(files)) != len(files):
        raise ValueError('POLICY_FILES')
    for file in files:
        if not isinstance(file, str) or not re.fullmatch(r'package/[A-Za-z0-9_./-]+', file) or any(part in ('', '.', '..') or part.startswith('.') for part in file.split('/')):
            raise ValueError('POLICY_PATH')
    if 'package/package.json' not in files or not isinstance(p['bins'], dict):
        raise ValueError('POLICY_BINS')
    for name, target in p['bins'].items():
        if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', name) or 'package/' + target not in files:
            raise ValueError('POLICY_BIN_PATH')
    return p



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


def validate_archive(data, expected, version, policy):
    if not VERSION.fullmatch(version):
        raise ValueError('Only prerelease semver publication permitted')
    if not re.fullmatch(r'[a-f0-9]{64}', expected) or hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('Tarball digest mismatch')
    # Streaming decompression has a hard output bound before tarfile parsing.
    import gzip
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as compressed:
        raw = compressed.read(policy['maxBytes'] + 1)
    if len(raw) > policy['maxBytes']:
        raise ValueError('Archive too large')
    entries = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        for entry in archive:
            if not entry.isreg() or entry.name not in policy['allowedFiles'] or entry.name in entries or entry.pax_headers:
                raise ValueError('Disallowed archive entry')
            body = archive.extractfile(entry).read()
            if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|npm_[A-Za-z0-9]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}', body):
                raise ValueError('Possible credential in package')
            entries[entry.name] = body
        end = archive.offset
    if len(raw) % 512 or len(raw) < end + 1024 or any(raw[end:]):
        raise ValueError('Invalid archive terminator or trailing data')
    if set(entries) != set(policy['allowedFiles']):
        raise ValueError('Missing package files')
    manifest = json.loads(entries['package/package.json'])
    if manifest.get('name') != policy['name'] or manifest.get('version') != version or manifest.get('bin', {}) != policy['bins']:
        raise ValueError('MANIFEST_IDENTITY')
    if any(key in manifest for key in ['scripts', 'dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'bundledDependencies', 'bundleDependencies', 'publishConfig']):
        raise ValueError('MANIFEST_AUTHORITY')
    repo = manifest.get('repository')
    if isinstance(repo, dict):
        repo = repo.get('url')
    if repo not in [policy['repo'], 'git+' + policy['repo'] + '.git', policy['repo'] + '.git']:
        raise ValueError('MANIFEST_REPOSITORY')
    return 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()


def reconcile(name, version, integrity, query=request, sleep=time.sleep, attempts=12):
    from urllib.parse import quote
    route = '/' + quote(name, safe='')
    for attempt in range(attempts):
        try:
            observed = query(route + '/' + version)
            if observed is not None:
                if observed.get('dist', {}).get('integrity') != integrity:
                    return 'REGISTRY_CONFLICT'
                tags = query('/-/package/' + quote(name, safe='') + '/dist-tags')
                if tags and tags.get('next') == version:
                    return 'VERIFIED'
        except (ValueError, OSError):
            pass
        if attempt + 1 < attempts:
            sleep(5)
    return 'UNCONFIRMED'


def publish(policy, data, expected, version, query=request, invoke=subprocess.run, sleep=time.sleep, token_loader=load_token):
    from urllib.parse import quote
    integrity = validate_archive(data, expected, version, policy)
    observed = query('/' + quote(policy['name'], safe='') + '/' + version)
    if observed is not None and observed.get('dist', {}).get('integrity') != integrity:
        return {'status': 'REGISTRY_CONFLICT'}
    outcome = 'EXISTING'
    npm_error_code = None
    if observed is None:
        npm = shutil.which('npm', path='/usr/local/bin:/usr/bin:/bin')
        if not npm:
            return {'status': 'NPM_UNAVAILABLE'}
        token = token_loader()
        with tempfile.TemporaryDirectory(prefix='factory-publish-') as home:
            artifact = os.path.join(home, 'release.tgz')
            with open(artifact, 'xb') as output:
                output.write(data)
            config = os.path.join(home, '.npmrc')
            with open(config, 'x') as output:
                output.write('registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\nignore-scripts=true\n')
            os.chmod(config, 0o600)
            env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': home, 'NPM_CONFIG_USERCONFIG': config, 'NPM_CONFIG_CACHE': os.path.join(home, 'cache'), 'NODE_AUTH_TOKEN': token, 'NPM_CONFIG_LOGS_MAX': '0'}
            try:
                result = invoke([npm, 'publish', artifact, '--ignore-scripts', '--access', 'public', '--tag', 'next', '--registry', REGISTRY], cwd=home, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=120, check=False)
                outcome = 'RETURNED_ZERO' if result.returncode == 0 else 'RETURNED_NONZERO'
                stderr = result.stderr if isinstance(result.stderr, bytes) else b''
                # Copy only a strict npm diagnostic enum, never bodies or messages.
                codes = re.findall(rb'^npm error code ([A-Z][A-Z0-9_]{0,63})\r?$', stderr, re.MULTILINE)
                if codes:
                    npm_error_code = codes[0].decode('ascii')
            except subprocess.TimeoutExpired:
                outcome = 'TIMEOUT'
            except OSError:
                outcome = 'EXECUTION_ERROR'
    status = reconcile(policy['name'], version, integrity, query=query, sleep=sleep)
    return {'status': status, 'publishOutcome': outcome, 'npmErrorCode': npm_error_code, 'name': policy['name'], 'version': version, 'integrity': integrity, 'provenance': 'unsupported outside GitHub OIDC'}


def main(args):
    if args == ['preflight']:
        response = request('/-/whoami', load_token())
        username = response.get('username')
        if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', username):
            raise ValueError('REGISTRY_IDENTITY')
        print(json.dumps({'status': 'AUTHENTICATED', 'username': username}))
        return
    if len(args) != 5 or args[0] != 'publish':
        raise ValueError('USAGE')
    _, policy_path, path, expected, version = args
    policy = load_policy(policy_path)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError('ARCHIVE_TYPE')
        data = os.read(fd, policy['maxBytes'] + 1)
    finally:
        os.close(fd)
    if len(data) > policy['maxBytes']:
        raise ValueError('ARCHIVE_SIZE')
    result = publish(policy, data, expected, version)
    print(json.dumps(result))
    if result['status'] != 'VERIFIED':
        sys.exit(1)


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except Exception as error:
        print(json.dumps({'status': 'REJECTED', 'reason': type(error).__name__}), file=sys.stderr)
        sys.exit(1)

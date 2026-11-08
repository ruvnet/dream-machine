"""Run the reviewed learning cycle with only its HF credential, never all vault keys."""
import os, pathlib, shlex, stat, subprocess, sys
binding = pathlib.Path('/run/user/1000/ruos-env')
fd = os.open(binding, os.O_RDONLY | os.O_NOFOLLOW)
try:
    meta = os.fstat(fd)
    if meta.st_uid != os.getuid() or stat.S_IMODE(meta.st_mode) != 0o600 or not stat.S_ISREG(meta.st_mode) or meta.st_size > 65536:
        raise RuntimeError('Unsafe credential binding')
    with os.fdopen(fd, 'r', closefd=False) as stream:
        token = None
        for line in stream:
            for part in shlex.split(line):
                if part.startswith('HF_TOKEN='):
                    token = part.split('=', 1)[1]
finally:
    os.close(fd)
if not token:
    raise RuntimeError('HF_TOKEN unavailable')
root = pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv) != 3:
    raise RuntimeError('Usage: python3 scripts/ruos-hf-run.py spec.json evidence-directory')
env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(pathlib.Path.home()), 'HF_TOKEN': token}
# Candidate programs never receive this environment; only the trusted HTTP adapter does.
result = subprocess.run(['/usr/bin/env', 'node', str(root / 'scripts/hf-learning-cycle.mjs'), *sys.argv[1:]], env=env, timeout=240)
sys.exit(result.returncode)

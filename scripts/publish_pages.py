"""Build and fast-forward the gh-pages branch without switching the current checkout."""
from pathlib import Path
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent


def git(*args, env=None, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd, env=env, text=True).strip()


if __name__ == '__main__':
    subprocess.run(['npm', 'run', 'build'], cwd=ROOT, check=True)
    remote = git('ls-remote', 'origin', 'refs/heads/gh-pages')
    parent = None
    if remote:
        subprocess.run(['git', 'fetch', 'origin', 'gh-pages'], cwd=ROOT, check=True)
        parent = git('rev-parse', 'FETCH_HEAD')
    git_dir = git('rev-parse', '--absolute-git-dir')
    with tempfile.TemporaryDirectory(prefix='nuo-pages-') as temp:
        env = os.environ.copy()
        env['GIT_INDEX_FILE'] = str(Path(temp) / 'index')
        args = ('--git-dir=' + git_dir, '--work-tree=' + str(ROOT / 'dist'))
        git(*args, 'read-tree', '--empty', env=env)
        git(*args, 'add', '--all', '.', env=env, cwd=ROOT / 'dist')
        tree = git(*args, 'write-tree', env=env)
    commit_args = ['-c', 'user.name=Codex', '-c', 'user.email=codex@users.noreply.github.com', 'commit-tree', tree]
    if parent:
        commit_args += ['-p', parent]
    commit_args += ['-m', 'Publish storybook preview from ' + git('rev-parse', '--short', 'HEAD')]
    commit = git(*commit_args)
    subprocess.run(['git', 'push', 'origin', commit + ':refs/heads/gh-pages'], cwd=ROOT, check=True)
    print('Uploaded website files to gh-pages. GitHub Pages must use gh-pages / (root).')

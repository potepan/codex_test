#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'gh-pages';
const DEPLOY_REMOTE = process.env.DEPLOY_REMOTE || 'origin';
const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const distDir = path.join(repoRoot, 'dist');
const message = process.env.DEPLOY_MESSAGE || `Deploy ${new Date().toISOString()}`;

function run(command, options = {}) {
  execSync(command, {
    stdio: 'inherit',
    ...options,
  });
}

function runCapture(command, options = {}) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  }).trim();
}

function ensureDistExists() {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ ディレクトリが見つかりません。先に "npm run build" を実行してください。');
  }
}

function ensureCleanWorkingTree() {
  const status = runCapture('git status --porcelain', { cwd: repoRoot });
  if (status) {
    throw new Error('作業ツリーにコミットされていない変更があります。デプロイ前にコミットまたは破棄してください。');
  }
}

function fetchRemote() {
  try {
    run(`git fetch ${DEPLOY_REMOTE}`);
  } catch (error) {
    console.warn('リモートの取得に失敗しましたが、処理を継続します。', error.message);
  }
}

function resolveWorktreeTarget(baseDir) {
  const worktreePath = path.join(baseDir, 'deploy');
  const localBranchExists = (() => {
    try {
      runCapture(`git show-ref --verify refs/heads/${DEPLOY_BRANCH}`);
      return true;
    } catch {
      return false;
    }
  })();

  const remoteBranchExists = (() => {
    try {
      const output = runCapture(`git ls-remote --heads ${DEPLOY_REMOTE} ${DEPLOY_BRANCH}`);
      return Boolean(output);
    } catch {
      return false;
    }
  })();

  if (localBranchExists) {
    run(`git worktree add ${worktreePath} ${DEPLOY_BRANCH}`);
  } else if (remoteBranchExists) {
    run(`git worktree add ${worktreePath} ${DEPLOY_REMOTE}/${DEPLOY_BRANCH}`);
  } else {
    run(`git worktree add -B ${DEPLOY_BRANCH} ${worktreePath}`);
  }

  return worktreePath;
}

function emptyDirectory(directory) {
  for (const entry of fs.readdirSync(directory)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
  }
}

function copyDistTo(directory) {
  fs.cpSync(distDir, directory, { recursive: true });
}

function commitAndPush(directory) {
  run('git add --all', { cwd: directory });
  const hasChanges = runCapture('git status --porcelain', { cwd: directory });

  if (!hasChanges) {
    console.log('デプロイ対象に変更がありません。処理を終了します。');
    return;
  }

  run(`git commit -m ${JSON.stringify(message)}`, { cwd: directory });
  run(`git push ${DEPLOY_REMOTE} HEAD:${DEPLOY_BRANCH}`, { cwd: directory });
}

function removeWorktree(directory) {
  try {
    run(`git worktree remove ${directory}`);
  } finally {
    fs.rmSync(path.dirname(directory), { recursive: true, force: true });
  }
}

(async function main() {
  try {
    ensureDistExists();
    ensureCleanWorkingTree();
    fetchRemote();

    const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'potepan-todo-'));
    const worktreePath = resolveWorktreeTarget(tempBase);

    try {
      emptyDirectory(worktreePath);
      copyDistTo(worktreePath);
      commitAndPush(worktreePath);
    } finally {
      removeWorktree(worktreePath);
    }
  } catch (error) {
    console.error('\u001b[31mデプロイに失敗しました:\u001b[0m', error.message);
    process.exitCode = 1;
  }
})();

#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
$guard = Join-Path $PSScriptRoot 'agent-worktree.ps1'; $sandbox = Join-Path ([IO.Path]::GetTempPath()) ('agent-worktree-' + [Guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $sandbox | Out-Null
try {
  function Run([string]$cwd, [string[]]$GitArgs) { $output = & git -C $cwd @GitArgs 2>&1; if ($LASTEXITCODE -ne 0) { throw "git failed: $($GitArgs -join ' ') output=$output" } }
  function Assert([bool]$ok, [string]$why) { if (-not $ok) { throw "ASSERTION FAILED: $why" } }
  $repo = Join-Path $sandbox 'repo'; New-Item -ItemType Directory $repo | Out-Null; Run $repo @('init', '-b', 'master'); Run $repo @('config', 'user.email', 'test@example.invalid'); Run $repo @('config', 'user.name', 'Test'); Set-Content (Join-Path $repo 'README.md') seed; Run $repo @('add', '.'); Run $repo @('commit', '-m', 'seed')
  New-Item -ItemType Directory (Join-Path $repo '.worktrees') | Out-Null
  $wt = Join-Path $repo '.worktrees/task-1'; Run $repo @('worktree', 'add', '-b', 'task-1', $wt)
  $env:IMPLEMENTER_TASK_ID = 'task-1'; & pwsh -NoProfile -File $guard -Mode Initialize -WorktreePath $wt | Out-Null; Assert ($LASTEXITCODE -eq 0) 'initialize valid worktree'
  $env:AGENT_WORKTREE_ROLE = 'implementer'; & pwsh -NoProfile -File $guard -Mode CommitGuard -WorktreePath $wt | Out-Null; Assert ($LASTEXITCODE -eq 0) 'valid worktree allowed'
  $env:IMPLEMENTER_TASK_ID = 'wrong-task'; & pwsh -NoProfile -File $guard -Mode CommitGuard -WorktreePath $wt 2>$null | Out-Null; Assert ($LASTEXITCODE -ne 0) 'mismatched task identity blocked'
  $env:IMPLEMENTER_TASK_ID = 'task-1'
  & pwsh -NoProfile -File $guard -Mode CommitGuard -WorktreePath $repo 2>$null | Out-Null; Assert ($LASTEXITCODE -ne 0) 'main checkout blocked'
  Remove-Item Env:AGENT_WORKTREE_ROLE; & pwsh -NoProfile -File $guard -Mode CommitGuard -WorktreePath $repo | Out-Null; Assert ($LASTEXITCODE -eq 0) 'human main commit allowed'
  $sha = (& git -C $repo rev-parse master).Trim(); & pwsh -NoProfile -File $guard -Mode AssertNoMainCommit -MainPath $repo -BaselineSha $sha | Out-Null; Assert ($LASTEXITCODE -eq 0) 'main invariant passes'
  Set-Content (Join-Path $repo 'main-change.txt') misrouted; Run $repo @('add', '.'); Run $repo @('commit', '-m', 'misrouted'); & pwsh -NoProfile -File $guard -Mode AssertNoMainCommit -MainPath $repo -BaselineSha $sha 2>$null | Out-Null; Assert ($LASTEXITCODE -ne 0) 'advanced main detected'
  'PASS: cic-ingestion agent worktree guard tests'
} finally { if (Test-Path $sandbox) { Remove-Item -LiteralPath $sandbox -Recurse -Force } }

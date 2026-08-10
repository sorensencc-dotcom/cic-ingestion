#!/usr/bin/env pwsh
[CmdletBinding()]
param(
  [ValidateSet('Initialize', 'Verify', 'CommitGuard', 'Snapshot', 'AssertNoMainCommit')]
  [string]$Mode = 'Verify',
  [string]$WorktreePath,
  [string]$BaselineSha,
  [string]$MainPath,
  [string]$MainBranch = 'master'
)
$ErrorActionPreference = 'Stop'

function Invoke-Git([string]$Path, [string[]]$GitArgs) {
  $out = & git -C $Path @GitArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git failed in $Path`: $out" }
  ($out -join "`n").Trim()
}
function Full([string]$Path) { [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path).TrimEnd('\', '/') }
function Root([string]$Path) { Full (Invoke-Git $Path @('rev-parse', '--show-toplevel')) }
function Worktrees([string]$Repo) {
  $lines = (Invoke-Git $Repo @('worktree', 'list', '--porcelain')) -split "`n"; $all = @(); $current = $null
  foreach ($line in $lines) {
    if ($line -like 'worktree *') { if ($current) { $all += [PSCustomObject]$current }; $current = @{ Path = Full $line.Substring(9).Trim() } }
  }
  if ($current) { $all += [PSCustomObject]$current }; $all
}
function IsImplementer([string]$Repo) { ((& git -C $Repo config --worktree --get agent.role 2>$null) -eq 'implementer') -or ($env:AGENT_WORKTREE_ROLE -eq 'implementer') }
function AssertWorktree([string]$Repo) {
  $current = Full $Repo; $all = @(Worktrees $Repo); $expected = ([IO.Path]::GetFullPath((Join-Path (($all | Select-Object -First 1).Path) '.worktrees'))).TrimEnd('\', '/')
  $registered = @($all | Where-Object { $_.Path -ieq $current })
  if (-not $registered -or -not $current.StartsWith($expected + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "IMPLEMENTER COMMIT BLOCKED: '$current' is not a registered .worktrees checkout under '$expected'." }
  if ($env:IMPLEMENTER_TASK_ID) { $configuredTask = (& git -C $Repo config --worktree --get agent.taskId 2>$null); if ($configuredTask -ne $env:IMPLEMENTER_TASK_ID) { throw "IMPLEMENTER COMMIT BLOCKED: task identity '$env:IMPLEMENTER_TASK_ID' does not match worktree task '$configuredTask'." } }
}
function Initialize-ImplementerWorktree([string]$Path) {
  $repo = Root $Path; Invoke-Git $repo @('config', 'extensions.worktreeConfig', 'true') | Out-Null; Invoke-Git $repo @('config', '--worktree', 'agent.role', 'implementer') | Out-Null
  if ($env:IMPLEMENTER_TASK_ID) { Invoke-Git $repo @('config', '--worktree', 'agent.taskId', $env:IMPLEMENTER_TASK_ID) | Out-Null }
  Invoke-Git $repo @('config', '--worktree', 'core.hooksPath', '.githooks') | Out-Null; AssertWorktree $repo; "initialized implementer worktree: $repo"
}
$repo = Root ($WorktreePath ?? (Get-Location).Path)
switch ($Mode) {
  'Initialize' { Initialize-ImplementerWorktree ($WorktreePath ?? $repo); exit 0 }
  'Verify' { if (IsImplementer $repo) { AssertWorktree $repo }; "verified checkout: $repo"; exit 0 }
  'CommitGuard' { if (IsImplementer $repo) { AssertWorktree $repo }; exit 0 }
  'Snapshot' { [PSCustomObject]@{ repoRoot = $repo; head = Invoke-Git $repo @('rev-parse', 'HEAD'); branch = Invoke-Git $repo @('branch', '--show-current') } | ConvertTo-Json -Compress; exit 0 }
  'AssertNoMainCommit' {
    if (-not $MainPath -or -not $BaselineSha) { throw 'MainPath and BaselineSha are required' }
    $current = Invoke-Git (Root $MainPath) @('rev-parse', $MainBranch)
    if ($current -ne $BaselineSha) { throw "DISPATCH BLOCKED: '$MainBranch' advanced from $BaselineSha to $current." }
    "main unchanged: $current"; exit 0
  }
}

#!/bin/sh
# Secret-scan pre-commit gate (repo cleanup 2026-07-03).
# Blocks commits that stage (a) non-example .env files or (b) content
# matching live credential patterns. Sourced/called from .git/hooks/pre-commit.

# (a) staged non-example env files
env_files=$(git diff --cached --name-only --diff-filter=AM | grep -E '(^|/)\.env(\.|$)' | grep -vE '\.example$')
if [ -n "$env_files" ]; then
  echo ""
  echo "BLOCKED: non-example .env file staged:"
  echo "$env_files" | sed 's/^/   /'
  echo "Env files carry credentials. Commit a .env.example instead."
  exit 1
fi

# (b) staged content matching credential patterns
# AIza: Google API key; sk-: OpenAI/Anthropic; ghp_/github_pat_: GitHub;
# xox: Slack; AKIA: AWS access key id
pattern='AIza[0-9A-Za-z_-]{35}|sk-[a-zA-Z0-9_-]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|xox[bp]-[0-9A-Za-z-]{10,}|AKIA[0-9A-Z]{16}'
hits=$(git diff --cached -U0 --diff-filter=AM | grep -E '^\+' | grep -EI "$pattern" | head -5)
if [ -n "$hits" ]; then
  echo ""
  echo "BLOCKED: staged content matches live credential pattern:"
  echo "$hits" | cut -c1-60 | sed 's/^/   /'
  echo "Rotate the key if real; use env vars/placeholders in code."
  exit 1
fi

exit 0

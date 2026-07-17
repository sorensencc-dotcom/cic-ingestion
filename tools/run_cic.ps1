$ErrorActionPreference = 'Stop'
$root = 'C:\dev\cic-ingestion'
node --loader ts-node/esm "$root\tools\run_full_pipeline.ts"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

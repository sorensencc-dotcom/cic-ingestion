# FamilySearch beta setup

Read one person from the FamilySearch beta environment. These steps make no writes to FamilySearch.

## Prerequisites

- A FamilySearch developer app key for the beta environment.
- Node 20 or later and `npm install` run in the repo.

## Steps

1. Register the redirect URI `http://localhost:3000/callback` on your app in the FamilySearch developer console. It must match exactly. To use another port, set `FAMILYSEARCH_REDIRECT_URI` to the same value you registered.
2. Add these variables to `C:\dev\cic-ingestion\.env`, or any env file you pass with `--env-file`:

   ```
   FAMILYSEARCH_ENV=beta
   FAMILYSEARCH_APP_KEY=<your beta app key>
   FAMILYSEARCH_REDIRECT_URI=http://localhost:3000/callback
   ```

3. Run the login script:

   ```powershell
   npm run fs:login -- --env-file C:\dev\cic-ingestion\.env
   ```

   The script prints a sign-in URL. Open it, sign in to FamilySearch beta, and approve the app. The script verifies the OAuth `state`, exchanges the code, and prints one line. It times out after 5 minutes.

4. Paste the printed line into the same PowerShell window:

   ```powershell
   $env:FAMILYSEARCH_ACCESS_TOKEN = '<printed token>'
   ```

   The token exists only in your terminal and that session. It is never written to disk. It lasts up to 24 hours.

5. Read a person:

   ```powershell
   npm run fs:read -- LV7Q-DGW --env-file C:\dev\cic-ingestion\.env
   ```

   The output lists names, facts, source descriptions, notes, and a relatives count. A redacted copy of the raw response goes to `.tmp/fs-person-<pid>.json`, which is gitignored.

## Variables

| Variable | Purpose |
| --- | --- |
| `FAMILYSEARCH_ENV` | `beta` (default) or `production`. `fs:login` refuses `production` without `--allow-production`. |
| `FAMILYSEARCH_APP_KEY` | OAuth `client_id`. |
| `FAMILYSEARCH_REDIRECT_URI` | Local callback URL. Default `http://localhost:3000/callback`. |
| `FAMILYSEARCH_ACCESS_TOKEN` | Bearer token from `fs:login`. |
| `FAMILYSEARCH_REFRESH_TOKEN`, `FAMILYSEARCH_CLIENT_SECRET` | Optional. Only if FamilySearch enabled refresh tokens for your app. |

`FAMILYSEARCH_API_KEY` and `FAMILYSEARCH_API_URL` were removed. Nothing reads them.

Variables already set in your shell take precedence over values in the env file.

## Route protection

Set `CIC_CREDENTIALED_ROUTE_KEY` (16+ characters) before starting the server. `/execute/familysearch` returns 401 without a matching `x-cic-route-key` header, and the adapter is not registered when the variable is unset. Responses omit the raw GEDCOM X document unless the payload sets `includeRaw: true`. Callers such as the toolforge chat-agent must send the header.

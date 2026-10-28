import http from "node:http";
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
} from "../src/adapters/familysearch/tokenProvider";
import { extractEnvFileArg, loadVars } from "../src/adapters/familysearch/cli/envFile";
import {
  LOGIN_TIMEOUT_MS,
  evaluateCallback,
  generateState,
  powershellTokenLine,
  resolveLoginConfig,
} from "../src/adapters/familysearch/cli/login";

async function main(): Promise<void> {
  const { envFile, rest } = extractEnvFileArg(process.argv.slice(2));
  const cfg = resolveLoginConfig(loadVars(envFile), rest.includes("--allow-production"));
  const state = generateState();

  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Timed out after 5 minutes waiting for sign-in"));
    }, LOGIN_TIMEOUT_MS);
    const server = http.createServer((req, res) => {
      const result = evaluateCallback(req.url ?? "/", cfg.callbackPath, state);
      if (result.kind === "ignore") {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(result.kind === "code" ? 200 : 400, { "Content-Type": "text/plain" });
      res.end(result.kind === "code" ? "Signed in. Return to the terminal." : result.message);
      clearTimeout(timer);
      server.close();
      if (result.kind === "code") resolve(result.code);
      else reject(new Error(result.message));
    });
    server.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    server.listen(cfg.port, "127.0.0.1", () => {
      console.log(`Environment: ${cfg.env}`);
      console.log(`Callback:    ${cfg.redirectUri}`);
      console.log("Open this URL in your browser and sign in:\n");
      console.log(
        buildAuthorizationUrl({
          env: cfg.env,
          clientId: cfg.appKey,
          redirectUri: cfg.redirectUri,
          state,
        })
      );
      console.log("\nWaiting for callback (5 minute limit)...");
    });
  });

  const tokens = await exchangeAuthorizationCode({
    env: cfg.env,
    clientId: cfg.appKey,
    redirectUri: cfg.redirectUri,
    code,
  });
  console.log("\nPaste this into PowerShell (token is shown only here):\n");
  console.log(powershellTokenLine(tokens.accessToken));
  console.log(`\nToken lifetime about ${Math.round(tokens.expiresInMs / 3600000)}h.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "login failed");
  process.exit(1);
});

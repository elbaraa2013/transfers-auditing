---
name: GitHub push auth
description: How to push to GitHub origin when git askpass auth fails in this workspace
---
Pushing to origin (GitHub HTTPS) fails with "Invalid username or token" even after the GitHub connector is connected — the built-in askpass doesn't pick it up.

**How to apply:** Get an OAuth token from the connectors service and push with it:
1. In a temp dir, `npm install @replit/connectors-sdk`; use `new ReplitConnectors().getProxyHeaders("github")` to get the `Replit-Authentication` header.
2. Fetch `https://$REPLIT_CONNECTORS_HOSTNAME/api/v2/connection?include_secrets=true` with that header. **Do NOT add `connector_names=` filter — it makes the API return 0 items.** Filter items by `connector_name === "github"` client-side; token at `settings.access_token`.
3. `git push https://x-access-token:$TOKEN@github.com/<owner>/<repo> main` (redact token in output with sed).

**Why:** curl with `X_REPLIT_TOKEN: repl $REPL_IDENTITY` also returned 0 items; only the SDK-derived header worked. Sandbox `listConnections('github')` returned empty despite a healthy connection.

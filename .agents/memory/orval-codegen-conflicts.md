---
name: Orval codegen param-name collision
description: Why adding query params to a path-param endpoint breaks the zod barrel, and how to avoid it.
---

# Orval `<Op>Params` collision (TS2308)

Adding query params to an endpoint that ALSO has a path param makes Orval emit two
exports both named `<Op>Params`: the zod `api.ts` names the path-param object
`<Op>Params`, while the TS types output names the *query* params type `<Op>Params`
too. The api-zod barrel re-exports both via `export *` → TS2308 "already exported a
member named X".

**Why:** the zod generator only suffixes query params with `Query` (`<Op>QueryParams`)
when a path param is present; the types generator never adds that suffix. Endpoints
with only query params (e.g. `/transfers/daily-recipients?date=`) are fine — no path
param, so no collision. Endpoints with only path params are fine too.

**How to apply:** do NOT add query params to an endpoint that has a path param
(the trigger case here was `GET /agents/{id}/statement?from&to`). Instead either
(a) make a separate query-only endpoint, or (b) do the filtering client-side —
the statement already returns all of the agent's transfers, so date-range filtering
+ period-summary recompute is done in `Statement.tsx`, not the API.

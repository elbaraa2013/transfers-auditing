---
name: Transfer response shape built in two places
description: The Transfer API object is assembled independently in two route files; new fields must be added to both.
---

The `Transfer` response object (matching the OpenAPI `Transfer` schema) is built in two independent places in the api-server:

- `routes/transfers.ts` → `buildTransferResponse()` (used by list/get/create/cash endpoints)
- `routes/agents.ts` → the `transfersFormatted` map inside the `GET /agents/:id/statement` handler (hand-rolled, does NOT call buildTransferResponse)

**Why:** the statement endpoint maps rows inline instead of reusing the shared builder. Adding a field to one builder but not the other means the statement endpoint silently violates the OpenAPI schema and the frontend reads `undefined` for that field on the statement page.

**How to apply:** whenever you add a column to `transfersTable` and expose it in the OpenAPI `Transfer` schema, update BOTH builders in lockstep. Consider refactoring agents.ts to reuse buildTransferResponse if this bites again.

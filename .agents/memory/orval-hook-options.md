---
name: Orval hook query options
description: Generated React Query hooks require explicit queryKey when passing query options like enabled
---

The Orval-generated hooks in `@workspace/api-client-react` type their `options.query` as a full `UseQueryOptions` with a **required** `queryKey`. Passing only `{ query: { enabled } }` fails typecheck (TS2741).

**Why:** the generated `UseQueryOptions` type is not `Partial` on `queryKey`, so any options object must supply it.

**How to apply:** always pair `enabled` (or any query option) with the matching generated key helper, e.g.
`useGetTransfer(id, { query: { enabled: ..., queryKey: getGetTransferQueryKey(id) } })`.
Also note: list hooks without path params take options as the **first** argument (e.g. `useListAgents({ query: ... })`), not `(undefined, options)`.

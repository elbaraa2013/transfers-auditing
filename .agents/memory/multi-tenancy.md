---
name: hawala-audit multi-tenancy
description: How per-account data isolation works in hawala-audit, and the rules every query must follow.
---

# Logical multi-tenancy (single DB)

hawala-audit isolates accounts logically in ONE Postgres DB (user chose this over
separate physical DBs). Each row in `agents`, `transfers`, `messages` carries
`ownerId text NOT NULL` = the Clerk userId. Auth is Clerk (cookie-based web).

**Rule:** EVERY read and write must be scoped by `req.userId`, including:
- `where` clauses on the primary table,
- the `innerJoin` condition when joining `agents` (constrain `agents.ownerId` too, not just `agentId = id`),
- post-update agent reads/writes (activity timestamp, name lookups).

**Why:** an inner join on `agentId` alone can leak another tenant's agent name if
referential consistency is ever violated. Defense-in-depth flagged by code review.

**operationNumber uniqueness:** moved from a GLOBAL `.unique()` to a composite
unique index `(ownerId, operationNumber)` — two accounts can reuse the same number.

`requireAuth` (artifacts/api-server/src/middlewares) sets `req.userId` and is applied
to all routers except `health`. Frontend gates dashboard behind Clerk `<Show>`; base
path "/" is a public landing page, signed-in users redirect to "/overview".

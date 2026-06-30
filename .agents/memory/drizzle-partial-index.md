---
name: drizzle partial index push gotcha
description: drizzle-kit push does not diff a unique index's partial WHERE predicate; partial indexes need manual SQL on dev.
---

# drizzle-kit push ignores partial-index WHERE predicates

When a `uniqueIndex(...).on(...).where(sql\`...\`)` predicate is added/changed but the
index name and columns stay the same, `drizzle-kit push` reports "No changes detected"
and the DB keeps the old (non-partial) index. Verify with
`SELECT indexdef FROM pg_indexes WHERE indexname='...'`.

**Why:** drizzle-kit's schema diff compares index name + columns, not the partial predicate.

**How to apply:** After editing the schema, if push says no changes but you added/changed a
`.where()` on an index, apply it manually on the **development** DB only:
`DROP INDEX ...; CREATE UNIQUE INDEX ... WHERE <predicate>;`. Keep the schema file in sync so
the source of truth is correct. Do NOT run DDL against production — re-publishing diffs the
actual dev vs prod databases (introspection-based, includes the predicate) and propagates it.

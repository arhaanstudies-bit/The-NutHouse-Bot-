---
name: pnpm overrides precedence
description: Behavior when both pnpm-workspace.yaml and root package.json define pnpm overrides.
---

When a pnpm monorepo defines dependency `overrides` in both
`pnpm-workspace.yaml` (`overrides:` top-level key) and the root
`package.json` (`pnpm.overrides`), the root `package.json` version wins
and **completely replaces** the pnpm-workspace.yaml overrides list — it does
not merge them. Any override keys that exist only in pnpm-workspace.yaml are
silently ignored if `package.json` also has a `pnpm.overrides` block.

**Why:** Discovered while fixing dependency vulnerabilities — adding new
override entries to `pnpm-workspace.yaml` had zero effect on the resulting
lockfile/installed versions because `package.json`'s `pnpm.overrides` (which
already existed with a couple of unrelated entries) silently took over.

**How to apply:** Before adding/editing a pnpm override, check both
`pnpm-workspace.yaml` and root `package.json` for existing `overrides`
sections. If both exist, put all overrides in the root `package.json`
`pnpm.overrides` block (or consolidate into whichever one the project
actually uses) and confirm with `pnpm audit` / grepping the lockfile after
`pnpm install --force` that the intended version actually landed.

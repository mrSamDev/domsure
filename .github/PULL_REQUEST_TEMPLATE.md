## Summary

<!-- One or two sentences. What does this change do? -->

## Motivation

<!-- Why is this change needed? Link an issue if one exists: `Closes #123`. -->

## What changed

<!-- Bullet list of the concrete changes. Mention any public API additions or
breaks. -->

## Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes — added tests for any new behavior
- [ ] `pnpm build` succeeds; `dist/` regenerated if `src/` changed
- [ ] No `any` — used `unknown` at boundaries
- [ ] Comments explain *why*, not *what*
- [ ] No AI filler words (robust, seamless, comprehensive, leverage, …)
- [ ] File under 200 lines
- [ ] If a public export was added/changed: updated `src/index.ts`, README API
  list, and `CHANGELOG.md`
- [ ] If the bundle size changed: the README size table still matches reality
  (`gzip -c dist/index.js | wc -c`)
# Contributing to domsure

domsure is small on purpose. The whole library is ~250 lines across 6 files. The
bar for adding code is high: if a feature doesn't justify its bytes, it doesn't
ship.

## Quick start

```sh
git clone <repo> && cd domsure
pnpm install
pnpm test          # vitest, jsdom
pnpm lint          # tsc --noEmit on src + test
pnpm build         # tsup → dist/index.{js,cjs} + .d.ts
pnpm verify:cjs    # smoke-test the CJS bundle
```

Node 18+. pnpm is the canonical package manager (see `packageManager` in
`package.json`). Don't add a second lockfile.

## What fits this library

domsure's thesis: **replace `!` assertions with real runtime checks**. A change
fits if it serves that thesis without adding weight:

- Correctness fixes for edge-case selectors (numeric IDs, escaped characters).
- Better error messages or structured error data.
- Smaller output, or removing code that isn't earning its bytes.
- Tests for untested production paths.

## What does not fit

- New query helpers that duplicate what `querySelector` already does clearly.
- Configuration objects / plugins / hooks. This is a function library, not a
  framework.
- Abstractions with one caller.
- "Robust", "enterprise", or "scalable" anything. See `AGENTS.md`.

## Before you open a PR

- [ ] `pnpm lint` passes with zero errors.
- [ ] `pnpm test` passes (44+ tests). Add tests for any new behavior.
- [ ] `pnpm build` succeeds and `dist/` is regenerated if you changed `src/`.
- [ ] File under 200 lines (`AGENTS.md` rule). Split by responsibility, not by
  type.
- [ ] No `any`. Use `unknown` at boundaries; trust internal types after validation.
- [ ] Comments explain *why*, not *what*. Delete comments that restate code.
- [ ] No AI filler words in comments or docs (robust, seamless, comprehensive,
  leverage, facilitate, enterprise-grade).
- [ ] If you added a public export, update `src/index.ts`, the README API list,
  and `CHANGELOG.md`.

## Test philosophy

Test behavior, not implementation.

```ts
// good
expect(() => $.required('#missing')).toThrow(DomsureError);

// bad — couples the test to the call graph
expect(query).toHaveBeenCalledWith('#missing');
```

If a test needs internal state (the warned-set, the dev-mode flag), use the
`_setDevOverrideForTests` / `resetWarnings` helpers in `src/env.ts`. Never reach
into module-private state directly.

## Size is a feature

The published ESM bundle is **< 1 KB gzipped**. The README says so. If your
change pushes it over 1 KB, either find a smaller approach or update the README
and the size table honestly. Do not let the claim and the reality drift.

## Changelog

Add an entry under `## Unreleased` in `CHANGELOG.md` describing the change from
a user's perspective. Move it to a versioned heading on release.

## Release

Releases are cut by maintainers. The flow:

1. `pnpm build && pnpm verify:cjs`
2. `npm publish` (npm) and `deno publish` (JSR)
3. Tag the release: `git tag v0.x.y && git push --tags`
4. Update `CHANGELOG.md` with the version and date.

## Code of conduct

See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Be kind, be specific, be
brief.
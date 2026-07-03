# project.md

Reference card for AI agents working in the **domsure** repository.
Read this before editing source, tests, or docs.

## What this is

`domsure` is a 1 KB-gzipped DOM query utility library. It replaces `!`
non-null assertions with real runtime checks and gives you branded errors,
dev-only warn-once behavior, and a typed selector registry.

- **Package:** `domsure` on npm, `@mrsamdevdomsure` on JSR
- **Runtime:** Browser only. Reads `document` directly. Throws `DomsureError`
  under SSR (where `document` is undefined) rather than failing silently.
- **Targets:** ESM + CJS, ES2020, Node >= 18, Deno.
- **Zero runtime dependencies.**

## Public API

Exported from `src/index.ts`:

```ts
import { $, $$, defineSelectors, DomsureError, resetWarnings } from 'domsure';

$(selector)          // HTMLElement | null   silent, fast #id path
$.required(sel)      // HTMLElement          throws DomsureError if missing
$.tryRequired(sel)   // [DomsureError|null, HTMLElement|null]  required, never throws
$.optional(sel)      // HTMLElement | null   warns once in dev if missing
$.exists(sel)        // boolean
$$(selector)         // HTMLElement[]        querySelectorAll as a real Array
$$.required(sel)     // HTMLElement[]        throws if zero match
$$.tryRequired(sel)  // [DomsureError|null, HTMLElement[]]  required, never throws
$$.optional(sel)     // HTMLElement[]        warns once in dev if zero match
$$.exists(sel)       // boolean
defineSelectors(s)   // Readonly typed registry, frozen
resetWarnings()      // clear the warn-once dedup set
DomsureError         // branded error class, carries `.selector`
```

`<T>` on `$`/`$$` is a cast, not tag inference. Do not "fix" it to verify
the tag — that's an intentional non-goal.

## Source map

| File | Responsibility | Lines |
|---|---|---|
| `src/index.ts` | Barrel re-exports only. No logic. | ~4 |
| `src/query.ts` | `$` and `$$` plus `.required`/`.optional`/`.exists`/`.tryRequired`. `#id` fast path via `getElementById`. | ~394 |
| `src/selectors.ts` | `defineSelectors` — frozen, typed registry. Dev-only validation rejects non-strings and duplicate selectors. | ~35 |
| `src/env.ts` | `isDev()`, warn-once dedup (`markWarned`, `resetWarnings`), test-only overrides. | ~60 |
| `src/errors.ts` | `DomsureError extends Error`, carries `selector`. | ~19 |
| `src/types.ts` | `SelectorSchema`, `SelectorMap<T>`. | ~4 |

Tests mirror source one-to-one in `test/`, run under jsdom via Vitest.

## Build / test / verify

```sh
pnpm install            # install dev deps
pnpm build              # tsup -> dist/ (ESM + CJS + .d.ts)
pnpm test               # vitest run
pnpm test:watch         # vitest
pnpm test:coverage      # vitest --coverage (thresholds: 95/95/90/95)
pnpm lint               # tsc --noEmit on src and test configs
pnpm verify:cjs         # smoke-test the CJS bundle loads
pnpm size               # size-limit: ESM <= 1100 B gz, CJS <= 1400 B gz
pnpm prepublishOnly     # build + verify:cjs + size (runs before npm publish)
```

Deno path: `deno test --no-check`, `deno check src/index.ts`, `deno publish`.

## Constraints agents must respect

1. **Size budget is hard.** ESM <= 1100 B gzipped, CJS <= 1400 B gzipped.
   `.size-limit.json` enforces it. Don't add features that blow the budget.
2. **Zero runtime dependencies.** Don't import anything at runtime.
3. **Dev-only code must be dead-code-eliminable.** Production builds must
   strip the `isDev()` branches. Keep them behind a single boolean gate.
4. **Files stay small.** Target < 200 lines. One file, one responsibility.
5. **Fail fast.** Throw `DomsureError`, never swallow. Never return silent
   defaults from `.required`.
6. **No AI filler.** No "robust", "seamless", "comprehensive". Comments
   explain *why*, not *what*. See `AGENTS.md` for the full style guide.
7. **`<T>` is a cast, not inference.** Do not add tag verification.
8. **Test behavior, not implementation.** Prefer `expect(() => fn()).toThrow()`
   over `expect(spy).toHaveBeenCalled()`.

## Release flow

1. `pnpm prepublishOnly` runs build + CJS smoke + size check.
2. `pnpm publish:npm` for npm, `pnpm publish:jsr` for JSR (Deno).
3. Update `CHANGELOG.md` and bump `version` in both `package.json` and
   `deno.json` — they must stay in sync.

## What not to do

- Don't add a DOM-polyfill or SSR fallback that returns null. SSR throws by
  design; users guard with `typeof window !== 'undefined'`.
- Don't switch `$`/`$$` to return `NodeList` or a jQuery-like wrapper. They
  return `HTMLElement` and `HTMLElement[]`.
- Don't add caching/memoization of query results. DOM mutates; stale caches
  are a bug factory.
- Don't expand the public API without a concrete use case (YAGNI).
- Don't edit `dist/`. It is build output.
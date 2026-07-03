---
name: domsure
description: Use domsure (a 1 KB DOM query utility library) — migrating raw DOM queries to domsure, choosing the right helper, wiring a typed selector registry, and avoiding the common pitfalls. Activates when the user asks to adopt, migrate to, or refactor code toward domsure in a project that has domsure installed.
---

# domsure

`domsure` replaces `document.querySelector(...)!` style non-null assertions
with real runtime checks that throw branded errors when an element is
missing. Six helpers, under 1 KB gzipped, zero runtime dependencies, ESM
+ CJS.

When the user asks to adopt, migrate to, or refactor code toward domsure,
follow the procedures below. The source of truth for the API is `llm.txt`
in the package root (or the published `README.md`) — read it before
paraphrasing, because method names and semantics are exact, not recalled.

## Activation

This skill fires when the user says any of:
- "migrate to domsure" / "refactor my DOM queries to use domsure"
- "replace my `!` assertions with domsure"
- "add domsure to this project" / "set up domsure"
- "why is my domsure call throwing" / "domsure SSR error"
- names a domsure symbol (`$.required`, `$$.optional`, `defineSelectors`,
  `DomsureError`, `resetWarnings`) in a question

If the user is asking how to *maintain or publish* the domsure repo itself
(rather than use it), point them at `project.md` instead — that file is for
contributors, not consumers.

## Install

```sh
npm install domsure       # or: pnpm add domsure / yarn add domsure
deno add @samdev/domsure  # Deno / JSR
```

## Procedure: migrate a codebase to domsure

Run this when the user asks to migrate existing raw-DOM code.

1. **Find the candidates.** Grep for the patterns domsure replaces:
   - `document.querySelector(...)!` — non-null assertion on a query
   - `document.getElementById(...)!`
   - `document.querySelectorAll(...)` followed by `Array.from(...)` /
     `[...nodeList]` / `NodeList.prototype.forEach`
   - `getElementById` / `querySelector` results dereferenced without a
     null check
2. **Classify each call site** by what the code does on a missing element:
   - *Crashes / must exist* → `$.required` / `$$.required`
   - *Tolerates missing, but you want a dev warning* → `$.optional` /
     `$$.optional`
   - *Branches on presence* → `$.exists` / `$$.exists`
   - *Genuinely silent* → `$` / `$$`
3. **Rewrite** using the mapping table below. Preserve the original
   selector string verbatim.
4. **Remove the now-redundant null guard** when you used `.required` — the
   whole point is that it throws, so an extra `if (!el) return` after it is
   dead code and noise.
5. **Convert `querySelectorAll` consumers.** `$$` returns a real `Array`,
   so delete any `Array.from(...)` / spread wrapper around it. `.map`,
   `.filter`, `.reduce` work directly.
6. **Type-narrow with `<T>` only if you need it**, and document that it is
   a cast, not a runtime tag check (see Pitfall #2).
7. **Run the project's type check and tests.** domsure is browser-only;
   under SSR it throws by design (see SSR section). If the test runner is
   jsdom/happy-dom that's fine; if it's pure Node with no DOM, guard the
   calls or expect failures.

## Mapping table (raw DOM → domsure)

| Before | After |
|---|---|
| `document.querySelector('#x')!` | `$.required('#x')` |
| `document.getElementById('x')!` | `$.required('#x')` |
| `document.querySelector('#x')` | `$('#x')` |
| `document.querySelectorAll('.item')` | `$$('.item')` |
| `Array.from(document.querySelectorAll('.item'))` | `$$('.item')` |
| `[...document.querySelectorAll('.item')]` | `$$('.item')` |
| `if (document.querySelector('#x')) { … }` | `if ($.exists('#x')) { … }` |
| `document.querySelectorAll('.row').length > 0` | `$$.exists('.row')` |
| `document.querySelectorAll('.row')` + throw if empty | `$$.required('.row')` |

Simple `#id` selectors hit `getElementById` internally (faster). Compound
selectors like `#app .item` or `#nav.active` fall through to
`querySelector`. You don't choose the path — pass the selector as-is.

## Procedure: set up a typed selector registry

Use `defineSelectors` when a codebase repeats the same selectors across
files, or when the user wants compile-time selector literals.

1. Collect the selectors into one object, **annotated `as const`** so keys
   infer as string literals rather than `string`.
2. Call `defineSelectors`. The result is frozen and typed.
3. Replace raw selector strings at call sites with `S.<key>`.

```ts
const S = defineSelectors({
  navbar: '#navbar',
  items:  '.item',
} as const);

const nav   = $.required(S.navbar);   // S.navbar typed as "#navbar"
const items = $$(S.items);
```

In dev, `defineSelectors` rejects non-string values and duplicate
selectors across keys (a common copy-paste typo). Production builds strip
that validation — it's dead-code-eliminated behind the `isDev()` gate.

## Procedure: wire `resetWarnings`

`$.optional` and `$$.optional` warn **once per selector** in dev, then go
quiet. In long-lived SPAs, a previously-missing element may reappear after
a route change but never warn again because it's already in the dedup set.

Call `resetWarnings()` on route change (or wherever the DOM is
substantially rebuilt) so the warn-once set clears:

```ts
router.on('change', () => {
  resetWarnings();
});
```

In tests, call `resetWarnings()` in `beforeEach` so warn-once behavior
doesn't leak between cases.

## SSR / isomorphic code

domsure reads `document` directly. Under SSR (`document` is undefined),
`$` and `$$` **throw `DomsureError`** — they do not return `null`. This is
intentional: silent null under SSR hides bugs. Guard isomorphic code:

```ts
if (typeof window !== 'undefined') {
  const el = $.required('#app');
}
```

Do not add a null fallback. Do not wrap the library to "fix" SSR.

## Error handling

Every failure throws `DomsureError`, which carries the offending
`selector` as a structured field. Catch by type, not by string-matching
the message:

```ts
try {
  $.required('#missing');
} catch (e) {
  if (e instanceof DomsureError) {
    log.error({ selector: e.selector, message: e.message });
  }
  throw e; // fail fast — don't swallow
}
```

**Never** catch `DomsureError` and return a silent default. If the element
was required, returning a placeholder hides the bug the library exists to
surface.

## Pitfalls (the ones agents get wrong)

1. **Using `$` when the code needs `$.required`.** `$` returns `null`
   silently. If the next line dereferences the result, use `.required`.
2. **Treating `<T>` as tag verification.** `$.required<HTMLCanvasElement>('#div')`
   compiles fine — `<T>` is a type-level cast, not a runtime check. Verify
   the tag yourself if it matters.
3. **Expecting `$$` to return a `NodeList`.** It returns `HTMLElement[]`.
   `Array.from` / spread wrappers are redundant after migration.
4. **Swallowing `DomsureError` into a default.** Fail fast. Re-throw or
   handle meaningfully.
5. **Adding an SSR null fallback.** The throw is by design. Guard with
   `typeof window !== 'undefined'`.
6. **Calling `resetWarnings` per render.** It's for route changes and test
   isolation, not hot paths.
7. **Forgetting `as const` on `defineSelectors`.** Without it, keys infer
   as `string` and you lose the literal-type benefit.
8. **Adding a redundant null check after `$.required`.** It throws on
   missing — `if (!el) return` after it is dead code.

## Where to look for truth

- `llm.txt` (package root) — canonical API reference + consumer pitfalls
- `README.md` (package root) — user-facing docs, before/after examples
- `project.md` (repo root, contributors only) — source map, build/test,
  size budget, release flow
- `AGENTS.md` (repo root) — coding style guide for any agent editing code

Read the relevant file before answering. Method names, SSR semantics, and
the `<T>`-is-a-cast contract are exact — quote the doc, don't recall.
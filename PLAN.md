# Review-Feedback Improvements Plan

Branch: `review-feedback-improvements` (forked from `main`)

Scope: six items distilled from an external review, filtered against the
actual codebase. Phase 0 pins the public API; 1, 2, and 5 are concrete code
changes; 3 is tests; 4 is a design RFC, not implemented.

Execution order is chosen so each phase ships independently and stays green.

**Quality gate — every phase must pass before commit:**

```
pnpm lint && pnpm test && pnpm build && pnpm size
```

Each phase below lists only *additional* acceptance criteria beyond this gate.

---

## Phase 0 — API contract tests

**Why.** The library is reaching maturity. Before further refactors, pin the
public surface consumers depend on — type signatures *and* runtime behavior
contracts — so a refactor can't silently break callers. Implementation tests
(`query.test.ts`) cover code paths; contract tests cover the promise.

**Files.** new `test/contract.test.ts`.

**What.**

Type contracts (`expectTypeOf`):
- `$` / `$.required` / `$.optional` / `$$` / `$$.required` default to
  `HTMLElement` / `HTMLElement | null` / `HTMLElement[]`.
- `$.exists` returns `boolean`.
- `DomsureError` extends `Error` and has `selector?: string`.
- `defineSelectors` returns a readonly `SelectorMap<T>`.
- `resetWarnings` returns `void`.

Runtime contracts:
- `$.required` never returns `null` (throws `DomsureError` instead) and the
  error carries `.selector`.
- `$.optional` returns `null` for a miss without throwing.
- `$$` returns a real `Array` (`Array.isArray`), not a `NodeList`.
- `$$.required` throws on empty, returns non-empty otherwise.
- `DomsureError` is `instanceof Error` with `name === 'DomsureError'`.
- `defineSelectors` returns a `Object.isFrozen` object.

**Acceptance.** Suite green; covers every symbol exported from `index.ts`.

**Risk.** None — test only.

---

## Phase 1 — Broaden generics from `HTMLElement` to `Element`

**Why.** Every query signature is `<T extends HTMLElement = HTMLElement>`.
`SVGSVGElement`, `MathMLElement`, and custom elements extend `Element`, not
`HTMLElement`, so `$.required<SVGSVGElement>("svg")` does not compile today.
`<T extends Element = HTMLElement>` is fully backwards-compatible: existing
call sites that omit `T` still get `HTMLElement`, and the constraint widens
to admit every DOM node type. Zero runtime cost.

**Files.** `src/query.ts` only.

**What.** One conceptual change — widen every generic constraint in `query.ts`
from `HTMLElement` to `Element`, preserving the `= HTMLElement` default so
inferred call sites keep their existing type.

Propagation surfaces (every `HTMLElement` constraint in the file):
- `safeQuery<T>` and `query<T>` (internal cores)
- `required` / `optional` (single-element public fns)
- `multiQuery` / `requiredMulti` / `optionalMulti` (multi-element public fns)
- `exists` / `existsMulti` internal `query<...>` calls
- `QueryFn` / `MultiQueryFn` interface call signatures
- both `Object.assign` call expressions for `$` and `$$`

The `getElementById(...) as T | null` cast stays valid: `HTMLElement | null`
and `SVGSVGElement | null` share `Element` as a common ancestor, so TS permits
the assertion (verified by compiling the exact cast under `--strict`).

**Acceptance.** `$.required<SVGSVGElement>("#svg")` type-checks; `$("#svg")`
without a type arg is still `HTMLElement | null` (guards the default).

**Risk.** Very low — pure type-level widening, no runtime change.

---

## Phase 2 — Centralize error message construction

**Why.** `new DomsureError('[domsure] ...')` is constructed inline in ~5
sites across `query.ts` and `selectors.ts`, with message strings duplicated
and formatted ad hoc. A tiny factory module gives one source of truth, makes
future localization a single-file change, and keeps messages consistent.

**Files.** new `src/errors.ts` additions (or a new `src/messages.ts` — see
decision below), `src/query.ts`, `src/selectors.ts`.

**Decision: extend `errors.ts` vs. new `messages.ts`.** `errors.ts` already
owns `DomsureError`. Adding a small `Errors` namespace (or named factory
functions) there keeps everything error-related in one module and avoids a
new import in every consumer file. Prefer extending `errors.ts`.

**Changes.**

1. In `src/errors.ts`, add factory functions. Prefer named functions over a
   namespace object so tree-shaking is trivial and the call sites read clearly:

   ```ts
   export function requiredNotFoundError(selector: string): DomsureError {
     return new DomsureError(
       `[domsure] Required element not found: ${selector}`,
       selector,
     );
   }
   export function requiredMultiNotFoundError(selector: string): DomsureError {
     return new DomsureError(
       `[domsure] Required elements not found: ${selector}`,
       selector,
     );
   }
   export function errOptionalNotFound(selector: string): DomsureError {
     return new DomsureError(
       `[domsure] Element not found: ${selector}`,
       selector,
     );
   }
   export function invalidSelectorError(selector: string): DomsureError {
     return new DomsureError(
       `[domsure] Invalid selector: ${JSON.stringify(selector)}`,
       selector,
     );
   }
   export function ssrError(): DomsureError {
     return new DomsureError(
       `[domsure] document is not available — domsure is browser-only. ` +
         `Guard calls with typeof window checks in SSR code paths.`,
     );
   }
   export function selectorValueError(key: string, kind: string): DomsureError {
     return new DomsureError(
       `[domsure] defineSelectors: value for "${key}" is ${kind}, expected a selector string`,
     );
   }
   export function duplicateSelectorError(value: string, prev: string, key: string): DomsureError {
     return new DomsureError(
       `[domsure] defineSelectors: duplicate selector "${value}" on keys "${prev}" and "${key}"`,
     );
   }
   ```

   Note: the SSR message in `multiQuery` today is shorter than the one in
   `query`. Centralizing unifies them — pick the longer, more helpful
   message (with the `typeof window` guidance) for both. This is a
   user-visible message change; call it out in the changelog.

2. Replace every inline `new DomsureError(...)` in `query.ts` and
   `selectors.ts` with the corresponding factory call.
3. `console.warn` strings in `optional` / `optionalMulti` are *not* errors
   and stay as inline `console.warn` — they don't construct `DomsureError`.
   Leave them.

**Acceptance.**

- No `new DomsureError(` remains in `query.ts` or `selectors.ts` except via
  the factory functions in `errors.ts` (verify with `grep`).
- Error messages in existing tests still match. The only test that may need
  updating is any assertion on the `multiQuery` SSR message text if it
  differed — check `test/query.test.ts` SSR guard block.
- `dist` size: expect negligible change (factory functions are tiny and
  tree-shakeable).

**Risk.** Low. The one behavior change is unifying the two SSR message
strings; everything else is mechanical. Tests assert on `instanceof
DomsureError` and `.selector`, not exact message text for the most part —
verify before merging.

---

## Phase 3 — Add SVG tests and a fuzz harness

**Why.** Real coverage gaps. No test queries SVG/MathML elements today, and
there is no property-based cross-check against the native DOM. After Phase 1
widens to `Element`, SVG tests also double as compile-time proof that the
generics work for non-`HTMLElement` nodes.

### 3a — SVG element tests

**Files.** new `test/svg.test.ts`, and a type-level test (see below).

**Cases.**

- `$.required<SVGSVGElement>("#svg")` returns an `SVGSVGElement` (compile +
  runtime). This is the Phase 1 regression guard.
- `$.optional<SVGCircleElement>("#circle")` — present and missing paths.
- `$$.required<SVGPathElement>("path")` — multi-element SVG query returns
  `SVGPathElement[]`.
- `$.exists("circle")` on an SVG subtree.
- Tag-name selectors inside SVG namespace (`$("svg > circle")`) resolve.
- jsdom caveat: jsdom's SVG support is limited; confirm which assertions hold
  in jsdom vs. need a real-browser note. If jsdom doesn't materialize SVG
  types, document the limitation in the test and keep the compile-level
  assertion (the type check is the most valuable part here).

**Type-level test.** Add `test/types.test.ts` using `vitest`'s
`expectTypeOf` (from `vitest`) or a plain `// @ts-expect-error`-style
assertion file compiled by `tsconfig.test.json`. Assert:

- `$.required<SVGSVGElement>("#svg")` is `SVGSVGElement`.
- `$.optional<SVGSVGElement>("#svg")` is `SVGSVGElement | null`.
- `$("#svg")` (no type arg) is still `HTMLElement | null` — guards the
  default-generic backwards-compat promise from Phase 1.
- `$$.required<SVGPathElement>("path")` is `SVGPathElement[]`.

### 3b — Fuzz harness

**Files.** new `test/fuzz.test.ts`.

**Approach.** Generate random valid CSS selectors over a fixed DOM fixture
and assert domsure's result matches the native `querySelector` /
`querySelectorAll` / `getElementById` result. This is the real
correctness oracle — domsure is a thin wrapper, so its output must equal the
native API's for every selector the fast-path logic routes.

**Generator shape.**

- A small alphabet of selectors drawn from the fixture: `#app`, `.item`,
  `div`, `span`, `div#app`, `#app .item`, `#app > .item`, `#app.active`,
  `:first-child`, `[id]`, `*`, plus escaped IDs (`#foo\\.bar`) and numeric
  IDs (`#123`) to exercise the `PURE_ID` fallback.
- Random combinations: pick 1–3 atoms joined by random combinators
  (` `, `>`, `+`, `~`).
- Run ~1000–5000 iterations per test, seeded with a fixed seed for
  reproducibility (use `Math.random` with a printed seed, or a tiny seeded
  PRNG so failures are reproducible).

**Invariants to check.**

- `$<Element>(s)` result `=== document.querySelector(s)` (identity or both
  null). For `#id` fast-path selectors, also compare against
  `document.getElementById(id)`.
- `$$(s).length === document.querySelectorAll(s).length`.
- If `document.querySelector(s)` throws (invalid selector), domsure must
  throw `DomsureError` (not a raw `DOMException`).
- Skip selectors jsdom can't parse; catch and filter them rather than
  failing the run.

**Acceptance.**

- `pnpm test` includes the new SVG and fuzz suites and is green.
- Fuzz run is deterministic (seeded) and reproducible.
- No new dist changes (test-only).

**Risk.** Low for 3a. For 3b, the main risk is jsdom selector-parser
divergence from real browsers producing false failures — mitigate by
treating a native `querySelector` throw as "skip this selector" rather than
"fail", and by pinning a seed.

---

## Phase 4 — Selector-registry → element-type inference (experimental RFC)

**Why.** Today `defineSelectors({ canvas: "#canvas" } as const)` gives
`S.canvas` the literal type `"#canvas"`, but `$.required(S.canvas)` still
returns `HTMLElement`. The review's most interesting idea: infer the element
type from the selector string so `$.required(S.canvas)` returns
`HTMLCanvasElement` automatically — purely at the type level.

**Status.** Experimental RFC — not a roadmap commitment. Do **not** implement
unless there is concrete user demand. The inference is too magical in
practice: `#main-video`, `#submit`, `#hero-image` cannot be inferred, so users
hit a "why didn't this infer?" footgun. Explicit type arguments
(`$.required<HTMLCanvasElement>("#canvas")`) already cover the need after
Phase 1. The `KnownIdElement` table is also a config-driven mapping AGENTS.md
warns against when it has no callers.

**Design notes (for the spike doc).**

- The mechanism is a template-literal-type map from selector shape to
  element type. A known prefix/shape table:

  ```ts
  type SelectorElement<S extends string> =
    S extends `#${infer id}` ? KnownIdElement<id> : HTMLElement;

  type KnownIdElement<Id extends string> =
    Id extends "canvas" ? HTMLCanvasElement :
    Id extends "video" ? HTMLVideoElement :
    Id extends "audio" ? HTMLAudioElement :
    Id extends "form" ? HTMLFormElement :
    Id extends "input" ? HTMLInputElement :
    Id extends "select" ? HTMLSelectElement :
    Id extends "textarea" ? HTMLTextAreaElement :
    Id extends "img" ? HTMLImageElement :
    Id extends "table" ? HTMLTableElement :
    Id extends "a" ? HTMLAnchorElement :
    Id extends "button" ? HTMLButtonElement :
    HTMLElement; // fallback
  ```

- The inference only works for `#id` selectors (and maybe tag selectors
  like `canvas`). Class/attribute/combinator selectors can't be statically
  resolved to an element type — they fall back to `HTMLElement`.
- Open questions for the spike:
  1. Should this be opt-in via a separate function
     (`$.typed(S.canvas)`) or implicit whenever a string-literal-typed
     selector is passed? Implicit is magical but surprising; opt-in is
     explicit but adds API surface.
  2. How does it interact with explicit type arguments — does
     `$.required<HTMLCanvasElement>(S.canvas)` still work, and does the
     inferred type ever *conflict* with an explicit one?
  3. Maintaining the `KnownIdElement` table by hand is the cost; is the
     magic worth it for a sub-1KB library? A larger table fights the size
     budget. A small table (the 10–15 most common typed elements) is the
     sweet spot.
  4. Is this better shipped as a separate companion types package so the
     core stays minimal?

**Deliverable on this branch.** A `docs/selector-type-inference-spike.md`
file capturing the design, the open questions, and a recommendation.
**No source changes.**

**Risk.** None (docs only).

---

## Phase 5 — Extract shared SSR / invalid-selector handling in `query.ts`

**Why.** The review's duplication critique was aimed at imaginary
`query-single.ts` / `query-multi.ts` files, but the underlying instinct is
valid: inside the real `query.ts`, the single-element `query()` and the
multi-element `multiQuery()` each independently implement (a) the
`typeof document === 'undefined'` SSR guard and (b) the
`try`/`catch`→`DomsureError` invalid-selector branding. That's two copies
of the same two concerns. Extracting them removes the duplication and makes
a future `$.closest()` / `$.cached()` addition cheap.

**Files.** `src/query.ts` (internal refactor only; no public API change).

**Changes.**

1. Extract the SSR guard into a tiny internal helper:

   ```ts
   function assertBrowser(): void {
     if (typeof document === 'undefined') {
       throw ssrError();
     }
   }
   ```

   Call it at the top of both `query()` and `multiQuery()`. (Uses the
   `ssrError()` factory from Phase 2 — so **Phase 5 depends on Phase 2**.)

2. The invalid-selector branding is already partially factored into
   `safeQuery()` for the single path. The multi path has its own inline
   `try`/`catch`. Add a `safeQueryAll` wrapper for the multi path that mirrors
   `safeQuery`:

   ```ts
   function safeQueryAll<T extends Element>(
     run: () => NodeListOf<T>,
     selector: string,
   ): T[] {
     try {
       return Array.from(run());
     } catch {
       throw invalidSelectorError(selector);
     }
   }
   ```

   Then `multiQuery` becomes `assertBrowser(); return safeQueryAll(() => document.querySelectorAll<T>(selector), selector);`.

   A single unified `withBrandedErrors` wrapper was considered and rejected —
   the single and multi paths return different types (`T | null` vs `T[]`),
   so a generic wrapper contorts the types for no real gain.

3. Do **not** extract the `SIMPLE_ID` / `PURE_ID` fast-path logic — that's
   specific to the single path (`getElementById` has no multi equivalent).
   The multi path stays a straight `querySelectorAll`.

**Dependency.** Phase 2 (for `ssrError()` / `invalidSelectorError()`). If Phase
2 is skipped, inline the `new DomsureError(...)` in the helpers instead —
the extraction still works, just without centralized messages.

**Acceptance.**

- Public API surface unchanged (verify `dist/index.d.ts` is byte-identical
  or semantically identical to pre-refactor — run `pnpm build` before and
  after and `diff` the `.d.ts`).
- No `typeof document === 'undefined'` check remains outside `assertBrowser`
  in `query.ts` (verify with `grep`).
- Invalid-selector behavior identical: both paths still throw
  `DomsureError` with the same `.selector` and message.

**Risk.** Low. Internal-only refactor. The only behavioral surface is the
SSR message unification (already handled in Phase 2). Verify the `.d.ts`
diff is empty to prove no API leakage.

---

## Execution order and merge shape

Recommended order, each phase a separate commit (or PR) for easy review and
rollback:

0. **Phase 0** (contract tests) — ship first; pins the surface later phases
   refactor under, so any contract break surfaces immediately.
1. **Phase 1** (generics widening) — highest value, zero risk; Phase 3's SVG
   type tests depend on it.
2. **Phase 2** (error centralization) — Phase 5 depends on it.
3. **Phase 3** (SVG + fuzz tests) — SVG type tests lock in Phase 1; the fuzz
   guards all future refactors including Phase 5.
4. **Phase 5** (internal extraction) — pure cleanup, gated by Phase 0's
   contract tests and Phase 3's fuzz.
5. **Phase 4** (RFC doc) — land anytime; docs only, no code dependency.

Every phase passes the quality gate (see top of document) before commit.
Update `CHANGELOG.md` per phase under an unreleased section. Bump version per
semver:

- Phase 0, 3, 5: `patch` (test/internal only).
- Phase 1: `minor` (0.4.0) — adds capability (SVG/MathML/custom elements).
- Phase 2: `patch` unless the SSR message unification is considered
  behavior-changing, in which case `minor`.
- Phase 4: no version bump (docs only).

## Out of scope (explicitly rejected from the review)

- `tryRequired` / `RequiredResult<T>` tuple type — the function doesn't
  exist; the review hallucinated it. Not adding a result-tuple API unless
  there's a concrete user need.
- `exists()` using `matches()` — current `query() !== null` is correct and
  the multi `exists` already reuses the single path to avoid array
  allocation. No change.
- `sideEffects: false` — already present in `package.json`.
- Weird-ID tests (`#123`, `#1a`, `#_x`) — already covered in
  `test/query.test.ts`.
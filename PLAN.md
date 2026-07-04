# Review-Feedback Improvements Plan

Branch: `review-feedback-improvements` (forked from `main`)

Scope: five items distilled from an external review, filtered against the
actual codebase. Items 1, 3, and 5 are concrete code changes; item 2 is a
small refactor; item 4 is a design spike deferred to a future major version.

Execution order is chosen so each phase ships independently and stays green.
Each phase ends with `pnpm lint && pnpm test && pnpm build`.

---

## Phase 1 — Broaden generics from `HTMLElement` to `Element`

**Why.** Every query signature is `<T extends HTMLElement = HTMLElement>`.
`SVGSVGElement`, `MathMLElement`, and custom elements extend `Element`, not
`HTMLElement`, so `$.required<SVGSVGElement>("svg")` does not compile today.
`<T extends Element = HTMLElement>` is fully backwards-compatible: existing
call sites that omit `T` still get `HTMLElement`, and the constraint widens
to admit every DOM node type. Zero runtime cost.

**Files.** `src/query.ts` only.

**Changes.**

1. `safeQuery<T extends HTMLElement>` → `safeQuery<T extends Element>`.
2. `query<T extends HTMLElement>` → `query<T extends Element = HTMLElement>`.
   Keep the default so call sites without a type argument stay `HTMLElement`.
3. `required<T extends HTMLElement = HTMLElement>` → `required<T extends Element = HTMLElement>`.
4. `optional<T extends HTMLElement = HTMLElement>` → `optional<T extends Element = HTMLElement>`.
5. `exists(selector)` currently calls `query<HTMLElement>(...)`. Change the
   internal call to `query<Element>(...)` — `exists` returns `boolean` so the
   generic is invisible to consumers, but the internal call should not impose
   `HTMLElement` on the query core.
6. `multiQuery<T extends HTMLElement = HTMLElement>` → `multiQuery<T extends Element = HTMLElement>`.
7. `requiredMulti` / `optionalMulti` — same widening.
8. `existsMulti` delegates to `query<HTMLElement>(...)`; change to `query<Element>(...)`.
9. The `QueryFn` and `MultiQueryFn` interface signatures: widen the call
   signature `<T extends HTMLElement = HTMLElement>` → `<T extends Element = HTMLElement>`.
   The `.required` / `.optional` members use `typeof required` etc., so they
   follow automatically once the functions are widened.
10. The two `Object.assign` call expressions for `$` and `$$`: widen the
    inline arrow `<T extends HTMLElement = HTMLElement>` → `<T extends Element = HTMLElement>`.

**Acceptance.**

- `pnpm lint` clean.
- Existing tests pass unchanged.
- New compile-only assertion: `$.required<SVGSVGElement>("#svg")` type-checks
  in a scratch `.ts` file (delete after confirming, or add as a
  `// @ts-expect-error`-inverted type test — see Phase 3).
- `dist` size unchanged (`size-limit` green).

**Risk.** Very low. Pure type-level widening; no runtime behavior changes.
The only subtle point is keeping the `= HTMLElement` default so inferred
calls don't suddenly become `Element`, which would be a breaking change for
consumers doing `const el = $("#x")` and expecting `HTMLElement | null`.

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
   export function errRequiredNotFound(selector: string): DomsureError {
     return new DomsureError(
       `[domsure] Required element not found: ${selector}`,
       selector,
     );
   }
   export function errRequiredMultiNotFound(selector: string): DomsureError {
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
   export function errInvalidSelector(selector: string): DomsureError {
     return new DomsureError(
       `[domsure] Invalid selector: ${JSON.stringify(selector)}`,
       selector,
     );
   }
   export function errSsr(): DomsureError {
     return new DomsureError(
       `[domsure] document is not available — domsure is browser-only. ` +
         `Guard calls with typeof window checks in SSR code paths.`,
     );
   }
   export function errSelectorValue(key: string, kind: string): DomsureError {
     return new DomsureError(
       `[domsure] defineSelectors: value for "${key}" is ${kind}, expected a selector string`,
     );
   }
   export function errDuplicateSelector(value: string, prev: string, key: string): DomsureError {
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

- `pnpm lint && pnpm test` green.
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

## Phase 4 — Selector-registry → element-type inference (design spike, deferred)

**Why.** Today `defineSelectors({ canvas: "#canvas" } as const)` gives
`S.canvas` the literal type `"#canvas"`, but `$.required(S.canvas)` still
returns `HTMLElement`. The review's most interesting idea: infer the element
type from the selector string so `$.required(S.canvas)` returns
`HTMLCanvasElement` automatically — purely at the type level.

**Status.** Design spike only. Do **not** implement on this branch. Document
the design, the tradeoffs, and a target version (1.0.0).

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
       throw errSsr();
     }
   }
   ```

   Call it at the top of both `query()` and `multiQuery()`. (Uses the
   `errSsr()` factory from Phase 2 — so **Phase 5 depends on Phase 2**.)

2. The invalid-selector branding is already partially factored into
   `safeQuery()` for the single path. The multi path has its own inline
   `try`/`catch`. Two options:

   - **Option A (minimal):** keep `safeQuery` for the single path and add a
     `safeQueryAll` wrapper for the multi path that mirrors it:

       ```ts
       function safeQueryAll<T extends Element>(
         run: () => NodeListOf<T>,
         selector: string,
       ): T[] {
         try {
           return Array.from(run());
         } catch {
           throw errInvalidSelector(selector);
         }
       }
       ```

     Then `multiQuery` becomes `assertBrowser(); return safeQueryAll(() => document.querySelectorAll<T>(selector), selector);`.

   - **Option B (more unified):** a single `withBrandedErrors<T>(selector,
     run)` that wraps any throwing query. This is cleaner but the single
     and multi paths return different types (`T | null` vs `T[]`), so a
     generic wrapper gets awkward. Prefer Option A for now — it's the
     minimal extraction that kills the duplication without contorting the
     types.

3. Do **not** extract the `SIMPLE_ID` / `PURE_ID` fast-path logic — that's
   specific to the single path (`getElementById` has no multi equivalent).
   The multi path stays a straight `querySelectorAll`.

**Dependency.** Phase 2 (for `errSsr()` / `errInvalidSelector()`). If Phase
2 is skipped, inline the `new DomsureError(...)` in the helpers instead —
the extraction still works, just without centralized messages.

**Acceptance.**

- `pnpm lint && pnpm test` green.
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

1. **Phase 1** (generics widening) — ship first; highest value, zero risk,
   and Phase 3's SVG type tests depend on it.
2. **Phase 2** (error centralization) — ship second; Phase 5 depends on it.
3. **Phase 3** (SVG + fuzz tests) — ship third; the SVG type tests lock in
   Phase 1, and the fuzz harness guards all future refactors including
   Phase 5.
4. **Phase 5** (internal extraction) — ship fourth; pure cleanup, gated by
   the fuzz harness from Phase 3.
5. **Phase 4** (spike doc) — land anytime; docs only, no code dependency.

Each phase must pass `pnpm lint && pnpm test && pnpm build && pnpm size`
before commit. Update `CHANGELOG.md` per phase under an unreleased section.
Bump version per semver:

- Phase 1: technically a non-breaking widening, but since inferred types at
  call sites are unchanged (default stays `HTMLElement`), ship as a `patch`
  or `minor`. Prefer `minor` (0.4.0) since it adds capability.
- Phase 2: `patch` (0.4.1) unless the SSR message unification is considered
  behavior-changing, in which case `minor`.
- Phase 3, 5: `patch`.
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
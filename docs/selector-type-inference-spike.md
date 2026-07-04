# Selector-registry → element-type inference (design spike)

Status: **design only, not implemented.** Target: v1.0.0 at the earliest.

## Problem

`defineSelectors` gives string-literal types today:

```ts
const S = defineSelectors({ canvas: "#canvas", dialog: "#dialog" } as const);
// S.canvas is typed "#canvas"
const c = $.required(S.canvas); // returns HTMLElement, not HTMLCanvasElement
```

The selector string is known at the type level, but the returned element
type is still `HTMLElement`. The review's idea: infer the element type from
the selector so `$.required(S.canvas)` returns `HTMLCanvasElement` — purely
at the type level, zero runtime cost.

## Mechanism

A template-literal-type map from selector shape to element type:

```ts
type SelectorElement<S extends string> =
  S extends `#${infer id}` ? KnownIdElement<id>
  : S extends `${infer tag}` ? KnownTagElement<tag>
  : HTMLElement;

type KnownIdElement<Id extends string> =
  Id extends "canvas" ? HTMLCanvasElement
  : Id extends "video" ? HTMLVideoElement
  : Id extends "audio" ? HTMLAudioElement
  : Id extends "form" ? HTMLFormElement
  : Id extends "input" ? HTMLInputElement
  : Id extends "select" ? HTMLSelectElement
  : Id extends "textarea" ? HTMLTextAreaElement
  : Id extends "img" ? HTMLImageElement
  : Id extends "table" ? HTMLTableElement
  : Id extends "a" ? HTMLAnchorElement
  : Id extends "button" ? HTMLButtonElement
  : HTMLElement; // fallback
```

Inference only resolves for `#id` and bare-tag selectors. Class, attribute,
and combinator selectors cannot map to a specific element type and fall back
to `HTMLElement`.

## Open questions

1. **Opt-in vs implicit.** Implicit (whenever a string-literal-typed selector
   is passed) is magical but surprising — a user passing `"#canvas"` gets
   `HTMLCanvasElement` with no opt-in. An explicit `$.typed(S.canvas)` or a
   separate `$.el` function is verbose but predictable. Recommendation:
   **opt-in**, via an overloaded signature that only triggers when the
   argument is a string literal (not `string`). This keeps existing `string`
   call sites on the `HTMLElement` path.

2. **Conflict with explicit type arguments.** `$.required<HTMLCanvasElement>`
   must still work. The inferred type should never override an explicit one.
   TypeScript overload resolution picks the explicit-generic signature first,
   so this is safe — but needs a test matrix to prove it.

3. **Table size vs the sub-1KB budget.** A hand-maintained `KnownIdElement`
   table adds type-level weight (zero runtime, but it bloats the `.d.ts`).
   A table of ~15 common typed elements is the sweet spot. A larger table
   fights the size promise and is high-maintenance. Recommendation: **small
   table, HTMLElement fallback**, document that uncommon elements need an
   explicit type argument.

4. **Core vs companion package.** If the table grows, it could ship as a
   separate `@mrsamdev/domsure-types` package so the core stays minimal and
   consumers opt into the inference surface. Recommendation: **keep in core
   while the table is small**; split only if it grows past ~30 entries.

## Recommendation

Do not implement yet. The feature is attractive but adds real maintenance
surface (the `KnownIdElement` table) for a convenience that explicit type
arguments already cover (`$.required<HTMLCanvasElement>("#canvas")` works
today). Revisit after v1.0 when the API surface is stable and there is user
demand. If implemented, start with the opt-in overload + a 15-entry table +
a test matrix covering the four questions above.

## Why not now

- Phase 1 already removed the hard limitation: SVG and any `Element` subtype
  compile via explicit type arguments. The inference feature is sugar, not a
  blocker.
- YAGNI (per AGENTS.md): no caller needs it yet, and "reusable code that is
  not reused" is explicitly called out as bloat to avoid.
- The table is the kind of config-driven mapping AGENTS.md warns about —
  worth it only with proven demand.
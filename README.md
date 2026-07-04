# domsure

[![npm version](https://img.shields.io/npm/v/domsure?logo=npm&label=npm)](https://www.npmjs.com/package/domsure)
[![JSR version](https://img.shields.io/jsr/v/@mrsamdev/domsure?logo=deno&label=deno)](https://jsr.io/@mrsamdev/domsure)
[![CI](https://github.com/mrsamdev/domsure/actions/workflows/ci.yml/badge.svg)](https://github.com/mrsamdev/domsure/actions/workflows/ci.yml)
[![Publish to npm](https://github.com/mrsamdev/domsure/actions/workflows/publish-npm.yml/badge.svg)](https://github.com/mrsamdev/domsure/actions/workflows/publish-npm.yml)
[![Publish to JSR](https://github.com/mrsamdev/domsure/actions/workflows/publish-jsr.yml/badge.svg)](https://github.com/mrsamdev/domsure/actions/workflows/publish-jsr.yml)

> Replace your `!` assertions with real runtime checks.

Eight DOM query helpers under 1 KB gzipped. ESM and CJS. No dependencies.

## Before / After

```ts
// Before: the ! hides a missing element. Silent null deref at runtime.
const navbar = document.getElementById("navbar")!;
navbar.classList.add("active");

// After: throws a clear error if the selector is wrong or the element is gone.
const navbar = $.required("#navbar");
navbar.classList.add("active");
```

## Install

```sh
npm install domsure
```

Deno / JSR:

```sh
deno add @mrsamdev/domsure
```

JSR releases carry a SLSA provenance statement (build verified from this
repo's source, recorded in the Sigstore transparency log). See
[`PROVENANCE.md`](./PROVENANCE.md).

## API

```ts
import { $, $$, defineSelectors, DomsureError } from 'domsure';

$(selector)        // HTMLElement | null  - silent query
$.required(sel)    // HTMLElement        - throw if missing
$.tryRequired(sel) // [DomsureError|null, HTMLElement|null] - required, never throws
$.optional(sel)    // HTMLElement | null - warn once in dev if missing
$.exists(sel)      // boolean            - presence check
$$(selector)       // HTMLElement[]      - querySelectorAll as an array
$$.required(sel)   // HTMLElement[]      - throw if none match
$$.tryRequired(sel)// [DomsureError|null, HTMLElement[]] - required, never throws
$$.optional(sel)   // HTMLElement[]      - warn once in dev if none match
$$.exists(sel)     // boolean            - presence check
defineSelectors(s) // Readonly registry  - frozen, typed selector map
resetWarnings()    // void               - clear the warn-once dedup set
```

### `$`

Silent single-element query. Simple `#id` selectors hit `getElementById` because it's faster; everything else, including compound selectors like `#app .item` or `#nav.active`, falls through to `querySelector`. Never warns.

```ts
const modal = $('#modal');        // HTMLElement | null
```

### `$.required`

Asserts the element exists. Throws `DomsureError` if it doesn't. This is the whole reason the package exists.

```ts
const app = $.required('#app');   // HTMLElement, never null
```
### `$.tryRequired`

Required semantics, but returns a `[error, element]` tuple instead of throwing. `[null, el]` on success; `[DomsureError, null]` on a miss. The error is the same `DomsureError` `$.required` would have thrown — same message, same `.selector` — so monitoring groups them together.

Use it where a throw is unrecoverable. The main case is React `useEffect` / `useLayoutEffect`: error boundaries catch render-phase throws, **not** effect throws, so a `$.required` inside an effect bypasses the boundary and crashes the page. `$.tryRequired` lets the effect degrade instead.

Error-first for a clean guard clause:

```ts
const [err, nav] = $.tryRequired('#navbar');
if (err) { report(err); return; }   // missing is a bug — degrade, don't crash
nav.classList.add('active');
```

Unlike `$.required`, it is safe under SSR — it returns `[DomsureError, null]` instead of throwing. Does not auto-warn; the tuple type makes the error visible at the call site, so the caller owns logging and telemetry.

### `$.optional`

Like `$`, but warns once per selector in development when the element is missing. The dedup keeps React and Vue re-renders from flooding the console. No warnings in production.

```ts
const tooltip = $.optional('#tooltip');
```

### `$.exists`

Boolean check. No warnings, no element back.

```ts
if ($.exists('#tooltip')) { /* ... */ }
```

### `$$` and its parity methods

`querySelectorAll` returned as a real `Array`, so `map`, `filter`, and `reduce` work directly. `$$` mirrors `$` with `.required`, `.optional`, and `.exists` for the multi-element case.

```ts
const items = $$('.item').map(el => el.textContent);

const required = $$.required('.row');    // throws if zero rows match
const [err, rows] = $$.tryRequired('.row'); // never throws — tuple
const maybe    = $$.optional('.row');    // warns once in dev if zero match
if ($$.exists('.row')) { /* ... */ }
```

### `defineSelectors`

Frozen, typed selector registry. Pass `as const` for string-literal inference. In dev, it rejects non-string values and duplicate selectors across keys, which is usually a copy-paste typo. Production builds strip the checks out via dead-code elimination.

```ts
const S = defineSelectors({
  navbar: '#navbar',
  items: '.item',
} as const);

S.navbar;  // typed as "#navbar", not string
```

### `resetWarnings`

Clears the warn-once dedup set so `$.optional` and `$$.optional` warn again for selectors that already fired one this session. Handy in long-lived SPAs after a route change, when previously missing elements reappear. It's also the hook test suites use for isolation.

```ts
resetWarnings();
```

### `DomsureError`

Every failure throws a `DomsureError`, not a raw `DOMException` or a string. Catch it by type instead of regex-matching a message prefix. It carries the offending `selector` as structured data, so your logs can group by selector without parsing prose.

```ts
try {
  $.required('#missing');
} catch (e) {
  if (e instanceof DomsureError) {
    console.error(e.selector, e.message);
  }
}
```

## Type parameter note

`<T>` narrows the return type. It does **not** verify the element's actual tag. It's a cast, not inference. `$<HTMLCanvasElement>('#div')` compiles fine. Use `$.required()` for a runtime guarantee that the element exists. Nothing here checks its tag.

```ts
const canvas = $.required<HTMLCanvasElement>('#chart');
```

## Browser-only

domsure reads `document` directly. Under SSR, where `document` is undefined, `$` and `$$` throw a `DomsureError` instead of failing silently. Guard isomorphic code:

```ts
if (typeof window !== 'undefined') {
  const el = $.required('#app');
}
```

## Size

| | raw | gzipped |
|---|---|---|
| ESM (`dist/index.js`) | ~2.3 KB | ~1.0 KB |
| CJS (`dist/index.cjs`) | ~2.8 KB | ~1.24 KB |

Measured on the published build. Zero runtime dependencies.

## Comparison

| | Raw DOM | jQuery | domsure |
|---|---|---|---|
| Size | 0 | ~30 KB | < 1 KB gz |
| Missing element | silent null / `!` hides it | silent empty set | `$.required` throws |
| Dev warnings | none | none | `$.optional` warns once |
| `querySelectorAll` | `NodeList` | jQuery object | `Array` |
| Branded errors | no | no | `DomsureError` |
| Dependencies | none | jQuery | none |

## License

MIT
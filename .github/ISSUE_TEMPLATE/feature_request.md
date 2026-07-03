---
name: Feature request
about: Suggest a new helper or behavior
title: "[feature] "
labels: enhancement
---

## The problem

<!-- What are you trying to do that domsure doesn't let you do today? -->

## The proposed change

<!-- The smallest API surface that solves the problem. Show the call site, not
the implementation. -->

```ts
import { $ } from 'domsure';

// how would you call it?
```

## Why it fits domsure

domsure is a small library (~250 lines) with a size budget under 1 KB gzipped.
A feature fits if it serves the thesis — "replace `!` with real runtime checks"
— without adding weight. Explain why this can't be done with the existing API
plus one line of caller code.

## Size impact

If you can estimate: how many bytes would this add to the gzipped ESM bundle?
(Run `pnpm build` before and after, then `gzip -c dist/index.js | wc -c`.)
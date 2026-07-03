---
name: Bug report
about: Report something that behaves incorrectly
title: "[bug] "
labels: bug
---

## What happened

<!-- A clear description of what went wrong. -->

## What I expected

<!-- What you thought would happen instead. -->

## Reproduction

```ts
import { $ } from 'domsure';

// minimal code that reproduces the issue
```

DOM shape (if relevant):

```html
<div id="app"></div>
```

## Environment

- domsure version: <!-- e.g. 0.1.0 -->
- Browser / runtime: <!-- e.g. Chrome 126, Node 20, Deno 2 -->
- Bundler (if any): <!-- e.g. Vite 5, Webpack 5, none -->

## Checklist

- [ ] I can reproduce with a single selector string (no app framework in the
  path).
- [ ] I checked that `querySelector` / `getElementById` with the same selector
  returns what I expect.
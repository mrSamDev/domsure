# Changelog

All notable changes to `domsure` are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); this project
follows [Semantic Versioning](https://semver.org/). Dates are ISO 8601.

## [Unreleased]

## [0.4.0] - 2026-07-04
### Added
- Query generics widened from `HTMLElement` to `Element` — `$.required<SVGSVGElement>("#svg")` and other SVG/MathML/custom-element types now compile. Default type argument stays `HTMLElement`, so existing call sites are unchanged.
### Fixed
- `$.tryRequired` / `$$.tryRequired` now rethrow any non-`DomsureError` failure instead of silently rebranding it via an unchecked cast. `required()` and `multiQuery()` only ever throw `DomsureError` today, so this is defense-in-depth against future code paths or exotic engine quirks — never swallow an unknown failure (#review).
- Warn-once dedup no longer clears the whole set on overflow. Hitting the 256-selector cap previously called `warned.clear()`, re-arming every previously-quiet selector and causing a periodic warning storm. Now existing dedup stays intact and only overflow selectors warn — noise is contained to new selectors instead of re-warning all (#review).
- `safeQuery` / `safeQueryAll` / the PURE-ID rescue in `query-core.ts` now narrow their `catch` to `DOMException`: invalid-selector errors are still branded `DomsureError`, but any non-DOM throw (a real bug, e.g. a `TypeError` from a corrupted document) is rethrown instead of being mislabeled "Invalid selector". Consistent with the `tryRequired` guard above — never swallow an unknown failure (#review).
- `project.md` source map updated to the actual three-file query structure (`query-core.ts` / `query-single.ts` / `query-multi.ts`) and corrected line counts; fixed `@mrsamdevdomsure` → `@mrsamdev/domsure` JSR package name typo (#review).
- Root `.gitignore` orphaned comment fixed to describe `dist/` specifically; added a clarifying comment for the `.deepsec/` ignore entry (#review).
- `publish-npm.yml` no longer passes `--no-git-checks`. `dist/` is gitignored so the working tree stays clean, and the tag-verification gate already proves a tagged release — the published artifact is now byte-reproducible from the tag, matching the SLSA provenance claim in `PROVENANCE.md` (#review).

## [0.3.0] - 2026-07-03
### Added
- `$.tryRequired` / `$$.tryRequired` — required semantics as a `[error, value]` tuple that never throws. For React effects (error boundaries don't catch effect throws) and other throw-unsafe contexts. Same `DomsureError` as `.required`; SSR-safe (returns the error instead of throwing).
- `RequiredResult<T>` exported type for the tuple shape.
- Error message factories (`requiredNotFoundError`, `invalidSelectorError`, `ssrError`, etc.) centralized in `errors.ts`.
- SVG runtime test suite (`test/svg.test.ts`) and a seeded fuzz harness (`test/fuzz.test.ts`, 250 iterations + deterministic edge cases) cross-checking `$`/`$$` against native `querySelector`/`querySelectorAll`.
- Type-level test (`test/types.test.ts`) guarding the `Element` constraint and the `HTMLElement` default.
- API contract tests (`test/contract.test.ts`) pinning the public surface — type signatures and runtime behavior guarantees.
- Design RFC: `docs/selector-type-inference-spike.md` for selector→element-type inference (experimental, not implemented).

## [0.2.0] - 2026-07-03
### Added
- `DomsureError` class for typed `catch` (#3)
- `$$.required` / `$$.optional` / `$$.exists` — `$$` API parity with `$` (#5)
- `resetWarnings()` public lifecycle hook (#2)
- Invalid-selector detection → branded `DomsureError` (#4)
- `defineSelectors` dev-mode duplicate-selector & non-string validation (#6)
### Changed
- `query.ts` split into `query-core.ts`, `query-single.ts`, `query-multi.ts`; shared `assertBrowser()` and `safeQueryAll()` extracted into `query-core.ts` to remove SSR-guard and invalid-selector duplication. Public `.d.ts` unchanged.
- Unified the two SSR error messages to the longer, more helpful version with `typeof window` guidance.
- README size claim corrected to measured "~920 B gzipped" (#1)
- `isDev()` memoized at module load (#7)
- Build output minified; sourcemaps no longer shipped (#1)

## [0.1.0] - 2026-07-03
- `$` — silent single-element query. `#id` fast path via `getElementById` (simple IDs only; compound selectors fall through to `querySelector`).
- `$.required` — throws if the element is missing. Replaces the `!` non-null assertion.
- `$.optional` — warns once per selector in dev when missing. Deduplicated.
- `$.exists` — boolean presence check.
- `$$` — `querySelectorAll` as an `Array`.
- `defineSelectors` — frozen, typed selector registry.
- Browser-only: throws a clear error under SSR (no `document`). Guard with `typeof window !== 'undefined'` in isomorphic code.
- ESM + CJS dual build. Internal modules (`query`, `isDev`, `warned`) are not exported.
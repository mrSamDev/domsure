# Changelog

All notable changes to `domsure` are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); this project
follows [Semantic Versioning](https://semver.org/). Dates are ISO 8601.

## [Unreleased]
### Added
- Query generics widened from `HTMLElement` to `Element` — `$.required<SVGSVGElement>("#svg")` and other SVG/MathML/custom-element types now compile. Default type argument stays `HTMLElement`, so existing call sites are unchanged.
- Error message factories (`errRequiredNotFound`, `errInvalidSelector`, `errSsr`, etc.) centralized in `errors.ts`.
- SVG runtime test suite (`test/svg.test.ts`) and a seeded fuzz harness (`test/fuzz.test.ts`, 2000 iterations) cross-checking `$`/`$$` against native `querySelector`/`querySelectorAll`.
- Type-level test (`test/types.test.ts`) guarding the `Element` constraint and the `HTMLElement` default.
- Design spike: `docs/selector-type-inference-spike.md` for future selector→element-type inference (v1.0 target).
- `DomsureError` class for typed `catch` (#3)
- `$$.required` / `$$.optional` / `$$.exists` — `$$` API parity with `$` (#5)
- `resetWarnings()` public lifecycle hook (#2)
- Invalid-selector detection → branded `DomsureError` (#4)
- `defineSelectors` dev-mode duplicate-selector & non-string validation (#6)
### Changed
- Internal `query.ts` refactor: extracted `assertBrowser()` and `safeQueryAll()` to remove SSR-guard and invalid-selector duplication between the single and multi paths. Public `.d.ts` unchanged.
- Unified the two SSR error messages to the longer, more helpful version with `typeof window` guidance.
- README size claim corrected to measured "~920 B gzipped" (#1)
- `isDev()` memoized at module load (#7)
- Build output minified; sourcemaps no longer shipped (#1)
### Fixed
- `warned` Set bounded (cap 256) to prevent unbounded growth (#2)
- `package.json` placeholder `<you>` URLs replaced (#9)

## [0.1.0] - 2026-07-03
- `$` — silent single-element query. `#id` fast path via `getElementById` (simple IDs only; compound selectors fall through to `querySelector`).
- `$.required` — throws if the element is missing. Replaces the `!` non-null assertion.
- `$.optional` — warns once per selector in dev when missing. Deduplicated.
- `$.exists` — boolean presence check.
- `$$` — `querySelectorAll` as an `Array`.
- `defineSelectors` — frozen, typed selector registry.
- Browser-only: throws a clear error under SSR (no `document`). Guard with `typeof window !== 'undefined'` in isomorphic code.
- ESM + CJS dual build. Internal modules (`query`, `isDev`, `warned`) are not exported.
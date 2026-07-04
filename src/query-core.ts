/**
 * Shared internals for the single- and multi-element query APIs: the ID
 * fast-path regexes, a DOMException-to-DomsureError wrapper, the
 * single-element query core, and a shared SSR error factory.
 *
 * @module
 */

import { invalidSelectorError, ssrError } from './errors.ts';

// Matches simple ID selectors eligible for the getElementById fast path.
// Compound selectors like `#app .item`, `#app.active`, `#nav > li` MUST fall
// through to querySelector — getElementById('app .item') silently returns null.
// Allows underscore-leading IDs (#_x) — CSS permits them, so querySelector
// would work too, but getElementById is still the faster path.
const SIMPLE_ID = /^#[A-Za-z_][\w-]*$/;

// Matches a pure ID selector — `#` followed by an ID value with no CSS
// combinators or compound syntax. This catches IDs that are valid HTML but
// invalid as unescaped CSS identifiers (e.g. #123, #1a): querySelector throws
// a DOMException for these, so we catch and fallback to getElementById, which
// accepts any string as an ID lookup and never throws.
const PURE_ID = /^#[^\s.#:>[+~*\[\]]+$/;

/**
 * Shared SSR guard. Throwing here (not at each call site) keeps the
 * browser-only failure branded and identical across every query path.
 */
export function assertBrowser(): void {
  if (typeof document === 'undefined') throw ssrError();
}

/**
 * Wrap a DOM query so a `DOMException` from an invalid selector is rebranded
 * as a {@link DomsureError}. The library's contract is that *every* selector
 * failure is branded `[domsure]` and actionable; leaking a raw DOMException is
 * a breach of that contract. The try/catch wraps only the query call (so
 * valid-but-exotic selectors — escaped dots, `:scope`, combinators — still
 * resolve normally) and narrows to `DOMException`, so a non-DOM throw (a real
 * bug, e.g. a TypeError from a corrupted document) escapes instead of being
 * mislabeled "Invalid selector". Never swallow an unknown failure.
 */
function safeQuery<T extends Element>(
  run: () => T | null,
  selector: string,
): T | null {
  try {
    return run();
  } catch (e) {
    if (e instanceof DOMException) throw invalidSelectorError(selector);
    throw e;
  }
}

/**
 * Multi-element counterpart of safeQuery: brands a querySelectorAll
 * DOMException as DomsureError. Same contract, different return shape —
 * narrows to DOMException so a non-DOM throw escapes unrebranded.
 */
export function safeQueryAll<T extends Element>(
  run: () => NodeListOf<T>,
  selector: string,
): T[] {
  try {
    return Array.from(run());
  } catch (e) {
    if (e instanceof DOMException) throw invalidSelectorError(selector);
    throw e;
  }
}

/**
 * Single internal query core. All public single-element functions delegate
 * here, and `$$.exists` reuses it to avoid allocating an array.
 *
 * Simple `#id` selectors use `getElementById` (faster than `querySelector`).
 * Pure IDs that are CSS-invalid as unescaped identifiers (e.g. `#123`) try
 * `querySelector` first and fall back to `getElementById` on DOMException.
 * Everything else goes through `querySelector` via `safeQuery`.
 */
export function query<T extends Element>(selector: string): T | null {
  assertBrowser();
  if (SIMPLE_ID.test(selector)) {
    return safeQuery(
      () => document.getElementById(selector.slice(1)) as T | null,
      selector,
    );
  }
  // Pure ID selector that may be CSS-invalid (e.g. #123, #1a).
  // Try querySelector first; if it throws DOMException (unescaped digit-
  // leading IDs), fall back to getElementById, which accepts any string.
  // Narrow to DOMException: a non-DOM throw is a real failure and must
  // escape — silently routing it to getElementById (which may return null)
  // would turn a real bug into a silent miss.
  if (PURE_ID.test(selector)) {
    try {
      return document.querySelector<T>(selector);
    } catch (e) {
      if (e instanceof DOMException) {
        return document.getElementById(selector.slice(1)) as T | null;
      }
      throw e;
    }
  }
  return safeQuery(() => document.querySelector<T>(selector), selector);
}
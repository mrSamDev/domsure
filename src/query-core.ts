/**
 * Shared internals for the single- and multi-element query APIs: the ID
 * fast-path regexes, a DOMException-to-DomsureError wrapper, the
 * single-element query core, and a shared SSR error factory.
 *
 * @module
 */

import { DomsureError } from './errors.ts';

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
 * Build the SSR guard error. Every query path that checks `document` throws
 * the same message so users get identical guidance regardless of which API
 * they called (`$`, `$$`, or any variant).
 */
export function ssrError(): DomsureError {
  return new DomsureError(
    `[domsure] document is not available — domsure is browser-only. ` +
      `Guard calls with typeof window checks in SSR code paths.`,
  );
}

/**
 * Wrap a DOM query so a `DOMException` from an invalid selector is rebranded
 * as a {@link DomsureError}. The library's contract is that *every* failure is
 * branded `[domsure]` and actionable; leaking a raw DOMException is a breach
 * of that contract. The try/catch must not over-catch — it wraps only the
 * query call, so valid-but-exotic selectors (escaped dots, `:scope`,
 * combinators) still resolve normally.
 */
function safeQuery<T extends HTMLElement>(
  run: () => T | null,
  selector: string,
): T | null {
  try {
    return run();
  } catch {
    throw new DomsureError(
      `[domsure] Invalid selector: ${JSON.stringify(selector)}`,
      selector,
    );
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
export function query<T extends HTMLElement>(selector: string): T | null {
  if (typeof document === 'undefined') {
    throw ssrError();
  }
  if (SIMPLE_ID.test(selector)) {
    return safeQuery(
      () => document.getElementById(selector.slice(1)) as T | null,
      selector,
    );
  }
  // Pure ID selector that may be CSS-invalid (e.g. #123, #1a).
  // Try querySelector first; if it throws (DOMException for unescaped
  // digit-leading IDs), fallback to getElementById which accepts any string.
  if (PURE_ID.test(selector)) {
    try {
      return document.querySelector<T>(selector);
    } catch {
      return document.getElementById(selector.slice(1)) as T | null;
    }
  }
  return safeQuery(() => document.querySelector<T>(selector), selector);
}
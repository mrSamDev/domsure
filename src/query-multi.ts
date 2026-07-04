/**
 * Multi-element DOM query helpers with `.required`, `.optional`, `.exists`,
 * and `.tryRequired` variants — mirrors {@link $} for the multi-element case.
 * `querySelectorAll` is returned as a real `Array` so `map`, `filter`, and
 * `reduce` work directly.
 *
 * @example
 * ```ts
 * import { $$ } from "@mrsamdev/domsure";
 *
 * const items = $$(".item").map(el => el.textContent);
 * const rows = $$.required(".row");   // throws if zero rows match
 * const maybe = $$.optional(".row");   // warns once in dev if zero match
 * ```
 *
 * @module
 */

import { isDev, markWarned } from './env.ts';
import { DomsureError, requiredMultiNotFoundError } from './errors.ts';
import { query, assertBrowser, safeQueryAll } from './query-core.ts';
import type { RequiredResult } from './types.ts';

// Multi-element internal query core. All public multi-element functions
// delegate here.
function multiQuery<T extends Element = HTMLElement>(selector: string): T[] {
  assertBrowser();
  return safeQueryAll(() => document.querySelectorAll<T>(selector), selector);
}

/**
 * Assert at least one element matches. Throws {@link DomsureError} if zero
 * elements are found.
 *
 * @template T - Narrows the element type. A cast, not tag inference.
 * @param selector - CSS selector string.
 * @returns An array of matched elements (never empty).
 * @throws {DomsureError} If zero elements match, the selector is invalid,
 *   or `document` is undefined (SSR).
 *
 * @example
 * ```ts
 * const rows = $$.required(".row"); // throws if zero rows match
 * ```
 */
function requiredMulti<T extends Element = HTMLElement>(selector: string): T[] {
  const els = multiQuery<T>(selector);
  if (els.length === 0) {
    throw requiredMultiNotFoundError(selector);
  }
  return els;
}

/**
 * Multi-element required semantics without throwing. Returns a
 * `[error, elements]` tuple — `[null, els]` on success, `[DomsureError, []]`
 * when zero match. The error is the same `$$.required` would have thrown.
 *
 * `$$.tryRequired` mirrors `$.tryRequired` for the multi-element case: use it
 * in React effects and other throw-unsafe contexts. SSR-safe (returns the
 * error instead of throwing). Does not auto-warn.
 *
 * @template T - Narrows the element type. A cast, not tag inference.
 * @param selector - CSS selector string.
 * @returns `[null, els]` on success; `[DomsureError, []]` if zero match, the
 *   selector is invalid, or `document` is undefined (SSR). Never throws.
 *
 * @example
 * ```ts
 * const [err, rows] = $$.tryRequired('.row');
 * if (err) { report(err); return; }
 * rows.forEach(r => r.classList.add('active'));
 * ```
 */
function tryRequiredMulti<T extends Element = HTMLElement>(
  selector: string,
): RequiredResult<T[]> {
  try {
    return [null, requiredMulti<T>(selector)];
  } catch (e) {
    // Guard the type rather than casting: rethrow anything that isn't a
    // DomsureError instead of silently rebranding an unknown failure.
    if (e instanceof DomsureError) return [e, []];
    throw e;
  }
}

/**
 * Query for all matching elements, warning once per selector in development
 * when zero elements match. The dedup keeps React and Vue re-renders from
 * flooding the console. No warnings in production.
 *
 * @template T - Narrows the element type. A cast, not tag inference.
 * @param selector - CSS selector string.
 * @returns An array of matched elements (possibly empty).
 * @throws {DomsureError} If the selector is invalid or `document` is
 *   undefined (SSR).
 *
 * @example
 * ```ts
 * const rows = $$.optional(".row"); // warns once in dev if zero match
 * ```
 */
function optionalMulti<T extends Element = HTMLElement>(selector: string): T[] {
  const els = multiQuery<T>(selector);
  if (els.length === 0 && isDev() && markWarned(selector)) {
    console.warn(`[domsure] No elements found: ${selector}`);
  }
  return els;
}

/**
 * Boolean presence check. No warnings, no array back. Delegates to the
 * single-element query core to avoid allocating an array.
 *
 * @param selector - CSS selector string.
 * @returns `true` if any element matches, `false` otherwise.
 * @throws {DomsureError} If the selector is invalid or `document` is
 *   undefined (SSR).
 *
 * @example
 * ```ts
 * if ($$.exists(".row")) { /* ... *\/ }
 * ```
 */
function existsMulti(selector: string): boolean {
  // Existence check is semantically identical for $ and $$ — we only need to
  // know if any element matches. Delegate to query() (which handles SSR
  // guards, error branding, and the ID fast path) instead of allocating an
  // array via multiQuery().length > 0.
  return query<Element>(selector) !== null;
}

interface MultiQueryFn {
  /**
   * Multi-element DOM query. `querySelectorAll` returned as a real `Array`,
   * so `map`, `filter`, and `reduce` work directly.
   *
   * @template T - Narrows the element type. A cast, not tag inference.
   * @param selector - CSS selector string.
   * @returns An array of matched elements (possibly empty).
   * @throws {DomsureError} If the selector is invalid or `document` is
   *   undefined (SSR).
   */
  <T extends Element = HTMLElement>(selector: string): T[];
  /** Assert at least one element matches. Throws {@link DomsureError} if zero. */
  required: typeof requiredMulti;
  /** Query for all matches, warning once in dev if zero match. */
  optional: typeof optionalMulti;
  /** Boolean presence check. No warnings, no array back. */
  exists: typeof existsMulti;
  /** Required as a `[error, elements]` tuple. Never throws. */
  tryRequired: typeof tryRequiredMulti;
}

/**
 * Multi-element DOM query. `querySelectorAll` returned as a real `Array`,
 * so `map`, `filter`, and `reduce` work directly. Mirrors `$` with
 * `.required`, `.optional`, and `.exists` for the multi-element case.
 *
 * @example
 * ```ts
 * import { $$ } from "@mrsamdev/domsure";
 *
 * const items = $$(".item").map(el => el.textContent);
 * const rows = $$.required(".row");   // throws if zero rows match
 * const maybe = $$.optional(".row");   // warns once in dev if zero match
 * ```
 */
const $$: MultiQueryFn = Object.assign(multiQuery, {
  required: requiredMulti,
  optional: optionalMulti,
  exists: existsMulti,
  tryRequired: tryRequiredMulti,
});

export { $$ };
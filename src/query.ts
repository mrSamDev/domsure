/**
 * Single and multi-element DOM query helpers with `.required`, `.optional`,
 * `.exists`, and `.tryRequired` variants. Replaces `!` non-null assertions with
 * runtime checks that throw {@link DomsureError} on failure (or return it as a
 * tuple via `.tryRequired` for throw-unsafe contexts like React effects).
 *
 * @example
 * ```ts
 * import { $, $$ } from "@mrsamdev/domsure";
 *
 * const el = $.required("#app");          // throws if missing
 * const maybe = $.optional("#tooltip");    // warns once in dev if missing
 * const [err, nav] = $.tryRequired("#nav"); // never throws — tuple
 * const items = $$(".item");              // HTMLElement[], not NodeList
 * ```
 *
 * @module
 */

import { isDev, markWarned } from './env.ts';
import { DomsureError } from './errors.ts';
import type { RequiredResult } from './types.ts';

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

// Single internal query core. All public single-element functions delegate here.
function query<T extends HTMLElement>(selector: string): T | null {
  if (typeof document === 'undefined') {
    throw new DomsureError(
      `[domsure] document is not available — domsure is browser-only. ` +
        `Guard calls with typeof window checks in SSR code paths.`,
    );
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

/**
 * Assert the element exists. Throws {@link DomsureError} if not found.
 * This is the primary use case for domsure — replacing `!` assertions.
 *
 * @template T - Narrows the return type. A cast, not tag inference.
 *   `$.required<HTMLCanvasElement>("#div")` compiles fine.
 * @param selector - CSS selector string. Bare `#id` hits the fast path.
 * @returns The matched element (never `null`).
 * @throws {DomsureError} If no element matches, the selector is invalid,
 *   or `document` is undefined (SSR).
 *
 * @example
 * ```ts
 * const app = $.required("#app"); // HTMLElement, never null
 * ```
 */
function required<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = query<T>(selector);
  if (!el) throw new DomsureError(`[domsure] Required element not found: ${selector}`, selector);
  return el;
}

/**
 * Required semantics without throwing. Returns a `[error, element]` tuple —
 * `[null, el]` on success, `[DomsureError, null]` on a miss. The error is the
 * same instance `$.required` would have thrown (same message, same `.selector`),
 * so monitoring groups them together regardless of which API produced it.
 *
 * Use this where a throw is unrecoverable: React `useEffect`/`useLayoutEffect`
 * (error boundaries don't catch effect throws), event handlers without a
 * `try/catch`, or any throw-unsafe call site. Unlike `$.required`, it is safe
 * to call under SSR — it returns `[DomsureError, null]` instead of throwing.
 *
 * Does not auto-warn. The tuple type makes the error visible at every call
 * site (unlike `$.optional`'s `T | null`, which is why `.optional` warns); the
 * caller owns logging and telemetry.
 *
 * @template T - Narrows the return type. A cast, not tag inference.
 * @param selector - CSS selector string. Bare `#id` hits the fast path.
 * @returns `[null, el]` on success; `[DomsureError, null]` if missing, the
 *   selector is invalid, or `document` is undefined (SSR). Never throws.
 *
 * @example
 * ```ts
 * const [err, nav] = $.tryRequired('#navbar');
 * if (err) { report(err); return; }   // degrade — page survives
 * nav.classList.add('active');
 * ```
 */
function tryRequired<T extends HTMLElement = HTMLElement>(
  selector: string,
): RequiredResult<T | null> {
  try {
    return [null, required<T>(selector)];
  } catch (e) {
    // required() only ever throws DomsureError (not-found, invalid selector,
    // SSR). The cast is safe; the catch exists to convert the throw into a
    // tuple value, not to defend against a non-DomsureError.
    return [e as DomsureError, null];
  }
}

/**
 * Query for a single element, warning once per selector in development when
 * the element is missing. The dedup keeps React and Vue re-renders from
 * flooding the console. No warnings in production.
 *
 * @template T - Narrows the return type. A cast, not tag inference.
 * @param selector - CSS selector string. Bare `#id` hits the fast path.
 * @returns The matched element, or `null` if none found.
 * @throws {DomsureError} If the selector is invalid or `document` is
 *   undefined (SSR).
 *
 * @example
 * ```ts
 * const tooltip = $.optional("#tooltip"); // HTMLElement | null
 * ```
 */
function optional<T extends HTMLElement = HTMLElement>(selector: string): T | null {
  const el = query<T>(selector);
  if (!el && isDev() && markWarned(selector)) {
    console.warn(`[domsure] Element not found: ${selector}`);
  }
  return el;
}

/**
 * Boolean presence check. No warnings, no element back.
 *
 * @param selector - CSS selector string. Bare `#id` hits the fast path.
 * @returns `true` if any element matches, `false` otherwise.
 * @throws {DomsureError} If the selector is invalid or `document` is
 *   undefined (SSR).
 *
 * @example
 * ```ts
 * if ($.exists("#tooltip")) { /* ... *\/ }
 * ```
 */
function exists(selector: string): boolean {
  return query<HTMLElement>(selector) !== null;
}

interface QueryFn {
  /**
   * Single-element DOM query. Returns the first match or `null`.
   *
   * Simple `#id` selectors use `getElementById` (faster than
   * `querySelector`). Compound selectors like `#app .item` or `#nav.active`
   * fall through to `querySelector`. Never warns.
   *
   * @template T - Narrows the return type. A cast, not tag inference.
   *   `$.optional<HTMLCanvasElement>("#div")` compiles fine.
   * @param selector - CSS selector string. Bare `#id` hits the fast path.
   * @returns The matched element, or `null` if none found.
   * @throws {DomsureError} If the selector is invalid or `document` is
   *   undefined (SSR).
   */
  <T extends HTMLElement = HTMLElement>(selector: string): T | null;
  /** Assert the element exists. Throws {@link DomsureError} if missing. */
  required: typeof required;
  /** Query for a single element, warning once in dev if missing. */
  optional: typeof optional;
  /** Boolean presence check. No warnings, no element back. */
  exists: typeof exists;
  /** Required as a `[error, element]` tuple. Never throws. */
  tryRequired: typeof tryRequired;
}

/**
 * Single-element DOM query. Returns the first match or `null`.
 *
 * Simple `#id` selectors use `getElementById` (faster than `querySelector`).
 * Compound selectors like `#app .item` or `#nav.active` fall through to
 * `querySelector`. Never warns — use `.optional` for dev warnings or
 * `.required` to throw on a miss.
 *
 * @example
 * ```ts
 * import { $ } from "@mrsamdev/domsure";
 *
 * const modal = $("#modal"); // HTMLElement | null
 * const canvas = $.required<HTMLCanvasElement>("#chart");
 * ```
 */
const $: QueryFn = Object.assign(
  <T extends HTMLElement = HTMLElement>(selector: string): T | null => query<T>(selector),
  { required, optional, exists, tryRequired },
);

// ── Multi-element query ($$) with API parity to $ ────────────────────────────

// Multi-element internal query core. All public multi-element functions
// delegate here.
function multiQuery<T extends HTMLElement = HTMLElement>(selector: string): T[] {
  if (typeof document === 'undefined') {
    throw new DomsureError(`[domsure] document is not available — domsure is browser-only.`);
  }
  try {
    return Array.from(document.querySelectorAll<T>(selector));
  } catch {
    throw new DomsureError(`[domsure] Invalid selector: ${JSON.stringify(selector)}`, selector);
  }
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
function requiredMulti<T extends HTMLElement = HTMLElement>(selector: string): T[] {
  const els = multiQuery<T>(selector);
  if (els.length === 0) {
    throw new DomsureError(`[domsure] Required elements not found: ${selector}`, selector);
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
function tryRequiredMulti<T extends HTMLElement = HTMLElement>(
  selector: string,
): RequiredResult<T[]> {
  try {
    return [null, requiredMulti<T>(selector)];
  } catch (e) {
    return [e as DomsureError, []];
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
function optionalMulti<T extends HTMLElement = HTMLElement>(selector: string): T[] {
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
  return query<HTMLElement>(selector) !== null;
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
  <T extends HTMLElement = HTMLElement>(selector: string): T[];
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

export { $, $$ };
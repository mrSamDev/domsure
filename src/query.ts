/**
 * Single and multi-element DOM query helpers with `.required`, `.optional`,
 * and `.exists` variants. Replaces `!` non-null assertions with runtime
 * checks that throw {@link DomsureError} on failure.
 *
 * @example
 * ```ts
 * import { $, $$ } from "@mrsamdev/domsure";
 *
 * const el = $.required("#app");        // throws if missing
 * const maybe = $.optional("#tooltip"); // warns once in dev if missing
 * const items = $$(".item");            // HTMLElement[], not NodeList
 * ```
 *
 * @module
 */

import { isDev, markWarned } from './env.ts';
import { DomsureError, requiredNotFoundError, invalidSelectorError, ssrError, requiredMultiNotFoundError } from './errors.ts';

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
function safeQuery<T extends Element>(
  run: () => T | null,
  selector: string,
): T | null {
  try {
    return run();
  } catch {
    throw invalidSelectorError(selector);
  }
}

// Multi-element counterpart of safeQuery: brands a DOMException from
// querySelectorAll as DomsureError. Same contract, different return shape.
function safeQueryAll<T extends Element>(
  run: () => NodeListOf<T>,
  selector: string,
): T[] {
  try {
    return Array.from(run());
  } catch {
    throw invalidSelectorError(selector);
  }
}

// Single SSR guard shared by every query path. Throwing here (rather than at
// each call site) keeps the "browser-only" failure consistent and branded.
function assertBrowser(): void {
  if (typeof document === 'undefined') throw ssrError();
}

// Single internal query core. All public single-element functions delegate here.
function query<T extends Element = HTMLElement>(selector: string): T | null {
  assertBrowser();
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
function required<T extends Element = HTMLElement>(selector: string): T {
  const el = query<T>(selector);
  if (!el) throw requiredNotFoundError(selector);
  return el;
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
function optional<T extends Element = HTMLElement>(selector: string): T | null {
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
  return query<Element>(selector) !== null;
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
  <T extends Element = HTMLElement>(selector: string): T | null;
  /** Assert the element exists. Throws {@link DomsureError} if missing. */
  required: typeof required;
  /** Query for a single element, warning once in dev if missing. */
  optional: typeof optional;
  /** Boolean presence check. No warnings, no element back. */
  exists: typeof exists;
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
  <T extends Element = HTMLElement>(selector: string): T | null => query<T>(selector),
  { required, optional, exists },
);

// ── Multi-element query ($$) with API parity to $ ────────────────────────────

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
});

export { $, $$ };
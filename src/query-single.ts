/**
 * Single-element DOM query helpers with `.required`, `.optional`, `.exists`,
 * and `.tryRequired` variants. Replaces `!` non-null assertions with runtime
 * checks that throw {@link DomsureError} on failure (or return it as a tuple
 * via `.tryRequired` for throw-unsafe contexts like React effects).
 *
 * @example
 * ```ts
 * import { $ } from "@mrsamdev/domsure";
 *
 * const el = $.required("#app");          // throws if missing
 * const maybe = $.optional("#tooltip");    // warns once in dev if missing
 * const [err, nav] = $.tryRequired("#nav"); // never throws — tuple
 * ```
 *
 * @module
 */

import { isDev, markWarned } from './env.ts';
import { DomsureError } from './errors.ts';
import { query } from './query-core.ts';
import type { RequiredResult } from './types.ts';

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

export { $ };
import { isDev } from './env.ts';
import { selectorValueError, duplicateSelectorError } from './errors.ts';
import type { DomsureError } from './errors.ts';
import type { SelectorSchema, SelectorMap } from './types.ts';

/**
 * Typed selector registry — frozen at runtime, validated in dev.
 *
 * @module
 */

/**
 * Frozen, typed selector registry. Pass `as const` for string-literal inference.
 *
 * In dev, also detects two classes of typo that `Object.freeze` alone cannot:
 *  - non-string values (catches `{ x: el }` instead of `{ x: '#x' }`)
 *  - duplicate selector strings across keys (catches two keys pointing at the
 *    same selector — almost always a copy-paste typo that silently routes two
 *    semantic names to one node)
 * Production builds skip the checks: `isDev()` is statically false after
 * bundler dead-code elimination, so the validation never ships to users and
 * the sub-1KB size promise is preserved.
 *
 * @template T - The schema type. Pass `as const` for string-literal inference.
 * @param schema - A map of semantic names to CSS selector strings.
 * @returns A frozen `SelectorMap<T>` with the same keys and values.
 * @throws {DomsureError} In dev, if a value is not a string or if two keys
 *   map to the same selector string.
 *
 * @example
 * ```ts
 * import { defineSelectors } from "@mrsamdev/domsure";
 *
 * const S = defineSelectors({
 *   navbar: "#navbar",
 *   items: ".item",
 * } as const);
 *
 * S.navbar;  // typed as "#navbar", not string
 * S.items;   // typed as ".item"
 * ```
 */
export function defineSelectors<T extends SelectorSchema>(schema: T): SelectorMap<T> {
  if (isDev()) {
    const seen = new Map<string, string>(); // selector -> first key that used it
    for (const [key, value] of Object.entries(schema)) {
      if (typeof value !== 'string') {
        throw selectorValueError(key, typeof value);
      }
      const prev = seen.get(value);
      if (prev !== undefined) {
        throw duplicateSelectorError(value, prev, key);
      }
      seen.set(value, key);
    }
  }
  return Object.freeze(schema) as SelectorMap<T>;
}
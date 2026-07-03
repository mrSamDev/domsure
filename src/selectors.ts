import { isDev } from './env.ts';
import { DomsureError } from './errors.ts';
import type { SelectorSchema, SelectorMap } from './types.ts';

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
 */
export function defineSelectors<T extends SelectorSchema>(schema: T): SelectorMap<T> {
  if (isDev()) {
    const seen = new Map<string, string>(); // selector -> first key that used it
    for (const [key, value] of Object.entries(schema)) {
      if (typeof value !== 'string') {
        throw new DomsureError(
          `[domsure] defineSelectors: value for "${key}" is ${typeof value}, expected a selector string`,
        );
      }
      const prev = seen.get(value);
      if (prev !== undefined) {
        throw new DomsureError(
          `[domsure] defineSelectors: duplicate selector "${value}" on keys "${prev}" and "${key}"`,
        );
      }
      seen.set(value, key);
    }
  }
  return Object.freeze(schema) as SelectorMap<T>;
}
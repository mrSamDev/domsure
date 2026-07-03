/**
 * domsure — DOM query utilities that replace `!` non-null assertions with
 * real runtime checks.
 *
 * Eight query helpers under 1 KB gzipped: {@link $} and {@link $$} each with
 * `.required`, `.optional`, `.exists`, and `.tryRequired` variants. Plus a
 * typed selector registry ({@link defineSelectors}), a warn-once reset hook
 * ({@link resetWarnings}), and a branded error class ({@link DomsureError}).
 *
 * Browser-only. Under SSR (where `document` is undefined), `$`, `$$`, and
 * their `.required`/`.optional`/`.exists` variants throw a {@link DomsureError}
 * instead of failing silently — guard isomorphic code with
 * `typeof window !== 'undefined'`. The `.tryRequired` variants are the
 * exception: they return `[DomsureError, null]` under SSR instead of throwing,
 * so they are safe to call unguarded in throw-unsafe contexts like React
 * effects (error boundaries do not catch effect throws).
 *
 * @example
 * ```ts
 * import { $, $$, defineSelectors } from "@mrsamdev/domsure";
 *
 * const navbar = $.required("#navbar");      // throws DomsureError if missing
 * const tooltip = $.optional("#tooltip");    // warns once in dev if missing
 * const [err, nav] = $.tryRequired("#nav");  // never throws — tuple
 * const items = $$(".item").map(el => el.textContent);
 *
 * const S = defineSelectors({
 *   navbar: "#navbar",
 *   items: ".item",
 * } as const);
 * ```
 *
 * @module
 */

export type { SelectorSchema, SelectorMap, RequiredResult } from './types.ts';
export { DomsureError } from './errors.ts';
export { resetWarnings } from './env.ts';
export { defineSelectors } from './selectors.ts';
export { $, $$ } from './query.ts';
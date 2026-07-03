/**
 * domsure — DOM query utilities that replace `!` non-null assertions with
 * real runtime checks.
 *
 * Six query helpers under 1 KB gzipped: {@link $} and {@link $$} each with
 * `.required`, `.optional`, and `.exists` variants. Plus a typed selector
 * registry ({@link defineSelectors}), a warn-once reset hook
 * ({@link resetWarnings}), and a branded error class ({@link DomsureError}).
 *
 * Browser-only. Under SSR (where `document` is undefined), `$` and `$$`
 * throw a {@link DomsureError} instead of failing silently. Guard isomorphic
 * code with `typeof window !== 'undefined'`.
 *
 * @example
 * ```ts
 * import { $, $$, defineSelectors } from "@mrsamdev/domsure";
 *
 * const navbar = $.required("#navbar");    // throws DomsureError if missing
 * const tooltip = $.optional("#tooltip");  // warns once in dev if missing
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

export type { SelectorSchema, SelectorMap } from './types.ts';
export { DomsureError } from './errors.ts';
export { resetWarnings } from './env.ts';
export { defineSelectors } from './selectors.ts';
export { $, $$ } from './query.ts';
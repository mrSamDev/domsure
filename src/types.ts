import type { DomsureError } from './errors.ts';

/**
 * Type definitions for the selector registry and query result tuples.
 *
 * @module
 */

/** A schema mapping semantic names to CSS selector strings. */
export type SelectorSchema = Record<string, string>;

/**
 * `[error, value]` tuple returned by `$.tryRequired` / `$$.tryRequired`.
 * Error-first so the guard clause reads naturally:
 * `const [err, el] = $.tryRequired('#x'); if (err) return;`
 *
 * The error is the same `DomsureError` `$.required` would have thrown — same
 * message, same `.selector` — so monitoring can't tell which API produced it.
 * `null` error means the query succeeded; `null`/`[]` value means it failed.
 */
export type RequiredResult<T> = [DomsureError | null, T];

/**
 * A frozen, readonly map of selector names to their string-literal values.
 * Produced by {@link defineSelectors}; the `readonly` modifier prevents
 * reassignment at compile time, and `Object.freeze` enforces it at runtime.
 */
export type SelectorMap<T extends SelectorSchema> = {
  readonly [K in keyof T]: T[K];
};
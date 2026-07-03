/**
 * Type definitions for the selector registry.
 *
 * @module
 */

/** A schema mapping semantic names to CSS selector strings. */
export type SelectorSchema = Record<string, string>;

/**
 * A frozen, readonly map of selector names to their string-literal values.
 * Produced by {@link defineSelectors}; the `readonly` modifier prevents
 * reassignment at compile time, and `Object.freeze` enforces it at runtime.
 */
export type SelectorMap<T extends SelectorSchema> = {
  readonly [K in keyof T]: T[K];
};
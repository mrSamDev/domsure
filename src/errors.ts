/**
 * Branded error class for all domsure failures.
 *
 * @module
 */

/**
 * Branded error class for all domsure failures.
 *
 * Extends `Error` so consumers can `catch (e) { if (e instanceof DomsureError) ... }`
 * instead of regex-matching a `[domsure]` string prefix. Carries the `selector`
 * that caused the failure as structured data, so logging/alerting tools can
 * group by selector without parsing the message.
 *
 * @example
 * ```ts
 * import { $, DomsureError } from "@mrsamdev/domsure";
 *
 * try {
 *   $.required("#missing");
 * } catch (e) {
 *   if (e instanceof DomsureError) {
 *     console.error(e.selector, e.message);
 *   }
 * }
 * ```
 */
export class DomsureError extends Error {
  /** The selector that caused the failure, or `undefined` for SSR errors. */
  readonly selector?: string;

  /**
   * @param message - The error message, prefixed with `[domsure]`.
   * @param selector - The selector that caused the failure, if applicable.
   */
  constructor(message: string, selector?: string) {
    super(message);
    this.name = 'DomsureError';
    this.selector = selector;
    // Restore prototype chain across TS->ES5 downlevel targets: when targeting
    // ES5, extending built-ins breaks instanceof unless we re-link the chain.
    Object.setPrototypeOf(this, DomsureError.prototype);
  }
}
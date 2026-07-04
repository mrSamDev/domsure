/**
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

  /**
   * Cross-realm `instanceof` support. `Error` subclass `instanceof` checks
   * fail across iframe/VM boundaries because each realm has its own
   * `DomsureError` constructor. Duck-type on `.name` instead — it's set in
   * the constructor and survives realm boundaries. This keeps `tryRequired`'s
   * guard (`e instanceof DomsureError`) working when the error was thrown in
   * an iframe and caught in the parent.
   */
  static [Symbol.hasInstance](instance: unknown): boolean {
    return typeof instance === 'object' && instance !== null &&
      (instance as Error).name === 'DomsureError';
  }
}

// Centralized message construction. One source of truth for wording so the
// query/selectors modules stay consistent and future localization is a
// single-file change. Tests assert on these substrings — keep them stable.

export function requiredNotFoundError(selector: string): DomsureError {
  return new DomsureError(`[domsure] Required element not found: ${selector}`, selector);
}

export function requiredMultiNotFoundError(selector: string): DomsureError {
  return new DomsureError(`[domsure] Required elements not found: ${selector}`, selector);
}

export function invalidSelectorError(selector: string): DomsureError {
  return new DomsureError(`[domsure] Invalid selector: ${JSON.stringify(selector)}`, selector);
}

export function ssrError(): DomsureError {
  return new DomsureError(
    `[domsure] document is not available — domsure is browser-only. ` +
      `Guard calls with typeof window checks in SSR code paths.`,
  );
}

export function selectorValueError(key: string, kind: string): DomsureError {
  return new DomsureError(
    `[domsure] defineSelectors: value for "${key}" is ${kind}, expected a selector string`,
  );
}

export function duplicateSelectorError(value: string, prev: string, key: string): DomsureError {
  return new DomsureError(
    `[domsure] defineSelectors: duplicate selector "${value}" on keys "${prev}" and "${key}"`,
  );
}
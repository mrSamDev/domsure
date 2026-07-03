/**
 * Branded error class for all domsure failures.
 *
 * Extends `Error` so consumers can `catch (e) { if (e instanceof DomsureError) ... }`
 * instead of regex-matching a `[domsure]` string prefix. Carries the `selector`
 * that caused the failure as structured data, so logging/alerting tools can
 * group by selector without parsing the message.
 */
export class DomsureError extends Error {
  readonly selector?: string;

  constructor(message: string, selector?: string) {
    super(message);
    this.name = 'DomsureError';
    this.selector = selector;
    // Restore prototype chain across TS->ES5 downlevel targets: when targeting
    // ES5, extending built-ins breaks instanceof unless we re-link the chain.
    Object.setPrototypeOf(this, DomsureError.prototype);
  }
}
/**
 * Dev-mode detection and warn-once dedup for `$.optional` / `$$.optional`.
 *
 * @module
 */

// process.env only — import.meta.env is ESM-only syntax and breaks
// CJS builds at parse time (a try/catch cannot recover from a parse error).
// Vite/Webpack replace process.env.NODE_ENV at build time, so keep it a
// direct reference — don't route through globalThis.
//
// Memoized once at module load: NODE_ENV does not change at runtime in any
// real bundler output, so re-reading it per call is pure overhead on the
// $.optional / $$.optional hot path. The try/catch stays for SSR/edge
// runtimes where `process` is undefined — its job is environment safety at
// load time, not per-call defense.
const IS_DEV: boolean = (() => {
  try {
    // @ts-ignore: process is a runtime global in Node, Bun, and Deno 2.
    // @types/node types it for npm builds; Deno has it at runtime without the lib.
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();

// Test-only override. Tests that change NODE_ENV after import can flip this
// to simulate dev/prod without re-importing the module. Null = use the
// module-load memoized value.
let _override: boolean | null = null;
export function _setDevOverrideForTests(v: boolean | null): void {
  _override = v;
}

/**
 * Returns `true` if running in development mode. Memoized at module load
 * from `NODE_ENV`; test overrides via `_setDevOverrideForTests` take
 * precedence.
 *
 * @returns `true` if `NODE_ENV` is not `"production"`.
 */
export function isDev(): boolean {
  return _override ?? IS_DEV;
}

// ── Warned-selector lifecycle ───────────────────────────────────────────────
// Selectors that already warned this session. Keeps $.optional quiet after
// the first miss per selector — avoids spamming React/Vue re-renders.
//
// Bounded (cap 256) so a long-lived SPA with dynamic selectors
// (`#cell-${row}-${col}` over a virtualized grid) cannot leak indefinitely.
// 256 is far above any realistic distinct-selector count for a single page;
// hitting the cap clears the set (FIFO-ish reset) — rare in practice, but
// caps worst-case memory at ~256 strings.
const WARNED_CAP = 256;
const warned = new Set<string>();

/**
 * Returns `true` if this call is the first warning for `selector`.
 *
 * @param selector - The selector string to dedup warnings for.
 * @returns `true` if this is the first warning, `false` if already warned.
 */
export function markWarned(selector: string): boolean {
  if (warned.has(selector)) return false;
  if (warned.size >= WARNED_CAP) warned.clear();
  warned.add(selector);
  return true;
}

/**
 * Clears the warned-selector dedup set so {@link $.optional} and
 * {@link $$.optional} warn again for selectors that already fired one this
 * session. Handy in long-lived SPAs after a route change, when previously
 * missing elements reappear. Also the hook test suites use for isolation.
 *
 * @example
 * ```ts
 * import { resetWarnings } from "@mrsamdev/domsure";
 *
 * resetWarnings();
 * ```
 */
export function resetWarnings(): void {
  warned.clear();
}

/**
 * Test-only: exposes the current dedup-set size for assertions.
 *
 * @returns The number of selectors currently in the warned set.
 */
export function _warnedSizeForTests(): number {
  return warned.size;
}
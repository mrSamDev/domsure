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
    // @ts-ignore (not @ts-expect-error) on purpose: the error this suppresses
    // is context-dependent (present under Deno's lib, absent under @types/node),
    // so @ts-expect-error would fail the npm build with TS2578 when unused.
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
// Namespace-scoped so multi-app / micro-frontend bundles can isolate their
// dedup sets. The default namespace is ''; pass a namespace string to
// resetWarnings() to clear only that namespace, or omit the argument to
// clear all namespaces.
//
// Bounded (cap 256 per namespace) so a long-lived SPA with dynamic selectors
// (`#cell-${row}-${col}` over a virtualized grid) cannot leak indefinitely.
// 256 is far above any realistic distinct-selector count for a single page.
// On overflow we do NOT clear: clearing would re-arm every previously-quiet
// selector and cause a warning storm across the whole app. Instead, once at
// cap we stop tracking new selectors — they warn on every call (the
// unavoidable cost of exceeding the cap) while the 256 already-seen selectors
// stay quiet. Overflow noise is contained to new selectors only.
const WARNED_CAP = 256;
const warned = new Map<string, Set<string>>();

function getWarned(namespace: string): Set<string> {
  let s = warned.get(namespace);
  if (!s) {
    s = new Set<string>();
    warned.set(namespace, s);
  }
  return s;
}

/**
 * Returns `true` if this call is the first warning for `selector`.
 *
 * @param selector - The selector string to dedup warnings for.
 * @returns `true` if this is the first warning, `false` if already warned.
 */
export function markWarned(selector: string): boolean {
  const s = getWarned('');
  if (s.has(selector)) return false;
  // Cap reached: keep existing dedup intact, don't add. The new selector
  // warns this call (and on future calls, since we can't track it without
  // exceeding the cap) — but the 256 selectors already seen stay quiet.
  // This contains overflow noise to new selectors instead of re-warning all.
  if (s.size >= WARNED_CAP) return true;
  s.add(selector);
  return true;
}

/**
 * Clears the warned-selector dedup set so {@link $.optional} and
 * {@link $$.optional} warn again for selectors that already fired one this
 * session. Handy in long-lived SPAs after a route change, when previously
 * missing elements reappear. Also the hook test suites use for isolation.
 *
 * Pass a namespace to clear only that namespace's dedup set (for multi-app /
 * micro-frontend bundles). Omit the argument to clear all namespaces.
 *
 * @param namespace - Optional namespace to clear. If omitted, clears all.
 *
 * @example
 * ```ts
 * import { resetWarnings } from "@mrsamdev/domsure";
 *
 * resetWarnings();           // clear all
 * resetWarnings('app-shell'); // clear only the app-shell namespace
 * ```
 */
export function resetWarnings(namespace?: string): void {
  if (namespace === undefined) {
    warned.clear();
  } else {
    warned.delete(namespace);
  }
}

/**
 * Test-only: exposes the current dedup-set size for assertions.
 *
 * @param namespace - The namespace to check (default '').
 * @returns The number of selectors currently in the warned set.
 */
export function _warnedSizeForTests(namespace = ''): number {
  return warned.get(namespace)?.size ?? 0;
}
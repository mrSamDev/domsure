import { isDev, markWarned } from './env.ts';
import { DomsureError } from './errors.ts';

// Matches simple ID selectors eligible for the getElementById fast path.
// Compound selectors like `#app .item`, `#app.active`, `#nav > li` MUST fall
// through to querySelector — getElementById('app .item') silently returns null.
// Allows underscore-leading IDs (#_x) — CSS permits them, so querySelector
// would work too, but getElementById is still the faster path.
const SIMPLE_ID = /^#[A-Za-z_][\w-]*$/;

// Matches a pure ID selector — `#` followed by an ID value with no CSS
// combinators or compound syntax. This catches IDs that are valid HTML but
// invalid as unescaped CSS identifiers (e.g. #123, #1a): querySelector throws
// a DOMException for these, so we catch and fallback to getElementById, which
// accepts any string as an ID lookup and never throws.
const PURE_ID = /^#[^\s.#:>[+~*\[\]]+$/;

/**
 * Wrap a DOM query so a `DOMException` from an invalid selector is rebranded
 * as a `DomsureError`. The library's contract is that *every* failure is
 * branded `[domsure]` and actionable; leaking a raw DOMException is a breach
 * of that contract. The try/catch must not over-catch — it wraps only the
 * query call, so valid-but-exotic selectors (escaped dots, `:scope`,
// combinators) still resolve normally.
 */
function safeQuery<T extends HTMLElement>(
  run: () => T | null,
  selector: string,
): T | null {
  try {
    return run();
  } catch {
    throw new DomsureError(
      `[domsure] Invalid selector: ${JSON.stringify(selector)}`,
      selector,
    );
  }
}

// Single internal query core. All public single-element functions delegate here.
function query<T extends HTMLElement>(selector: string): T | null {
  if (typeof document === 'undefined') {
    throw new DomsureError(
      `[domsure] document is not available — domsure is browser-only. ` +
        `Guard calls with typeof window checks in SSR code paths.`,
    );
  }
  if (SIMPLE_ID.test(selector)) {
    return safeQuery(
      () => document.getElementById(selector.slice(1)) as T | null,
      selector,
    );
  }
  // Pure ID selector that may be CSS-invalid (e.g. #123, #1a).
  // Try querySelector first; if it throws (DOMException for unescaped
  // digit-leading IDs), fallback to getElementById which accepts any string.
  if (PURE_ID.test(selector)) {
    try {
      return document.querySelector<T>(selector);
    } catch {
      return document.getElementById(selector.slice(1)) as T | null;
    }
  }
  return safeQuery(() => document.querySelector<T>(selector), selector);
}

function required<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = query<T>(selector);
  if (!el) throw new DomsureError(`[domsure] Required element not found: ${selector}`, selector);
  return el;
}

function optional<T extends HTMLElement = HTMLElement>(selector: string): T | null {
  const el = query<T>(selector);
  if (!el && isDev() && markWarned(selector)) {
    console.warn(`[domsure] Element not found: ${selector}`);
  }
  return el;
}

function exists(selector: string): boolean {
  return query<HTMLElement>(selector) !== null;
}

interface QueryFn {
  // <T> narrows the return type but does not verify the element's actual tag.
  // It is a cast, not inference. Use required() for a runtime guarantee.
  <T extends HTMLElement = HTMLElement>(selector: string): T | null;
  required: typeof required;
  optional: typeof optional;
  exists: typeof exists;
}

const $: QueryFn = Object.assign(
  <T extends HTMLElement = HTMLElement>(selector: string): T | null => query<T>(selector),
  { required, optional, exists },
);

// ── Multi-element query ($$) with API parity to $ ────────────────────────────
function multiQuery<T extends HTMLElement = HTMLElement>(selector: string): T[] {
  if (typeof document === 'undefined') {
    throw new DomsureError(`[domsure] document is not available — domsure is browser-only.`);
  }
  try {
    return Array.from(document.querySelectorAll<T>(selector));
  } catch {
    throw new DomsureError(`[domsure] Invalid selector: ${JSON.stringify(selector)}`, selector);
  }
}

function requiredMulti<T extends HTMLElement = HTMLElement>(selector: string): T[] {
  const els = multiQuery<T>(selector);
  if (els.length === 0) {
    throw new DomsureError(`[domsure] Required elements not found: ${selector}`, selector);
  }
  return els;
}

function optionalMulti<T extends HTMLElement = HTMLElement>(selector: string): T[] {
  const els = multiQuery<T>(selector);
  if (els.length === 0 && isDev() && markWarned(selector)) {
    console.warn(`[domsure] No elements found: ${selector}`);
  }
  return els;
}

function existsMulti(selector: string): boolean {
  // Existence check is semantically identical for $ and $$ — we only need to
  // know if any element matches. Delegate to query() (which handles SSR
  // guards, error branding, and the ID fast path) instead of allocating an
  // array via multiQuery().length > 0.
  return query<HTMLElement>(selector) !== null;
}

interface MultiQueryFn {
  <T extends HTMLElement = HTMLElement>(selector: string): T[];
  required: typeof requiredMulti;
  optional: typeof optionalMulti;
  exists: typeof existsMulti;
}

const $$: MultiQueryFn = Object.assign(multiQuery, {
  required: requiredMulti,
  optional: optionalMulti,
  exists: existsMulti,
});

export { $, $$ };
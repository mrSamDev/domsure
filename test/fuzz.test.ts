import { describe, it, expect } from 'vitest';
import { $ } from '../src/query-single';
import { $$ } from '../src/query-multi';
import { DomsureError } from '../src/errors';

// Property-based cross-check: domsure is a thin wrapper, so for every
// selector the native DOM accepts, domsure must return the identical result;
// for every selector the native DOM rejects, domsure must throw DomsureError
// (never leak a raw DOMException). Seeded so failures are reproducible.

const FIXTURE =
  '<div id="app" class="active">' +
  '<span class="item" data-x="1">a</span>' +
  '<span class="item" data-x="2">b</span>' +
  '<div id="123"><span id="1a"></span></div>' +
  '<div id="_x"></div>' +
  '<div id="foo.bar"></div>' +
  '</div>';

// Selectors the native DOM accepts (verified against the fixture).
const VALID_ATOMS = [
  '#app', '.item', 'div', 'span', 'div#app', '[data-x]', '[data-x="1"]',
  '#app .item', '#app > .item', '#app.active', ':first-child', '*',
  '#123', '#1a', '#_x', 'div#123', '#app.active .item', '#foo\\.bar',
  'span[data-x="2"]', '#app > *', '.item + .item',
];

// Selectors the native DOM rejects (invalid CSS).
const INVALID_ATOMS = ['#[', '][', ':invalid-pseudo::', ':::'];

const COMBINATORS = [' ', ' > ', ' + ', ' ~ '];

// mulberry32 — tiny deterministic PRNG. Fixed seed for reproducibility.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function genSelector(rand: () => number): string {
  // ~15% chance to start from the invalid pool to exercise the branding path.
  if (rand() < 0.15) return pick(rand, INVALID_ATOMS);
  const parts = [pick(rand, VALID_ATOMS)];
  // 1–3 atoms joined by combinators.
  const extra = Math.floor(rand() * 3);
  for (let i = 0; i < extra; i++) {
    parts.push(pick(rand, COMBINATORS));
    parts.push(pick(rand, VALID_ATOMS));
  }
  return parts.join('');
}

type NativeResult =
  | { kind: 'ok'; el: Element | null }
  | { kind: 'throws' };

function nativeQuery(selector: string): NativeResult {
  try {
    return { kind: 'ok', el: document.querySelector(selector) };
  } catch {
    return { kind: 'throws' };
  }
}

function nativeCount(selector: string): NativeResult & { count?: number } {
  try {
    return { kind: 'ok', el: null, count: document.querySelectorAll(selector).length };
  } catch {
    return { kind: 'throws' };
  }
}

// Pure-id selectors (#123, #1a) are CSS-invalid but HTML-valid. domsure rescues
// them via getElementById instead of letting querySelector throw. This is the
// documented fast-path contract, so the fuzz must model it: pure-ids resolve
// through getElementById (never throw); everything else mirrors querySelector.
const PURE_ID = /^#[^\s.#:>[+~*\[\]]+$/;

const ITERATIONS = 250; // combinatorial coverage; deterministic edge cases below
const SEED = 13653842; // fixed for reproducibility

describe('fuzz: $ matches native querySelector', () => {
  it('every selector: identical result, branded error, or pure-id rescue', () => {
    document.body.innerHTML = FIXTURE;
    const rand = rng(SEED);
    let checked = 0;
    let branded = 0;
    let rescued = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const selector = genSelector(rand);

      // Pure-id path: domsure resolves via getElementById, never throws.
      if (PURE_ID.test(selector)) {
        const gbid = document.getElementById(selector.slice(1));
        let domsureEl: Element | null;
        try {
          domsureEl = $(selector);
        } catch (e) {
          throw new Error(`domsure threw on pure-id ${JSON.stringify(selector)}: ${(e as Error).message}`);
        }
        expect(domsureEl).toBe(gbid);
        rescued++;
        continue;
      }

      const native = nativeQuery(selector);

      if (native.kind === 'throws') {
        // Native rejects it → domsure must throw DomsureError, not leak DOMException.
        expect(() => $(selector)).toThrow(DomsureError);
        branded++;
        continue;
      }

      let domsureEl: Element | null;
      try {
        domsureEl = $(selector);
      } catch (e) {
        throw new Error(`domsure threw on a native-valid selector ${JSON.stringify(selector)}: ${(e as Error).message}`);
      }
      expect(domsureEl).toBe(native.el);
      checked++;
    }

    // Guard against a generator that never exercises any path.
    expect(checked).toBeGreaterThan(0);
    expect(branded).toBeGreaterThan(0);
    expect(rescued).toBeGreaterThan(0);
  });
});

describe('fuzz: $$ matches native querySelectorAll length', () => {
  it('every selector: identical count or branded error', () => {
    document.body.innerHTML = FIXTURE;
    const rand = rng(SEED + 1);
    let checked = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const selector = genSelector(rand);
      const native = nativeCount(selector);

      if (native.kind === 'throws') {
        expect(() => $$(selector)).toThrow(DomsureError);
        continue;
      }

      let domsureCount: number;
      try {
        domsureCount = $$(selector).length;
      } catch (e) {
        throw new Error(`domsure threw on a native-valid selector ${JSON.stringify(selector)}: ${(e as Error).message}`);
      }
      expect(domsureCount).toBe(native.count);
      checked++;
    }

    expect(checked).toBeGreaterThan(0);
  });
});

// Deterministic edge cases — the bugs selector wrappers actually ship are
// edge cases, not random. These pin specific exotic selectors against native
// behavior. The fuzz above covers combinatorial breadth; these cover depth.
describe('deterministic exotic selectors match native', () => {
  const EDGE_FIXTURE =
    '<div id="app" class="active">' +
    '<span class="item" data-x="1" data-role="primary">a</span>' +
    '<span class="item" data-x="2">b</span>' +
    '<span class="other">c</span>' +
    '</div>';

  // Each entry: selector domsure must resolve identically to native querySelector.
  // Excluded from this list: pure-id rescue selectors (#123) — covered in
  // query.test.ts and modeled in the fuzz above.
  const EDGE_SELECTORS = [
    ':scope > .item',
    ':not(.other)',
    '[data-x="1"]',
    "[data-role='primary']",
    '[data-x]',
    '.item:not(.other)',
    '#app > .item:first-child',
    'span[class~="item"]',
    '[data-x="2"]',
    ':nth-child(2)',
  ];

  for (const selector of EDGE_SELECTORS) {
    it(`$('${selector}') matches native`, () => {
      document.body.innerHTML = EDGE_FIXTURE;
      // :scope resolves relative to document in this context; native is the oracle.
      const native = nativeQuery(selector);
      if (native.kind === 'throws') {
        expect(() => $(selector)).toThrow(DomsureError);
        return;
      }
      expect($(selector)).toBe(native.el);
    });
  }
});
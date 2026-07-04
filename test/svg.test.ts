import { describe, it, expect, beforeEach } from 'vitest';
import { $ } from '../src/query-single';
import { $$ } from '../src/query-multi';
import { DomsureError } from '../src/errors';

// SVG elements extend Element, not HTMLElement. These tests lock in the
// Phase 1 widening at runtime. jsdom defines SVGSVGElement (the root <svg>)
// but NOT SVGCircleElement / SVGPathElement, so instanceof checks for those
// are type-level only (see test/types.test.ts) and skipped at runtime here.
describe('SVG queries', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<svg id="svg" viewBox="0 0 10 10">' +
      '<circle id="c" cx="1" cy="2" r="3"></circle>' +
      '<path id="p" d="M0 0L5 5"></path>' +
      '<path id="p2" d="M1 1L4 4"></path>' +
      '</svg>';
  });

  it('$.required returns the SVGSVGElement', () => {
    const svg = $.required<SVGSVGElement>('#svg');
    expect(svg.nodeName).toBe('svg');
    expect(svg).toBeInstanceOf(SVGSVGElement);
  });

  it('$.optional finds a circle by id', () => {
    const circ = $.optional('#c');
    expect(circ).not.toBeNull();
    expect(circ!.nodeName).toBe('circle');
    expect(circ!.getAttribute('cx')).toBe('1');
  });

  it('$.optional returns null for a missing svg element', () => {
    expect($.optional('#missing-svg')).toBeNull();
  });

  it('$$.required returns all path elements', () => {
    const paths = $$.required<SVGPathElement>('path');
    expect(paths).toHaveLength(2);
    expect(paths[0].nodeName).toBe('path');
    expect(paths[1].getAttribute('d')).toBe('M1 1L4 4');
  });

  it('$$ returns empty array for a missing svg selector', () => {
    expect($$('polygon')).toEqual([]);
  });

  it('$.exists detects svg child elements', () => {
    expect($.exists('circle')).toBe(true);
    expect($.exists('polygon')).toBe(false);
  });

  it('combinator selectors resolve inside the svg subtree', () => {
    const child = $('svg > circle');
    expect(child).not.toBeNull();
    expect(child!.nodeName).toBe('circle');
  });

  it('$.required throws DomsureError for a missing svg element', () => {
    expect(() => $.required<SVGCircleElement>('#nope')).toThrow(DomsureError);
  });
});
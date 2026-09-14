import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ORDPOOL_FAMILY, ORDPOOL_FAMILY_HEADING } from 'ordpool-sdk';
import { beforeEach, describe, expect, it } from 'vitest';

import { FooterComponent } from './footer.component';

/**
 * Pins the footer's CLASS contract, the part this component controls: the
 * hardcoded self-key, the SDK-owned member source, and the lede wiring. The
 * template DOM behaviour (self-row rendered as a <span>, the others as links,
 * the dashed self-row) is verified separately against the live browser render
 * (ux-round4/cubes frames + measured contrast); this vitest setup is
 * template-compiler-free, so it exercises the class, not the rendered template.
 */
/**
 * The component's template-facing members.
 *
 * They are `protected`, which in Angular means "the template may read this,
 * code outside the class may not". These tests stand in for the template, so
 * they reach past that boundary. Doing it once, in a typed place, keeps the
 * assertions checked: a member that is renamed or changes type still fails
 * here rather than passing through an `any`.
 */
function templateView(c: FooterComponent): {
  currentKey: string;
  family: typeof ORDPOOL_FAMILY;
  familyHeading: string;
} {
  return c as unknown as ReturnType<typeof templateView>;
}

describe('FooterComponent: Ordpool family contract', () => {
  let component: FooterComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    component = TestBed.runInInjectionContext(() => new FooterComponent());
  });

  it('marks THIS site as cubes (hardcoded, never host-matched)', () => {
    // Load-bearing: the self-key decides which card renders as "you are here".
    // 'cubes' must be hardcoded so it works on localhost and preview builds,
    // where a host match would silently vanish.
    expect(templateView(component).currentKey).toBe('cubes');
  });

  it('renders all four family members from the SDK, in build order', () => {
    expect(templateView(component).family).toBe(ORDPOOL_FAMILY);
    expect(templateView(component).family.map(m => m.key)).toEqual(['ordpool', 'cat21', 'cubes', 'wallet']);
  });

  it('uses the SDK heading verbatim', () => {
    expect(templateView(component).familyHeading).toBe(ORDPOOL_FAMILY_HEADING);
  });

});

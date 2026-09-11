import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ORDPOOL_FAMILY, ORDPOOL_FAMILY_HEADING, ordpoolFamilyLede } from 'ordpool-sdk';
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
    expect(component.currentKey).toBe('cubes');
  });

  it('renders all four family members from the SDK, in build order', () => {
    expect(component.family).toBe(ORDPOOL_FAMILY);
    expect(component.family.map(m => m.key)).toEqual(['ordpool', 'cat21', 'cubes', 'wallet']);
  });

  it('uses the SDK heading verbatim', () => {
    expect(component.familyHeading).toBe(ORDPOOL_FAMILY_HEADING);
  });

  it('wires the cubes-specific lede and carries no coin-check warning', () => {
    // The maintainer removed the coin-check clause from the footer; cubes' lede
    // names what the visitor is looking at. Both facts are load-bearing.
    expect(component.familyLede).toBe(ordpoolFamilyLede('cubes'));
    expect(component.familyLede).toContain('an artsy rotating cube');
    expect(component.familyLede).not.toContain('checks what a coin is carrying');
  });
});

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ORDPOOL_FAMILY, ORDPOOL_FAMILY_HEADING, ordpoolFamilyLede } from 'ordpool-sdk';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  imports: [RouterLink],
})
export class FooterComponent {
  /** The four family members, in build order, from the SDK (single source of
   *  truth so cubes' footer cannot drift from cat21.space and ordpool.space). */
  protected readonly family = ORDPOOL_FAMILY;
  protected readonly familyHeading = ORDPOOL_FAMILY_HEADING;
  /** cubes' own lede tail ("an artsy rotating cube"), from the SDK. Carries no
   *  safety claim: the coin-check warning lives at the action in the caveat. */
  protected readonly familyLede = ordpoolFamilyLede('cubes');

  /** This site's key. Its own row renders as the current site (not a link),
   *  so the reader sees the whole set of four from here. */
  protected readonly currentKey = 'cubes';
}

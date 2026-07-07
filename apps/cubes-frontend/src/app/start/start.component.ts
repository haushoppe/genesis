import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { InscribeMintOrchestrator, WalletService } from 'ordpool-sdk';

import { InscriptionListItemComponent } from '../layout/inscription-list-item/inscription-list-item.component';
import { LoadingIndicatorComponent } from '../layout/loading-indicator/loading-indicator.component';
import { CubesDataService } from '../services/cubes-data/cubes-data.service';
import { MintFacade } from '../store/mint.facade';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  imports: [
    LoadingIndicatorComponent,
    InscriptionListItemComponent,
    NgbPagination,
    RouterLink,
  ],
  host: {
    '(window:keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartComponent {
  mintFacade = inject(MintFacade);
  walletService = inject(WalletService);
  orchestrator = inject(InscribeMintOrchestrator);
  cursor = toSignal(inject(CubesDataService).getCursor());
  connectedWallet = toSignal(this.walletService.connectedWallet$, { initialValue: null });
  wallets = toSignal(this.walletService.wallets$, {
    initialValue: { installedWallets: [], notInstalledWallets: [] },
  });

  onKeydown(event: KeyboardEvent) {
    if (isTextInputTarget(event.target)) return;
    const i = this.mintFacade.inscriptions();
    if (!i?.itemsPerPage) return;
    const lastPage = Math.ceil(i.totalInscriptions / i.itemsPerPage);
    if (event.key === 'ArrowLeft' && i.currentPage > 1) {
      this.mintFacade.loadInscriptions(i.itemsPerPage, i.currentPage - 1);
    } else if (event.key === 'ArrowRight' && i.currentPage < lastPage) {
      this.mintFacade.loadInscriptions(i.itemsPerPage, i.currentPage + 1);
    }
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

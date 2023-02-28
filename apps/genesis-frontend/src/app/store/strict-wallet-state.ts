import { WalletState, EIP1193Provider, ConnectedChain } from '@web3-onboard/core';

// the original WalletState from can't be serialized or freezed
export interface StrictWalletState {
  label: string;
  // icon: string;
  getProvider: () => EIP1193Provider;
  accounts: WalletState['accounts'];
  chains: ConnectedChain[];
  instance?: unknown;
}

export function toStrictWalletState(wallet: WalletState): StrictWalletState {
  return {
    label: wallet.label,
    // icon: wallet.icon,
    getProvider: () => wallet.provider,
    accounts: wallet.accounts,
    chains: wallet.chains,
    instance: wallet.instance
  };
}

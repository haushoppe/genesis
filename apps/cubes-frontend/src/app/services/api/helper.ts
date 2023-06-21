import BigNumber from 'bignumber.js';

import { ORDINALS_URL } from '../constant';
import { BtcTransactionData } from '../types';
import * as esplora from '../types/api/esplora';

export function sumOutputsForAddress(outputs: esplora.Vout[], address: string): number {
  let total = 0;
  outputs.forEach((output) => {
    if (output.scriptpubkey_address) {
      if (output.scriptpubkey_address === address) {
        total += output.value;
      }
    }
  });
  return total;
}

export function sumInputsForAddress(inputs: esplora.Vin[], address: string): number {
  let total = 0;
  inputs.forEach((input) => {
    if (input.prevout.scriptpubkey_address === address) {
      total += input.prevout.value;
    }
  });
  return total;
}

export function parseOrdinalsBtcTransactions(
  responseTx: esplora.Transaction,
  ordinalsAddress: string
): BtcTransactionData {
  const inputAddresses: string[] = [];
  responseTx.vin.forEach((input) => {
    if (input.prevout.scriptpubkey_address) {
      inputAddresses.push(input.prevout.scriptpubkey_address);
    }
  });
  const inputAddressSet = new Set(inputAddresses);
  const incoming = !inputAddressSet.has(ordinalsAddress);

  const outputAddresses: string[] = [];
  responseTx.vout.forEach((output) => {
    if (output.scriptpubkey_address && output.scriptpubkey_address !== ordinalsAddress) {
      outputAddresses.push(output.scriptpubkey_address);
    }
  });
  let amount = 0;
  if (incoming) {
    amount = sumOutputsForAddress(responseTx.vout, ordinalsAddress);
  } else {
    const inputAmount = sumInputsForAddress(responseTx.vin, ordinalsAddress);
    const changeAmount = sumOutputsForAddress(responseTx.vout, ordinalsAddress);
    amount = inputAmount - changeAmount;
  }

  const total = responseTx.fee + amount;

  const date = new Date(0);
  if (responseTx.status.block_time) date.setUTCSeconds(responseTx.status.block_time);

  const parsedTx: BtcTransactionData = {
    blockHash: responseTx.status.block_hash ?? '',
    blockHeight: responseTx.status.block_height ?? 0,
    txid: responseTx.txid,
    total,
    fees: responseTx.fee,
    size: responseTx.size,
    confirmed: responseTx.status.confirmed,
    inputs: responseTx.vin,
    outputs: responseTx.vout,
    seenTime: date,
    incoming: incoming,
    amount: new BigNumber(amount),
    txType: 'bitcoin',
    txStatus: responseTx.status.confirmed ? 'success' : 'pending',
    isOrdinal: true,
    recipientAddress: outputAddresses[0],
  };
  return parsedTx;
}

export function parseBtcTransactionData(
  responseTx: esplora.Transaction,
  btcAddress: string,
  ordinalsAddress: string
): BtcTransactionData {
  const inputAddresses: string[] = [];
  responseTx.vin.forEach((input) => {
    if (input.prevout.scriptpubkey_address) {
      inputAddresses.push(input.prevout.scriptpubkey_address);
    }
  });
  const inputAddressSet = new Set(inputAddresses);

  const incoming = !inputAddressSet.has(btcAddress);
  const isOrdinal = inputAddressSet.has(ordinalsAddress);

  const outputAddresses: string[] = [];
  responseTx.vout.forEach((output) => {
    if (
      output.scriptpubkey_address &&
      output.scriptpubkey_address !== btcAddress &&
      output.scriptpubkey_address !== ordinalsAddress
    ) {
      outputAddresses.push(output.scriptpubkey_address);
    }
  });

  // calculate sent/received amount from inputs/outputs
  let amount = 0;
  if (incoming) {
    amount = sumOutputsForAddress(responseTx.vout, btcAddress);
  } else {
    const inputAmount = sumInputsForAddress(responseTx.vin, btcAddress);
    const changeAmount = sumOutputsForAddress(responseTx.vout, btcAddress);
    amount = inputAmount - changeAmount;
  }

  const total = responseTx.fee + amount;
  const date = new Date(0);
  if (responseTx.status.block_time) date.setUTCSeconds(responseTx.status.block_time);

  const parsedTx: BtcTransactionData = {
    blockHash: responseTx.status.block_hash ?? '',
    blockHeight: responseTx.status.block_height ?? 0,
    txid: responseTx.txid,
    total,
    fees: responseTx.fee,
    size: responseTx.size,
    confirmed: responseTx.status.confirmed,
    inputs: responseTx.vin,
    outputs: responseTx.vout,
    seenTime: date,
    incoming: incoming,
    amount: new BigNumber(amount),
    txType: 'bitcoin',
    txStatus: responseTx.status.confirmed ? 'success' : 'pending',
    isOrdinal,
    recipientAddress: outputAddresses[0],
  };

  return parsedTx;
}

export function getFetchableUrl(uri: string, protocol: string): string | null {
  const publicIpfs = 'https://cf-ipfs.com/ipfs';
  if (protocol === 'http') return uri;
  if (protocol === 'ipfs') {
    const url = uri.split('//');
    return `${publicIpfs}/${url[1]}`;
  }
  return null;
}

export function getOrdinalImageUrl(content: string): string | null {
  return getFetchableUrl(`${ORDINALS_URL}${content}`, 'http');
}

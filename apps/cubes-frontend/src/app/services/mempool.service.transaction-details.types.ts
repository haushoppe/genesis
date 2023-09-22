export interface TransactionDetail {
  txid: string;
  version: number;
  locktime: number;
  vin: VinEntry[];
  vout: VoutEntry[];
  size: number;
  weight: number;
  fee: number;
  status: TransactionStatus;
}

export interface VinEntry {
  txid: string;
  vout: number;
  prevout: Prevout;
  scriptsig: string;
  scriptsig_asm: string;
  witness: string[];
  is_coinbase: boolean;
  sequence: number;
  inner_witnessscript_asm: string;
}

export interface Prevout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface VoutEntry {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface TransactionStatus {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}

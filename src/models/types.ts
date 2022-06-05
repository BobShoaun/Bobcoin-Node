export interface Transaction {
  hash: string;
  timestamp: number;
  version: string;
  inputs: [
    {
      txHash: string;
      outIndex: number;
      publicKey: string;
      signature: string;
    }
  ];
  outputs: [
    {
      address: string;
      amount: number;
    }
  ];
}

export interface Block {
  height: number;
  hash: string;
  previousHash: string;
  timestamp: number;
  version: string;
  difficulty: number;
  nonce: number;
  merkleRoot: string;
  transactions: Transaction[];
}

export interface TransactionInfo extends Transaction {
  inputs: [
    {
      txHash: string;
      outIndex: number;
      publicKey: string;
      signature: string;
      address: string;
      amount: number;
    }
  ];
  outputs: [
    {
      address: string;
      amount: number;
      txHash?: string;
    }
  ];
}

export interface BlockInfo extends Block {
  valid: boolean;
  transactions: TransactionInfo[];
}

export interface Utxo {
  txHash: string;
  outIndex: number;
  address: string;
  amount: number;
}

export interface FaucetEntry {
  address: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

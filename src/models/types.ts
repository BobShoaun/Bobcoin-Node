export interface Transaction {
  hash: string;
  timestamp: number;
  version: string;
  message: string;
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

export interface CandidateBlock {
  height: number;
  previousHash: string;
  timestamp: number;
  version: string;
  difficulty: number;
  merkleRoot: string;
  transactions: Transaction[];
}

export interface Block extends CandidateBlock {
  hash: string;
  nonce: number;
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

export interface PoolMiner {
  address: string;
  candidateBlock: CandidateBlock;
  shareDifficulty: number;
  numShares: number;
  previousNonce: number;
  numShareSubmissions: number;
  prevShareDiffRecalcTime: number;
}

export interface PoolReward {
  blockHash: string;
  blockHeight: number;
  minerShares: [{ address: string; numShares: number }];
}

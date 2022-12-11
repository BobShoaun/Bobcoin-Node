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

export interface Input {
  txHash: string;
  outIndex: number;
  publicKey: string;
  signature: string;
}

export interface Output {
  address: string;
  amount: number;
}

export interface TransactionInfo extends Transaction {
  inputs: [
    {
      address: string;
      amount: number;
    } & Input
  ];
  outputs: [
    {
      address: string;
      amount: number;
      txHash?: string | null;
    } & Output
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
  // totalAcceptedShares: number;
  prevShareDiffRecalcTime: number;
}

export interface PoolReward {
  blockHash: string;
  blockHeight: number;
  minerShares: [{ address: string; numShares: number }];
}

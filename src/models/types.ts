interface Transaction {
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

interface Block {
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

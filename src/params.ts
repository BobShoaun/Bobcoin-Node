// consensus parameters

/*
  infinite sum of: 
  (blkRewardHalflife * initBlkReward) / 2 ^ n 
  from n = 0 -> inf
  gives us the hardCap.

  blkRewardHalflife: 100_000
  initBlkReward: 4096 * coin
  give us hardCap: 819_200_000 * coin 

  or 

  blkRewardHalflife: 400_000
  initBlkReward: 512 * coin
  give us hardCap: 409_600_000 * coin 
  */

import { network } from "./config";

const testnetParams = {
  name: "Bobcoin",
  symbol: "XBC",
  coin: 100_000_000, // amounts are stored as the smallest unit, this is how many of the smallest unit that amounts to 1 coin.
  version: "0.2.0",
  addressPre: "06",
  checksumLen: 4,
  initBlkReward: 4096 * 100_000_000, // in coins
  blkRewardHalflife: 20, // in block height
  initBlkDiff: 1,
  initHashTarg: "0000afffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  targBlkTime: 5 * 60, // 5 minutes in seconds
  diffRecalcHeight: 10, // in block height
  minDiffCorrFact: 1 / 4,
  maxDiffCorrFact: 4,
  blkMaturity: 6, // number of blocks that has to be mined on top (confirmations + 1) to be considered matured
  hardCap: 819_200_000 * 100_000_000, // upper bound to amt of coins in circulation
  derivPurpose: 44, // bip 44
  derivCoinType: 1, // coin type for all test nets as of bip44 spec
  genesisBlock: {
    height: 0,
    hash: "000099f65f482c57e0ef074f40c42483875dc71080ec11eb6fb1baa5ed8e30f2",
    previousHash: null,
    timestamp: 1623376926309,
    version: "0.0.1",
    difficulty: 1,
    nonce: 10420,
    merkleRoot: "0618fafa470c0531b81de6022b0dd5d41b0dcb53fe2e8c81723c61c07a7755b5",
    transactions: [
      {
        hash: "de745c2aaf7c34f798c5b9e24274c2c23789d617cf2014eb98c2df4e3656efe3",
        timestamp: 1623376926308,
        version: "0.0.1",
        inputs: [],
        outputs: [
          {
            address: "8bobLqxCRPTSEhvZwQTeKnKz5429N26",
            amount: 409600000000,
          },
        ],
      },
    ],
  },
};

const mainnetParams = {
  name: "Bobcoin",
  symbol: "XBC",
  coin: 100_000_000, // amounts are stored as the smallest unit, this is how many of the smallest unit that amounts to 1 coin.
  version: "1.3.0",
  addressPre: "06",
  checksumLen: 4,
  initBlkReward: 512 * 100_000_000, // in coins
  blkRewardHalflife: 10_100, // in block height
  initBlkDiff: 1,
  initHashTarg: "000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  targBlkTime: 8 * 60, // 8 minutes in seconds
  diffRecalcHeight: 50, // in block height
  minDiffCorrFact: 1 / 4,
  maxDiffCorrFact: 4,
  blkMaturity: 6, // number of blocks that has to be mined on top (confirmations + 1) to be considered matured
  hardCap: 10_240_000 * 100_000_000, // upper bound to amt of coins in circulation
  derivPurpose: 44, // bip 44
  derivCoinType: 8888, // coin type for mainnet bobcoin
  genesisBlock: {
    height: 0,
    hash: "0000000feec941f61402e216aad021939642cfee2e97e6fc45c7a692dd3a759f",
    previousHash: null,
    timestamp: 1623366187131,
    version: "1.0.0",
    difficulty: 1,
    nonce: 18189500,
    merkleRoot: "fc0f8fbb19f660bd80feeb09ba09869dd954a7811a8451d5a77b521705c8575a",
    transactions: [
      {
        hash: "1209af6a4390ec05767e7e0908a2aabbf9793b2f328fb6fd45328315bcf29c66",
        timestamp: 1623366187129,
        version: "1.0.0",
        inputs: [],
        outputs: [
          {
            address: "8GEN8Ab66ydbi82Q3wVcVwWKpvRVphN",
            amount: 51200000000,
          },
        ],
      },
    ],
  },
};

const params = network === "mainnet" ? mainnetParams : testnetParams;

export default params;

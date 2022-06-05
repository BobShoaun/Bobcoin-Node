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

export const testnetParams = {
  name: "Bobcoin",
  symbol: "XBC",
  coin: 100_000_000, // amounts are stored as the smallest unit, this is how many of the smallest unit that amounts to 1 coin.
  version: "0.1.0",
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
};

export const mainnetParams = {
  name: "Bobcoin",
  symbol: "XBC",
  coin: 100_000_000, // amounts are stored as the smallest unit, this is how many of the smallest unit that amounts to 1 coin.
  version: "1.2.0",
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
};

const params = network === "mainnet" ? mainnetParams : testnetParams;

export default params;

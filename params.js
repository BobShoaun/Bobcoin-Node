// consensus parameters
const params = {
	name: "Bobcoin",
	symbol: "BBC", // or BCX ?
	coin: 100000000, // amounts are stored as the smallest unit, this is how many of the smallest unit that amounts to 1 coin.
	version: 1,
	addressPre: "06",
	checksumLen: 4,
	initBlkReward: 5000000000, // in coins
	blkRewardHalflife: 10, // in block height
	initBlockDiff: 1,
	initHashTarg: "000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
	targBlkTime: 5 * 60, // 5 minutes in seconds
	diffRecalcHeight: 20, // in block height
	minDiffCorrFact: 1 / 4,
	maxDiffCorrFact: 4,
};

export default params;

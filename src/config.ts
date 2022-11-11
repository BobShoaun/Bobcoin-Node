import dotenv from "dotenv";

dotenv.config();

export const network = process.env.NETWORK; // mainnet || testnet
export const port = parseInt(process.env.PORT ?? "");
export const apiKey = process.env.API_KEY;
export const mongoURI = process.env.MONGODB_URI;
export const blockPostQueuedLimit = process.env.BLOCK_POST_QUEUED_LIMIT ?? 20;
export const canRecalcCache = !process.env.npm_config_norecalc;

export const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
export const faucetSecretKey = process.env.FAUCET_SECRET_KEY;
export const faucetDonateAmount = 10_00_000_000; // in integer denomination
export const faucetFeeAmount = 10_000_000;
export const faucetCooldown = 24; // hours

export const nodeDonationPercent = 0.1;
export const nodeDonationAddress = "8WHdkueKmPjbmAH1Va9uZpC2v7Xbqkw";

// mining pool
export const poolName = "Bobcoin Official Pool";
export const poolAddress = "8GEN8Ab66ydbi82Q3wVcVwWKpvRVphN";
export const poolOperatorFeePercent = 0.1;
export const poolDifficultyPercent = 0.01;
export const poolMinDifficulty = 0.1;

export const whitelistedNodeUrls = process.env.WHITELISTED_NODE_URLS?.split(" ") ?? [];

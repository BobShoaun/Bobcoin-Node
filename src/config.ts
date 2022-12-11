import dotenv from "dotenv";

dotenv.config();

export const isProduction = process.env.NODE_ENV === "production";

export const network = process.env.NETWORK; // mainnet || testnet
export const port = parseInt(process.env.PORT ?? "");
export const apiKey = process.env.API_KEY;
export const mongoURI = process.env.MONGODB_URI;
export const blockQueueLimit = process.env.BLOCK_QUEUE_LIMIT ?? 20;
export const canRecalcCache = !process.env.npm_config_norecalc;

export const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
export const faucetSecretKey = process.env.FAUCET_SECRET_KEY;
export const faucetDonateAmount = 10_00_000_000; // in integer denomination
export const faucetFeeAmount = 10_000_000;
export const faucetCooldown = 24; // hours

export const nodeDonationPercent = 0.1;
export const nodeDonationAddress = process.env.NODE_DONATION_ADDRESS;

// mining pool
export const poolSecretKey = process.env.POOL_SECRET_KEY;
export const poolPublicKey = process.env.POOL_PUBLIC_KEY;
export const poolAddress = process.env.POOL_ADDRESS;
export const poolTargetShareTime = 30; // seconds
export const poolShareDifficultyRecalcFreq = 5; // every 5 accepted share submission
export const poolOperatorFeePercent = 0.1;

export const whitelistedNodeUrls = process.env.WHITELISTED_NODE_URLS?.split(" ") ?? [];

import dotenv from "dotenv";

dotenv.config();

export const network = process.env.NETWORK; // mainnet || testnet
export const port = parseInt(process.env.PORT);
export const apiKey = process.env.API_KEY;
export const mongoURI = process.env.MONGODB_URI;

export const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
export const faucetSecretKey = process.env.FAUCET_SECRET_KEY;
export const faucetDonateAmount = 10_00_000_000; // in integer denomination
export const faucetFeeAmount = 10_000_000;
export const faucetCooldown = 24; // hours

export const whitelistedNodeUrls = process.env.WHITELISTED_NODE_URLS?.split(" ") ?? [];

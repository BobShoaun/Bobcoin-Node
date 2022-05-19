import dotenv from "dotenv";

dotenv.config();

export const mainnetURI = process.env.MAINNET_MONGO_URI;
export const testnetURI = process.env.TESTNET_MONGO_URI;

export const network = process.env.NETWORK; // mainnet || testnet
export const port = process.env.PORT || network === "mainnet" ? 3001 : 3002;

export const mongoURI = network === "mainnet" ? mainnetURI : testnetURI;

export const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
export const faucetSecretKey = process.env.FAUCET_SECRET_KEY;
export const faucetDonateAmount = 100_00_000_000; // in smallest denomination
export const faucetFeeAmount = 10_000_000;
export const faucetCooldown = 24; // hours

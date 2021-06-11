import dotenv from "dotenv";

dotenv.config();

export const port = process.env.PORT || 3001;

export const mainnetAtlas = process.env.MAINNET_ATLAS;
export const testnetAtlas = process.env.TESTNET_ATLAS;

export const network = process.env.NETWORK; // mainnet || testnet

export const atlasURI = network === "mainnet" ? mainnetAtlas : testnetAtlas;

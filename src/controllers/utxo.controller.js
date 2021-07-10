import BlockCrypto from "blockcrypto";

import params from "../params.js";

const { createBlockchain, calculateMempoolUTXOSet, getHighestValidBlock } = BlockCrypto;

export const getUTXOs = (locals, address) => locals.utxos.filter(utxo => utxo.address === address);

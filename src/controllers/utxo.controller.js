export const getUTXOs = (locals, address) => locals.utxos.filter(utxo => utxo.address === address);

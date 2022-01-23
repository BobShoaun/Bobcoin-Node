export const getUtxos = (locals, address) => locals.utxos.filter(utxo => utxo.address === address);

const utxoInMempool = (locals, utxo) => {
  for (const transaction of locals.mempool) {
    for (const input of transaction.inputs) {
      if (input.txHash !== utxo.txHash) continue;
      if (input.outIndex !== utxo.outIndex) continue;
      return true;
    }
  }
  return false;
};

export const getMempoolUtxos = (locals, address) =>
  locals.utxos.filter(utxo => utxo.address === address && !utxoInMempool(locals, utxo));

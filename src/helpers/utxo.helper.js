const utxoInMempool = (mempool, utxo) => {
  for (const transaction of mempool) {
    for (const input of transaction.inputs) {
      if (input.txHash !== utxo.txHash) continue;
      if (input.outIndex !== utxo.outIndex) continue;
      return true;
    }
  }
  return false;
};

/**
 * Get all utxos of address, accounting for if its already in the mempool, and new utxos resulting from the mempool
 *
 * sort them by recommended usage priority, small amount -> big amount, confirmed -> in mempool
 */
export const getUtxosFactoringMempool = (utxos, mempool, address) => {
  const _utxos = utxos.filter(utxo => utxo.address === address && !utxoInMempool(mempool, utxo)); // confirmed utxos
  for (const transaction of mempool) {
    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i];
      if (output.address !== address) continue;
      _utxos.push({
        txHash: transaction.hash,
        outIndex: i,
        address,
        amount: output.amount,
        mempool: true,
      });
    }
  }

  _utxos.sort((a, b) => (a.mempool !== b.mempool ? (a.mempool ? 1 : -1) : a.amount - b.amount));
  return _utxos;
};

export const getMempoolUtxos = mempool => {
  const utxos = [];
  for (const transaction of mempool) {
    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i];
      utxos.push({
        txHash: transaction.hash,
        outIndex: i,
        address: output.address,
        amount: output.amount,
      });
    }
  }
  return utxos;
};

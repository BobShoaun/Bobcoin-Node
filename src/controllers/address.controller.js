import { TransactionInfo } from "../models/index.js";

export const getAddressInfo = async (locals, address) => {
  const utxos = await getAddressUtxos(locals, address);
  const transactions = await getAddressTransactions(address);

  const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);
  const totalReceived = transactions.reduce(
    (total, { outputs }) =>
      total +
      outputs
        .filter(output => output.address === address)
        .reduce((total, output) => total + output.amount, 0),
    0
  );
  const totalSent = transactions.reduce(
    (total, { inputs }) =>
      total +
      inputs
        .filter(input => input.address === address)
        .reduce((total, input) => total + input.amount, 0),
    0
  );

  const numUtxos = utxos.length;
  const numTransactions = transactions.length;
  const numBlocksMined = transactions.filter(
    tx => tx.inputs.length === 0
  ).length;

  return {
    balance,
    totalReceived,
    totalSent,
    numUtxos,
    numTransactions,
    numBlocksMined,
  };
};

export const getAddressUtxos = async (locals, address) => {
  const utxos = locals.utxos.filter(utxo => utxo.address === address);
  return utxos;
};

export const getAddressTransactions = async (
  address,
  limit = 0,
  offset = 0
) => {
  const transactions = await TransactionInfo.find(
    {
      $or: [{ "inputs.address": address }, { "outputs.address": address }],
      status: { $ne: "orphaned" },
    },
    { _id: false }
  )
    .sort({ timestamp: -1 })
    .skip(offset > 0 ? offset : 0)
    .limit(limit > 0 ? limit : 0);
  return transactions;
};

export const getWalletInfo = async (locals, addresses) => {
  const utxos = locals.utxos.filter(utxo => addresses.includes(utxo.address));
  const transactions = await TransactionInfo.find(
    {
      $or: [
        { "inputs.address": { $in: addresses } },
        { "outputs.address": { $in: addresses } },
      ],
      status: { $ne: "orphaned" },
    },
    { _id: false }
  );
  return { utxos, transactions };
};

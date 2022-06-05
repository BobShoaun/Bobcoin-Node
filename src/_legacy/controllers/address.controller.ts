// @ts-nocheck
import { TransactionInfo } from "../models/index";

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
  const numBlocksMined = transactions.filter(tx => tx.inputs.length === 0).length;

  return {
    balance,
    totalReceived,
    totalSent,
    numUtxos,
    numTransactions,
    numBlocksMined,
  };
};

export const getAddressesInfo = async (locals, addresses) => {
  const utxos = await getAddressesUtxos(locals, addresses);
  const transactions = await getAddressesTransactions(addresses);

  const balance = utxos.reduce((total, utxo) => total + utxo.amount, 0);
  const totalReceived = transactions.reduce(
    (total, { outputs }) =>
      total +
      outputs
        .filter(output => addresses.includes(output.address))
        .reduce((total, output) => total + output.amount, 0),
    0
  );
  const totalSent = transactions.reduce(
    (total, { inputs }) =>
      total +
      inputs
        .filter(input => addresses.includes(input.address))
        .reduce((total, input) => total + input.amount, 0),
    0
  );

  const numUtxos = utxos.length;
  const numTransactions = transactions.length;
  const numBlocksMined = transactions.filter(tx => tx.inputs.length === 0).length;

  const numAddressTransactions = new Map();
  for (const address of addresses) {
    const addressTransactions = transactions.filter(({ outputs }) =>
      outputs.some(output => output.address === address)
    );
    numAddressTransactions.set(address, addressTransactions.length);
  }

  return {
    balance,
    totalReceived,
    totalSent,
    numUtxos,
    numTransactions,
    numBlocksMined,
    numAddressTransactions: Object.fromEntries(numAddressTransactions),
  };
};

export const getAddressUtxos = async (locals, address) =>
  locals.utxos.filter(utxo => utxo.address === address);

export const getAddressesUtxos = async (locals, addresses) =>
  locals.utxos.filter(utxo => addresses.includes(utxo.address));

export const getAddressTransactions = (address, limit = 0, offset = 0) =>
  TransactionInfo.find(
    {
      $or: [{ "inputs.address": address }, { "outputs.address": address }],
      status: { $ne: "orphaned" },
    },
    { _id: false }
  )
    .sort({ timestamp: -1 })
    .skip(offset > 0 ? offset : 0)
    .limit(limit > 0 ? limit : 0);

export const getAddressesTransactions = (addresses, limit = 0, offset = 0) =>
  TransactionInfo.find(
    {
      $or: [{ "inputs.address": { $in: addresses } }, { "outputs.address": { $in: addresses } }],
      status: { $ne: "orphaned" },
    },
    { _id: false }
  )
    .sort({ timestamp: -1 })
    .skip(offset > 0 ? offset : 0)
    .limit(limit > 0 ? limit : 0);

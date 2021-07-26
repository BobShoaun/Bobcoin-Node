import { TransactionInfo } from "../models/index.js";

export const getAddressInfo = async (locals, address) => {
	const utxos = locals.utxos.filter(utxo => utxo.address === address);
	const transactions = await TransactionInfo.find(
		{
			$or: [{ "inputs.address": address }, { "outputs.address": address }],
			status: { $ne: "orphaned" },
		},
		{ _id: false }
	);
	return { utxos, transactions };
};

export const getWalletInfo = async (locals, addresses) => {
	const utxos = locals.utxos.filter(utxo => addresses.includes(utxo.address));
	const transactions = await TransactionInfo.find(
		{
			$or: [{ "inputs.address": { $in: addresses } }, { "outputs.address": { $in: addresses } }],
			status: { $ne: "orphaned" },
		},
		{ _id: false }
	);
	return { utxos, transactions };
};

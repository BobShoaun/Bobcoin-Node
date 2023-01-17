import axios from "axios";
import { mineBlock, calculateHashTarget, bigIntToHex64 } from "blockcrypto";
import params from "../params";
import { VCODE } from "../helpers/validation-codes";

const nodeUrl = "http://localhost:3001";
const miner = "9FDQigFN6krhH1XKgPq96SCyuqhAjhV";
const initialPreviousBlockHash = "0000000d558e7b071a6768545ff6f1ddd4b1930a46027942c6a199a88e05dcfd";

(async () => {
  let previousBlockHash = initialPreviousBlockHash;

  while (previousBlockHash) {
    const { data } = await axios.post(new URL("/mine/candidate-block", nodeUrl).toString(), {
      miner,
      previousBlockHash,
    });
    const { validation: candidateBlockValidation, candidateBlock } = data;

    if (candidateBlockValidation.code !== VCODE.VALID) {
      console.error("candidate block invalid", candidateBlock);
      return;
    }

    const target = calculateHashTarget(params, candidateBlock);
    console.log("hash target", bigIntToHex64(target));

    let block = candidateBlock;
    for (block of mineBlock(block, target)) {
      if (block.nonce % 1000000 === 0 && block.nonce > 0) console.log("nonce reached", block.nonce);
    }
    console.log("success", block);

    const { validation: blockValidation, blockInfo } = (await axios.post(new URL("/block", nodeUrl).toString(), block))
      .data;

    if (blockValidation.code !== VCODE.VALID) {
      console.error("mined block invalid", blockInfo);
      return;
    }

    previousBlockHash = blockInfo.hash;
  }
})();

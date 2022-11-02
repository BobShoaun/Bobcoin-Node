export const VCODE = {
  BK00: 0,
  BK01: 1,
  BK02: 2,
  BK03: 3,
  BK04: 4,
  BK05: 5,
  BK06: 6,
  BK07: 7,

  TX00: 100,
  TX01: 101,
  TX02: 102,
  TX03: 103,
  TX04: 104,
  TX05: 105,
  TX06: 106,
  TX07: 107,
  TX08: 108,
  TX09: 109,
  TX10: 110,
  TX11: 111,

  CB00: 200,
  CB01: 201,
  CB02: 202,
  CB03: 203,
  CB04: 204,
  CB05: 205,
  CB06: 206,
  CB07: 207,

  BC00: 300,
  BC01: 301,
  BC02: 302,
  BC03: 303,
  BC04: 304,
  BC05: 305,

  VALID: 400,
};

export const mapVCode = (code, ...args) => {
  switch (code) {
    // block
    case VCODE.BK00:
      return { code, msg: "no previous block hash." };
    case VCODE.BK01:
      return { code, msg: "no timestamp." };
    case VCODE.BK02:
      return { code, msg: "no version." };
    case VCODE.BK03:
      return { code, msg: "no transactions." };
    case VCODE.BK04:
      return { code, msg: `invalid difficulty, expected: ${args[0]}, actual: ${args[1]}.` };
    case VCODE.BK05:
      return { code, msg: `invalid block hash.` };
    case VCODE.BK06:
      return { code, msg: `invalid merkle root.` };
    case VCODE.BK07:
      return { code, msg: `hash not within target of ${args[0]}.` };

    // transaction
    case VCODE.TX00:
      return { code, msg: "no inputs." };
    case VCODE.TX01:
      return { code, msg: "no outputs." };
    case VCODE.TX02:
      return { code, msg: "no timestamp." };
    case VCODE.TX03:
      return { code, msg: "no version." };
    case VCODE.TX04:
      return { code, msg: "invalid hash." };
    case VCODE.TX05:
      return { code, msg: `UTXO not found for input ${args[0]}:${args[1]}.` };
    case VCODE.TX06:
      return { code, msg: "input has invalid public key." };
    case VCODE.TX07:
      return { code, msg: "invalid signature." };
    case VCODE.TX08:
      return { code, msg: "output address invalid." };
    case VCODE.TX09:
      return { code, msg: "output amount is negative or zero." };
    case VCODE.TX10:
      return { code, msg: `input is ${args[0]} and output is ${args[1]}` };
    case VCODE.TX11:
      return { code, msg: `input ${args[0]}:${args[1]} already spent.` };

    // case VCODE.TX07:
    //   return { code, msg: "more than one sender" };

    // coinbase transaction
    case VCODE.CB00:
      return { code, msg: "no timestamp." };
    case VCODE.CB01:
      return { code, msg: "no version." };
    case VCODE.CB02:
      return { code, msg: "contains inputs." };
    case VCODE.CB03:
      return { code, msg: "invalid output count." };
    case VCODE.CB04:
      return { code, msg: "invalid hash." };
    case VCODE.CB05:
      return { code, msg: "invalid miner address." };
    case VCODE.CB06:
      return { code, msg: "output amount is negative or zero." };
    case VCODE.CB07:
      return { code, msg: `invalid block reward, expected: ${args[0]} actual: ${args[1]}` };

    // blockchain
    case VCODE.BC00:
      return { code, msg: "more or less than 1 genesis block." };
    case VCODE.BC01:
      return { code, msg: "previous block not found in blockchain." };
    case VCODE.BC02:
      return { code, msg: "invalid timestamp w.r.t. previous block." };
    case VCODE.BC03:
      return { code, msg: "blockchain contains disconnected blocks." };
    case VCODE.BC04:
      return { code, msg: "block already in blockchain." };
    case VCODE.BC05:
      return { code, msg: "invalid height w.r.t. previous block." };

    // valid
    case VCODE.VALID:
      return { code, msg: "valid!" };

    default:
      console.log("ERROR, invalid code");
  }
};

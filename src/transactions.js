const CryptoJS = require("crypto-js"),
  elliptic = require("elliptic"),
  _ = require("lodash"),
  utils = require("./utils");

const ec = new elliptic.ec("secp256k1");

// 마이닝 성공시 보상 갯수
const COINBASE_AMOUNT = 50;

class TxOut {
  constructor(address, amount) {
    this.address = address;
    this.amount = amount;
  }
}

class TxIn {
  // txOutId
  // txOutIndex
  // signature
}

class Transaction {
  // ID
  // Txins[]
  // Txouts []
}

class UTxOut {
  constructor(txOutId, txOutIndex, address, amount) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.address = address;
    this.amount = amount;
  }
}

const getTxId = tx => {
  const txInsContent = tx.txIns
    .map(txIn => txIn.txOutId + txIn.txOutIndex)
    .reduce((a, b) => a + b, "");
  const txOutContent = tx.txOuts
    .map(txOut => txOut.address + txOut.amount)
    .reduce((a, b) => a + b, "");

  return CryptoJS.SHA256(txInsContent + txOutContent + tx.timestamp).toString();
};

// UtxOutput find
const findUTxout = (txOutId, txOutIndex, uTxOutList) => {
  return uTxOutList.find(
    uTxO => uTxO.txOutId === txOutId && uTxO.txOutIndex === txOutIndex
  );
};

const signTxIn = (tx, txInIndex, privateKey, uTxOutList) => {
  const txIn = tx.txIns[txInIndex];
  const dataToSign = tx.id;
  const referencedUTxOut = findUTxout(
    txIn.txOutId,
    txIn.txOutIndex,
    uTxOutList
  );
  if (referencedUTxOut === null || referencedUTxOut === undefined) {
    throw Error("Couldn't find the referenced uTxOut, not signing");
    return;
  }

  const referencedAddress = referencedUTxOut.address;
  if (getPublicKey(privateKey) !== referencedAddress) {
    return false;
  }
  const key = ec.keyFromPrivate(privateKey, "hex");
  const signature = utils.toHexString(key.sign(dataToSign).toDER());
  return signature;
};

const getPublicKey = privateKey => {
  return ec.keyFromPrivate(privateKey, "hex").getPublic().encode("hex");
};

const updateUTxOuts = (newTxs, uTxOutList) => {
  const newUTxOuts = newTxs
    .map(tx =>
      tx.txOuts.map(
        (txOut, index) => new UTxOut(tx.id, index, txOut.address, txOut.amount)
      )
    )
    .reduce((a, b) => a.concat(b), []);

  const spentTxOuts = newTxs
    .map(tx => tx.txIns)
    .reduce((a, b) => a.concat(b), [])
    .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

  const resultingUTxOuts = uTxOutList
    .filter(uTxO => !findUTxout(uTxO.txOutId, uTxO.txOutIndex, spentTxOuts))
    .concat(newUTxOuts);

  return resultingUTxOuts;
};

const isTxInStructureValid = txIn => {
  if (txIn === null) {
    return false;
  } else if (typeof txIn.signature !== "string") {
    return false;
  } else if (typeof txIn.txOutId !== "string") {
    return false;
  } else if (typeof txIn.txOutIndex !== "number") {
    return false;
  } else {
    return true;
  }
};

const isAddressValid = address => {
  if (address.length !== 130) {
    return false;
  } else if (address.match("^[a-fA-F0-9]+$") === null) {
    return false;
  } else if (!address.startsWith("04")) {
    return false;
  } else {
    return true;
  }
};

const isTxOutStructureValid = txOut => {
  console.dir(typeof txOut);
  if (txOut === null) {
    console.log("TxOut is null");
    return false;
  } else if (typeof txOut.address !== "string") {
    console.log(typeof txOut.address);
    console.log("address가 문자열이 아닙니다.");
    return false;
  } else if (!isAddressValid(txOut.address)) {
    console.log("유효한 주소가 아닙니다.");
    return false;
  } else if (typeof txOut.amount !== "number") {
    console.log("수량이 숫자 타입이 아닙니다.");
    return false;
  } else {
    return true;
  }
};

const isTxStructureValid = tx => {
  if (typeof tx.id !== "string") {
    console.log("TX ID가 유효하지 않습니다.");
    return false;
  } else if (!(tx.txIns instanceof Array)) {
    console.log("TX Input가 Array가 아닙니다.");
    return false;
  } else if (
    !tx.txIns.map(isTxInStructureValid).reduce((a, b) => a && b, true)
  ) {
    console.log("하나이상의 TX INPUT의 구조가 유효하지 않습니다.");
    return false;
  } else if (!(tx.txOuts instanceof Array)) {
    console.log("TX OUTPUT이 Array가 아닙니다.");
    return false;
  } else if (
    !tx.txOuts.map(isTxOutStructureValid).reduce((a, b) => a && b, true)
  ) {
    console.log("하나이상의 TX OUTPUT의 구조가 유효하지 않습니다.");
    return false;
  } else {
    return true;
  }
};

const validateTxIn = (txIn, tx, uTxOutList) => {
  const wantedTxOut = uTxOutList.find(
    uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex
  );

  if (wantedTxOut === undefined) {
    return false;
  } else {
    const address = wantedTxOut.address;
    const key = ec.keyFromPublic(address, "hex");
    return key.verify(tx.id, txIn.signature);
  }
};

const getAmountInTxIn = (txIn, uTxOutList) =>
  findUTxout(txIn.txOutId, txIn.txOutIndex, uTxOutList).amount;

const validateTx = (tx, uTxOutList) => {
  if (!isTxStructureValid(tx)) {
    return false;
  }
  if (getTxId(tx) !== tx.id) {
    return false;
  }

  const hasValidTxIns = tx.txIns.map(txIn =>
    validateTxIn(txIn, tx, uTxOutList)
  );

  if (!hasValidTxIns) {
    return false;
  }

  const amountInTxIns = tx.txIns
    .map(txIn => getAmountInTxIn(txIn, uTxOutList))
    .reduce((a, b) => a + b, 0);
  const amountInTxOuts = tx.txOuts
    .map(txOut => txOut.amount)
    .reduce((a, b) => a + b, 0);

  if (amountInTxIns !== amountInTxOuts) {
    return false;
  } else {
    return true;
  }
};

// 채굴 보상으로 주는 TX 유효성 검증
// const validateCoinbaseTx = (tx, blockIndex) => {
//   if (getTxId(tx) !== tx.id) {
//     console.log("Invalid Coinbase tx ID");
//     return false;
//   } else if (tx.txIns.length !== 1) {
//     console.log("Coinbase TX should only have one input");
//     return false;
//   } else if (tx.txIns[0].txOutIndex !== blockIndex) {
//     console.log(
//       "The txOutIndex of the Coinbase Tx should be the same as the Block Index"
//       +"tx.txIns.length :::: " + tx.txIns.length
//       +"tx.txIns[0].txOutIndex :::: " + tx.txIns[0].txOutIndex
//       +"blockIndex ::::::: " +blockIndex
//     );
//     return false;
//   } else if (tx.txOuts.length !== 1) {
//     console.log("Coinbase TX should only have one output");
//     return false;
//   } else if (tx.txOuts[0].amount !== COINBASE_AMOUNT) {
//     console.log(
//       `Coinbase TX should have an amount of only ${COINBASE_AMOUNT} and it has ${
//         tx.txOuts[0].amount
//       }`
//     );
//     return false;
//   } else {
//     return true;
//   }
// };

const validateCoinbaseTx = (tx, blockIndex) => {
  if (getTxId(tx) !== tx.id) {
    console.log("Invalid Coinbase tx ID");
    return false;
  } else if (tx.txIns.length !== 1) {
    console.log("Coinbase TX should only have one input");
    return false;
  } else if (tx.txIns[0].txOutIndex !== blockIndex) {
    console.log(
      "The txOutIndex of the Coinbase Tx should be the same as the Block Index"
    );
    return false;
  } else if (tx.txOuts.length !== 1) {
    console.log("Coinbase TX should only have one output");
    return false;
  } else if (tx.txOuts[0].amount !== COINBASE_AMOUNT) {
    console.log(
      `Coinbase TX should have an amount of only ${COINBASE_AMOUNT} and it has ${tx
        .txOuts[0].amount}`
    );
    return false;
  } else {
    return true;
  }
};

// 채굴 보상 Tx
const createCoinbaseTx = (address, blockIndex) => {
  const tx = new Transaction();
  const txIn = new TxIn();
  txIn.signature = "";
  txIn.txOutId = "";
  txIn.txOutIndex = blockIndex;
  tx.txIns = [txIn];
  tx.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
  tx.id = getTxId(tx);
  return tx;
};

// 이중 지불 방지
const hasDuplicates = txIns => {
  const groups = _.countBy(txIns, txIn => txIn.txOutId + txIn.txOutIndex);
  return _(groups)
    .map(value => {
      if (value > 1) {
        console.log("이중 지불 발견");
        return true;
      } else {
        return false;
      }
    })
    .includes(true);
};
// 블록 트랜젝션 유효성 검증
const validateBlockTxs = (txs, uTxOutList, blockIndex) => {
  const coinbaseTx = txs[0];
  console.dir(coinbaseTx);
  if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
    console.log("채굴보상 Tx가 유효하지 않습니다.");
  }
  const txIns = _(txs).map(tx => tx.txIns).flatten().value();

  if (hasDuplicates(txIns)) {
    console.log("중복 트랜잭션 발견");
    return false;
  }

  const nonCoinbaseTxs = txs.slice(1);

  return nonCoinbaseTxs
    .map(tx => validateTx(tx, uTxOutList))
    .reduce((a, b) => a + b, true);
};

// Tx 처리
const processTxs = (txs, uTxOutList, blockIndex) => {
  // console.log("txs ::::::::: " + typeof txs);
  // console.log("txs ::::::::: " + typeof txs);
  if (!validateBlockTxs(txs, uTxOutList, blockIndex)) {
    return null;
  }
  return updateUTxOuts(txs, uTxOutList);
};

module.exports = {
  getPublicKey,
  getTxId,
  signTxIn,
  TxIn,
  Transaction,
  TxOut,
  createCoinbaseTx,
  processTxs,
  validateTx
};

const CryptoJS = require("crypto-js"),
  _ = require("lodash"),
  Wallet = require("./wallet"),
  Mempool = require("./mempool"),
  Transactions = require("./transactions"),
  hexToBinary = require("hex-to-binary");

const {
  getBalance,
  getPublicFromWallet,
  createTx,
  getPrivateFromWallet
} = Wallet;

const { createCoinbaseTx, processTxs } = Transactions;

const { addToMempool, getMempool, updateMempool } = Mempool;

//블록이 채굴되는 시간(ex 비트코인은 20분 나는 10초)
const BLOCK_GENERATION_INTERVAL = 10;
// 난이도 조정을하는 블록의 수 (ex 비트코인은 2016블럭마다 재계산)
const DIFFICULTY_ADJUSMENT_INTERVAL = 10;

//블록 구조 클래스
class Block {
  constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }
}

const genesisTx = {
  txIns: [{ signature: "", txOutId: "", txOutIndex: 0 }],
  txOuts: [
    {
      address:
        "043f41cb9ff89a412733ef96bbf2de36feef5471bc1bc92d01b32a0818d6a16d17df5f8642ddcb9d716a81174945185d13f928c1527dca95476dbb65ad045e41bf",
      amount: 50
    }
  ],
  id: "4645b688490362034a1efc6e5774467480cb8b7a319eda85b1e83b395d081380"
};

// Genesis Blcok 생성
const genesisBlock = new Block(
  0,
  "bc1bbc795b43dd41a3cea7cee196b58f2e464c982199ec06048601ccd13aaaed",
  "",
  1544495848,
  [genesisTx],
  0,
  0
);

let blockchain = [genesisBlock];

let uTxOuts = processTxs(blockchain[0].data, [], 0);

//가장 최신 블록 정보 가져오기
const getNewestBlock = () => blockchain[blockchain.length - 1];
// 블록생성시점 타임스템프 가져오기
const getTimestamp = () => Math.round(new Date().getTime() / 1000);
// 블록체인 가져오기
const getBlockchain = () => blockchain;
// 블록생성시 필요한 hash 생성
const createHash = (index, previousHash, timestamp, data, difficulty, nonce) =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
  ).toString();

// 채굴 보상 블록 생성
const createNewBlock = () => {
  const coinbaseTx = createCoinbaseTx(
    getPublicFromWallet(),
    getNewestBlock().index + 1
  );
  const blockData = [coinbaseTx].concat(getMempool());
  return createNewRawBlock(blockData);
};

//신규블록 생성
const createNewRawBlock = data => {
  const previousBlock = getNewestBlock();
  const newBlockIndex = previousBlock.index + 1;
  const newTimestamp = getTimestamp();
  const difficulty = findDifficulty();
  const newBlock = findBlock(
    newBlockIndex,
    previousBlock.hash,
    newTimestamp,
    data,
    difficulty
  );
  addBlockToChain(newBlock);
  require("./p2p").broadcastNewBlock();
  return newBlock;
};

//난이도 조절 함수
const findDifficulty = () => {
  const newestBlock = getNewestBlock();
  if (
    newestBlock.index % DIFFICULTY_ADJUSMENT_INTERVAL === 0 &&
    newestBlock.index !== 0
  ) {
    return calculateNewDifficulty(newestBlock, getBlockchain());
  } else {
    return newestBlock.difficulty;
  }
};

//난이도 계산
const calculateNewDifficulty = (newestBlock, blockchain) => {
  const lastCalculatedBlock =
    blockchain[blockchain.length - DIFFICULTY_ADJUSMENT_INTERVAL];
  const timeExpected =
    BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSMENT_INTERVAL; //블록생성 시간을 100초로 설정
  const timeTaken = newestBlock.timestamp - lastCalculatedBlock.timestamp;
  if (timeTaken < timeExpected / 2) {
    return lastCalculatedBlock.difficulty + 1;
  } else if (timeTaken > timeExpected * 2) {
    return lastCalculatedBlock.difficulty - 1;
  } else {
    return lastCalculatedBlock.difficulty;
  }
};

//블록 찾기
const findBlock = (index, previousHash, timestamp, data, difficulty) => {
  let nonce = 0;
  while (true) {
    console.log("Current nonce", nonce);
    const hash = createHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    );
    //해시 난이도가 맞는지 체크
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(
        index,
        hash,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce
      );
    }
    nonce++;
  }
};

//
const hashMatchesDifficulty = (hash, difficulty) => {
  const hashInBinary = hexToBinary(hash);
  const requiredZeros = "0".repeat(difficulty);
  console.log("Difficulty ::::", difficulty, "::: Hash ::::", hashInBinary);
  return hashInBinary.startsWith(requiredZeros);
};
// 블록 해쉬 가져오기
const getBlocksHash = block =>
  createHash(
    block.index,
    block.previousHash,
    block.timestamp,
    block.data,
    block.difficulty,
    block.nonce
  );
// 타임스탬프의 유효성 검증
const isTimeStampvalid = (newBlock, oldBlock) => {
  return (
    oldBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < getTimestamp()
  );
};

// 신규생성된 블록 유효성 검증
const isBlockValid = (candidateBlock, latestBlock) => {
  if (!isBlockStructureValid(candidateBlock)) {
    console.log("후보블록의 구조가 유효하지 않습니다.");
    return false;
  } else if (latestBlock.index + 1 !== candidateBlock.index) {
    console.log("후보블록의 인덱스가 유효하지 않습니다.");
    return false;
  } else if (latestBlock.hash !== candidateBlock.previousHash) {
    console.log("후보블록의 이전블록해시가 최근블록 해쉬와 맞지 않습니다.");
    return false;
  } else if (getBlocksHash(candidateBlock) !== candidateBlock.hash) {
    console.log("후보블록의 해쉬가 유효하지 않습니다.");
    return false;
  } else if (!isTimeStampvalid(candidateBlock, latestBlock)) {
    console.log("타임스탬프가 조작된듯.");
    return false;
  }
  return true;
};

// 블록 구조 유효성 검증
const isBlockStructureValid = block => {
  // console.log("typeof block.index ::::::::: " + typeof block.index);
  // console.log("typeof block.hash ::::::::" + typeof block.hash);
  // console.log("typeof block.previousHash :::::" + typeof block.previousHash);
  // console.log("typeof block.timestamp ::::" + typeof block.timestamp);
  // console.log("typeof block.data ::::::" + typeof block.data);
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
  );
};

// 체인의 유효성 검증
const isChainValid = candidateChain => {
  const isGenesisValid = block => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };
  if (!isGenesisValid(candidateChain[0])) {
    console.log("후보체인의 제네시스블록이 유효하지 않습니다.");
    return null;
  }

  let foreignUTxOuts = [];

  // 제네시스 블록은 제외하고 검증시작
  for (let i = 0; i < candidateChain.length; i++) {
    const currentBlock = candidateChain[i];
    if (i !==0 && !isBlockValid(currentBlock, candidateChain[i - 1])) {
      return null;
    }

    foreignUTxOuts = processTxs(
      currentBlock.data,
      foreignUTxOuts,
      currentBlock.index
    );

    if (foreignUTxOuts === null) {
      return null;
    }
  }
  return foreignUTxOuts;
};

// 체인교체시에 난이도가 높은 블록을 고려하기 위함
const sumDifficulty = anyBlockchain =>
  anyBlockchain
    .map(block => block.difficulty)
    .map(difficulty => Math.pow(2, difficulty))
    .reduce((a, b) => a + b);

// 항상 가장긴 체인을 선택
const replaceChain = candidateChain => {
  const foreignUTxOuts = isChainValid(candidateChain);
  const validChain = foreignUTxOuts !== null;
  if (
    validChain &&
    // candidateChain.length > getBlockchain().length
    sumDifficulty(candidateChain) > sumDifficulty(getBlockchain())
  ) {
    blockchain = candidateChain;
    uTxOuts = foreignUTxOuts;
    updateMempool(uTxOuts);
    require("./p2p").broadcastNewBlock();
    return true;
  } else {
    return false;
  }
};
// 체인에 블록을 추가
const addBlockToChain = candidateBlock => {
  if (isBlockValid(candidateBlock, getNewestBlock())) {
    const processedTxs = processTxs(
      candidateBlock.data,
      uTxOuts,
      candidateBlock.index
    );
    if (processedTxs === null) {
      console.log("처리할 Txr가 없습니다.");
      return false;
    } else {
      blockchain.push(candidateBlock);
      uTxOuts = processedTxs;
      updateMempool(uTxOuts);
      return true;
    }
    return true;
  } else {
    return false;
  }
};

const getUTxOutList = () => _.cloneDeep(uTxOuts);
const getAccountBalance = () => getBalance(getPublicFromWallet(), uTxOuts);
const sendTx = (address, amount) => {
  const tx = createTx(
    address,
    amount,
    getPrivateFromWallet(),
    getUTxOutList(),
    getMempool()
  );
  addToMempool(tx, getUTxOutList());
  require("./p2p").broadcastMempool();
  return tx;
};

const handleIncomingTx = tx => {
  addToMempool(tx, getUTxOutList());
};

module.exports = {
  getNewestBlock,
  getBlockchain,
  createNewBlock,
  isBlockStructureValid,
  addBlockToChain,
  replaceChain,
  getAccountBalance,
  sendTx,
  handleIncomingTx,
  getUTxOutList
};

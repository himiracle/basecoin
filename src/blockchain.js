const cryptoJS = require('crypto-js');
//블록 구조 클래스
class Block {
    constructor(index, hash, previousHash, timestamp, data) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
    }
}

// Genesis Blcok 생성
const genesisBlock = new Block(
    0,
    "2C4CEB90344F20CC4C77D626247AED3ED530C1AEE3E6E85AD494498B17414CAC",
    null,
    1520312194926,
    "This is the genesis!!"
)

let blockchain = [genesisBlock];

//가장 최신 블록 정보 가져오기
const getLastBlock = () => blockchain[blockchain.length - 1];
// 블록생성시점 타임스템프 가져오기
const getTimestamp = () => new Date().getTimeStamp / 1000;
// 블록생성시 필요한 hash 생성
const createHash = (index, previousHash, timestamp, data) =>
    cryptoJS(index+previousHash+timestamp+data).toString();
//신규블록 생성
const createNewBlock = data => {
    const previousBlock = getLastBlock();
    const newBlcokIndex = previousBlock.index + 1;
    const newTimestamp = getTimestamp();
    const newHash = createHash(
        newBlcokIndex,
        previousBlock.hash,
        newTimestamp,
        data
    )

    const newBlock = new Block(
        newBlcokIndex,
        newHash,
        previousBlock.hash,
        newTimestamp,
        data
    )
    return newBlock;
};
console.log(blockchain);
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
// 블록체인 가져오기
const getBlockChain = () => blockchain;
// 블록생성시 필요한 hash 생성
const createHash = (index, previousHash, timestamp, data) =>
    cryptoJS(index+previousHash+timestamp+JSON.stringify(data).toString());
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

// 블록 해쉬 가져오기
const getBlockHash = (block) => createHash(block.index, block.previousHash, block.timestamp, block.data);

// 신규생성된 블록 유효성 검증
const isNewBlockValid = (candidateBlock, lastestBlock) => {
    if(!isNewStructureValid(candidateBlock)){
        console.log("후보블록의 구조가 유효하지 않습니다.");
        return false;
    }else if(lastestBlock.index + 1 !== candidateBlock.index){
        console.log("후보블록의 인덱스가 유효하지 않습니다.");
        return false;
    }else if(lastestBlock.hash !== candidateBlock.previousHash){
        console.log("후보블록의 이전블록해시가 최근블록 해쉬와 맞지 않습니다.");
        return false;
    }else if(getBlockHash(candidateBlock) !== candidateBlock.hash){
        console.log("후보블록의 해쉬가 유효하지 않습니다.")
        return false;
    }
    return true;
}

// 블록 구조 유효성 검증
const isNewStructureValid = (block) => {
    retun(
        typeof block.index === "number" &&
        typeof block.hash === "string" &&
        typeof block.previousHash === "string" &&
        typeof block.timestamp === "number" &&
        typeof block.data === "string"
    )
}

// 체인의 유효성 검증
const isChainValid = (candidateChain) => {
    const isGenesisValid = block => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    }
    if(!isGenesisValid(candidateChain[0])){
        console.log("후보체인의 제네시스블록이 유효하지 않습니다.");
        return false;
    }
    // 제네시스 블록은 제외하고 검증시작
    for (let i = 1; i < candidateChain.length; i++) {
        if(isNewBlockValid(candidateChain[i], candidateChain[i-1])){
            return false;
        } 
    }
    return true;
}

// 항상 가장긴 체인을 선택
const replaceChain = candidateChain => {
    if(isChainValid(candidateChain) && candidateChain.length > getBlockChain().length){
        blockchain = candidateChain;
        return true;
    }else{
        return false;
    }
}

// 체인에 블록을 추가
const addBlockToChain = candidateBlock => {
    if(isNewBlockValid(candidateBlock, getLastBlock())){
        getBlockChain().push(candidateBlock);
        return true;
    }else{
        return false;
    }
}
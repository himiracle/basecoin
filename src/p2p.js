const WebSockets = require("ws"),
  Mempool = require("./mempool"),
  Blockchain = require("./blockchain");

const {
  getNewestBlock,
  isBlockStructureValid,
  replaceChain,
  getBlockchain,
  addBlockToChain,
  handleIncomingTx
} = Blockchain;

const { getMempool } = Mempool;

const sockets = [];

// Messages Types
const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";
const REQUEST_MEMPOOL = "REQUEST_MEMPOOL";
const MEMPOOL_RESPONSE = "MEMPOOL_RESPONSE";

// Message Creators
const getLatest = () => {
  return {
    type: GET_LATEST,
    data: null
  };
};

const getAll = () => {
  return {
    type: GET_ALL,
    data: null
  };
};

const blockchainResponse = data => {
  return {
    type: BLOCKCHAIN_RESPONSE,
    data
  };
};

const getAllMempool = () => {
  return {
    type: REQUEST_MEMPOOL,
    data: null
  };
};

const mempoolResponse = data => {
  return {
    type: MEMPOOL_RESPONSE,
    data
  };
};

const getSockets = () => sockets;

const startP2PServer = server => {
  const wsServer = new WebSockets.Server({ server });
  wsServer.on("connection", ws => {
    initSocketConnection(ws);
  });

  wsServer.on("error", () => {
    console.log(error);
  });
  console.log("MyCoin P2P Server Start Running");
};

const initSocketConnection = ws => {
  sockets.push(ws);
  handleSocketMessages(ws);
  handleSocketError(ws);
  sendMessage(ws, getLatest());
  setTimeout(() => {
    sendMessageToAll(ws, getAllMempool());
  }, 1000);

  setInterval(() => {
    if (sockets.includes(ws)) {
      sendMessage(ws, "");
    }
  }, 1000);
};

const parseData = data => {
  try {
    return JSON.parse(data);
  } catch (e) {
    console.log(e);
    return null;
  }
};

const handleSocketMessages = ws => {
  ws.on("message", data => {
    const message = parseData(data);
    if (message === null) {
      return;
    }
    console.log(message);
    switch (message.type) {
      case GET_LATEST:
        sendMessage(ws, responseLatest());
        break;
      case GET_ALL:
        sendMessage(ws, responseAll());
        break;
      case BLOCKCHAIN_RESPONSE:
        const receivedBlocks = message.data;
        if (receivedBlocks === null) {
          break;
        }
        handleBlockchainResponse(receivedBlocks);
        break;
      case REQUEST_MEMPOOL:
        sendMessage(ws, returnMempool());
        break;
      case MEMPOOL_RESPONSE:
        const receivedTxs = message.data;
        if (receivedTxs === null) {
          return;
        }
        console.log("receivedTxs Length :::::::::::: " + receivedTxs);
        receivedTxs.forEach(tx => {
          try {
            handleIncomingTx(tx);
            broadcastMempool();
          } catch (e) {
            console.log(e);
          }
        });
        break;
    }
  });
};

// 블록체인 리스판스 관리
const handleBlockchainResponse = receivedBlocks => {
  if (receivedBlocks.length === 0) {
    console.log("블록의 길이가 없습니다.");
    return;
  }
  // 받아온 블록의 마지막 블록 확인
  const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
  if (!isBlockStructureValid(latestBlockReceived)) {
    console.log("수신된 블록의 구조가 유효하지 않습니다.");
    return;
  }
  // 내블록의 마지막 블록 확인
  const newestBlock = getNewestBlock();
  if (latestBlockReceived.index > newestBlock.index) {
    if (newestBlock.hash === latestBlockReceived.previousHash) {
      if (addBlockToChain(latestBlockReceived)) {
        broadcastNewBlock();
      }
    } else if (receivedBlocks.length === 1) {
      sendMessageToAll(getAll());
    } else {
      replaceChain(receivedBlocks);
    }
  }
};

const returnMempool = () => mempoolResponse(getMempool());

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const sendMessageToAll = message =>
  sockets.forEach(ws => sendMessage(ws, message));

const responseLatest = () => blockchainResponse([getNewestBlock()]);

const responseAll = () => blockchainResponse(getBlockchain());

// 새로운 블록이 생겼을때 전체 노드에 알림
const broadcastNewBlock = () => sendMessageToAll(responseLatest());
// 새로운 트렌잭션이 생겼을때 전체 노드에 알림
const broadcastMempool = () => sendMessageToAll(returnMempool());

const handleSocketError = ws => {
  const closeSocketConnection = ws => {
    ws.close();
    sockets.splice(sockets.indexOf(ws), 1);
  };
  ws.on("close", () => closeSocketConnection(ws));
  ws.on("error", () => closeSocketConnection(ws));
};

const connectToPeers = newPeer => {
  const ws = new WebSockets(newPeer);
  ws.on("open", () => {
    initSocketConnection(ws);
  });
  ws.on("close", console.log("P2P 커넥션 에러.."));
  ws.on("error", console.log("P2P 커넥션 에러.."));
};

module.exports = {
  startP2PServer,
  connectToPeers,
  broadcastNewBlock,
  broadcastMempool
};

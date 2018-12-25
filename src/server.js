const express = require("express"),
  _ = require("lodash"),
  cors = require("cors"),
  bodyParser = require("body-parser"),
  morgan = require("morgan"),
  Blockchain = require("./blockchain"),
  P2P = require("./p2p"),
  Mempool = require("./mempool"),
  Wallet = require("./wallet");

const { getBlockchain, createNewBlock, getAccountBalance, sendTx, getUTxOutList } = Blockchain;
const { startP2PServer, connectToPeers } = P2P;
const { initWallet, getPublicFromWallet, getBalance } = Wallet;
const { getMempool } = Mempool;
const PORT = process.env.HTTP_PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(morgan("combined"));

app
  .route("/blocks")
  .get((req, res) => {
    res.send(getBlockchain());
  })
  .post((req, res) => {
    // const { body: { data } } = req;
    const newBlock = createNewBlock();
    res.send(newBlock);
  });
app.post("/peers", (req, res) => {
  const { body: { peer } } = req;
  connectToPeers(peer);
  res.send();
});
// 계정 수량 보기
app.get("/me/balance", (req, res) => {
  const balance = getAccountBalance();
  res.send({ balance });
});

//주소 보기
app.get("/me/address", (req, res) => {
  res.send(getPublicFromWallet());
});

//특정블록 정보
app.get("/blocks/:hash", (req, res) => {
  const { params: { hash } } = req;
  const block = _.find(getBlockchain(), { hash });
  if (block === undefined) {
    res.status(400).send("해당 블럭은 존재 하지 않습니다.");
  } else {
    res.send(block);
  }
});

//특정Tx 정보
app.get("/transactions/:id", (req, res) => {
  const { params: { id } } = req;
  const tx = _(getBlockchain())
    .map(blocks => blocks.data)
    .flatten()
    .find({ id: req.params.id });
  if (tx === undefined) {
    res.status(400).send("해당 TX는 존재 하지 않습니다.");
  } else {
    res.send(tx);
  }
});

//트랜젝션
app
  .route("/transactions")
  .get((req, res) => {
    res.send(getMempool());
  })
  .post((req, res) => {
    try {
      const { body: { address, amount } } = req;
      console.log("1111");
      if (address === undefined || amount === undefined) {
        throw Error("Please specify and address and an amount");
      } else {
        console.log("222");
        const sendtx = sendTx(address, amount);
        console.log("333");
        res.send(sendtx);
      }
    } catch (e) {
      res.status(400).send(e.message);
    }
  });

app.get("/address/:address", (req, res) => {
  const {params:{address}} = req;
  const balance = getBalance(address, getUTxOutList());
  if(address === undefined){
    res.status(400).send("올바른 주소가 아닙니다.");
  }
  res.send({balance});
})

const server = app.listen(PORT, () =>
  console.log("Coin Server Running~!", PORT)
);
initWallet();
startP2PServer(server);

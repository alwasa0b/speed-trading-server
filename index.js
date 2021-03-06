"use strict";

const express = require("express");
const http = require("http");
const SocketIO = require("socket.io");
const compression = require("compression");
const login = require("./util");
const bodyParser = require("body-parser");
const placeBuyOrder = require("./place-buy-order");
const placeSellOrder = require("./place-sell-order");
const placeStopLossOrder = require("./place-stop-loss-order");
const mapLimit = require("promise-map-limit");

let app = express();
let cors = require("cors");
let server = http.Server(app);
let io = new SocketIO(server);
let port = process.env.PORT || 3001;

let Robinhood;

app.use(compression({}));
app.use(bodyParser.json());
app.use(cors());
app.use(express["static"](__dirname + "/../client"));

app.post("/login", async (req, res) => {
  Robinhood = await login(req.body);
  return res.send({ loggedin: true });
});

app.post("/orders", async (req, res) => {
  const resl = await Robinhood.orders(req.body);
  return res.send(resl.results);
});
app.post("/place_cancel_order", async (req, res) => {
  const resl = await Robinhood.cancel_order(req.body);
  return res.send(resl);
});

app.post("/positions", async (req, res) => {
  const resl = await Robinhood.nonzero_positions();
  return res.send(resl.results);
});

app.post("/place_stop_loss_order", async (req, res) => {
  const placedOrder = await placeStopLossOrder(Robinhood, req.body);
  return res.send(placedOrder);
});

app.post("/place_buy_order", async (req, res) => {
  const placedOrder = await placeBuyOrder(Robinhood, req.body);
  return res.send(placedOrder);
});

app.post("/place_sell_order", async (req, res) => {
  const placedOrder = await placeSellOrder(Robinhood, req.body);
  return res.send(placedOrder);
});

let update_price_handle;
let update_position_handle;
let update_order_handle;

//todo: refactor to make less calls to RB
io.on("connection", socket => {
  socket.on("action", ({ type, symbol }) => {
    if (type === "SERVER/UPDATE_PRICE") {
      if (update_price_handle != null) clearInterval(update_price_handle);
      update_price_handle = setInterval(async () => {
        let price = await Robinhood.quote_data(symbol);
        socket.emit("action", {
          type: "PRICE_UPDATED",
          data: {
            price: price.results[0].last_trade_price,
            instrument: price.results[0].instrument,
            symbol: price.results[0].symbol
          }
        });
      }, 600);
    }

    if (type === "SERVER/UPDATE_POSITIONS") {
      if (update_position_handle != null) clearInterval(update_position_handle);
      update_position_handle = setInterval(async () => {
        const resl = await Robinhood.nonzero_positions();
        let arr = await mapLimit(resl.results, 1, async order => {
          let ticker = await Robinhood.url(order.instrument);
          let price = await Robinhood.quote_data(ticker.symbol);
          return {
            symbol: ticker.symbol,
            cur_price: price.results[0].last_trade_price,
            ...order
          };
        });

        socket.emit("action", {
          type: "POSITIONS_UPDATED",
          data: arr
        });
      }, 5000);
    }

    if (type === "SERVER/UPDATE_ORDERS") {
      if (update_order_handle != null) clearInterval(update_order_handle);
      update_order_handle = setInterval(async () => {
        let options = { updated_at: getDate() };
        let orders = await Robinhood.orders(options);
        let tickers = await await mapLimit(orders.results, 1, async order => {
          let ticker = await Robinhood.url(order.instrument);
          return { symbol: ticker.symbol, ...order };
        });

        socket.emit("action", {
          type: "ORDERS_UPDATED",
          data: tickers
        });
      }, 5000);
    }
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("userDisconnect");
  });
});

app.post("/logout", async (req, res) => {
  if (update_price_handle != null) clearInterval(update_price_handle);
  if (update_position_handle != null) clearInterval(update_position_handle);
  if (update_order_handle != null) clearInterval(update_order_handle);

  Robinhood = await Robinhood.expire_token();

  return res.send({ loggedout: true });
});

server.listen(port, () => {
  console.log("[INFO] Listening on *:" + port);
});

function getDate() {
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1; //January is 0!

  var yyyy = today.getFullYear();
  if (dd < 10) {
    dd = "0" + dd;
  }
  if (mm < 10) {
    mm = "0" + mm;
  }
  var today = yyyy + "-" + mm + "-" + dd;
  return today;
}

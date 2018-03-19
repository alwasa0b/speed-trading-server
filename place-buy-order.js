let excutedOrder;
module.exports = async (
  Robinhood,
  {
    instrument,
    quantity,
    bid_price,
    symbol,
    placeSellOrder = false,
    placeStopLoss = false,
    customPrice = false,
    sellPrice,
    stopLossPrice
  }
) => {
  try {
    let quote;

    if (!customPrice) quote = await Robinhood.quote_data(symbol);

    let options = {
      type: "limit",
      quantity,
      bid_price: customPrice ? bid_price : quote.results[0].last_trade_price,
      instrument: { url: instrument, symbol }
    };

    const orderPlacedRes = await Robinhood.place_buy_order(options);

    if (placeSellOrder || placeStopLoss) {
      excutedOrder = setInterval(async () => {
        let order = await Robinhood.url(orderPlacedRes.url);
        if (order.state === "filled") {
          console.log("order filled");
          console.log("placing sell and stop orders");

          if (placeSellOrder)
            await Robinhood.place_sell_order({
              ...options,
              bid_price: sellPrice
            });

          if (placeStopLoss)
            await Robinhood.place_sell_order({
              instrument: { url: instrument, symbol },
              quantity,
              stop_price: stopLossPrice,
              type: "market",
              trigger: "stop"
            });

          clearInterval(excutedOrder);
        }
      }, 600);
    }

    return orderPlacedRes;
  } catch (e) {
    if (excutedOrder) clearInterval(excutedOrder);
    return { detail: e.toString() };
  }
};

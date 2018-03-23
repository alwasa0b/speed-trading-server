module.exports = async (Robinhood, { instrument, quantity, stop_price, symbol }) => {
    try {
      const orderPlacedRes = await Robinhood.place_sell_order({
        instrument: { url: instrument, symbol },
        quantity,
        stop_price,
        type: "market",
        trigger: "stop"
      });
  
      return orderPlacedRes;
    } catch (e) {
      return { detail: e.toString() };
    }
  };
  
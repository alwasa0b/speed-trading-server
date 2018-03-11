let excutedOrder;
module.exports = async (
  Robinhood,
  {
    instrument,
    updated_at
  }
) => {
  try {
    let options = {
        updated_at: updated_at,
        instrument
    }
    const orders = await Robinhood.orders(options);


    return orders;
  } catch (e) {
    return { detail: e.toString() };
  }
};

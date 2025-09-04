const axios = require('axios');
const zlib = require('zlib');

async function fetchAndDecompressItems() {
  const url = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz';

  // Log when function is called
  console.log(`[${new Date().toISOString()}] fetchAndDecompressItems called`);

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
    });

    // Decompress the .gz file
    const decompressed = zlib.gunzipSync(response.data);

    // ✅ Parse full JSON (Upstox returns array of objects, not line-delimited JSON)
    const items = JSON.parse(decompressed.toString());

    // 🔍 Log first 3 raw entries for debugging
    console.log("Raw uncompressed sample:", items.slice(0, 3));

    // ✅ Whitelist fields
    const mappedItems = items.map((item, index) => ({
      id: `item-${Date.now()}-${index}`,
      name: item.name || "Unknown",
      segment: item.segment || "N/A",
      underlying_symbol: item.underlying_symbol || "N/A",
      instrument_key: item.instrument_key || `KEY-${index}`,
      exchange_token: item.exchange_token || `TOKEN-${index}`,
      minimum_lot: item.minimum_lot || item.lot_size || 1,
      trading_symbol: item.trading_symbol || `SYMBOL-${index}`,
      strike_price: item.strike_price || 0,
      expiry: item.expiry ? new Date(item.expiry).toISOString() : null,
      dateAdded: new Date().toISOString()
    }));

    // 🔍 Log mapped entries for verification
    console.log("Mapped entries:", mappedItems.slice(0, 5));

    return mappedItems;
    
  } catch (error) {
    console.error('Error fetching or decompressing items:', error);
    return [];
  }
}

module.exports = { fetchAndDecompressItems };

const axios = require('axios');
const zlib = require('zlib');

async function fetchAndDecompressItems() {
  const url = 'https://huggingface.co/datasets/togethercomputer/RedPajama-Data-V2/resolve/main/sample/documents/2023-06/0007/de_head.json.gz';

  // Log when function is called
  console.log(`[${new Date().toISOString()}] fetchAndDecompressItems called`);

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
    });

    const decompressed = zlib.gunzipSync(response.data);
    const jsonLines = decompressed.toString().split('\n');
    
    const items = jsonLines
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));

    return items.map((item, index) => ({
      id: `item-${Date.now()}-${index}`,
      name: item.name || "Unknown",
      segment: item.segment || "N/A",
      underlying_symbol: item.underlying_symbol || "N/A",
      instrument_key: item.instrument_key || `KEY-${index}`,
      exchange_token: item.exchange_token || `TOKEN-${index}`,
      minimum_lot: item.minimum_lot || 1,
      trading_symbol: item.trading_symbol || `SYMBOL-${index}`,
      strike_price: item.strike_price || 0,
      dateAdded: new Date().toISOString()
    }));
    
  } catch (error) {
    console.error('Error fetching or decompressing items:', error);
    return [];
  }
}

module.exports = { fetchAndDecompressItems };
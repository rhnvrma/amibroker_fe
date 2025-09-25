/**
 * Generates a trading symbol for a derivative instrument (Options/Futures).
 * This function mimics the Python `generate_trading_symbol` logic.
 * @param {string} underlying - The underlying asset name (e.g., 'NIFTY').
 * @param {Date} expiryDate - The expiry date of the instrument.
 * @param {number} strikePrice - The strike price of the instrument.
 * @param {string} optionType - The type of option ('CE', 'PE') or 'FF' for Futures.
 * @returns {string} The formatted trading symbol.
 */
function generateDerivativeSymbol(underlying, expiryDate, strikePrice, optionType,exchange) {
  // Format the date to YYMMDD
  const year = expiryDate.getFullYear().toString().slice(-2);
  const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0'); // JS months are 0-indexed
  const day = expiryDate.getDate().toString().padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Format strike price to one decimal place
  const strikeStr = strikePrice % 1 === 0 ? String(parseInt(strikePrice, 10)): String(strikePrice);

  return `${underlying}${dateStr}${strikeStr}${optionType}`;
}

/**
 * Gets or generates the trading symbol for a given instrument object.
 * The logic is based on the provided Python script, handling EQ, Options, Futures, and Indices.
 *
 * @param {object} instrument - The instrument object from the API.
 * @returns {string|null} The trading symbol, or null if it cannot be determined.
 */
function getTradingSymbol(instrument) {
  // 1. Handle null, undefined, or non-object input
  if (!instrument || typeof instrument !== 'object') {
    return null;
  }

  const { instrument_type, name, trading_symbol, expiry, strike_price ,exchange,segment } = instrument;

  if (instrument_type === 'INDEX') {
    return name ? name.trim() : null;
  }

  switch (segment) {
    // Case for Equity
    case 'NSE_EQ':
    case 'BSE_EQ':
      return trading_symbol? trading_symbol.trim()+"_"+exchange  : null;

    // Cases for Options (Call/Put)
    case 'NSE_FO':
    case 'NCD_FO':
    case 'BSE_FO':
    case 'BCD_FO':
    case 'MCX_FO':
    case 'NCD_FO':
        switch (instrument_type) {
            case 'CE':
            case 'PE':
                if (!expiry || strike_price === undefined) {
                    return null; // Equivalent to 'continue' in the loop
                }
                const optionExpiry = new Date(expiry); // Python expiry is in ms for JS Date
                return generateDerivativeSymbol(name, optionExpiry, strike_price, instrument_type,exchange);
            case 'FUT':
                if ( !expiry) {
                    return null; // Equivalent to 'continue' in the loop
                }
                const futExpiry = new Date(expiry);
                // For futures, strike is 0 and option_type is 'FF'
                return generateDerivativeSymbol(name, futExpiry, 0, 'FF',exchange );
            }

    // 3. If it's a string (legacy support from original function)
    // This part is not in the python logic but kept from your original JS for robustness
    case undefined:
        if (typeof instrument === 'string') {
            return instrument.trim();
        }
        break;

    // 4. Return null for any other unexpected type
    default:
      return instrument.trading_symbol.replace(/\s+/g, '');
  }

  return null; // Final fallback
}
module.exports = {
  getTradingSymbol
};
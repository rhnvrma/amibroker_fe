const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { format, parse, add, getDay, addDays, subDays, min } = require('date-fns');
const { pLimit } = require('p-limit');
// ==============================================================================
// TOP-LEVEL CONFIGURATION
// ==============================================================================
const API_BASE_URL = "https://api.upstox.com/v2/historical-candle";
const API_ACCESS_TOKEN = "YOUR_API_ACCESS_TOKEN"; // IMPORTANT: Replace with your actual token

const CONCURRENCY_LIMIT = 10; // Reduced for file I/O operations. Tune based on your machine/disk speed.
const RETRY_ATTEMPTS = 5;
const RETRY_INITIAL_DELAY = 1000;

const INTERVALS = ['1minute'];
const GLOBAL_START_DATE = "2023-01-01";
const END_DATE = format(new Date(), 'yyyy-MM-dd');
const ROOT_DATA_PATH = "./financial_data_csv"; // Root directory for all CSV files

/**
 * CSV File Format:
 * Each file will contain the following columns:
 * timestamp,open,high,low,close,volume,oi
 * Example: 2024-01-05 15:29:00,2985.9,2986,2985.35,2985.8,11025,0
 */

// ==============================================================================
// SCRIPT IMPLEMENTATION
// ==============================================================================

const log = (level, message) => {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    console.log(`${timestamp} - ${level.toUpperCase()} - ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==============================================================================
// CSV HELPER FUNCTIONS (REPLACING DATABASE LOGIC)
// ==============================================================================

/**
 * Prepares a CSV file for writing and determines the correct start date for fetching data.
 * If the file doesn't exist, it creates it with a header.
 * If it exists, it reads the last entry to avoid re-fetching old data, and removes the last day's
 * data to ensure the final day is always complete.
 * @param {string} filePath - The full path to the CSV file.
 * @param {string} defaultStartDate - The start date to use if the file is new.
 * @returns {Promise<string>} The calculated start date for the API fetch.
 */
async function prepareCsvAndGetStartDate(filePath, defaultStartDate) {
    const csvHeader = 'timestamp,open,high,low,close,volume,oi\n';

    try {
        await fs.access(filePath); // Check if file exists
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n');

        if (lines.length <= 1) { // File exists but is empty or only has a header
            log('info', `[${path.basename(filePath)}] File is empty. Fetching from ${defaultStartDate}.`);
            await fs.writeFile(filePath, csvHeader);
            return defaultStartDate;
        }

        const lastLine = lines[lines.length - 1];
        const lastTimestamp = lastLine.split(',')[0]; // Assumes timestamp is the first column
        const fetchStartDate = lastTimestamp.slice(0, 10); // 'yyyy-MM-dd'

        // To ensure the last day is always complete, we remove partial data for that day and re-fetch it.
        const contentToKeep = lines.slice(1).filter(line => !line.startsWith(fetchStartDate));
        const newContent = csvHeader + contentToKeep.join('\n') + (contentToKeep.length > 0 ? '\n' : '');
        
        await fs.writeFile(filePath, newContent, 'utf-8');

        log('info', `[${path.basename(filePath)}] Last entry on ${lastTimestamp}. Re-fetching from ${fetchStartDate}.`);
        return fetchStartDate;

    } catch (error) {
        // This block runs if fs.access throws an error (i.e., file does not exist)
        log('info', `[${path.basename(filePath)}] No previous file. Creating and fetching from ${defaultStartDate}.`);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true }); // Ensure directory exists
        await fs.writeFile(filePath, csvHeader);
        return defaultStartDate;
    }
}

/**
 * Appends an array of candle data to the specified CSV file.
 * @param {string} filePath - The full path to the CSV file.
 * @param {Array<Array>} candles - The candle data fetched from the API.
 */
async function appendDataToCsv(filePath, candles) {
    if (!candles || candles.length === 0) {
        return;
    }

    try {
        const csvRows = candles.map(candle => {
            const formattedTimestamp = candle[0].slice(0, 19).replace('T', ' ');
            // candle format: [timestamp, open, high, low, close, volume, oi]
            return [formattedTimestamp, candle[1], candle[2], candle[3], candle[4], candle[5], candle[6]].join(',');
        }).join('\n') + '\n';

        await fs.appendFile(filePath, csvRows, 'utf-8');
        log('info', `✅ [${path.basename(filePath)}] Appended ${candles.length} new rows to the file.`);
    } catch (e) {
        log('error', `[${path.basename(filePath)}] CSV Append Error: ${e.message}`);
    }
}

// ==============================================================================
// DATA FETCHING & DATE LOGIC (Unchanged)
// ==============================================================================

function adjustDateToWeekday(dateObj, isStartDate) {
    const weekday = getDay(dateObj);
    if (isStartDate) {
        if (weekday === 6) return addDays(dateObj, 2);
        if (weekday === 0) return addDays(dateObj, 1);
    } else {
        if (weekday === 6) return subDays(dateObj, 1);
        if (weekday === 0) return subDays(dateObj, 2);
    }
    return dateObj;
}

function getDateRanges(startDateStr, endDateStr, interval) {
    let startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
    let endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());
    startDate = adjustDateToWeekday(startDate, true);
    endDate = adjustDateToWeekday(endDate, false);

    if (startDate > endDate) return [];
    
    const delta = interval.includes('minute') ? { days: 28 } : { years: 10 };
    const dateChunks = [];
    let currentStart = startDate;

    while (currentStart <= endDate) {
        const chunkEnd = min([add(currentStart, delta), endDate]);
        const adjustedChunkEnd = adjustDateToWeekday(chunkEnd, false);
        dateChunks.push({ from: format(currentStart, 'yyyy-MM-dd'), to: format(adjustedChunkEnd, 'yyyy-MM-dd') });
        const nextStart = addDays(adjustedChunkEnd, 1);
        currentStart = adjustDateToWeekday(nextStart, true);
    }
    return dateChunks;
}

async function fetchCandleDataChunk(session, instrumentKey, interval, fromDate, toDate) {
    const url = `${API_BASE_URL}/${instrumentKey}/${interval}/${toDate}/${fromDate}`;
    const headers = { 'Accept': 'application/json', 'Authorization': `Bearer ${API_ACCESS_TOKEN}` };
    const requestId = `${instrumentKey.padEnd(20)} | ${interval} | ${fromDate} to ${toDate}`;
    let delay = RETRY_INITIAL_DELAY;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await session.get(url, { headers, timeout: 30000 });
            return response.data?.data?.candles || [];
        } catch (error) {
            const status = error.response?.status;
            if ([429, 503, 504].includes(status) || error.code === 'ECONNRESET') {
                 log('warn', `[RETRYING] ${requestId} - Status: ${status || error.code}. Attempt ${attempt}/${RETRY_ATTEMPTS}.`);
            } else {
                 log('error', `[FAILED] ${requestId} - Status: ${status}, Reason: ${error.message}`);
                 return null;
            }
        }
        if (attempt < RETRY_ATTEMPTS) {
            await sleep(delay);
            delay *= 2;
        }
    }
    log('error', `[GAVE UP] ${requestId} after ${RETRY_ATTEMPTS} attempts.`);
    return null;
}

// ==============================================================================
// MAIN ORCHESTRATION
// ==============================================================================

/**
 * Processes a single instrument: prepares CSV, fetches data, and saves data.
 * @param {object} limit - p-limit instance
 * @param {object} session - axios instance
 * @param {object} item - The item object containing the instrument_key.
 * @param {string} rootPath - The root directory to save CSV files.
 */
async function processInstrument(limit, session, item, rootPath) {
    const instrumentKey = item.instrument_key;
    for (const interval of INTERVALS) {
        const fileName = `${item.trading_symbol.replace(/\|/g, '_')}.csv`;
        const filePath = path.join(rootPath, fileName);
        log('info', `[${fileName}] Starting process...`);

        // 1. Prepare CSV file and get the correct start date
        const startDate = await prepareCsvAndGetStartDate(filePath, GLOBAL_START_DATE);

        // 2. Fetch all data for this instrument
        const dateRanges = getDateRanges(startDate, END_DATE, interval);
        if (dateRanges.length === 0) {
            log('info', `[${fileName}] No new date ranges to fetch. Process complete.`);
            continue;
        }

        const downloadTasks = dateRanges.map(range =>
            limit(() => fetchCandleDataChunk(session, instrumentKey, interval, range.from, range.to))
        );
        const results = await Promise.all(downloadTasks);
        const allCandles = results.flat().filter(Boolean);
        log('info', `[${fileName}] Download complete. Fetched: ${allCandles.length} candles.`);
        
        // 3. Sort all candles chronologically before saving
        // This is crucial because concurrent fetches can resolve out of order.
        allCandles.sort((a, b) => a[0].localeCompare(b[0]));

        // 4. Save the sorted data
        await appendDataToCsv(filePath, allCandles);
    }
}

/**
 * Main function to orchestrate the fetching and storing of data for a given list of instruments.
 * @param {Array<object>} itemsToFetch - A list of items, each with an 'instrument_key' property.
 * @param {string} rootPath - The root directory where CSV files will be stored.
 */
async function fetchAndStoreData(itemsToFetch, rootPath) {
    const startMainTime = performance.now();
    log('info', `--- SCRIPT STARTING FOR ${itemsToFetch.length} INSTRUMENTS ---`);

    const limit = pLimit(CONCURRENCY_LIMIT);
    const session = axios.create();

    const allTasks = itemsToFetch.map(item =>
        limit(() => processInstrument(limit, session, item, rootPath))
    );

    await Promise.all(allTasks);

    const mainDuration = (performance.now() - startMainTime) / 1000;
    log('info', `\n=== Script finished in ${mainDuration.toFixed(2)} seconds ===`);
}

// ==============================================================================
// SCRIPT ENTRY POINT
// ==============================================================================

// Self-invoking async function to run the script
// (async () => {
//     // This is where you define the list of instruments you want to run.
//     // The format is now an array of objects, each with an `instrument_key`.
//     const exampleItems = [
//         { instrument_key: 'NSE_EQ|INE002A01018' },  // Reliance Industries
//         { instrument_key: 'NSE_EQ|INE090A01021' },  // ICICI Bank
//         // { instrument_key: 'NSE_EQ|INE476A01028' },  // HDFC Bank
//         // { instrument_key: 'NSE_FO|44833' },          // TATA MOTORS
//     ];

//     try {
//         // Ensure the root data directory exists before starting
//         await fs.mkdir(ROOT_DATA_PATH, { recursive: true });
//         log('info', `Data will be saved in '${ROOT_DATA_PATH}' directory.`);
        
//         // Call the main function with the list of items and the root path.
//         await fetchAndStoreData(exampleItems, ROOT_DATA_PATH);
//     } catch (error) {
//         log('error', `An unexpected top-level error occurred: ${error.stack}`);
//     }
// })();
module.exports = {
    fetchAndStoreData
};
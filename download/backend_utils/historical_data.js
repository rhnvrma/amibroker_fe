const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { format, parse, add, getDay, addDays, subDays, min } = require('date-fns');

// ==============================================================================
// TOP-LEVEL CONFIGURATION
// ==============================================================================
const API_BASE_URL = "https://api.upstox.com/v2/historical-candle";
const API_ACCESS_TOKEN = "YOUR_API_ACCESS_TOKEN"; // IMPORTANT: Replace with your actual token

const CONCURRENCY_LIMIT = 10; // Max number of instruments to process at the same time.
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
// HELPER FUNCTIONS
// ==============================================================================

const log = (level, message) => {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    console.log(`${timestamp} - ${level.toUpperCase()} - ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==============================================================================
// NATIVE CONCURRENCY POOL (p-limit alternative)
// ==============================================================================

/**
 * Runs async tasks from an iterable with a specific concurrency.
 * @param {number} concurrency - The number of tasks to run at the same time.
 * @param {Array<any>} iterable - An array of items to process.
 * @param {Function} iteratorFn - An async function that processes one item.
 * @returns {Promise<Array<any>>} A promise that resolves with the results of all tasks.
 */
async function asyncPool(concurrency, iterable, iteratorFn) {
    const results = [];
    const executing = new Set();
    let index = 0;

    for (const item of iterable) {
        // Wrap iteratorFn in a Promise to handle both sync and async functions
        const p = Promise.resolve().then(() => iteratorFn(item, index++));
        results.push(p);
        executing.add(p);
        
        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);
        
        // If the pool is full, wait for at least one promise to complete
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}


// ==============================================================================
// CSV HELPER FUNCTIONS
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
            // await fs.writeFile(filePath, csvHeader);
            return defaultStartDate;
        }

        const lastLine = lines[lines.length - 1];
        const lastTimestamp = lastLine.split(',')[0]; // Assumes timestamp is the first column
        const fetchStartDate = lastTimestamp.slice(0, 10); // 'yyyy-MM-dd'

        // To ensure the last day is always complete, we remove partial data for that day and re-fetch it.
        const contentToKeep = lines.slice(1).filter(line => !line.startsWith(fetchStartDate));
        const newContent = contentToKeep.join('\n') + (contentToKeep.length > 0 ? '\n' : '');
        
        await fs.writeFile(filePath, newContent, 'utf-8');

        log('info', `[${path.basename(filePath)}] Last entry on ${lastTimestamp}. Re-fetching from ${fetchStartDate}.`);
        return fetchStartDate;

    } catch (error) {
        // This block runs if fs.access throws an error (i.e., file does not exist)
        log('info', `[${path.basename(filePath)}] No previous file. Creating and fetching from ${defaultStartDate}.`);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true }); // Ensure directory exists
        // await fs.writeFile(filePath, csvHeader);
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
            // const formattedTimestamp = candle[0].slice(0, 19).replace('T', ' ');
            // candle format: [timestamp, open, high, low, close, volume, oi]
            return [candle[0], candle[1], candle[2], candle[3], candle[4], candle[5], candle[6]].join(',');
        }).join('\n') + '\n';

        await fs.appendFile(filePath, csvRows, 'utf-8');
        log('info', `✅ [${path.basename(filePath)}] Appended ${candles.length} new rows to the file.`);
    } catch (e) {
        log('error', `[${path.basename(filePath)}] CSV Append Error: ${e.message}`);
    }
}

// ==============================================================================
// DATA FETCHING & DATE LOGIC
// ==============================================================================

function adjustDateToWeekday(dateObj, isStartDate) {
    const weekday = getDay(dateObj);
    if (isStartDate) {
        if (weekday === 6) return addDays(dateObj, 2); // Saturday -> Monday
        if (weekday === 0) return addDays(dateObj, 1); // Sunday -> Monday
    } else {
        if (weekday === 6) return subDays(dateObj, 1); // Saturday -> Friday
        if (weekday === 0) return subDays(dateObj, 2); // Sunday -> Friday
    }
    return dateObj;
}

function getDateRanges(startDateStr, endDateStr, interval) {
    let startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
    let endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());
    startDate = adjustDateToWeekday(startDate, true);
    endDate = adjustDateToWeekday(endDate, false);

    if (startDate > endDate) return [];
    
    // Upstox API limit for 1-minute data is about 1 month. Using 28 days for safety.
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
                 return null; // Don't retry on other errors (e.g., 401, 404)
            }
        }
        if (attempt < RETRY_ATTEMPTS) {
            await sleep(delay);
            delay *= 2; // Exponential backoff
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
 * @param {object} session - axios instance
 * @param {object} item - The item object containing the instrument_key and trading_symbol.
 * @param {string} rootPath - The root directory to save CSV files.
 */
async function processInstrument(session, item, rootPath) {
    const instrumentKey = item.instrument_key;
    for (const interval of INTERVALS) {
        const fileName = `${item.trading_symbol.replace(/\|/g, '_')}.txt`;
        const filePath = path.join(rootPath, fileName);
        log('info', `[${fileName}] Starting process...`);

        // 1. Prepare CSV file and get the correct start date
        const startDate = await prepareCsvAndGetStartDate(filePath, GLOBAL_START_DATE);

        // 2. Get date ranges to fetch
        const dateRanges = getDateRanges(startDate, END_DATE, interval);
        if (dateRanges.length === 0) {
            log('info', `[${fileName}] No new date ranges to fetch. Process complete.`);
            continue;
        }

        // 3. Download all data chunks for this instrument in parallel
        const downloadTasks = dateRanges.map(range =>
            fetchCandleDataChunk(session, instrumentKey, interval, range.from, range.to)
        );
        const results = await Promise.all(downloadTasks);
        const allCandles = results.flat().filter(Boolean); // Flatten chunks and remove nulls
        log('info', `[${fileName}] Download complete. Fetched: ${allCandles.length} candles.`);
        
        // 4. Sort all candles chronologically before saving
        allCandles.sort((a, b) => a[0].localeCompare(b[0]));

        // 5. Save the sorted data
        await appendDataToCsv(filePath, allCandles);
    }
}

/**
 * Main function to orchestrate the fetching and storing of data for a given list of instruments.
 * @param {Array<object>} itemsToFetch - A list of items, each with an 'instrument_key' and 'trading_symbol'.
 * @param {string} rootPath - The root directory where CSV files will be stored.
 */
async function fetchAndStoreData(itemsToFetch, rootPath) {
    const startMainTime = performance.now();
    log('info', `--- SCRIPT STARTING FOR ${itemsToFetch.length} INSTRUMENTS ---`);

    const session = axios.create();

    // Use the native asyncPool to process instruments with controlled concurrency
    await asyncPool(
        CONCURRENCY_LIMIT,
        itemsToFetch,
        (item) => processInstrument(session, item, rootPath)
    );

    const mainDuration = (performance.now() - startMainTime) / 1000;
    log('info', `\n=== Script finished in ${mainDuration.toFixed(2)} seconds ===`);
}

// ==============================================================================
// SCRIPT ENTRY POINT
// ==============================================================================

// Self-invoking async function to run the script


module.exports = {
    fetchAndStoreData
};
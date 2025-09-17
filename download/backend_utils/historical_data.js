// import fs from 'fs';
// import axios from 'axios';
// import { format, parse, add, getDay, addDays, subDays, min } from 'date-fns';
// import pLimit from 'p-limit';
// import sqlite3 from 'sqlite3';
// import { open } from 'sqlite';

// // ==============================================================================
// // TOP-LEVEL CONFIGURATION
// // ==============================================================================
// const API_BASE_URL = "https://api.upstox.com/v2/historical-candle";
// const API_ACCESS_TOKEN = "YOUR_API_ACCESS_TOKEN"; // IMPORTANT: Replace with your actual token

// const CONCURRENCY_LIMIT = 50; // Adjusted for concurrent DB writes. Tune based on your machine.
// const RETRY_ATTEMPTS = 5;
// const RETRY_INITIAL_DELAY = 1000;

// const INTERVALS = ['1minute'];
// const GLOBAL_START_DATE = "2023-01-01";
// const END_DATE = format(new Date(), 'yyyy-MM-dd');
// const DB_NAME = "financial_data.db";

// // ==============================================================================
// // SCRIPT IMPLEMENTATION
// // ==============================================================================

// const log = (level, message) => {
//     const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
//     console.log(`${timestamp} - ${level.toUpperCase()} - ${message}`);
// };

// const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// // ==============================================================================
// // DATABASE HELPER FUNCTIONS (DESIGNED FOR CONCURRENCY)
// // ==============================================================================

// /**
//  * Opens a database connection and enables WAL (Write-Ahead Logging) mode.
//  * WAL is crucial for allowing concurrent write operations without locking errors.
//  */
// async function openDbConnection() {
//     const db = await open({ filename: DB_NAME, driver: sqlite3.Database });
//     // Enable Write-Ahead Logging for better concurrency
//     await db.exec('PRAGMA journal_mode = WAL;');
//     // ** NEW **: Wait up to 5000ms (5s) if the database is locked by another process
//     await db.exec('PRAGMA busy_timeout = 5000;');
//     return db;
// }

// async function prepareAndGetStartDate(tableName, defaultStartDate) {
//     let db;
//     try {
//         db = await openDbConnection();
//         const sqlCreateTable = `
//         CREATE TABLE IF NOT EXISTS "${tableName}" (
//             timestamp TEXT PRIMARY KEY, open REAL NOT NULL, high REAL NOT NULL,
//             low REAL NOT NULL, close REAL NOT NULL, volume INTEGER NOT NULL, oi INTEGER
//         );`;
//         await db.exec(sqlCreateTable);

//         const result = await db.get(`SELECT MAX(timestamp) as max_ts FROM "${tableName}"`);
//         const lastTsStr = result?.max_ts;
//         console.log(lastTsStr);

//         if (lastTsStr) {
//             // const fetchStartDate = format(parse(lastTsStr, 'yyyy-MM-dd HH:mm:ss', new Date()), 'yyyy-MM-dd');
//             const fetchStartDate = lastTsStr.slice(0, 19).replace('T', ' ');
//             await db.run(`DELETE FROM "${tableName}" WHERE DATE(timestamp) = ?`, fetchStartDate);
//             log('info', `[${tableName}] Last entry: ${lastTsStr}. Fetching from ${fetchStartDate}.`);
//             return fetchStartDate;
//         } else {
//             log('info', `[${tableName}] No previous data. Fetching from ${defaultStartDate}.`);
//             return defaultStartDate;
//         }
//     } catch (e) {
//         log('error', `[${tableName}] DB Prep Error: ${e.message}`);
//         return defaultStartDate;
//     } finally {
//         if (db) await db.close();
//     }
// }

// /**
//  * Saves data for a single instrument to the database.
//  * This function opens its own connection to be used concurrently.
//  */
// async function saveInstrumentData(tableName, candles) {
//     if (!candles || candles.length === 0) {
//         return;
//     }
//     let db;
//     let stmt;
//     try {
//         db = await openDbConnection();
//         await db.exec('BEGIN TRANSACTION;');

//         stmt = await db.prepare(
//             `INSERT OR IGNORE INTO "${tableName}" (timestamp, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?)`
//         );

//         // 1. ASYNCHRONOUS PRE-PROCESSING
//         // By making the map's callback function `async`, it returns a promise for each candle.
//         const processingPromises = candles.map(async (candle) => {
//             // This string manipulation is inherently synchronous, but this structure
//             // makes the entire pre-processing step awaitable and asynchronous.
//             const formattedTimestamp = candle[0].slice(0, 19).replace('T', ' ');
//             return [formattedTimestamp, candle[1], candle[2], candle[3], candle[4], candle[5], candle[6]];
//         });

//         // Wait for all the data-processing promises to resolve.
//         const processedCandles = await Promise.all(processingPromises);

//         // 2. CONCURRENT INSERTION: Create all insertion promises at once.
//         const insertionPromises = processedCandles.map(candle => stmt.run(...candle));

//         // 3. AWAIT ALL: Wait for all insertions to complete.
//         await Promise.all(insertionPromises);

//         await db.exec('COMMIT;');
//         log('info', `✅ [${tableName}] Saved ${candles.length} new rows to the database.`);

//     } catch (e) {
//         if (db) await db.exec('ROLLBACK;');
//         log('error', `[${tableName}] DB Save Error: ${e.message}`);

//     } finally {
//         if (stmt) {
//             await stmt.finalize();
//         }
//         if (db) {
//             await db.close();
//         }
//     }
// }
// // ==============================================================================
// // DATA FETCHING & DATE LOGIC (Largely Unchanged)
// // ==============================================================================

// function adjustDateToWeekday(dateObj, isStartDate) {
//     const weekday = getDay(dateObj);
//     if (isStartDate) {
//         if (weekday === 6) return addDays(dateObj, 2);
//         if (weekday === 0) return addDays(dateObj, 1);
//     } else {
//         if (weekday === 6) return subDays(dateObj, 1);
//         if (weekday === 0) return subDays(dateObj, 2);
//     }
//     return dateObj;
// }

// function getDateRanges(startDateStr, endDateStr, interval) {
//     let startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
//     let endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());
//     startDate = adjustDateToWeekday(startDate, true);
//     endDate = adjustDateToWeekday(endDate, false);

//     if (startDate > endDate) return [];
    
//     const delta = interval.includes('minute') ? { days: 28 } : { years: 10 };
//     const dateChunks = [];
//     let currentStart = startDate;

//     while (currentStart <= endDate) {
//         const chunkEnd = min([add(currentStart, delta), endDate]);
//         const adjustedChunkEnd = adjustDateToWeekday(chunkEnd, false);
//         dateChunks.push({ from: format(currentStart, 'yyyy-MM-dd'), to: format(adjustedChunkEnd, 'yyyy-MM-dd') });
//         const nextStart = addDays(adjustedChunkEnd, 1);
//         currentStart = adjustDateToWeekday(nextStart, true);
//     }
//     return dateChunks;
// }

// async function fetchCandleDataChunk(session, instrument, interval, fromDate, toDate) {
//     const url = `${API_BASE_URL}/${instrument}/${interval}/${toDate}/${fromDate}`;
//     const headers = { 'Accept': 'application/json', 'Authorization': `Bearer ${API_ACCESS_TOKEN}` };
//     const requestId = `${instrument.padEnd(20)} | ${interval} | ${fromDate} to ${toDate}`;
//     let delay = RETRY_INITIAL_DELAY;

//     for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
//         try {
//             const response = await session.get(url, { headers, timeout: 30000 });
//             return response.data?.data?.candles || [];
//         } catch (error) {
//             const status = error.response?.status;
//             if ([429, 503, 504].includes(status) || error.code === 'ECONNRESET') {
//                  log('warn', `[RETRYING] ${requestId} - Status: ${status || error.code}. Attempt ${attempt}/${RETRY_ATTEMPTS}.`);
//             } else {
//                 log('error', `[FAILED] ${requestId} - Status: ${status}, Reason: ${error.message}`);
//                 return null;
//             }
//         }
//         if (attempt < RETRY_ATTEMPTS) {
//             await sleep(delay);
//             delay *= 2;
//         }
//     }
//     log('error', `[GAVE UP] ${requestId} after ${RETRY_ATTEMPTS} attempts.`);
//     return null;
// }

// // ==============================================================================
// // MAIN ORCHESTRATION
// // ==============================================================================

// /**
//  * Processes a single instrument: prepares DB, fetches data, and saves data.
//  * This is the core unit of concurrent work.
//  */
// async function processInstrument(limit, session, instrument) {
//     for (const interval of INTERVALS) {
//         const tableName = `${instrument.replace(/\|/g, '_')}_${interval}`;
//         log('info', `[${tableName}] Starting process...`);

//         // 1. Prepare DB for this specific table and get the correct start date
//         const startDate = await prepareAndGetStartDate(tableName, GLOBAL_START_DATE);

//         // 2. Fetch all data for this instrument
//         const dateRanges = getDateRanges(startDate, END_DATE, interval);
//         if (dateRanges.length === 0) {
//             log('info', `[${tableName}] No new date ranges to fetch. Process complete.`);
//             continue;
//         }

//         const downloadTasks = dateRanges.map(range =>
//             limit(() => fetchCandleDataChunk(session, instrument, interval, range.from, range.to))
//         );
//         const results = await Promise.all(downloadTasks);
//         const allCandles = results.flat().filter(Boolean);
//         log('info', `[${tableName}] Download complete. Fetched: ${allCandles.length} candles.`);

//         // 3. Save the downloaded data immediately
//         await saveInstrumentData(tableName, allCandles);
//     }
// }

// /**
//  * Main function to orchestrate the fetching and storing of data for a given list of instruments.
//  * @param {string[]} instrumentsToFetch - A list of instrument keys to process.
//  */
// export async function fetchAndStoreData(instrumentsToFetch) {
//     const startMainTime = performance.now();
//     log('info', `--- SCRIPT STARTING FOR ${instrumentsToFetch.length} INSTRUMENTS ---`);

//     const limit = pLimit(CONCURRENCY_LIMIT);
//     const session = axios.create();

//     const allTasks = instrumentsToFetch.map(instrument =>
//         limit(() => processInstrument(limit, session, instrument))
//     );

//     await Promise.all(allTasks);

//     const mainDuration = (performance.now() - startMainTime) / 1000;
//     log('info', `\n=== Script finished in ${mainDuration.toFixed(2)} seconds ===`);
// }

// // ==============================================================================
// // SCRIPT ENTRY POINT
// // ==============================================================================

// // Self-invoking async function to run the script
// (async () => {
//     // This is where you define the list of instruments you want to run.
//     const exampleInstruments = [
//         'NSE_EQ|INE002A01018',   // Reliance Industries
//         // 'NSE_EQ|INE090A01021',   // ICICI Bank
//         // 'NSE_EQ|INE476A01028',   // HDFC Bank
//         // 'NSE_EQ|INE155A01022',   // HDFC Ltd. (pre-merger)
//         // 'NSE_EQ|INE062A01020',
//         // 'NSE_FO|44833'          // TATA MOTORS
//     ];

//     if (!fs.existsSync(DB_NAME)) {
//         log('info', `Database file '${DB_NAME}' not found, will be created on first run.`);
//     }

//     try {
//         // Call the main function with the list of instruments.
//         await fetchAndStoreData(exampleInstruments);
//     } catch (error) {
//         log('error', `An unexpected top-level error occurred: ${error.stack}`);
//     }
// })();
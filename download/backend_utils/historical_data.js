const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { format, parse, add, getDay, addDays, subDays, min } = require('date-fns');

// --- Configuration ---
const API_BASE_URL = "https://api.upstox.com/v3/historical-candle";
const INTERVALS = ['minutes'];
const GLOBAL_START_DATE = "2025-01-01";
const END_DATE = format(new Date(), 'yyyy-MM-dd');

// --- Helper Functions ---
const log = (level, message) => {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    console.log(`${timestamp} - ${level.toUpperCase()} - ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class ConcurrentProcessor {
    constructor({
        endpoints,
        concurrentRequests = 50,
        clientRefreshThreshold = 200,
        maxRetries = 3
    }) {
        this.endpoints = endpoints;
        this.concurrentRequests = concurrentRequests;
        this.clientRefreshThreshold = clientRefreshThreshold;
        this.maxRetries = maxRetries;
        this.taskQueue = this.endpoints.map(url => ({ url, retryCount: 0 }));
        this.successfulResponses = [];
        this.failedTasks = [];
        this.totalRequestsFired = 0;
        this.totalSuccessCount = 0;
        this.totalFailureCount = 0;
        this.jar = null;
        this.client = null;
    }

    async _handshake(client) {
        try {
            if (this.endpoints.length === 0) return true;
            const baseUrl = new URL(this.endpoints[0]).origin;
            const r = await client.get(baseUrl, { validateStatus: () => true });
            log('info', `Handshake to ${baseUrl} -> ${r.status}`);
            return r.status < 500;
        } catch (e) {
            log('error', `Handshake failed with a network error: ${e.constructor.name} -> ${e.message}`);
            return false;
        }
    }

    async _fireRequest(client, url) {
        try {
            const r = await client.get(url, { validateStatus: () => true });
            return r;
        } catch (e) {
            return e;
        }
    }

    _handleRetry(url, retryCount, reason) {
        if (retryCount < this.maxRetries) {
            const newRetryCount = retryCount + 1;
            log('warn', `Retrying ${url} (attempt ${newRetryCount}/${this.maxRetries}) due to: ${reason}`);
            this.taskQueue.push({ url, retryCount: newRetryCount });
        } else {
            log('error', `Task ${url} failed after ${this.maxRetries} retries. Reason: ${reason}. Giving up.`);
            this.failedTasks.push({ url, reason });
            this.totalFailureCount += 1;
        }
    }

    async run() {
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            timeout: 30000,
            jar: this.jar
        }));

        log('info', "\n=== Initializing single AxiosClient and performing initial handshake... ===");
        if (!await this._handshake(this.client)) {
            log('error', "Initial handshake failed. Aborting run.");
            return [
                [], this.endpoints.map(url => ({ url, reason: "Initial handshake failed" }))
            ];
        }

        let requestsWithCurrentSession = 0;
        while (this.taskQueue.length > 0) {
            const batchSize = Math.min(this.concurrentRequests, this.taskQueue.length);
            const currentBatch = Array.from({ length: batchSize }, () => this.taskQueue.shift());

            const tasks = currentBatch.map(({ url }) => this._fireRequest(this.client, url));
            const results = await Promise.all(tasks);

            this.totalRequestsFired += batchSize;
            requestsWithCurrentSession += batchSize;
            let got429 = false;

            results.forEach((result, index) => {
                const { url, retryCount } = currentBatch[index];
                if (result instanceof Error) {
                    this._handleRetry(url, retryCount, `RequestError (${result.constructor.name})`);
                } else {
                    if (result.status === 200) {
                        this.successfulResponses.push(result);
                        this.totalSuccessCount += 1;
                    } else if (result.status === 429) {
                        log('warn', `-> 429 Rate Limit Hit for ${url}. Re-queuing task.`);
                        this.taskQueue.push({ url, retryCount });
                        got429 = true;
                    } else if (result.status >= 500) {
                        this._handleRetry(url, retryCount, `Server Error (Status ${result.status})`);
                    } else {
                        const reason = `Client Error (Status ${result.status})`;
                        // Don't log 404s as errors, they are expected for missing data
                        if (result.status !== 404) {
                            log('error', `Task ${url} failed permanently. Reason: ${reason}`);
                        }
                        this.failedTasks.push({ url, reason });
                        this.totalFailureCount += 1;
                    }
                }
            });

            log('info',
                `Batch Complete -> Success: ${this.totalSuccessCount}, Fail: ${this.totalFailureCount} | ` +
                `Attempted: ${this.totalRequestsFired} | Session Reqs: ${requestsWithCurrentSession} | ` +
                `Queue: ${this.taskQueue.length}`
            );

            if ((got429 || requestsWithCurrentSession >= this.clientRefreshThreshold) && this.taskQueue.length > 0) {
                if (got429) {
                    log('info', "\n>>> Rate limit detected. Clearing cookies and re-handshaking after a delay.");
                    await sleep(2000 + Math.random() * 2000);
                } else {
                    log('info', `\n>>> Client refresh threshold (${this.clientRefreshThreshold}) reached. Clearing cookies and re-handshaking.`);
                }

                this.jar.removeAllCookiesSync();
                requestsWithCurrentSession = 0;

                if (!await this._handshake(this.client)) {
                    log('error', "Re-handshake failed. Re-queuing batch and pausing before next attempt.");
                    this.taskQueue.unshift(...currentBatch);
                    await sleep(5000);
                }
            }
        }

        log('info', `\n--- Processing Complete ---`);
        log('info', `Final Score -> Total Succeeded: ${this.successfulResponses.length}, Total Failed: ${this.failedTasks.length}`);
        return [this.successfulResponses, this.failedTasks];
    }
}

async function prepareCsvAndGetStartDate(filePath, defaultStartDate) {
    try {
        await fs.access(filePath);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n');

        if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
            return defaultStartDate;
        }

        const lastLine = lines[lines.length - 1];
        const lastTimestamp = lastLine.split(',')[0];
        const fetchStartDate = lastTimestamp.slice(0, 10);

        const contentToKeep = lines.filter(line => !line.startsWith(fetchStartDate));
        const newContent = contentToKeep.join('\n') + (contentToKeep.length > 0 ? '\n' : '');

        await fs.writeFile(filePath, newContent, 'utf-8');
        log('info', `[${path.basename(filePath)}] Last entry on ${lastTimestamp}. Re-fetching from ${fetchStartDate}.`);
        return fetchStartDate;

    } catch (error) {
        log('info', `[${path.basename(filePath)}] New file. Creating and fetching from ${defaultStartDate}.`);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, '');
        return defaultStartDate;
    }
}

async function sortAndAppendData(filePath, allCandles) {
    if (!allCandles || allCandles.length === 0) {
        return;
    }
    try {
        // Create a Set of existing timestamps to prevent duplicates
        const existingContent = await fs.readFile(filePath, 'utf-8');
        const existingTimestamps = new Set(existingContent.split('\n').map(line => line.split(',')[0]));

        const newUniqueCandles = allCandles.filter(candle => !existingTimestamps.has(candle[0]));
        
        if (newUniqueCandles.length === 0) {
            log('info', `[${path.basename(filePath)}] No new unique rows to append.`);
            return;
        }

        // Combine, sort, and save
        const allLines = existingContent.trim().split('\n').filter(Boolean); // Read existing lines, remove empty ones
        const combinedData = [...allLines, ...newUniqueCandles.map(c => c.join(','))];
        
        combinedData.sort((a, b) => a.split(',')[0].localeCompare(b.split(',')[0]));

        const csvContent = combinedData.join('\n') + '\n';
        await fs.writeFile(filePath, csvContent, 'utf-8');

        log('info', `✅ [${path.basename(filePath)}] Wrote ${combinedData.length} total rows (${newUniqueCandles.length} new).`);
    } catch (e) {
        log('error', `[${path.basename(filePath)}] CSV Write/Append Error: ${e.message}`);
    }
}

function adjustDateToWeekday(dateObj, isStartDate) {
    const weekday = getDay(dateObj);
    if (isStartDate) {
        if (weekday === 6) return addDays(dateObj, 2); // Sat -> Mon
        if (weekday === 0) return addDays(dateObj, 1);  // Sun -> Mon
    } else {
        if (weekday === 6) return subDays(dateObj, 1); // Sat -> Fri
        if (weekday === 0) return subDays(dateObj, 2);  // Sun -> Fri
    }
    return dateObj;
}

function getDateRanges(startDateStr, endDateStr) {
    let startDate = adjustDateToWeekday(parse(startDateStr, 'yyyy-MM-dd', new Date()), true);
    let endDate = adjustDateToWeekday(parse(endDateStr, 'yyyy-MM-dd', new Date()), false);
    if (startDate > endDate) return [];

    const delta = { days: 28 };
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

// --- Main fetchAndStoreData function with PROBE logic ---
async function fetchAndStoreData(itemsToFetch, rootPath, options = {}) {
    const {
        concurrentRequests = 200,
        clientRefreshThreshold = 200,
        maxRetries = 3
    } = options;

    const startMainTime = performance.now();
    log('info', `--- SCRIPT STARTING FOR ${itemsToFetch.length} INSTRUMENTS ---`);

    const dataToSave = {};

    // =========================================================================
    // == STAGE 1: PROBE - Fetch most recent historical chunk for each instrument
    // =========================================================================
    log('info', '--- Stage 1: Creating HISTORICAL PROBE tasks ---');
    const probeUrls = [];
    const probeUrlMetadataMap = {};
    const instrumentDateRanges = {};

    for (const item of itemsToFetch) {
        for (const interval of INTERVALS) {
            const uniqueKey = `${item.instrument_key}_${interval}`;
            const fileName = `${item.trading_symbol.replace(/\|/g, '_')}.txt`;
            const filePath = path.join(rootPath, fileName);
            
            const startDate = await prepareCsvAndGetStartDate(filePath, GLOBAL_START_DATE);
            const dateRanges = getDateRanges(startDate, END_DATE);
            instrumentDateRanges[uniqueKey] = dateRanges;

            if (dateRanges.length > 0) {
                const probeRange = dateRanges[dateRanges.length - 1];
                const url = `${API_BASE_URL}/${encodeURIComponent(item.instrument_key)}/${interval}/1/${probeRange.to}/${probeRange.from}`;
                probeUrls.push(url);
                probeUrlMetadataMap[url] = { filePath, uniqueKey };
            }
        }
    }
    
    const validCombos = new Set();
    if (probeUrls.length > 0) {
        log('info', `Created ${probeUrls.length} probe tasks. Running historical probe...`);
        const probeProcessor = new ConcurrentProcessor({ endpoints: probeUrls, ...options });
        const [probeSuccesses, _] = await probeProcessor.run();

        log('info', "\n--- Analyzing historical probe results ---");
        for (const response of probeSuccesses) {
            const url = response.config.url;
            const metadata = probeUrlMetadataMap[url];
            const candles = response.data?.data?.candles || [];
            if (candles.length > 0) {
                log('info', `Probe SUCCESS for ${metadata.uniqueKey}. Will fetch full history.`);
                validCombos.add(metadata.uniqueKey);
                if (!dataToSave[metadata.filePath]) dataToSave[metadata.filePath] = [];
                dataToSave[metadata.filePath].push(...candles);
            } else {
                log('info', `Probe found NO DATA for ${metadata.uniqueKey}.`);
            }
        }
    }

    // =========================================================================
    // == STAGE 2: INTRADAY - Fetch today's data for ALL instruments
    // =========================================================================
    log('info', '\n--- Stage 2: Creating INTRADAY tasks for all instruments ---');
    const intradayUrls = [];
    const intradayUrlMetadataMap = {};
    for (const item of itemsToFetch) {
        const fileName = `${item.trading_symbol.replace(/\|/g, '_')}.txt`;
        const filePath = path.join(rootPath, fileName);
        const url = `${API_BASE_URL}/intraday/${encodeURIComponent(item.instrument_key)}/minutes/1`;
        intradayUrls.push(url);
        intradayUrlMetadataMap[url] = { filePath };
    }

    if (intradayUrls.length > 0) {
        log('info', `Created ${intradayUrls.length} intraday tasks. Running intraday fetch...`);
        const intradayProcessor = new ConcurrentProcessor({ endpoints: intradayUrls, ...options });
        const [intradaySuccesses, _] = await intradayProcessor.run();

        log('info', "\n--- Analyzing intraday results ---");
        for (const response of intradaySuccesses) {
            const url = response.config.url;
            const metadata = intradayUrlMetadataMap[url];
            const candles = response.data?.data?.candles || [];
            if (candles.length > 0) {
                if (!dataToSave[metadata.filePath]) dataToSave[metadata.filePath] = [];
                dataToSave[metadata.filePath].push(...candles);
            }
        }
    }


    // ======================================================================
    // == STAGE 3: MAIN FETCH - Fetch remaining history for valid instruments
    // ======================================================================
    log('info', '\n--- Stage 3: Creating MAIN tasks for full history of valid instruments ---');
    const mainUrls = [];
    const mainUrlMetadataMap = {};

    for (const item of itemsToFetch) {
        for (const interval of INTERVALS) {
            const uniqueKey = `${item.instrument_key}_${interval}`;
            if (!validCombos.has(uniqueKey)) continue;
            
            const fileName = `${item.trading_symbol.replace(/\|/g, '_')}.txt`;
            const filePath = path.join(rootPath, fileName);
            const dateRanges = instrumentDateRanges[uniqueKey];
            
            const rangesToFetch = dateRanges.slice(0, -1); 

            for (const range of rangesToFetch) {
                const url = `${API_BASE_URL}/${encodeURIComponent(item.instrument_key)}/${interval}/1/${range.to}/${range.from}`;
                mainUrls.push(url);
                mainUrlMetadataMap[url] = { filePath };
            }
        }
    }
    
    if (mainUrls.length > 0) {
        log('info', `A total of ${mainUrls.length} main API requests will be made.`);
        const mainProcessor = new ConcurrentProcessor({ endpoints: mainUrls, ...options });
        const [mainSuccesses, _] = await mainProcessor.run();

        for (const response of mainSuccesses) {
            const url = response.config.url;
            const metadata = mainUrlMetadataMap[url];
            if (metadata) {
                const candles = response.data?.data?.candles || [];
                if (!dataToSave[metadata.filePath]) dataToSave[metadata.filePath] = [];
                dataToSave[metadata.filePath].push(...candles);
            }
        }
    } else {
        log('info', 'No further historical data needed beyond the probe results.');
    }

    // =============================================
    // == STAGE 4: SAVE - Write all aggregated data
    // =============================================
    log('info', '\n--- Stage 4: Saving all aggregated data to respective files ---');
    const saveTasks = Object.entries(dataToSave).map(([filePath, candles]) =>
        sortAndAppendData(filePath, candles)
    );
    await Promise.all(saveTasks);

    const mainDuration = (performance.now() - startMainTime) / 1000;
    log('info', `\n=== Script finished in ${mainDuration.toFixed(2)} seconds ===`);
}

module.exports = {
    fetchAndStoreData
};
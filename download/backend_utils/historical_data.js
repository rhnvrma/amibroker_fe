const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { format, parse, add, getDay, addDays, subDays, min } = require('date-fns');

// --- Configuration ---
const API_BASE_URL = "https://api.upstox.com/v3/historical-candle";
const INTERVALS = ['minutes'];
const GLOBAL_START_DATE = "2023-01-01";
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
            return [[], this.endpoints.map(url => ({url, reason: "Initial handshake failed"}))];
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
                        log('error', `Task ${url} failed permanently. Reason: ${reason}`);
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
        const trimmedContent = fileContent.trim();
        if (!trimmedContent) {
            return defaultStartDate;
        }
        const lines = trimmedContent.split('\n');
        const lastLine = lines[lines.length - 1];
        const lastTimestamp = lastLine.split(',')[0];
        const fetchStartDate = lastTimestamp.slice(0, 10);

        const contentToKeep = lines.slice(1).filter(line => !line.startsWith(fetchStartDate));
        const newContent = contentToKeep.join('\n') + (contentToKeep.length > 0 ? '\n' : '');
        
        await fs.writeFile(filePath, newContent, 'utf-8');
        log('info', `[${path.basename(filePath)}] Last entry on ${lastTimestamp}. Re-fetching from ${fetchStartDate}.`);
        return fetchStartDate;

    } catch (error) {
        log('info', `[${path.basename(filePath)}] New file. Creating and fetching from ${defaultStartDate}.`);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath,'');
        return defaultStartDate;
    }
}

async function sortAndAppendData(filePath, allCandles) {
    if (!allCandles || allCandles.length === 0) {
        return;
    }
    try {
        allCandles.sort((a, b) => a[0].localeCompare(b[0]));
        const csvRows = allCandles.map(candle => candle.join(',')).join('\n') + '\n';
        await fs.appendFile(filePath, csvRows, 'utf-8');
        log('info', `✅ [${path.basename(filePath)}] Appended ${allCandles.length} new rows.`);
    } catch (e) {
        log('error', `[${path.basename(filePath)}] CSV Append Error: ${e.message}`);
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


async function fetchAndStoreData(itemsToFetch, rootPath, options = {}) {
    const {
        concurrentRequests = 200,
        clientRefreshThreshold = 200,
        maxRetries = 3
    } = options;

    const startMainTime = performance.now();
    log('info', `--- SCRIPT STARTING FOR ${itemsToFetch.length} INSTRUMENTS ---`);

    // 1. Prepare all URLs and metadata
    log('info', 'Preparing all API requests...');
    const allUrls = [];
    const urlMetadataMap = {};

    for (const item of itemsToFetch) {
        for (const interval of INTERVALS) {
            const fileName = `${item.trading_symbol.replace(/\|/g, '_')}.txt`;
            const filePath = path.join(rootPath, fileName);
            
            const startDate = await prepareCsvAndGetStartDate(filePath, GLOBAL_START_DATE);
            const dateRanges = getDateRanges(startDate, END_DATE);

            for (const range of dateRanges) {
                // IMPORTANT: The Upstox API v3 uses to_date before from_date in the URL path
                const url = `${API_BASE_URL}/${encodeURIComponent(item.instrument_key)}/${interval}/1/${range.to}/${range.from}`;
                allUrls.push(url);
                urlMetadataMap[url] = { filePath };
            }
        }
    }
    
    if (allUrls.length === 0) {
        log('info', 'All data is already up-to-date. Nothing to fetch.');
        return;
    }

    log('info', `A total of ${allUrls.length} API requests will be made.`);

    // 2. Run the processor with all URLs
    const processor = new ConcurrentProcessor({
        endpoints: allUrls,
        concurrentRequests,
        clientRefreshThreshold,
        maxRetries
    });
    const [successes, failures] = await processor.run();

    // 3. Aggregate results by file
    log('info', 'Aggregating downloaded data...');
    const dataToSave = {};
    for (const response of successes) {
        const url = response.config.url;
        const metadata = urlMetadataMap[url];
        if (metadata) {
            const candles = response.data?.data?.candles || [];
            if (!dataToSave[metadata.filePath]) {
                dataToSave[metadata.filePath] = [];
            }
            dataToSave[metadata.filePath].push(...candles);
        }
    }

    // 4. Save data to files
    log('info', 'Saving data to respective files...');
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
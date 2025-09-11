const net = require("net");

/**
 * Sends a UTF-8 message to a Windows named pipe.
 * Logs errors instead of throwing.
 * @param {string} pipeName - The name of the pipe (e.g., "MyTestPipe").
 * @param {string} message - The message to send.
 * @returns {Promise<void>}
 */
function sendToPipe(pipeName, message) {
  return new Promise((resolve) => {
    const pipePath = `\\\\.\\pipe\\${pipeName}`;

    const client = net.createConnection(pipePath, () => {
      const buffer = Buffer.from(message, "utf8");
      client.write(buffer);
      client.end();
    });

    client.on("end", resolve);

    client.on("error", (err) => {
      console.error(`[sendToPipe] Failed to send to pipe "${pipeName}":`, err.message);
      resolve(); // don't reject, just finish
    });

    // optional: fail fast if pipe doesn't respond in time
    client.setTimeout(3000, () => {
      console.error(`[sendToPipe] Timeout while sending to pipe "${pipeName}"`);
      client.destroy();
      resolve();
    });
  });
}

module.exports = { sendToPipe };

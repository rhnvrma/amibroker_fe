const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const otpauth = require('otpauth');
const path = require('path');
const fs = require("fs");

const SERVICE_URL = 'https://service.upstox.com/';

/**
 * Checks if a valid, existing access token can be used.
 * @param {string} rootFolder - The folder where the access_token.txt file is stored.
 * @returns {Promise<object|null>} - A promise that resolves with the login result if the token is valid, otherwise null.
 */
async function checkExistingToken(rootFolder) {
    console.log("Step 0: Checking for an existing token...");

    if (!rootFolder || !fs.existsSync(rootFolder)) {
        console.log("   -> Root folder not provided or does not exist. Skipping check.");
        return null;
    }

    const tokenFilePath = path.join(rootFolder, "access_token.txt");

    if (!fs.existsSync(tokenFilePath)) {
        console.log("   -> Token file not found. Proceeding with full login.");
        return null;
    }

    const content = fs.readFileSync(tokenFilePath, "utf-8").trim();

    if (content.length === 0) {
        console.log("   -> Token file is empty. Proceeding with full login.");
        return null;
    }

    const lines = content.split(/\r?\n/);
    const access_token = lines[0] || "";
    const refresh_token = lines[1] || "";
    const cookie = `access_token=${access_token};refresh_token=${refresh_token}`;

    try {
        const checkRes = await axios.get(`${SERVICE_URL}profile/v5/client-info`, {
            headers: { Cookie: cookie },
        });

        if (checkRes.status === 200) {
            console.log("✅ Token is valid, skipping login flow.");
            return {
                success: true,
                token: content,
                refreshedItems: [], // You could potentially send client-info back here
            };
        } else {
            console.log("⚠️ Token check failed with status:", checkRes.status);
            return null;
        }
    } catch (err) {
        console.log("⚠️ Token is invalid, proceeding with full login flow...");
        return null;
    }
}


/**
 * Performs login to the Upstox API.
 * @param {object} credentials - The user's API credentials.
 * @param {string} credentials.apiKey
 * @param {string} credentials.apiSecret
 * @param {string} credentials.mobileNumber
 * @param {string} credentials.pin
 * @param {string} credentials.toptSecret
 * @param {string} credentials.rootFolder
 * @returns {Promise<object>} - A promise that resolves with the login result.
 */
async function loginToUpstox(credentials) {
    console.log("Attempting to log in with credentials:", { ...credentials });
    const { apiKey, apiSecret, mobileNumber, pin, toptSecret, rootFolder } = credentials;

    // If no valid existing token, proceed with the full login flow
    const { wrapper } = await import('axios-cookiejar-support');
    const BASE_URL = "https://api.upstox.com/v2";
    const REDIRECT_URL = "http://localhost";

    try {
        const jar = new CookieJar();
        const session = wrapper(axios.create({ jar, withCredentials: true }));

        // 1. Get Authorization Dialog
        const authDialogUrl = new URL(`${BASE_URL}/login/authorization/dialog`);
        authDialogUrl.search = new URLSearchParams({
            client_id: apiKey,
            redirect_uri: REDIRECT_URL,
            response_type: "code",
            scope: "general",
            state: "123"
        }).toString();

        console.log("Step 1: Requesting authorization dialog...");
        let userId, clientIdFromRedirect;
        try {
            await session.get(authDialogUrl.toString(), { maxRedirects: 0 });
        } catch (error) {
            if (error.response && error.response.status === 302) {
                const location = error.response.headers.location;
                const redirectUrlParams = new URL(location).searchParams;
                userId = redirectUrlParams.get('user_id');
                clientIdFromRedirect = redirectUrlParams.get('client_id');
                console.log(`    -> Success! Extracted userId: ${userId}`);
            } else {
                throw new Error("Failed to get initial redirect for user_id.", { cause: error });
            }
        }
        if (!userId) throw new Error("Could not extract user_id.");

        session.defaults.headers.common['x-device-details'] = 'platform=WEB|osName=Windows/10|osVersion=Chrome/131.0.0.0|appVersion=4.0.0|modelName=Chrome|manufacturer=unknown|uuid=YSBB6dKYEDtLd0gKuQhe|userAgent=Upstox 3.0 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
        session.defaults.headers.post['Content-Type'] = 'application/json';

        // 2. Generate 1FA OTP validation token
        console.log("Step 2: Generating 1FA OTP token...");
        const otpGenerateResponse = await session.post(`${SERVICE_URL}login/open/v6/auth/1fa/otp/generate`, {
            data: { mobileNumber: mobileNumber, userId: userId }
        });
        const validateOTPToken = otpGenerateResponse.data.data.validateOTPToken;
        console.log("    -> Success! Received OTP validation token.");

        // 3. Verify TOTP
        const totp = new otpauth.TOTP({ secret: otpauth.Secret.fromBase32(toptSecret) });
        console.log("Step 3: Verifying TOTP...");
        await session.post(`${SERVICE_URL}login/open/v4/auth/1fa/otp-totp/verify`, {
            data: { otp: totp.generate(), validateOtpToken: validateOTPToken }
        });
        console.log("    -> Success! TOTP verified.");

        // 4. Perform 2FA with PIN. This request's response will set the auth cookies.
        const encodedPin = Buffer.from(pin).toString('base64');
        const twoFaUrl = new URL(`${SERVICE_URL}login/open/v3/auth/2fa`);
        twoFaUrl.search = new URLSearchParams({
            client_id: clientIdFromRedirect,
            redirect_uri: 'https://api-v2.upstox.com/login/authorization/redirect'
        }).toString();
        
        console.log("Step 4: Performing 2FA with PIN...");
        await session.post(twoFaUrl.toString(), {
            data: { twoFAMethod: "SECRET_PIN", inputText: encodedPin }
        });
        console.log("    -> Success! 2FA response received, cookies should be set.");

        // 5. Extract tokens by reading the cookies from the jar
        console.log("Step 5: Extracting tokens from cookie jar...");
        
        const cookies = jar.getCookiesSync(SERVICE_URL);
        
        const accessTokenCookie = cookies.find(cookie => cookie.key === 'access_token');
        const refreshTokenCookie = cookies.find(cookie => cookie.key === 'refresh_token');

        if (!accessTokenCookie) {
            console.error("Failed to find 'access_token' cookie. All cookies found:", JSON.stringify(cookies, null, 2));
            throw new Error("Could not find access_token cookie in the jar.");
        }

        const accessToken = accessTokenCookie.value;
        const refreshToken = refreshTokenCookie ? refreshTokenCookie.value : null;
        
        console.log("\n✅ Successfully obtained Access Token!");

        return {
            success: true,
            token: `${accessToken}\n${refreshToken}`,
            refreshedItems: [],
        };

    } catch (error) {
        console.error("Upstox login error:", error.message);
        if (error.response) {
            console.error("    - Status:", error.response.status);
            console.error("    - Data:", JSON.stringify(error.response.data, null, 2));
        } else if (error.cause) {
            console.error("    - Caused by:", error.cause);
        }
        return {
            success: false,
            error: error.response?.data?.errors?.[0]?.message || error.message || "An unknown error occurred during login.",
        };
    }
}

module.exports = { loginToUpstox, checkExistingToken };

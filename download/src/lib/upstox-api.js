const { CookieJar } = require('tough-cookie');
const otpauth = require('otpauth');
const path = require('path');
const fs = require("fs");

const SERVICE_URL = 'https://service.upstox.com/';

/**
 * A helper function to manage fetch requests and cookie handling.
 * This version correctly handles multiple 'set-cookie' headers.
 * @param {string} url - The URL to fetch.
 * @param {object} options - The options for the fetch request.
 * @param {CookieJar} jar - The cookie jar instance.
 * @returns {Promise<Response>} - A promise that resolves with the fetch response.
 */
async function fetchWithCookies(url, options, jar) {
    const cookieString = await jar.getCookieString(url);
    if (cookieString) {
        options.headers = { ...options.headers, 'Cookie': cookieString };
    }

    const response = await fetch(url, options);

    // This is the corrected part. The 'Headers' object is iterable.
    // We check for the 'set-cookie' header specifically.
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
         // tough-cookie can handle the combined header string
        await jar.setCookie(setCookieHeader, response.url);
    }
    
    return response;
}

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
    const cookie = `access_token=${access_token}`;

    try {
        const response = await fetch(`${SERVICE_URL}profile/v5/client-info`, {
            headers: { 'Cookie': cookie },
        });

        if (response.ok) {
            console.log("✅ Token is valid, skipping login flow.");
            return {
                success: true,
                token: content,
                refreshedItems: [],
            };
        } else {
            console.log("⚠️ Token check failed with status:", response.status);
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
 * @returns {Promise<object>} - A promise that resolves with the login result.
 */
async function loginToUpstox(credentials) {
    console.log("Attempting to log in with credentials:", { ...credentials });
    const { apiKey, mobileNumber, pin, toptSecret } = credentials;
    
    const BASE_URL = "https://api.upstox.com/v2";
    const REDIRECT_URL = "http://localhost";
    const jar = new CookieJar();

    try {
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
        
        const initialAuthResponse = await fetchWithCookies(authDialogUrl.toString(), { redirect: 'manual' }, jar);
        
        const location = initialAuthResponse.headers.get('location');
        if (location) {
            const redirectUrlParams = new URL(location).searchParams;
            userId = redirectUrlParams.get('user_id');
            clientIdFromRedirect = redirectUrlParams.get('client_id');
            console.log(`    -> Success! Extracted userId: ${userId}`);
        } else {
             throw new Error("Failed to get initial redirect for user_id.");
        }

        if (!userId) throw new Error("Could not extract user_id.");

        const commonHeaders = {
            'x-device-details': 'platform=WEB|osName=Windows/10|osVersion=Chrome/131.0.0.0|appVersion=4.0.0|modelName=Chrome|manufacturer=unknown|uuid=YSBB6dKYEDtLd0gKuQhe|userAgent=Upstox 3.0 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Content-Type': 'application/json'
        };

        // 2. Generate 1FA OTP validation token
        console.log("Step 2: Generating 1FA OTP token...");
        const otpGenerateResponse = await fetchWithCookies(`${SERVICE_URL}login/open/v6/auth/1fa/otp/generate`, {
            method: 'POST',
            headers: commonHeaders,
            body: JSON.stringify({ data: { mobileNumber: mobileNumber, userId: userId } })
        }, jar);
        const otpGenerateData = await otpGenerateResponse.json();
        const validateOTPToken = otpGenerateData.data.validateOTPToken;
        console.log("    -> Success! Received OTP validation token.");

        // 3. Verify TOTP
        const totp = new otpauth.TOTP({ secret: otpauth.Secret.fromBase32(toptSecret) });
        console.log("Step 3: Verifying TOTP...");
        await fetchWithCookies(`${SERVICE_URL}login/open/v4/auth/1fa/otp-totp/verify`, {
            method: 'POST',
            headers: commonHeaders,
            body: JSON.stringify({ data: { otp: totp.generate(), validateOtpToken: validateOTPToken } })
        }, jar);
        console.log("    -> Success! TOTP verified.");

        // 4. Perform 2FA with PIN
        const encodedPin = Buffer.from(pin).toString('base64');
        const twoFaUrl = new URL(`${SERVICE_URL}login/open/v3/auth/2fa`);
        twoFaUrl.search = new URLSearchParams({
            client_id: clientIdFromRedirect,
            redirect_uri: 'https://api-v2.upstox.com/login/authorization/redirect'
        }).toString();
        
        console.log("Step 4: Performing 2FA with PIN...");
        await fetchWithCookies(twoFaUrl.toString(), {
            method: 'POST',
            headers: commonHeaders,
            body: JSON.stringify({ data: { twoFAMethod: "SECRET_PIN", inputText: encodedPin } })
        }, jar);
        console.log("    -> Success! 2FA response received, cookies should be set.");

        // 5. Extract tokens from cookie jar
        console.log("Step 5: Extracting tokens from cookie jar...");
        
        const cookies = await jar.getCookies(SERVICE_URL);
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
        if (error.cause) {
            console.error("    - Caused by:", error.cause);
        }
        return {
            success: false,
            error: error.message || "An unknown error occurred during login.",
        };
    }
}

module.exports = { loginToUpstox, checkExistingToken };
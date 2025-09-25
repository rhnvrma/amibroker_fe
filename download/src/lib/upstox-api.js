const { CookieJar } = require('tough-cookie');
const otpauth = require('otpauth');
const { URL, URLSearchParams } = require('url');

// --- Configuration ---
const BASE_URL = "https://api.upstox.com/v2";
const SERVICE_URL = 'https://service.upstox.com/';
const REDIRECT_URL = "http://localhost";

/**
 * A helper function to manage fetch requests and cookie handling.
 * It automatically adds cookies to requests and saves cookies from responses.
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

    // `getSetCookie()` is a Node.js extension to fetch that correctly
    // handles multiple 'set-cookie' headers.
    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders && setCookieHeaders.length > 0) {
        // Use Promise.all to handle all cookie setting operations concurrently
        await Promise.all(
            setCookieHeaders.map(header => jar.setCookie(header, response.url))
        );
    }
    
    return response;
}

/**
 * Performs login to the Upstox API using the provided credentials.
 * @param {object} credentials - The user's API credentials.
 * @returns {Promise<object>} - A promise that resolves with the login result.
 */
async function loginToUpstox(credentials) {
    const { apiKey, mobileNumber, pin, toptSecret } = credentials;
    const jar = new CookieJar();

    try {
        // 1. Get Authorization Dialog to extract user_id and client_id
        console.log("Step 1: Requesting authorization dialog...");
        const authDialogUrl = new URL(`${BASE_URL}/login/authorization/dialog`);
        authDialogUrl.search = new URLSearchParams({
            client_id: apiKey,
            redirect_uri: REDIRECT_URL,
            response_type: "code",
            scope: "general",
            state: "123"
        }).toString();

        const initialAuthResponse = await fetchWithCookies(authDialogUrl.toString(), { redirect: 'manual' }, jar);
        
        const location = initialAuthResponse.headers.get('location');
        if (!location) {
            throw new Error("Failed to get initial redirect for user_id. Check API Key.");
        }

        const redirectUrlParams = new URL(location).searchParams;
        const userId = redirectUrlParams.get('user_id');
        const clientIdFromRedirect = redirectUrlParams.get('client_id');
        console.log(`   -> Success! Extracted userId: ${userId}`);

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
        console.log("   -> Success! Received OTP validation token.");

        // 3. Verify TOTP
        console.log("Step 3: Verifying TOTP...");
        const totp = new otpauth.TOTP({ secret: otpauth.Secret.fromBase32(toptSecret) });
        await fetchWithCookies(`${SERVICE_URL}login/open/v4/auth/1fa/otp-totp/verify`, {
            method: 'POST',
            headers: commonHeaders,
            body: JSON.stringify({ data: { otp: totp.generate(), validateOtpToken: validateOTPToken } })
        }, jar);
        console.log("   -> Success! TOTP verified.");

        // 4. Perform 2FA with PIN
        console.log("Step 4: Performing 2FA with PIN...");
        const encodedPin = Buffer.from(pin).toString('base64');
        const twoFaUrl = new URL(`${SERVICE_URL}login/open/v3/auth/2fa`);
        twoFaUrl.search = new URLSearchParams({
            client_id: clientIdFromRedirect,
            redirect_uri: 'https://api-v2.upstox.com/login/authorization/redirect'
        }).toString();
        
        const twoFaResponse = await fetchWithCookies(twoFaUrl.toString(), {
            method: 'POST',
            headers: commonHeaders,
            body: JSON.stringify({ data: { twoFAMethod: "SECRET_PIN", inputText: encodedPin } })
        }, jar);

        // Check if 2FA was successful before proceeding
        if (!twoFaResponse.ok) {
            const errorBody = await twoFaResponse.json();
            console.error("   -> 2FA failed with status:", twoFaResponse.status);
            console.error("   -> 2FA Response Body:", JSON.stringify(errorBody));
            throw new Error(errorBody.error.message || "2FA with PIN failed.");
        }
        console.log("   -> Success! 2FA response received, cookies should be set.");

        // 5. Extract tokens from the cookie jar
        console.log("Step 5: Extracting tokens from cookie jar...");
        const cookies = await jar.getCookies(SERVICE_URL);
        const accessTokenCookie = cookies.find(cookie => cookie.key === 'access_token');
        const refreshTokenCookie = cookies.find(cookie => cookie.key === 'refresh_token');

        if (!accessTokenCookie) {
            throw new Error("Could not find access_token cookie after login.");
        }

        const accessToken = accessTokenCookie.value;
        const refreshToken = refreshTokenCookie ? refreshTokenCookie.value : null;
        
        console.log("\n✅ Successfully obtained Access Token! " + `${accessToken}\n${refreshToken}`);

        return {
            success: true,
            token: `${accessToken}\n${refreshToken}`,
            refreshedItems: [],
        };

    } catch (error) {
        console.error("\n❌ Upstox login error:", error.message);
        return {
            success: false,
            error: error.message || "An unknown error occurred during login.",
        };
    }
}

module.exports = { loginToUpstox };
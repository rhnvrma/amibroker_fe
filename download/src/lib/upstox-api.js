const axios = require('axios');
const { CookieJar } = require('tough-cookie');
// const { wrapper } = require('axios-cookiejar-support'); // REMOVE THIS LINE
const otpauth = require('otpauth');

/**
 * Performs login to the Upstox API.
 * @param {object} credentials - The user's API credentials.
 * @param {string} credentials.apiKey
 * @param {string} credentials.apiSecret
 * @param {string} credentials.mobileNumber
 * @param {string} credentials.pin
 * @param {string} credentials.toptSecret
 * @returns {Promise<object>} - A promise that resolves with the login result.
 */
async function loginToUpstox(credentials) {
    console.log("Attempting to log in with credentials:", { ...credentials });

    // --- ADD THE DYNAMIC IMPORT HERE ---
    const { wrapper } = await import('axios-cookiejar-support');

    // Destructure credentials for easier use
    const { apiKey, apiSecret, mobileNumber, pin, toptSecret } = credentials;

    // Define constant URLs
    const BASE_URL = "https://api.upstox.com/v2";
    const SERVICE_URL = 'https://service.upstox.com/';
    const REDIRECT_URL = "http://localhost";

    try {
        // Create an axios instance with a cookie jar to automatically handle cookies
        const jar = new CookieJar();
        const session = wrapper(axios.create({ jar, withCredentials: true }));

        // ... the rest of your login logic remains exactly the same ...

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
                console.log(`   -> Success! Extracted userId: ${userId}`);
            } else {
                throw new Error("Failed to get initial redirect for user_id.", { cause: error });
            }
        }
        if (!userId) throw new Error("Could not extract user_id.");

        // Update session headers
        session.defaults.headers.common['x-device-details'] = 'platform=WEB|osName=Windows/10|osVersion=Chrome/131.0.0.0|appVersion=4.0.0|modelName=Chrome|manufacturer=unknown|uuid=YSBB6dKYEDtLd0gKuQhe|userAgent=Upstox 3.0 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
        session.defaults.headers.post['Content-Type'] = 'application/json';

        // 2. Generate 1FA OTP validation token
        console.log("Step 2: Generating 1FA OTP token...");
        const otpGenerateResponse = await session.post(`${SERVICE_URL}login/open/v6/auth/1fa/otp/generate`, {
            data: { mobileNumber: mobileNumber, userId: userId }
        });
        const validateOTPToken = otpGenerateResponse.data.data.validateOTPToken;
        console.log("   -> Success! Received OTP validation token.");

        // 3. Verify TOTP
        const totp = new otpauth.TOTP({ secret: otpauth.Secret.fromBase32(toptSecret) });
        console.log("Step 3: Verifying TOTP...");
        await session.post(`${SERVICE_URL}login/open/v4/auth/1fa/otp-totp/verify`, {
            data: { otp: totp.generate(), validateOtpToken: validateOTPToken }
        });
        console.log("   -> Success! TOTP verified.");

        // 4. Perform 2FA with PIN
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
        console.log("   -> Success! 2FA with PIN successful.");

        // 5. Authorize OAuth to get the final code
        const oauthAuthorizeUrl = new URL(`${SERVICE_URL}login/v2/oauth/authorize`);
        oauthAuthorizeUrl.search = new URLSearchParams({
            client_id: clientIdFromRedirect,
            redirect_uri: 'https://api-v2.upstox.com/login/authorization/redirect',
            response_type: 'code'
        }).toString();
        console.log("Step 5: Authorizing OAuth application...");
        const finalCodeResponse = await session.post(oauthAuthorizeUrl.toString(), {
            data: { userOAuthApproval: true }
        });
        const finalRedirectUri = finalCodeResponse.data.data.redirectUri;
        const finalCode = new URL(finalRedirectUri).searchParams.get('code');
        console.log(`   -> Success! Received final authorization code: ${finalCode}`);

        // 6. Exchange final code for the access token
        console.log("Step 6: Exchanging code for access token...");
        const tokenResponse = await axios.post(`${BASE_URL}/login/authorization/token`,
            new URLSearchParams({
                code: finalCode,
                client_id: apiKey,
                client_secret: apiSecret,
                redirect_uri: REDIRECT_URL,
                grant_type: 'authorization_code'
            }), {
                headers: {
                    'Api-Version': '2.0',
                    'accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;
        console.log("\n✅ Successfully obtained Access Token!");

        return {
            success: true,
            token: accessToken,
            refreshedItems: [],
        };

    } catch (error) {
        console.error("Upstox login error:", error.message);
        if (error.response) {
            console.error("   - Status:", error.response.status);
            console.error("   - Data:", JSON.stringify(error.response.data, null, 2));
        }
        return {
            success: false,
            error: error.response?.data?.errors?.[0]?.message || error.message || "An unknown error occurred during login.",
        };
    }
}

module.exports = { loginToUpstox };
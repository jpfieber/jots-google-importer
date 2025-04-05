import { GoogleAccount } from '@/models/Account';
import { GoogleCredentials } from '@/types';
import { OAuth2Client } from 'google-auth-library';

const SCOPES = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts.other.readonly',
    'https://www.googleapis.com/auth/directory.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.labels'
];

/**
 * Get an authenticated OAuth2 client.
 * @param credentials - Google API credentials.
 * @param token - OAuth2 token for the account.
 * @returns OAuth2Client or undefined if an error occurs.
 */
export const getAuthClient = async (credentials: GoogleCredentials, token: string | undefined): Promise<OAuth2Client | undefined> => {
    let oAuth2Client: OAuth2Client | undefined;

    if (!token) {
        console.warn('Called getAuthClient with an empty token.');
        return;
    }

    try {
        const { client_id, client_secret, redirect_uris } = credentials;
        oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]); // Use the first redirect URI
    } catch (err) {
        console.warn(`Error initializing OAuth2 client: ${err}`);
        return;
    }

    try {
        oAuth2Client.setCredentials(JSON.parse(token));
    } catch (err) {
        console.warn(`Invalid token for account: ${err}`);
    }

    return oAuth2Client;
};

/**
 * Generate an authentication URL for the user to authorize the app.
 * @param credentials - Google API credentials.
 * @returns The authentication URL or undefined if an error occurs.
 */
export const getAuthURL = async (credentials: GoogleCredentials): Promise<string | undefined> => {
    try {
        console.log('Credentials:', credentials); // Log the credentials object
        const { client_id, client_secret, redirect_uris } = credentials;
        const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            redirect_uri: redirect_uris[0], // Ensure this matches the registered URI
        });
        console.log('Generated Auth URL:', authUrl);
        console.log('Redirect URI:', redirect_uris[0]);
        return authUrl;
    } catch (err: any) {
        console.error(`Error generating auth URL: ${err.message}`);
        return;
    }
};

/**
 * Exchange an authorization code for an OAuth2 token and save it.
 * @param credentials - Google API credentials.
 * @param account - The Google account to associate with the token.
 * @param code - The authorization code from the user.
 * @returns The token as a string or undefined if an error occurs.
 */
export const writeTokenFile = async (credentials: GoogleCredentials, account: GoogleAccount, code: string): Promise<string | undefined> => {
    try {
        const { client_id, client_secret, redirect_uris } = credentials;
        const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]); // Use the first redirect URI
        const token = await oAuth2Client.getToken(code);
        console.log(`Saved token for account: ${account.accountName}`);
		console.log('Redirect URI:', redirect_uris[0]);
        return JSON.stringify(token.tokens);
    } catch (err: any) {
        console.error(`Error exchanging authorization code for token: ${err.message}`);
        return;
    }
};

/**
 * Validate the token and ensure it has the required scopes.
 * @param oAuth2Client - The OAuth2 client with the token set.
 * @returns True if the token is valid and has the required scopes, false otherwise.
 */
export const validateTokenScopes = async (oAuth2Client: OAuth2Client): Promise<boolean> => {
    try {
        const tokenInfo = await oAuth2Client.getTokenInfo(oAuth2Client.credentials.access_token!);
        const missingScopes = SCOPES.filter((scope) => !tokenInfo.scopes.includes(scope));
        if (missingScopes.length > 0) {
            console.warn(`Token is missing required scopes: ${missingScopes.join(', ')}`);
            return false;
        }
        return true;
    } catch (err: any) {
        console.error(`Error validating token scopes: ${err.message}`);
        return false;
    }
};
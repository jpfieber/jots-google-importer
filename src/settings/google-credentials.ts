import GoogleLookupPlugin from '@/main';
import { GoogleCredentials } from '@/types';

export const getGoogleCredentials = (plugin: GoogleLookupPlugin): GoogleCredentials => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { client_id, client_redirect_uri_port, client_secret } = plugin.settings!;

    // Ensure client_redirect_uri_port is a number
    const redirectPort = typeof client_redirect_uri_port === 'string'
        ? parseInt(client_redirect_uri_port, 10)
        : client_redirect_uri_port;

    return {
        client_id,
        client_secret,
        redirect_uris: [`http://127.0.0.1:${redirectPort}`], // Ensure this is an array
        redirect_port: redirectPort
    };
};

export const hasGoogleCredentials = (plugin: GoogleLookupPlugin): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { client_id, client_redirect_uri_port, client_secret } = plugin.settings!;

    return (
        client_id?.length > 0 &&
        client_secret?.length > 0 &&
        client_redirect_uri_port !== undefined
    );
};
import { gmail_v1, gmail } from '@googleapis/gmail';
import { OAuth2Client } from 'google-auth-library';
import { getAuthClient } from './auth';
import { GoogleServiceOptions } from '@/types';

interface GmailQueryOptions {
    service: gmail_v1.Gmail;
    accountName: string;
}

/**
 * Get the Gmail service instance.
 * @param options - Google service options including credentials and token.
 * @returns Gmail service instance.
 */
export const getGmailService = async ({ credentials, token }: GoogleServiceOptions): Promise<gmail_v1.Gmail> => {
    try {
        // Get the OAuth2Client from the auth utility
        const authClient = (await getAuthClient(credentials, token)) as OAuth2Client;

        // Return the Gmail service instance with the authenticated client
        return gmail({ version: 'v1', auth: authClient as any }); // Explicitly cast authClient to any
    } catch (err: any) {
        console.error(`Failed to initialize Gmail service: ${err.message}`);
        throw new Error('Failed to initialize Gmail service');
    }
};

/**
 * Fetch the subjects and message IDs of emails with the label "Send2Obsidian" for the authenticated user.
 * @param service - Gmail service instance.
 * @param accountName - The name of the Google account.
 * @returns List of email subjects and message IDs with the label "Send2Obsidian".
 */
export const fetchEmailsWithLabelSubjects = async ({ service, accountName }: GmailQueryOptions): Promise<{ subject: string; messageId: string }[]> => {
    try {
        const response = await service.users.messages.list({
            userId: 'me',
            q: 'label:Send2Obsidian', // Gmail query to filter emails with the label "Send2Obsidian"
        });

        if (response.status !== 200) {
            console.warn(`Error querying Gmail API: ${response.statusText}`);
            return [];
        }

        const messageIds = response.data.messages?.map((message) => message.id) || [];
        const messages: { subject: string; messageId: string }[] = [];

        for (const messageId of messageIds) {
            if (!messageId) continue;

            try {
                const message = await service.users.messages.get({
                    userId: 'me',
                    id: messageId,
                    format: 'metadata',
                    metadataHeaders: ['Subject'],
                });

                const headers = (message.data.payload?.headers || []) as gmail_v1.Schema$MessagePartHeader[];
                const subjectHeader = headers.find((header) => header.name === 'Subject');
                const subject = subjectHeader?.value || 'No Subject';

                messages.push({ subject, messageId });

                // Uncomment and replace label IDs if you want to modify labels after fetching
                /*
                await service.users.messages.modify({
                    userId: 'me',
                    id: messageId,
                    requestBody: {
                        addLabelIds: ['Label_Sent2Obsidian'], // Add the new label (replace with your label ID)
                        removeLabelIds: ['Label_Send2Obsidian'], // Remove the old label (replace with your label ID)
                    },
                });
                */
            } catch (err: any) {
                console.error(`Failed to fetch or modify message details for ID ${messageId}: ${err.message}`);
            }
        }

        return messages;
    } catch (err: any) {
        console.error(`Unable to query Gmail API for account ${accountName}: ${err.message}`);
        return [];
    }
};

/**
 * Fetch the list of Gmail labels for the authenticated user.
 * @param service - Gmail service instance.
 * @returns List of Gmail labels with their IDs and names.
 */
export const fetchGmailLabels = async (service: gmail_v1.Gmail): Promise<{ id: string; name: string }[]> => {
    try {
        const response = await service.users.labels.list({ userId: 'me' });
        const labels = response.data.labels || [];
        return labels.map((label) => ({ id: label.id!, name: label.name! })); // Ensure `id` and `name` are not null
    } catch (err: any) {
        console.error(`Failed to fetch Gmail labels: ${err.message}`);
        return [];
    }
};
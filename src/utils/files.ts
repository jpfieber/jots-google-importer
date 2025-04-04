import { App, Editor, MarkdownView, Notice, TFile } from 'obsidian';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const isViewInSourceMode = (view: MarkdownView | null) => {
    const view_mode = view?.getMode();
    return !!view_mode && view_mode === 'source';
};

export const maybeGetSelectedText = (app: App) => {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (!isViewInSourceMode(view)) {
        return;
    }
    return view?.editor.getSelection();
};

export const insertIntoEditorRange = (app: App, content: string) => {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    const editor: Editor | undefined = view?.editor;
    if (!editor || !isViewInSourceMode(view)) {
        return;
    }
    editor.replaceRange(content, editor.getCursor());
};

export const renameFile = async (app: App, title: string, folder: string) => {
    const file: TFile | null = app.workspace.getActiveFile();
    if (!file || !isViewInSourceMode(app.workspace.getActiveViewOfType(MarkdownView))) {
        return;
    }

    try {
        const newPath = `${folder}/${sanitizeHeading(title)}.md`;
        await app.fileManager.renameFile(file, newPath);
    } catch (err: any) {
        console.error(err.message);
        new Notice(`Unable to rename/move file - does the folder "${folder}" exist?`, 7000);
    }
};

const sanitizeHeading = (text: string) => {
    const stockIllegalSymbols = /[\\/:|#^[\]]/g;
    text = text.replace(stockIllegalSymbols, '');
    return text.trim();
};

export function removeInvalidFileNameChars(filename: string): string {
    return filename.replace(/[<>:"/\\|?*]/g, '_');
}

// Define fetchImageWithFallback to handle image fetching
const fetchImageWithFallback = async (url: string, savePath: string): Promise<string | null> => {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });

        // Convert ArrayBuffer to Buffer
        const buffer = Buffer.from(response.data);

        // Convert the image to Base64
        const base64Data = buffer.toString('base64');
        const mimeType = response.headers['content-type'] || 'image/png'; // Default to PNG if content type is missing
        return `data:${mimeType};base64,${base64Data}`; // Return Base64-encoded data
    } catch (error: any) {
        const errorMessage = error?.message || '';

        // Use regex to match common network or CORS-related errors
        const networkErrorRegex = /(CORS|Access-Control-Allow-Origin|Network Error)/i;
        if (networkErrorRegex.test(errorMessage)) {
            return null; // Skip the image if CORS or network error occurs
        }

        // Log unexpected errors for debugging
        return null;
    }
};

const saveImagesLocally = async (imageUrls: string[], savePath: string): Promise<string[]> => {
    const base64ImageData: string[] = [];
    for (const url of imageUrls) {
        try {
            const base64Data = await fetchImageWithFallback(url, savePath); // Fetch and convert to Base64
            if (base64Data) {
                base64ImageData.push(base64Data); // Add the Base64 data to the array
            }
        } catch (error: any) {
            const errorMessage = error?.message || '';

            // Use regex to match common network or CORS-related errors
            const networkErrorRegex = /(CORS|Access-Control-Allow-Origin|Network Error)/i;
            if (networkErrorRegex.test(errorMessage)) {
                continue; // Skip this image and move to the next
            }
        }
    }
    return base64ImageData; // Always return an array
};

export function saveFileToStack(vaultRoot: string, subfolderStructure: string, filename: string, content: string): string {
    const fullSubfolderStructure = path.join('Chronological', 'Email', subfolderStructure);

    const dateMatch = filename.match(/^(\d{4})(\d{2})\d{2}/);
    if (!dateMatch) throw new Error('Filename does not contain a valid date.');

    const year = dateMatch[1];
    const month = dateMatch[2];

    const subfolder = fullSubfolderStructure.replace('YYYY', year).replace('YYYY-MM', `${year}-${month}`);
    const targetFolder = path.join(vaultRoot, subfolder);

    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
    }

    const targetPath = path.join(targetFolder, filename);

    try {
        fs.writeFileSync(targetPath, content, 'utf8');
    } catch (error: any) {
        console.error(`Failed to write file: ${error.message}`);
        throw error;
    }

    return targetPath;
}

export async function prepareEmailContent(email: { HtmlBody?: string; TextBody?: string }, savePath: string): Promise<string> {
    let theBody = '';

    if (email.HtmlBody) {
        const imageUrls = extractImageUrls(email.HtmlBody); // Extract image URLs from HTML
        const base64ImageData = await saveImagesLocally(imageUrls, savePath); // Fetch and convert to Base64
        theBody = replaceImageUrlsWithBase64(email.HtmlBody, imageUrls, base64ImageData); // Replace URLs with Base64 data
    } else if (email.TextBody) {
        theBody = `<html><body><pre>${email.TextBody}</pre></body></html>`;
    } else {
        theBody = '<html><body><p>No content available.</p></body></html>';
    }

    return theBody;
}

// Helper function to replace image URLs with Base64 data in HTML
const replaceImageUrlsWithBase64 = (html: string, urls: string[], base64Data: string[]): string => {
    let updatedHtml = html;
    urls.forEach((url, index) => {
        const base64 = base64Data[index];
        if (base64) {
            updatedHtml = updatedHtml.replace(url, base64); // Replace the URL with Base64 data
        } else {
            updatedHtml = updatedHtml.replace(url, ''); // Remove the image or replace with a placeholder
        }
    });
    return updatedHtml;
};

// Helper function to extract image URLs from HTML
const extractImageUrls = (html: string): string[] => {
    const regex = /<img[^>]+src="([^">]+)"/g;
    const urls: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        urls.push(match[1]);
    }
    return urls;
};

// Fetch email content by message ID
export async function fetchEmailContent({ service, messageId }: { service: any; messageId: string }): Promise<{ HtmlBody?: string; TextBody?: string; from?: string; date?: string }> {
    try {
        const response = await service.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });

        const payload = response.data.payload;
        let htmlBody = '';
        let textBody = '';
        let from = 'unknown';
        let date = '';

        // Extract the "from" field from the headers
        const headers = payload.headers || [];
        const fromHeader = headers.find((header: any) => header.name.toLowerCase() === 'from');
        if (fromHeader) {
            const emailMatch = fromHeader.value.match(/<([^>]+)>|^[^<\s]+@[^>\s]+$/);
            if (emailMatch) {
                from = emailMatch[1] || emailMatch[0];
                from = from.trim();
            }
        }

        // Extract the "date" field from the headers
        const dateHeader = headers.find((header: any) => header.name.toLowerCase() === 'date');
        if (dateHeader) {
            date = new Date(dateHeader.value).toISOString(); // Convert to ISO format
        }

        // Helper function to recursively extract body content
        const extractBodyFromParts = (parts: any[], mimeType: string): string => {
            for (const part of parts) {
                if (part.mimeType === mimeType) {
                    return Buffer.from(part.body?.data || '', 'base64').toString('utf-8');
                }
                if (part.parts) {
                    const nestedBody = extractBodyFromParts(part.parts, mimeType);
                    if (nestedBody) return nestedBody;
                }
            }
            return '';
        };

        // Check if the email is multipart
        if (payload.parts) {
            htmlBody = extractBodyFromParts(payload.parts, 'text/html');
            textBody = extractBodyFromParts(payload.parts, 'text/plain');
        } else {
            if (payload.mimeType === 'text/html') {
                htmlBody = Buffer.from(payload.body?.data || '', 'base64').toString('utf-8');
            } else if (payload.mimeType === 'text/plain') {
                textBody = Buffer.from(payload.body?.data || '', 'base64').toString('utf-8');
            }
        }

        return { HtmlBody: htmlBody, TextBody: textBody, from, date };
    } catch (error: any) {
        console.error(`Failed to fetch email content for ID ${messageId}: ${error.message}`);
        throw error;
    }
}
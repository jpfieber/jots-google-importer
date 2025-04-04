import { PersonSuggestModal } from '@/ui/person-modal';
import { GoogleAccount } from 'models/Account';
import { Notice, Plugin } from 'obsidian';
import { EventSuggestModal } from '@/ui/calendar-modal';
import { DEFAULT_SETTINGS, GoogleLookupSettingTab } from './settings';
import { GoogleLookupPluginSettings } from './types';
import { getGoogleCredentials, hasGoogleCredentials } from './settings/google-credentials';
import { getGmailService, fetchEmailsWithLabelSubjects } from '@/api/google/gmail';
import { removeInvalidFileNameChars, saveFileToStack, prepareEmailContent, fetchEmailContent } from '@/utils/files';

export default class GoogleLookupPlugin extends Plugin {
    settings: GoogleLookupPluginSettings | undefined;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new GoogleLookupSettingTab(this.app, this));

        // Add command to insert contact info
		this.addCommandIfMarkdownView('Insert Contact Info', 'insert-contact-info', () => {
			try {
				console.log('Opening PersonSuggestModal...');
				new PersonSuggestModal(this.app, {
					renameFile: this.settings!.rename_person_file,
					template: this.settings!.template_file_person,
					moveToFolder: this.settings!.folder_person,
					newFilenameTemplate: this.settings!.person_filename_format,
				}).open();
				console.log('PersonSuggestModal opened successfully.');
			} catch (error) {
				const err = error as Error;
				console.error('Error opening PersonSuggestModal:', err.message);
				new Notice('Failed to open contact info modal.');
			}
		});

        // Add command to insert event info
        this.addCommandIfMarkdownView('Insert Event Info', 'insert-event-info', () => {
            try {
                new EventSuggestModal(this.app, {
                    template: this.settings!.template_file_event,
                    dateFormat: this.settings!.event_date_format,
                }).open();
            } catch (error) {
                const err = error as Error;
                console.error('Error opening EventSuggestModal:', err.message);
                new Notice('Failed to open event info modal.');
            }
        });

        // Add command to fetch emails with the label "Sent2Obsidian"
        this.addCommand({
            id: 'process-emails',
            name: 'Process Emails with Label "Sent2Obsidian"',
            callback: async () => {
                try {
                    if (!hasGoogleCredentials(this)) {
                        new Notice('Google credentials not set up yet. Go to Settings to configure.');
                        return;
                    }

                    const vaultRoot = (this.app.vault.adapter as any).basePath; // Get the absolute path of the vault

                    for (const account of GoogleAccount.getAllAccounts()) {
                        if (!account.token) {
                            new Notice(`No token found for account: ${account.accountName}`);
                            continue;
                        }

                        const gmailService = await getGmailService({
                            credentials: GoogleAccount.credentials,
                            token: account.token,
                        });

                        const messages = await fetchEmailsWithLabelSubjects({
                            service: gmailService,
                            accountName: account.accountName,
                        });

						for (const { subject, messageId } of messages) {
							try {
								// Fetch the email content using the message ID
								const email = await fetchEmailContent({ service: gmailService, messageId });
						
								// Extract the sender's email address and date from the email content
								const from = email?.from || 'unknown';
								const emailDate = email?.date ? new Date(email.date) : new Date(); // Use email date or fallback to current date
						
								// Format the date and time for the filename
								const year = emailDate.getFullYear();
								const month = String(emailDate.getMonth() + 1).padStart(2, '0'); // Months are 0-based
								const day = String(emailDate.getDate()).padStart(2, '0');
								const hours = String(emailDate.getHours()).padStart(2, '0');
								const minutes = String(emailDate.getMinutes()).padStart(2, '0');
								const seconds = String(emailDate.getSeconds()).padStart(2, '0');
						
								const datePart = `${year}${month}${day}`;
								const timePart = `${hours}${minutes}${seconds}`;
						
								// Sanitize the subject and email address
								const sanitizedSubject = removeInvalidFileNameChars(subject || 'Untitled');
								const sanitizedEmail = removeInvalidFileNameChars(from);
						
								// Combine the parts to form the filename
								const sanitizedFilename = `${datePart}_${timePart} - ${sanitizedEmail} -- ${sanitizedSubject}.htm`;
						
								// Prepare the email content
								const emailContent = await prepareEmailContent(email, ''); // No need for a save path
						
								const subfolderStructure = this.settings!.subfolderStructure;
						
								const targetPath = saveFileToStack(
									vaultRoot,
									subfolderStructure,
									sanitizedFilename,
									emailContent
								);
								console.log(`Saved email to: ${targetPath}`);
							} catch (error) {
								const err = error as Error;
								console.error(`Failed to process email: ${err.message}`);
								new Notice(`Failed to process email: ${err.message}`);
							}
						}
                    }
                } catch (error) {
                    const err = error as Error;
                    console.error(`Error processing emails: ${err.message}`);
                    new Notice(`Error processing emails: ${err.message}`);
                }
            },
        });

        GoogleAccount.loadAccountsFromStorage();
    }

    onunload() {
        GoogleAccount.removeAllAccounts();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        GoogleAccount.credentials = getGoogleCredentials(this);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        GoogleAccount.credentials = getGoogleCredentials(this);
    }

	addCommandIfMarkdownView(name: string, id: string, func: () => void) {
		this.addCommand({
			id,
			name,
			callback: () => {
				try {
					if (!this.settings) {
						console.error('Settings not loaded.');
						new Notice('Plugin settings not loaded. Please reload the plugin.');
						return;
					}

					if (!hasGoogleCredentials(this)) {
						new Notice('Google credentials not set up yet. Go to Settings to configure.');
						return;
					}

					func();
				} catch (error) {
					const err = error as Error;
					console.error(`Error executing command "${name}":`, err.message);
					new Notice(`Error executing command "${name}".`);
				}
			},
		});
	}
}
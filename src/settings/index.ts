import { App, PluginSettingTab, Setting } from 'obsidian';
import GoogleLookupPlugin from '@/main';
import { GoogleLookupPluginSettings, KeysMatching } from '@/types';
import { GoogleAccount } from '@/models/Account';
import { AuthModal } from '@/ui/auth-modal';
import { ConfirmModal } from '@/ui/confirm-modal';

export const DEFAULT_SETTINGS: Partial<GoogleLookupPluginSettings> = {
    client_redirect_uri_port: 42601,
    folder_person: '',
    rename_person_file: true,
    emailStorageFolder: '_Inbox', // Default folder for storing emails
    subfolderStructure: 'YYYY/YYYY-MM', // Default subfolder structure
};

type CommonSettingParams = {
    container?: HTMLElement;
    name: string;
    description: string | DocumentFragment;
};
type ToggleSettingParams = { key: KeysMatching<GoogleLookupPluginSettings, boolean> } & CommonSettingParams;

type TextInputSettingParams = {
    placeholder?: string;
    key: KeysMatching<GoogleLookupPluginSettings, string>;
} & CommonSettingParams;

type NumberInputSettingParams = {
    key: KeysMatching<GoogleLookupPluginSettings, number>; // Ensure the key matches a number type
} & CommonSettingParams;

export class GoogleLookupSettingTab extends PluginSettingTab {
    plugin: GoogleLookupPlugin;
    accountsEl: HTMLElement;

    constructor(app: App, plugin: GoogleLookupPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.accountsEl = document.createElement('div'); // Initialize accountsEl

        console.log('GoogleLookupSettingTab initialized'); // Debugging log
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        if (!this.plugin.settings) {
            console.warn('Settings object is undefined.');
            return;
        }

        containerEl.createEl('h3', { text: 'Email Processing Settings' });

        this.insertTextInputSetting({
            name: 'Email Storage Folder',
            description: 'Base folder where emails will be stored.',
            placeholder: '_Inbox',
            key: 'emailStorageFolder'
        });

        this.insertTextInputSetting({
            name: 'Subfolder Structure',
            description: 'Structure for organizing emails (e.g., YYYY/YYYY-MM).',
            placeholder: 'YYYY/YYYY-MM',
            key: 'subfolderStructure'
        });

        containerEl.createEl('h3', { text: 'Contact Info' });
        this.insertTextInputSetting({
            name: 'Contact Template',
            description: getDocumentFragmentWithLink(
                'File containing template content for contact info. Default template and more info',
                'available here',
                'https://ntawileh.github.io/obsidian-google-lookup/person'
            ),
            placeholder: '_assets/templates/t_person',
            key: 'template_file_person'
        });
        this.insertToggleSetting({
            name: 'Rename and move person file',
            description:
                'When enabled, this will rename the note to the name of the person that was imported and move the note into a folder',
            key: 'rename_person_file'
        });
        this.insertTextInputSetting({
            name: 'Folder for people notes',
            description:
                'When the above option is enabled, the person note will move to this folder. An empty value (default) means the file will not move to any new directory',
            placeholder: 'people',
            key: 'folder_person'
        });
        this.insertTextInputSetting({
            name: 'Filename format for people notes',
            description: getDocumentFragmentWithLink(
                'When the option to move and rename is enabled, the person note will have a title based on this format. Default value is "{{lastname}}, {firstname}". See template options',
                'here',
                'https://ntawileh.github.io/obsidian-google-lookup/person'
            ),
            placeholder: '{{lastname}}, {{firstname}}',
            key: 'person_filename_format'
        });

        containerEl.createEl('h3', { text: 'Events Info' });
        this.insertTextInputSetting({
            name: 'Event Template',
            description: getDocumentFragmentWithLink(
                'File containing template content for events. Default template and more info',
                'available here',
                'https://ntawileh.github.io/obsidian-google-lookup/event'
            ),
            placeholder: '_assets/templates/t_event',
            key: 'template_file_event'
        });

        this.insertTextInputSetting({
            name: 'Date Format',
            description: 'Date format to be used on the start date field.',
            placeholder: 'ddd, MMM Do @ hh:mma',
            key: 'event_date_format'
        });

        containerEl.createEl('h3', { text: 'Google Client' });
        this.insertTextInputSetting({
            name: 'Client ID',
            description: 'Client ID for your Google API application',
            placeholder: '123456789123-example29i02ttu92h0vftuhff2jtgg.apps.googleusercontent.com',
            key: 'client_id'
        });
        this.insertTextInputSetting({
            name: 'Client Secret',
            description: 'Client Secret for your Google API application',
            key: 'client_secret'
        });
        this.insertNumberInputSetting({
            name: 'Redirect URI Port',
            description: 'The port number that this plugin will listen to for Google authentication redirects.',
            key: 'client_redirect_uri_port', // This is now valid for a number input
        });

        containerEl.createEl('h3', { text: 'Accounts' });
        this.displayAccounts();
        this.containerEl.appendChild(this.accountsEl);
    }

    show(): void {
        console.log('Showing settings tab...'); // Debugging log
        this.display(); // Ensure the display method is called
    }

    hide(): void {
        console.log('Hiding settings tab...'); // Debugging log
    }

    private displayAccounts() {
        const { accountsEl } = this;
        accountsEl.empty();
        for (const account of GoogleAccount.getAllAccounts()) {
            this.insertAccountSetting({
                name: account.accountName,
                container: this.accountsEl,
                account
            });
        }
        new Setting(this.accountsEl).addButton((b) => {
            b.setButtonText('Add Account');
            b.setCta();
            b.onClick(() => {
                GoogleAccount.createNewAccount(this.plugin.app, () => {
                    this.displayAccounts();
                });
            });
        });
    }

    private insertTextInputSetting({
        container = this.containerEl,
        placeholder,
        key,
        name,
        description
    }: TextInputSettingParams) {
        new Setting(container)
            .setName(name)
            .setDesc(description)
            .addText((text) => {
                text
                    .setPlaceholder(placeholder ? placeholder : '')
                    .onChange(async (v) => {
                        this.plugin.settings![key] = v;
                        await this.plugin.saveSettings();
                    })
                    .setValue(this.plugin.settings![key] || '');
            });
    }

    private insertNumberInputSetting({
        container = this.containerEl,
        key,
        name,
        description,
    }: NumberInputSettingParams) {
        new Setting(container)
            .setName(name)
            .setDesc(description)
            .addText((text) => {
                text.inputEl.type = 'number'; // Set input type to number
                text.setValue(this.plugin.settings![key]?.toString() || '');
                text.onChange(async (value) => {
                    this.plugin.settings![key] = parseInt(value, 10);
                    await this.plugin.saveSettings();
                });
            });
    }

    private insertToggleSetting({ container = this.containerEl, key, name, description }: ToggleSettingParams) {
        new Setting(container)
            .setName(name)
            .setDesc(description)
            .addToggle((tc) => {
                tc.setValue(this.plugin.settings![key]).onChange(async (v) => {
                    this.plugin.settings![key] = v;
                    await this.plugin.saveSettings();
                });
            });
    }

    private insertAccountSetting({
        container = this.containerEl,
        name,
        account
    }: {
        container?: HTMLElement;
        name: string;
        account: GoogleAccount;
    }) {
        new Setting(container)
            .setName(name)
            .addExtraButton((b) => {
                b.setIcon('reset');
                b.setTooltip('refresh account credentials');
                b.onClick(() => {
                    AuthModal.createAndOpenNewModal(this.app, account, () => {
                        this.displayAccounts();
                    });
                });
            })
            .addExtraButton((b) => {
                b.setIcon('trash');
                b.setTooltip('remove account and delete login credentials');
                b.onClick(() => {
                    new ConfirmModal(this.app, `Are you sure you want to remove account ${account.accountName}?`, () => {
                        console.log(`removing account ${account.accountName}`);
                        account.removeFromAccountsList();
                        GoogleAccount.writeAccountsToStorage();
                        this.displayAccounts();
                    }).open();
                });
            });
    }
}

const getDocumentFragmentWithLink = (text: string, linkText: string, href: string) => {
    const fragment = document.createDocumentFragment();
    fragment.createSpan({ text: `${text} ` });
    fragment.createEl('a', {
        href,
        text: linkText
    });

    return fragment;
};
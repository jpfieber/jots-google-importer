import { DEFAULT_PERSON_FILENAME_FORMAT, DEFAULT_PERSON_TEMPLATE } from '@/settings/default-templates';
import { PersonResult } from '@/types';
import { getTemplateContents } from '@/utils/template';
import { App, moment } from 'obsidian';

export class Person {
	#person: PersonResult;
	#template: string | undefined;
	#filenameTemplate: string | undefined;

	constructor(p: PersonResult, templateFile: string | undefined, filenameTemplate: string | undefined) {
		this.#person = p;
		this.#template = templateFile;
		this.#filenameTemplate = filenameTemplate;
	}

	generateFromTemplate = async (app: App) => {
		const rawTemplate = await getTemplateContents(app, this.#template);
		return this.applyTemplateTransformations(
			rawTemplate && rawTemplate.length > 0 ? rawTemplate : DEFAULT_PERSON_TEMPLATE
		);
	};

	getContactUrl() {
		if (!this.#person.resourceName) {
			return 'unknown';
		}

		return this.#person.resourceName.replace('people/', 'https://contacts.google.com/person/');
	}

	private applyTemplateTransformations = (rawTemplateContents: string): string => {
		let templateContents = rawTemplateContents;
		const now = moment();

		const transform = {
			firstName: this.#person.firstName || '',
			lastName: this.#person.lastName || '',
			middleName: this.#person.middleName || '',
			firstLast: `${this.#person.firstName}${this.#person.lastName}` || '',
			lastFirst: `${this.#person.lastName}${this.#person.firstName}` || '',
			emails: this.#person.emails?.join(',') || '',
			phones: this.#person.phones?.join(',') || '',
			'org.title': this.#person.org?.title || '',
			'org.department': this.#person.org?.department || '',
			type: this.#person.type,
			link: this.getContactUrl(),
			source: this.#person.accountSource.toLocaleLowerCase()
		};

		for (const [k, v] of Object.entries(transform)) {
			templateContents = templateContents.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'gi'), v);
		}
		templateContents = templateContents
			.replace(/{{\s*date\s*}}/gi, now.format('YYYY-MM-DD'))
			.replace(/{{\s*time\s*}}/gi, now.format('HH:mm'));

		return templateContents;
	};

	getTitle = () => {
		return this.applyTemplateTransformations(
			this.#filenameTemplate && this.#filenameTemplate.length > 0
				? this.#filenameTemplate
				: DEFAULT_PERSON_FILENAME_FORMAT
		);
	};
}

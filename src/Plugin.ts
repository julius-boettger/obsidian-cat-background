import { Plugin, WorkspaceWindow } from 'obsidian';
import { SettingsTab } from './PluginSettingsTab';
import { resolveLocal, resolveRemote, URLResult } from './Validation';
import { Notice } from 'obsidian';

interface PluginSettings {
	cat: string, // cat to use as background image
	localImageLocation: boolean; // whether to use local file (true) or remote URL
	imageLocation: string; // path to file or URL
	imageSize: number; // in percent
	opacity: number;
	bluriness: string;
	inputContrast: boolean;
	position: string;
}

export const DEFAULT_SETTINGS: Partial<PluginSettings> = {
	cat: "face",
	localImageLocation: true,
	imageLocation: '.obsidian/plugins/cat-background/cats/face-lines.svg',
	opacity: 0.2,
	imageSize: 10,
	bluriness: 'off',
	inputContrast: false,
	position: 'center',
};

export default class BackgroundPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SettingsTab(this.app, this));
		this.app.workspace.onLayoutReady(() => this.updateBackground(document));
		this.registerEvent(
			this.app.workspace.on(
				'window-open',
				(win: WorkspaceWindow) => void this.updateBackground(win.doc),
			),
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		void this.updateBackground();
	}

	onunload() {
		// clear up blob to avoid memory leaks
		const prevLoc = this.prevResult?.location ?? null;
		if (this.isBlob(prevLoc)) {
			URL.revokeObjectURL(prevLoc);
		}

		const doc = document;
		doc.body.style.removeProperty('--obsidian-editor-background-image');
		doc.body.style.removeProperty('--obsidian-editor-background-image-size');
		doc.body.style.removeProperty('--obsidian-editor-background-opacity');
		doc.body.style.removeProperty('--obsidian-editor-background-bluriness');
		doc.body.style.removeProperty(
			'--obsidian-editor-background-input-contrast',
		);
		doc.body.style.removeProperty(
			'--obsidian-editor-background-line-padding',
		);
		doc.body.style.removeProperty('--obsidian-editor-background-position');
	}

	private prevResult: URLResult | null = null;
	private isBlob = (loc: string | null): loc is string =>
		typeof loc === 'string' && loc.startsWith('blob:');

	private sendNotice(result: URLResult) {
		const errorChanged = result.error !== (this.prevResult?.error ?? null);
		const locChanged =
			result.location !== (this.prevResult?.location ?? null);

		if (result.error && (errorChanged || locChanged)) {
			new Notice(`Cat Background: ${result.error}`);
		}
	}

	private async resolveImage(): Promise<URLResult> {
		const loc = (this.settings.imageLocation ?? '').trim();
		if (!loc) {
			return { location: null, error: 'Cat image location is empty' };
		}

		if (this.settings.localImageLocation) {
			// local image
			return resolveLocal(this.app, loc);
		}
		return resolveRemote(loc); // remote URL
	}

	async updateBackground(doc: Document = activeDocument) {
		const result = await this.resolveImage();

		const prevLoc = this.prevResult?.location ?? null;
		const nextLoc = result.location;
		if (this.isBlob(prevLoc) && prevLoc !== nextLoc) {
			URL.revokeObjectURL(prevLoc);
		}

		this.sendNotice(result);
		this.prevResult = result;
		if (result.error) {
			doc.body.style.setProperty(
				'--obsidian-editor-background-image',
				'none',
			);
			return;
		}

		doc.body.style.setProperty(
			'--obsidian-editor-background-image',
			`url("${result.location}")`,
		);
		doc.body.style.setProperty(
			'--obsidian-editor-background-image-size',
			`${this.settings.imageSize}%`,
		);
		doc.body.style.setProperty(
			'--obsidian-editor-background-opacity',
			`${this.settings.opacity}`,
		);
		doc.body.style.setProperty(
			'--obsidian-editor-background-bluriness',
			`blur(${this.settings.bluriness})`,
		);
		doc.body.style.setProperty(
			'--obsidian-editor-background-input-contrast',
			this.settings.inputContrast ? '#ffffff17' : 'none',
		);
		doc.body.style.setProperty(
			'--obsidian-editor-background-line-padding',
			this.settings.inputContrast ? '1rem' : '0',
		);
		doc.body.style.setProperty(
			'--obsidian-editor-background-position',
			this.settings.position,
		);
	}
}

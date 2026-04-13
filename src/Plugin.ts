import { Plugin, WorkspaceWindow } from 'obsidian';
import { SettingsTab, catOptions } from './PluginSettingsTab';
import { resolveLocal, resolveRemote, URLResult } from './Validation';
import { Notice } from 'obsidian';

import catSvgFace from "../cats/face-lines.svg";
import catSvgSilhouette from "../cats/silhouette-filled.svg";
import catSvgStretching from "../cats/stretching-lines.svg";

interface PluginSettings {
	cat: string, // cat to use as background image
	localImageLocation: boolean; // whether to use local file (true) or remote URL
	imageLocation: string; // path to file or URL
	imageSize: number; // in em
	imageSpacing: number, // in svg viewport units (actual number)
	opacity: number;
	bluriness: string;
	inputContrast: boolean;
	position: string;
}

export const DEFAULT_SETTINGS: Partial<PluginSettings> = {
	cat: "face",
	localImageLocation: true,
	imageLocation: '',
	opacity: 0.2,
	imageSize: 10,
	imageSpacing: 0,
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
		doc.body.style.removeProperty('--cat-background-image');
		doc.body.style.removeProperty('--cat-background-image-size');
		doc.body.style.removeProperty('--cat-background-opacity');
		doc.body.style.removeProperty('--cat-background-bluriness');
		doc.body.style.removeProperty(
			'--cat-background-input-contrast',
		);
		doc.body.style.removeProperty(
			'--cat-background-line-padding',
		);
		doc.body.style.removeProperty('--cat-background-position');
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
		let imageUrl;
		if (this.settings.cat != catOptions.custom) {
			// use bundled svg cat
			let svgString = "";
			switch (this.settings.cat) {
				case catOptions.face:
					svgString = catSvgFace;
					break;
				case catOptions.silhouette:
					svgString = catSvgSilhouette;
					break;
				case catOptions.stretching:
					svgString = catSvgStretching;
					break;
			}
			
			let sanitizedSvgString = svgString
				.replace(/[\r\n]/g, '')
				.replace(/#/g, '%23');

			const viewBoxPattern = /viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/;
			const viewBoxMatch = sanitizedSvgString.match(viewBoxPattern);
			if (viewBoxMatch) {
				const offset = this.settings.imageSpacing;
				const [, xS, yS, wS, hS] = viewBoxMatch;
				const [x, y, w, h] = [xS, yS, wS, hS].map(Number);
				sanitizedSvgString = sanitizedSvgString.replace(viewBoxPattern,
					`viewBox="${x-offset} ${y-offset} ${w+(2*offset)} ${h+(2*offset)}"`);
			}

			imageUrl = "data:image/svg+xml," + sanitizedSvgString;
		} else {
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
					'--cat-background-image',
					'none',
				);
				return;
			}

			imageUrl = result.location;
		}

		doc.body.style.setProperty(
			'--cat-background-image',
			`url('${imageUrl}')`,
		);
		doc.body.style.setProperty(
			'--cat-background-image-size',
			`${this.settings.imageSize}em`,
		);
		doc.body.style.setProperty(
			'--cat-background-opacity',
			`${this.settings.opacity}`,
		);
		doc.body.style.setProperty(
			'--cat-background-bluriness',
			`blur(${this.settings.bluriness})`,
		);
		doc.body.style.setProperty(
			'--cat-background-input-contrast',
			this.settings.inputContrast ? '#ffffff17' : 'none',
		);
		doc.body.style.setProperty(
			'--cat-background-line-padding',
			this.settings.inputContrast ? '1rem' : '0',
		);
		doc.body.style.setProperty(
			'--cat-background-position',
			this.settings.position,
		);
	}
}

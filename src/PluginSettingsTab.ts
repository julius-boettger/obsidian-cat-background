import BackgroundPlugin, { DEFAULT_SETTINGS } from './Plugin';
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';

const blurLevels = {
	off: '0px',
	low: '5px',
	high: '15px',
};

const positionOptions = {
	center: 'center',
	top: 'top',
	right: 'right',
	bottom: 'bottom',
	left: 'left',
};

export const catOptions = {
	face: 'face',
	silhouette: 'silhouette',
	stretching: 'stretching',
	custom: 'custom',
};

export class SettingsTab extends PluginSettingTab {
	plugin: BackgroundPlugin;

	constructor(app: App, plugin: BackgroundPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h1', { text: 'Cat Background' }); // Heading

		const instructions = containerEl.createEl('div');
		instructions.createEl('p', {
			text: "Local cat background images must be stored in the Obsidian vault.",
		});

		new Setting(containerEl)
			.setName('Cat')
			.setDesc('Which cat to use as the background image.')
			.addDropdown((dropdown) => {
				Object.entries(catOptions).forEach(([key, value]) =>
					dropdown.addOption(key, value),
				);
				dropdown
					.setValue(this.plugin.settings.cat)
					.onChange(async (value) => {
						this.plugin.settings.cat = value;
						if (value != catOptions.custom) {
							// TODO: handle static paths to preconfigured cats
							let filename;
							switch (this.plugin.settings.cat) {
								case catOptions.face:
									filename = "face-lines";
									break;
								case catOptions.silhouette:
									filename = "silhouette-filled";
									break;
								case catOptions.stretching:
									filename = "stretching-lines";
									break;
							}
						}
						await this.plugin.saveSettings();
						this.display(); // for potentially adjusted settings
					});
			});

		if (this.plugin.settings.cat == catOptions.custom) {
			// setting for local images
			new Setting(containerEl)
				.setName('Use local cat image')
				.setDesc('Use a cat image from your Obsidian vault instead of a link to a cat.')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.localImageLocation)
						.onChange(async (value) => {
							this.plugin.settings.localImageLocation = value;
							await this.plugin.saveSettings();
							this.display();
						});
				});

			// render local path settings OR remote url settings
			const FILE_TYPES_TEXT = "Supported Image formats are PNG, JPG/JPEG, GIF (including animated), WEBP, and SVG.";
			if (this.plugin.settings.localImageLocation) {
				new Setting(containerEl)
					.setName('Path to local cat image')
					.setDesc('Image must be in your Obsidian vault.\n' + FILE_TYPES_TEXT)
					.addText((text) => {
						text.setPlaceholder('path/to/background.png').setValue(
							this.plugin.settings.imageLocation,
						);
						const inputEl = text.inputEl;

						// update settings when user clicks off
						inputEl.addEventListener('blur', async () => {
							const value = text.getValue().trim();
							this.plugin.settings.imageLocation = value;
							await this.plugin.saveSettings();
						});
					});
			} else {
				new Setting(containerEl)
					.setName('Link to cat image')
					.setDesc(FILE_TYPES_TEXT)
					.addText((text) => {
						text.setPlaceholder('https://example.com/cat.png');
						text.setValue(this.plugin.settings.imageLocation);

						// update settings when user clicks off
						text.inputEl.addEventListener('blur', async () => {
							const value = text.getValue().trim();
							this.plugin.settings.imageLocation = value;
							await this.plugin.saveSettings();
						});
					});
			}
		}

		new Setting(containerEl)
			.setName('Cat Size')
			.setDesc(
				'Size of cat(s) in percent. Values like 0.5 are also possible.',
			)
			.addText((text) => {
				text.setPlaceholder(
					`${DEFAULT_SETTINGS.imageSize}`,
				).setValue(
					`${this.plugin.settings.imageSize}`,
				);
				// update settings when user clicks off
				text.inputEl.addEventListener('blur', async () => {
					const value = Number(text.getValue());
					if (value >= 0) {
						this.plugin.settings.imageSize = value;
						await this.plugin.saveSettings();
					} else if (value < 0) {
						new Notice(
							`Cat Background: Error: Cat size ${value} is negative, it has to be positive`,
						);
					} else {
						new Notice(
							`Cat Background: Error: Cat size "${value}" is not a number`,
						);
					}
				});
			});

		new Setting(containerEl)
			.setName('Cat Opacity')
			.setDesc(
				'Opacity of cat(s) in percent. Values like 0.5 are also possible.',
			)
			.addText((text) => {
				text.setPlaceholder(
					`${(DEFAULT_SETTINGS.opacity ?? 1) * 100}`,
				).setValue(
					`${this.floatToPercent(this.plugin.settings.opacity)}`,
				);
				// update settings when user clicks off
				text.inputEl.addEventListener('blur', async () => {
					const float = this.percentToFloat(Number(text.getValue()));
					this.plugin.settings.opacity = float;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Cat Bluriness')
			.setDesc('Blurring your cat(s) may improve legibility.')
			.addDropdown((dropdown) => {
				dropdown
					.addOption(blurLevels.off, 'Off')
					.addOption(blurLevels.low, 'Low')
					.addOption(blurLevels.high, 'High')
					.setValue(this.plugin.settings.bluriness)
					.onChange(async (value) => {
						this.plugin.settings.bluriness = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Note-taking Area Contrast Background')
			.setDesc(
				'Adding a translucent background to the note-taking area may improve legibility.',
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.inputContrast)
					.onChange(async (value) => {
						this.plugin.settings.inputContrast = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Cat Alignment')
			.setDesc(
				"How to align your cat(s). Probably doesn't do much.",
			)
			.addDropdown((dropdown) => {
				Object.entries(positionOptions).forEach(([key, value]) =>
					dropdown.addOption(key, value),
				);
				dropdown
					.setValue(this.plugin.settings.position)
					.onChange(async (value) => {
						this.plugin.settings.position = value;
						await this.plugin.saveSettings();
					});
			});
	}

	floatToPercent(value: number) {
		return Math.max(0, Math.min(1, value)) * 100;
	}

	percentToFloat(value: number) {
		return Math.max(0, Math.min(100, value)) / 100;
	}
}

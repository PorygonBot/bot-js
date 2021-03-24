const { google } = require("googleapis");

const utils = require("../utils.js");
const DiscordChannelStats = require("../updaters/DiscordChannelStats");

class SheetsAppendStats {
	constructor(message) {
		//Requires that message is a Discord Message object
		this.message = message;
		this.channel = message.channel;

		//Sheets authentication
		const serviceAuth = new google.auth.GoogleAuth({
			credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
			scopes: [
				"https://www.googleapis.com/auth/drive",
				"https://www.googleapis.com/auth/spreadsheets",
			],
		});

		google.options({ auth: serviceAuth });
		this.sheets = google.sheets({
			version: "v4",
			auth: serviceAuth,
		});
	}

	async update(matchJson) {
		let info = matchJson.info;
		let res = await this.sheets.spreadsheets.values
			.append(utils.genAppend(matchJson))
			.catch((e) => {
				this.channel.send(
					":x: I do not have permission to edit the file you provided. If you want me to automatically update your sheet, please give full editing permissions to `master@porygonthebot.iam.gserviceaccount.com`."
				);
				console.error(e);
			});

		if (info.redirect) {
			matchJson.streamChannel = info.redirect.substring(
				2,
				info.redirect.length - 1
			);
			let channeler = new DiscordChannelStats(this.message);
			await channeler.update(matchJson);
		} else {
			this.channel.send(
				`Battle between \`${
					Object.keys(matchJson.players)[0]
				}\` and \`${
					Object.keys(matchJson.players)[1]
				}\` is complete and info has been updated!\n**Replay:** ${
					matchJson.info.replay
				}\n**History:** ${matchJson.info.history}`
			);
		}
	}
}

module.exports = SheetsAppendStats;

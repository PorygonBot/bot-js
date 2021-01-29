const { google } = require("googleapis");

const utils = require("../utils.js");

class SheetsAppendStats {
	constructor(message) {
		//Requires that message is a Discord Message object
		this.channel = message.channel;

		//Sheets authentication
		const serviceAuth = new google.auth.GoogleAuth({
			keyFile: `./service_account.json`,
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
        let res = await this.sheets.spreadsheets.values.append(utils.genAppend(matchJson)).catch((e) => {
			this.channel.send(":x: I do not have permission to edit the file you provided. If you want me to automatically update your sheet, please give full editing permissions to `master@porygonthebot.iam.gserviceaccount.com`.")
			console.error(e);
		});

		this.channel.send(
			`Battle between \`${Object.keys(matchJson.players)[0]}\` and \`${Object.keys(matchJson.players)[1]}\` is complete and info has been updated!\n**Replay:** ${matchJson.info.replay}\n**History:** ${matchJson.info.history}`
		);
	}
}

module.exports = SheetsAppendStats;

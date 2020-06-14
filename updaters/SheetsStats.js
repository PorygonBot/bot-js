const { google } = require("googleapis");

class GoogleSheetsMassStats {
	constructor(spreadsheetId, player1Json, player2Json, message) {
		this.sheetid = spreadsheetId;
		this.player1 = player1Json.ps;
		this.player2 = player2Json.ps;
		this.p1range = player1Json.range;
		this.p2range = player2Json.range;

		const serviceauth = new google.auth.GoogleAuth({
			keyFile: `./service_account.json`,
			scopes: [
				"https://www.googleapis.com/auth/drive",
				"https://www.googleapis.com/auth/drive.file",
				"https://www.googleapis.com/auth/spreadsheets",
			],
		});

		google.options({ auth: serviceauth });
		this.sheets = google.sheets({
			version: "v4",
			auth: serviceauth,
		});

		this.channel = message.channel;
	}

	async getValues(range) {
		let request = {
			spreadsheetId: this.sheetid,
			range: range,
		};

		let valuesJson = await new Promise((resolve, reject) => {
			this.sheets.spreadsheets.values.get(request, (err, response) => {
				if (err) {
					reject(err);
				} else {
					resolve(response);
				}
			});
		});

		return valuesJson;
	}

	async update(recordJson) {
		console.log(
			`${this.player1} (${this.p1range}) vs. ${this.player2} (${this.p2range})`
		);

		let killJsonp1Separated = recordJson.players[this.player1].kills;
		let deathJsonp1 = recordJson.players[this.player1].deaths;
		let killJsonp2Separated = recordJson.players[this.player2].kills;
		let deathJsonp2 = recordJson.players[this.player2].deaths;
        let replay = recordJson.info.replay;
        
        //Combining the direct kills and passive kills in the object
        for (let pokemon of Object.keys(killJsonp1Separated)) {
            killJsonp1Separated[pokemon] = killJsonp1Separated[pokemon].direct + killJsonp1Separated[pokemon].passive;
        }
        for (let pokemon of Object.keys(killJsonp2Separated)) {
            killJsonp2Separated[pokemon] = killJsonp2Separated[pokemon].direct + killJsonp2Separated[pokemon].passive;
        }

		//Getting current sheet's values and initializing new update request
		let currentRequest1 = await this.getValues(this.p1range);
		let currentRequest2 = await this.getValues(this.p2range);
		let newRequest1 = {
			spreadsheetId: this.sheetid,
			range: this.p1range,
			includeValuesInResponse: false,
			responseValueRenderOption: "FORMATTED_VALUE",
			valueInputOption: "USER_ENTERED",
			resource: {
				range: this.p1range,
				values: currentRequest1.data.values,
			},
		};
		let newRequest2 = {
			spreadsheetId: this.sheetid,
			range: this.p2range,
			includeValuesInResponse: false,
			responseValueRenderOption: "FORMATTED_VALUE",
			valueInputOption: "USER_ENTERED",
			resource: {
				range: this.p2range,
				values: currentRequest2.data.values,
			},
		};

		//Printing requests before
		console.log(
			`newRequest1 before: ${JSON.stringify(newRequest1.resource)}`
		);
		console.log(
			`newRequest2 before: ${JSON.stringify(newRequest2.resource)}`
		);

		//Updating new info to the request
		for (let i = 0; i < currentRequest1.data.values.length; i++) {
			let pokeOne = currentRequest1.data.values[i][0].split("-")[0];
			let pokeTwo = currentRequest2.data.values[i][0].split("-")[0];

			//Updating the Games Played value.
			if (pokeOne in killJsonp1 || pokeOne in deathJsonp1) {
				newRequest1.resource.values[i][2] = (
					parseInt(newRequest1.resource.values[i][2]) + 1
				).toString();
			}
			if (pokeTwo in killJsonp2 || pokeTwo in deathJsonp2) {
				newRequest2.resource.values[i][2] = (
					parseInt(newRequest2.resource.values[i][2]) + 1
				).toString();
			}

			//Updating Player 1's info
			if (killJsonp1[pokeOne] >= 0)
				newRequest1.resource.values[i][4] = (
					killJsonp1[pokeOne] +
					parseInt(newRequest1.resource.values[i][4])
				).toString();
			if (deathJsonp1[pokeOne] >= 0)
				newRequest1.resource.values[i][5] = (
					deathJsonp1[pokeOne] +
					parseInt(newRequest1.resource.values[i][5])
				).toString();

			//Updating Player 2's info
			if (killJsonp2[pokeTwo] >= 0)
				newRequest2.resource.values[i][4] = (
					killJsonp2[pokeTwo] +
					parseInt(newRequest2.resource.values[i][4])
				).toString();
			if (deathJsonp2[pokeTwo] >= 0)
				newRequest2.resource.values[i][5] = (
					deathJsonp2[pokeTwo] +
					parseInt(newRequest2.resource.values[i][5])
				).toString();
		}

		//Printing requests after
		console.log(
			`newRequest1 after: ${JSON.stringify(newRequest1.resource)}`
		);
		console.log(
			`newRequest2 after: ${JSON.stringify(newRequest2.resource)}`
		);

		//Updating both players' info using new request
		let res1 = await new Promise((resolve, reject) => {
			this.sheets.spreadsheets.values.update(
				newRequest1,
				(err, response) => {
					if (err) {
						reject(err);
					} else {
						resolve(response);
					}
				}
			);
		});
		let res2 = await new Promise((resolve, reject) => {
			this.sheets.spreadsheets.values.update(
				newRequest2,
				(err, response) => {
					if (err) {
						reject(err);
					} else {
						resolve(response);
					}
				}
			);
		});

		this.channel.send(
			`Battle between \`${this.player1}\` and \`${this.player2}\` is complete and info has been updated!/nReplay: ${replay}`
		);
		return {
			res1: res1,
			res2: res2,
		};
	}
}

module.exports = GoogleSheetsMassStats;

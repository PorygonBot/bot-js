const {google} = require("googleapis");
const gc = require("../googleclient");

const sheets = google.sheets({
    version: "v4",
    auth: gc.oAuth2Client
});

class GoogleSheetsMassStats {
    constructor(spreadsheetId, p1range, p2range) {
        this.sheetid = spreadsheetId;
        this.p1range = p1range;
        this.p2range = p2range;
    }

    async update(killJson1, deathJson1, killJson2, deathJson2, replay) {
        //Updating player1's sheet
        let request1 = await getValues(this.p1range);
        let res1 = await new Promise((resolve, reject) => {
            sheets.spreadsheets.values.update(request1, (err, response) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(response);
                }
            });
        });

        //Updating player2's sheet
        let request2 = await getValues(this.p2range);
        let res2 = await new Promise((resolve, reject) => {
            sheets.spreadsheets.values.update(request2, (err, response) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(response);
                }
            });
        });

        return [res1, res2];
    }

    async getValues(range) {
        let request = {
            "spreadsheetId": this.sheetid,
            "range": range
        };

        let valuesJson = await new Promise((resolve, reject) => {
            sheets.spreadsheets.values.get(request, (err, response) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(response);
                }
            });
        });

        return valuesJson;
    }
}
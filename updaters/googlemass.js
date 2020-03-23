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
        //Getting current sheet's values and initializing new update request
        let currentRequest1 = await getValues(this.p1range);
        let currentRequest2 = await getValues(this.p2range);
        let newRequest1 = {
            "spreadsheetId": this.sheetid,
            "range": this.p1range,
            "includeValuesInResponse": false,
            "responseValueRenderOption": "FORMATTED_VALUE",
            "valueInputOption": "USER_ENTERED",
            "resource": {
                "range": this.p1range,
                "values": currentRequest1.data.values
            }
        }
        let newRequest2 = {
            "spreadsheetId": this.sheetid,
            "range": this.p2range,
            "includeValuesInResponse": false,
            "responseValueRenderOption": "FORMATTED_VALUE",
            "valueInputOption": "USER_ENTERED",
            "resource": {
                "range": this.p2range,
                "values": currentRequest1.data.values
            }
        }

        //Updating new info to the request
        for (let i = 0; i < request1.data.values.length; i++) {
            let pokemon1 = currentRequest1.data.values[i][0].split("-")[0];
            let pokemon2 = currentRequest2.data.values[i][0].split("-")[0];

            //Updating Games Played
            newRequest1.resource.values[i][2] = (parseInt(currentRequest1.data.values[i][2] + 1)).toString();
            newRequest2.resource.values[i][2] = (parseInt(currentRequest2.data.values[i][2] + 1)).toString();

            //Updating Player 1's info
            if (killJson1[pokemon1] >= 0) {
                newRequest1.resource.values[i][4] = (parseInt(currentRequest1.data.values[i][4] + killJson1[pokemon1])).toString();
            }
            if (deathJson1[pokemon1] >= 0) {
                newRequest1.resource.values[i][5] = (parseInt(currentRequest1.data.values[i][5] + deathJson1[pokemon1])).toString();
            }

            //Updating Player 2's info
            if (killJson2[pokemon2] >= 0) {
                newRequest2.resource.values[i][4] = (parseInt(currentRequest2.data.values[i][4] + killJson2[pokemon2])).toString();
            }
            if (deathJson2[pokemon2] >= 0) {
                newRequest2.resource.values[i][5] = (parseInt(currentRequest2.data.values[i][5] + deathJson2[pokemon2])).toString();
            }
        }

        //Updating both players' info using new request
        let res1 = await new Promise((resolve, reject) => {
            sheets.spreadsheets.values.update(newRequest1, (err, response) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(response);
                }
            });
        });
        let res2 = await new Promise((resolve, reject) => {
            sheets.spreadsheets.values.update(newRequest2, (err, response) => {
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
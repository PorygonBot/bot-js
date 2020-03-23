const {google} = require("googleapis");
const gc = require("../googleclient");

const sheets = google.sheets({
    version: "v4",
    auth: gc.oAuth2Client
});

class GoogleSheetsMassStats {
    constructor(spreadsheetId, range) {
        this.sheetid = spreadsheetId;
        this.range = range;
    }

    async update(player1, killJson1, deathJson1, player2, killJson2, deathJson2, replay) {
        
    }
}
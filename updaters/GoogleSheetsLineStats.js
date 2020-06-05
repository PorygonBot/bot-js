const {google} = require("googleapis");
const gclient = require("../GoogleClient");

const sheets = google.sheets({
    version: "v4",
    auth: gclient.oAuth2Client
});

class GoogleSheetsLineStats {
    constructor(spreadsheetId, tab) {
        this.sheetid = spreadsheetId;
        this.tab = tab;
    }

    async update(player1, pokemon1, killJson1, deathJson1, 
                 player2, pokemon2, killJson2, deathJson2, 
                 info) {
        let res = await sheets.spreadsheets.values.append({
            "spreadsheetId": this.sheetid,
            "range": `${this.tab}!A2:AO2`,
            "responseValueRenderOption": "FORMATTED_VALUE",
            "valueInputOption": "USER_ENTERED",
            "resource": {
                "range": ``,
                "values": [
                    [
                        player1, player2, info.winner, info.replay,
                        //Player 1's Pokemon
                        pokemon1[0], killJson1[pokemon1[0]], deathJson1[pokemon1[0]],
                        pokemon1[1], killJson1[pokemon1[1]], deathJson1[pokemon1[1]],
                        pokemon1[2], killJson1[pokemon1[2]], deathJson1[pokemon1[2]],
                        pokemon1[3], killJson1[pokemon1[3]], deathJson1[pokemon1[3]],
                        pokemon1[4], killJson1[pokemon1[4]], deathJson1[pokemon1[4]],
                        pokemon1[5], killJson1[pokemon1[5]], deathJson1[pokemon1[5]],
                        //Player 2's Pokemon
                        pokemon2[0], killJson2[pokemon2[0]], deathJson2[pokemon2[0]],
                        pokemon2[1], killJson2[pokemon2[1]], deathJson2[pokemon2[1]],
                        pokemon2[2], killJson2[pokemon2[2]], deathJson2[pokemon2[2]],
                        pokemon2[3], killJson2[pokemon2[3]], deathJson2[pokemon2[3]],
                        pokemon2[4], killJson2[pokemon2[4]], deathJson2[pokemon2[4]],
                        pokemon2[5], killJson2[pokemon2[5]], deathJson2[pokemon2[5]],
                        info.turns
                    ]
                ]
            }
        });

        return res.data;
    }
}
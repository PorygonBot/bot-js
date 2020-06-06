//This is the code for connecting to and keeping track of a showdown match
const json = require("json");
const ws = require("ws");
const axios = require("axios");
const querystring = require("querystring");

const DiscordDMStats = require("../updaters/DiscordDMStats");
const GoogleSheetsLineStats = require("../updaters/GoogleSheetsLineStats");
const GoogleSheetsMassStats = require("../updaters/GoogleSheetsMassStats");

const { username, password, airtable_key, base_id, google_key } = require("../config.json");
const Airtable = require("airtable");
const base = new Airtable({
    apiKey: airtable_key
}).base(base_id);
const VIEW_NAME = "Grid view";

let findLeagueId = async (checkChannelId) => {
    let leagueId;
    let leagueName;
    await base("Leagues").select({
        maxRecords: 500,
        view: "Grid view"
    }).all().then(async (records) => {
        for (let leagueRecord of records) {
            let channelId = await leagueRecord.get('Channel ID');
            if (channelId === checkChannelId) {
                leagueId = leagueRecord.id;
                leagueName = await leagueRecord.get("Name");
            }
        }
    });

    let leagueJson = {
        id: leagueId,
        name: leagueName
    };
    console.log("End of first function");
    return leagueJson;
};

let getPlayersIds = async (leagueId) => {
    console.log("Inside the second function");
    let recordsIds = await new Promise((resolve, reject) => {
        base("Leagues").find(leagueId, (err, record) => {
            if (err) reject(err);

            recordIds = record.get("Players");
            resolve(recordIds);
        });
    });

    return recordsIds;
};

let playerInLeague = async (playersIds, playerName) => {
    let funcarr = [];
    let isIn = false;
    for (let playerId of playersIds) {
        funcarr.push(new Promise((resolve, reject) => {
            base("Players").find(playerId, async (err, record) => {
                if (err) reject(err);

                let recordName = await record.get("Showdown Name");
                if (recordName.toLowerCase() === playerName.toLowerCase()) {
                    isIn = true;
                }

                resolve();
            })
        }));
    }
    await Promise.all(funcarr);

    return isIn;
}

class Showdown {
    constructor(battle, server, message) {
        this.battle = battle.split("/")[3];

        this.serverType = server.toLowerCase();

        let ip;
        switch(server) {
            case "Showdown":
                ip = "sim.smogon.com";
                break;
            case "Sports":
                ip = "34.222.148.43";
                break;
            case "Automatthic":
                ip = "185.224.89.75";
                break;
        }
        this.server = `ws://${ip}:8000/showdown/websocket`;
            
        this.websocket = new ws(this.server);
        this.username = username;
        this.password = password;
        this.message = message;
    }

    async endscript(playerp1, killJson1, deathJson1, playerp2, killJson2, deathJson2, info) {
        let player1 = playerp1.substring(0, playerp1.length - 2).toLowerCase().trim();
        let player2 = playerp2.substring(0, playerp2.length - 2).toLowerCase().trim();

        //Getting players info from Airtable
        let recordJson = {
            "system": "",
            "players": {},
            "sheetId": "",
            "mods": []
        };

        console.log("Players: " + player1 + " and " + player2);
        base("Leagues").select({
            maxRecords: 500,
            view: VIEW_NAME
        }).all().then(async (records) => {
            for (let leagueRecord of records) {
                let channelId = await leagueRecord.get('Channel ID');
                if (channelId === this.message.channel.id) {
                    let playersIds = await leagueRecord.get("Players");
                    let modsIds = await leagueRecord.get("Mods");

                    let funcArr = [];
                    for (let playerId of playersIds) {
                        funcArr.push(new Promise((resolve, reject) => {
                            base("Players").find(playerId, async (error, record) => {
                                if (error) {
				                    console.error(error);
                                    reject(error);
                                }

                                let recordPSName = await record.get('Showdown Name');
                                recordPSName = recordPSName.toLowerCase().trim();
                                let recordDiscord = await record.get('Discord Tag');
                                let recordTab = await record.get('Sheet Tab Name');
   				
				                console.log(playerId + "    " + recordPSName + "player");

                                if (recordPSName === player1 || recordPSName === player2) {
                                    let player = recordPSName === player1 ? player1 : player2;
                                    console.log("Player inside if statement: " + player);
                                    
                                    recordJson.players[player] = {
                                        ps: player,
                                        discord: recordDiscord,
                                        sheet_tab: recordTab,
                                        kills: player === player1 ? killJson1 : killJson2,
                                        deaths: player === player1 ? deathJson1 : deathJson2
                                    };
                                }

                                resolve();
                            });
                        }));
                    }

                    let modFuncArr = [];
                    if (modsIds) {
                        for (let modId of modsIds) {
                            modFuncArr.push(new Promise((resolve, reject) => {
                                base("Players").find(modId, async (err, record) => {
                                    if (err) reject(err);

                                    let recordDiscord = await record.get('Discord Tag');
                                    recordJson.mods.push(recordDiscord);

                                    resolve();
                                });
                            }));
                        }
                    }
 
                    await Promise.all(funcArr).then(() => {
                        console.log("Players found! Updating now...");
                    });
                    await Promise.all(modFuncArr).then(() => {
                        console.log("Mods found!");
                    })
 
                    recordJson.system = await leagueRecord.get('Stats Storage System');
                    recordJson.sheetId = await leagueRecord.get('Sheet ID');
                    recordJson.range = await leagueRecord.get('Stats Range');
                    recordJson.info = info;
                    recordJson.dmMods = await leagueRecord.get("DM Mods?");
                    recordJson.streamChannel = await leagueRecord.get("Stream Channel ID");
                    recordJson.battleId = this.battle;
                }
            }
        }).then(async () => {        
            console.log("Mods: " + recordJson.mods);
            console.log("yay: " + JSON.stringify(recordJson));

            //Instantiating updater objects
            let dmer = new DiscordDMStats(this.message);
            
            //Checking if the player was found in the database
            if (!recordJson.players[player1] || !recordJson.players[player2]) {
                this.message.channel.send(`Player \`${!recordJson.players[player1] ? player1 : player2}\` was not found in the database for \`${this.battle}\`. Contact ${dmer.getUser("harbar20#9389")} for support and more information.`)
                return;
            }

            //Updating stats based on given method
            switch (recordJson.system) {
                case "Google Sheets Line":
                    let liner = new GoogleSheetsLineStats(recordJson.sheetId, recordJson.players[player1].sheet_tab);
                    await liner.update(player1, Object.keys(killJson1), killJson1, deathJson1,
                                       player2, Object.keys(killJson2), killJson2, deathJson2, 
                                       info);
                    break;
                case "Google Sheets Mass":
                    let masser = new GoogleSheetsMassStats(recordJson.sheetId, 
                                                       `${recordJson.players[player1].sheet_tab}!${recordJson.range}`, 
                                                       `${recordJson.players[player2].sheet_tab}!${recordJson.range}`);
                    await masser.update(recordJson);
                    break;
                case "Discord DM":
                    await dmer.update(recordJson);
                    break;
            }

            console.log("Updating done!");
        });       
    }

    async login(nonce) {
        console.log("LOGGING IN");
        let psUrl = `https://play.pokemonshowdown.com/~~${this.serverType}/action.php`;
        //let psUrl = `https://play.pokemonshowdown.com/action.php`;
        let data = querystring.stringify({
            act: "login",
            name: this.username,
            pass: this.password,
            challstr: nonce
        });
    
        let response = await axios.post(psUrl, data);
        let json;
        try {
            json = JSON.parse(response.data.substring(1));
            console.log("Login is a success!");
        }
        catch (e) {
            console.log("Response to login request: " + response);
            this.message.channel.send(`Error: \`${this.username}\` failed to login to Showdown. Contact Porygon support.`);
            console.error(e);
            return;
        }
        console.log("Logged in to PS.");
        return json.assertion;
    }

    async join() {
        console.log(this.battle);
        this.websocket.send(`|/join ${this.battle}`);
        this.message.channel.send("Battle joined! Keeping track of stats now.");
    }

    async requestReplay(data) {
       let url = `https://play.pokemonshowdown.com/~~${this.serverType}/action.php`;
       data.id = `${this.serverType === "showdown" ? "" : `${this.serverType}-`}${data.id}`;
       let newData = querystring.stringify({
           act: "uploadreplay",
           log: data.log,
           id: data.id
       });
       //console.log("newData: " + JSON.stringify(newData) + "\n");

       let response = await axios.post(url, newData);

       console.log("Replay posted!");
       let replay = `https://replay.pokemonshowdown.com/${data.id}`;
       //console.log(`Response to replay: ${response.data}`);

       return replay;
    }

    async track() {
        let dataArr = [];
        let p1a = "";
        let p2a = "";
        let players = [];
        let pokes1 = [];
        let pokes2 = [];
        let killer = "";
        let victim = "";
        let killJsonp1 = {};
        let killJsonp2 = {};
        let deathJsonp1 = {};
        let deathJsonp2 = {};
        let turns = 0;
        let replay = "";
        let winner = "";
        let loser = "";

        //when the this.websocket sends a message
        this.websocket.on("message", async (data) => {
            let realdata = data.split("\n");

            //Checks first and foremost if the battle even exists
            if (data.contains(`|noinit|nonexistent|`)) {
                return this.message.channel.send(":x: This link is invalid. The battleroom is either closed or non-existent. I have left the battle.");
            }
        
            //stuff to do after server connects
            if (data.startsWith("|challstr|")) {
                let nonce = data.substring(10);
                let assertion = await this.login(nonce);
                //logs in
                if (assertion) {
                    this.websocket.send(`|/trn ${username},0,${assertion}|`);
                    //Joins the battle
                    await this.join();   
                }
                else {
                    return;
                }
            }

            else if (data.startsWith("|queryresponse|")) {
                if (data.startsWith("|queryresponse|savereplay")) {
                    let replayData = JSON.parse(data.substring(26,));
                    //replay = `https://replay.pokemonshowdown.com/${replayJson.id}`;
                    replay = await this.requestReplay(replayData);
                    console.log("Replay inside the track function: " + replay);

                    let info = {
                        "replay": replay,
                        "turns": turns,
                        "winner": winner,
                        "loser": loser
                    };

                    if (winner.endsWith("p1") && loser.endsWith("p2")) {
                        await this.endscript(winner, killJsonp1, deathJsonp1, loser, killJsonp2, deathJsonp2, info);
                    }
                    else if (winner.endsWith("p2") && loser.endsWith("p1")) {
                        await this.endscript(winner, killJsonp2, deathJsonp2, loser, killJsonp1, deathJsonp1, info);
                    }
                    else {
                        return {"code": "-1"};
                    }

                    this.websocket.send(`|/leave ${this.battle}`);
                    //this.websocket.close();

                    let returndata = {
                        "replay": replay,
                        "players": {
                            "winner": winner,
                            "loser": loser
                        },
                        "code": "1"
                    }
            
                    return returndata;
                }
            }
        
            //removing the `-supereffective` line if it exists in realdata
            for (let element of realdata) {
                if (element.startsWith(`|-supereffective|`)) {
                    realdata.splice(realdata.indexOf(element), 1);
                }
            }
            //going through each line in realdata
            for (let line of realdata) {
                dataArr.push(line);
                let linenew = line.substring(1);
                let parts = linenew.split("|");

                if (linenew.startsWith(`turn`)) {
                    turns++;
                }
        
                //|switch|p1a: Primarina|Primarina, M|100/100
                // or
                //|switch|p1a: Hydreigon|Hydreigon, M|100/100|[from]move: U-turn
                // or
                //|drag|p2a: Alakazam|Alakazam, F|251/251
                else if (linenew.startsWith(`switch`) || linenew.startsWith(`drag`)) {
                    if (linenew.includes("p1a")) {
                        let oldP1a = p1a;
                        p1a = parts[2].split(",")[0];
                        console.log(`Switched from ${oldP1a} to ${p1a}`);
                    }   
                    else if (linenew.includes("p2a")) {
                        let oldP2a = p2a;
                        p2a = parts[2].split(",")[0];
                        console.log(`Switched from ${oldP2a} to ${p2a}`);  
                    }
                }

                //|title|Talal_23 vs. infernapeisawesome
                else if (linenew.startsWith(`title`)) {
                    players = parts[1].split(" vs. ");
                    console.log("Players: " + players);

                    //Checking if either player isn't in the database
                    let leagueJson = await findLeagueId(this.message.channel.id);
                    console.log("got league id for checking during battle ");
                    let playersIds = await getPlayersIds(leagueJson.id);
                    const containsOne = await playerInLeague(playersIds, players[0]);
                    const containsTwo = await playerInLeague(playersIds, players[1]);

                    if (!containsOne && !containsTwo) { //Both players aren't in the database
                        this.message.channel.send(`:exclamation: \`${players[0]}\` and \`${players[1]}\` aren't in the database. Quick, add them before the match ends! Don't worry, I'll still track the battle just fine if you do that.`);
                    }
                    else if (!containsOne) { //Only player 1 isn't in the database
                        this.message.channel.send(`:exclamation: \`${players[0]}\` isn't in the database. Quick, add them before the match ends! Don't worry, I'll still track the battle just fine if you do that.`);
                    }
                    else if (!containsTwo) { //Only player 2 isn't in the database
                        this.message.channel.send(`:exclamation: \`${players[1]}\` isn't in the database. Quick, add them before the match ends! Don't worry, I'll still track the battle just fine if you do that.`);
                    }
                }
        
                //|poke|p1|Hatterene, F|
                else if (linenew.startsWith(`poke`)) {
                    let pokemon = parts[2].split(",")[0].split("-")[0];
                    if (parts[1] === "p1") {
                        pokes1.push(pokemon);
                        killJsonp1[pokemon] = 0;
                        deathJsonp1[pokemon] = 0;
                    }
                    else if (parts[1] === "p2") {
                        pokes2.push(pokemon);
                        killJsonp2[pokemon] = 0;
                        deathJsonp2[pokemon] = 0;
                    }
                } 
                else if (linenew.startsWith("faint")) {
                    if (parts[1].substring(0, 3) === "p1a") {
                        killer = p2a.split("-")[0];
                        victim = p1a.split("-")[0];
                        //updating killer info in the JSON
                        if (!killJsonp2[killer])
                            killJsonp2[killer] = 1;
                        else
                            killJsonp2[killer]++;
                        //updating victim info in the JSON
                        if (!deathJsonp1[victim])
                            deathJsonp1[victim] = 1;
                        else 
                            deathJsonp1[victim]++;
                    } 
                    else {
                        killer = p1a.split("-")[0];
                        victim = p2a.split("-")[0];
                        //updating killer info in the JSON
                        if (!killJsonp1[killer])
                            killJsonp1[killer] = 1;
                        else
                            killJsonp1[killer]++;
                        //updating victim info in the JSON
                        if (!deathJsonp2[victim])
                            deathJsonp2[victim] = 1;
                        else 
                            deathJsonp2[victim]++;
                    }
                    console.log(`${killer} killed ${victim}.`);
                }
        
                //|win|infernapeisawesome
                else if (linenew.startsWith(`win`)) {
                    winner = parts[1];
                    winner = ((winner === players[0]) ? `${winner}p1` : `${winner}p2`);
                    loser = ((winner === `${players[0]}p1`) ? `${players[1]}p2` : `${players[0]}p1`);
                    this.websocket.send(`${this.battle}|/uploadreplay`);
                }
            }
        });
    }
}

module.exports = Showdown
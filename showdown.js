//This is the code for connecting to and keeping track of a showdown match
const json = require("json");
const ws = require("ws");
const axios = require("axios");

const DiscordDMStats = require("./updaters/discorddm");
const GoogleSheetsLineStats = require("./updaters/googleline");
const GoogleSheetsMassStats = require("./updaters/googlemass");

const { username, password, airtable_key, base_id, google_key } = require("./config.json");
const Airtable = require("airtable");
const base = new Airtable({
    apiKey: airtable_key
}).base(base_id);
const VIEW_NAME = "Grid view";

class Showdown {
    constructor(battle, server, message) {
        this.battle = battle.split("/")[3];

        this.serverType = server;
        if (server == "Standard") 
            this.server = "ws://sim.smogon.com:8000/showdown/websocket";
        else if (server == "Sports") 
            this.server = "ws://34.222.148.43:8000/showdown/websocket";
	else if (server === "Automatthic") 
	    this.server = "ws://185.224.89.75:8000/showdown/websocket";
        this.websocket = new ws(this.server);
        this.username = username;
        this.password = password;
        this.message = message;
    }

    async endscript(playerp1, killJson1, deathJson1, playerp2, killJson2, deathJson2, info) {
        let player1 = playerp1.substring(0, playerp1.length - 2).toLowerCase();
        let player2 = playerp2.substring(0, playerp2.length - 2).toLowerCase();

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
                                recordPSName = recordPSName.toLowerCase();
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
                }
            }
        }).then(async () => {        
            console.log("Mods: " + recordJson.mods);
	    console.log("yay: " + JSON.stringify(recordJson));

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
                    await masser.update(killJson1, deathJson1, killJson2, deathJson1, info.replay);
                    break;
                case "Discord DM":
                    let dmer = new DiscordDMStats(this.message);
                    // await dmer.update(recordJson.players[player1].discord, killJson1, deathJson1, 
                    //                   recordJson.players[player2].discord, killJson2, deathJson2, 
                    //                   info);
                    await dmer.update(recordJson);
                    break;
            }

            console.log("Updating done!");
        })        
    }

    async login(nonce) {
        console.log("LOGGING IN");
        let psUrl = "https://play.pokemonshowdown.com/action.php";
        let data = {
            act: "login",
            name: this.username,
            pass: this.password,
            challstr: nonce
        };
    
        let response = await axios.post(psUrl, data);
        let json = JSON.parse(response.data.substring(1));
        console.log("Logged in to PS.");
        return json.assertion;
    }

    async join() {
        console.log(this.battle);
        this.websocket.send(`|/join ${this.battle}`);
        this.message.channel.send("Battle joined! Keeping track of stats now.");
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
        
            //stuff to do after server connects
            if (data.startsWith("|challstr|")) {
                let nonce = data.substring(10);
                let assertion = await this.login(nonce);
                //logs in
                this.websocket.send(`|/trn ${username},0,${assertion}|`);
                //Joins the battle
                await this.join();
            }

            else if (data.startsWith("|queryresponse|")) {
                if (data.startsWith("|queryresponse|savereplay")) {
                    //https://replay.pokemonshowdown.com/sports-gen8nationaldexdraft-44205
                    let replayJson = JSON.parse(data.substring(26,));
                    //replay = `https://replay.pokemonshowdown.com/${replayJson.id}`;
                    if (this.serverType === "Standard") {
                        replay = `https://replay.pokemonshowdown.com/${replayJson.id}`
                    }
		            else {
                        replay = `https://replay.pokemonshowdown.com/${this.serverType.toLowerCase()}-${replayJson.id}`
                    }

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
        
                else if (linenew.startsWith(`switch`)) {
                    if (linenew.includes("p1a")) p1a = parts[2].split(",")[0];
                    else if (linenew.includes("p2a")) p2a = parts[2].split(",")[0];
                }
        
                //|player|p2|infernapeisawesome|1|
                else if (linenew.startsWith(`player`)) {
                    players.push(parts[2]);
                    console.log("Players: " + players);
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
                    this.websocket.send(`${this.battle}|/savereplay`);
                }
            }
        });

        console.log("websocket closed!");
    }
}

module.exports = Showdown

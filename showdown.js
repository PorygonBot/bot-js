//This is the code for connecting to and keeping track of a showdown match
const json = require("json");
const ws = require("ws");

const DiscordDMStats = require("./updaters/discorddm");
const GoogleSheetsLineStats = require("./updaters/googleline");
const GoogleSheetsMassStats = require("./updaters/googlemass");

const { username, password, airtable_key, base_id, google_key } = require("./config.json");
const Airtable = require("airtable");
const base = new Airtable({
    apiKey: airtable_key
}).base(base_id);
var viewname = "Grid view";

class Showdown {
    #username;
    #password;
    #websocket;
    constructor(battle, server, message) {
        this.battle = battle.split("/")[3];

        if (server == "Standard") 
            this.server = "wss://sim.smogon.com/showdown/websocket";
        else if (server == "Sports") 
            this.server = "ws://34.222.148.43:8000/showdown/websocket";
        this.#websocket = new ws(this.server);

        this.#username = username;
        this.#password = password;
        this.message = message;
    }

    async endscript(player1, killJson1, deathJson1, player2, killJson2, deathJson2, info) {
        //TODO finish endscript

        //Getting players info from Airtable
        let recordJson = {
            "system": "",
            "players": {},
            "sheetId": ""
        };

        base("Leagues").select({
            maxRecords: 50,
            view: viewname
        }).eachPage(function page(records, fetchNextPage) {
            records.forEach(function(record) {
                if (record.get("Channel Name") === this.message.channel.name) {
                    let playersIds = record.get("Players");
                    for (let playerId of playersIds) {
                        base("Players").find(playerId, function(err, record) {
                            if (err) {
                                console.error(err);
                                return;
                            }

                            let player = record.get("Showdown Name") === player1 ? player1 : player2
                            recordJson.players[player] = {
                                "ps": player,
                                "discord": record.get("Discord Tag"),
                                "sheet_tab": record.get("Sheet Tab Name"),
                                "kills": (player === player1 ? killJson1 : killJson2),
                                "deaths": (player === player1 ? deathJson1 : deathJson2)
                           }
                        });
                    }

                    recordJson.system = record.get("Stats Storage System");
                    recordJson.sheetId = record.get("Sheet ID");
                    recordJson.range = record.get("Stats Range");
                }
            });

            fetchNextPage();
        },
        function done(err) {
            if (err) {
                console.error(err);
                return;
            }
        });

        //Updating stats based on given method
        switch (recordJson.system) {
            case "Google Sheets Line":
                let liner = GoogleSheetsLineStats(recordJson.sheetId, recordJson.players[player1].sheet_tab);
                await liner.update(player1, Object.keys(killJson1), killJson1, deathJson1,
                                   player2, Object.keys(killJson2), killJson2, deathJson2, 
                                   info);
                break;
            case "Google Sheets Mass":
                let masser = GoogleSheetsMassStats(recordJson.sheetId, 
                                                   `${recordJson.players[player1].sheet_tab}!${recordJson.range}`, 
                                                   `${recordJson.players[player2].sheet_tab}!${recordJson.range}`);
                await masser.update(killJson1, deathJson1, killJson2, deathJson1, info.replay);
                break;
            default:
                let dmer = DiscordDMStats(this.message);
                await dmer.update(recordJson.players[player1].discord, killJson1, deathJson1, 
                                  recordJson.players[player2].discord, killJson2, deathJson2, 
                                  info);
        }
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

        //when the this.#websocket sends a message
        this.#websocket.on("message", async function incoming(data) {
            let realdata = data.split("\n");
        
            //stuff to do after server connects
            if (data.startsWith("|challstr|")) {
                let nonce = data.substring(10);
                let assertion = await login(nonce);
                //logs in
                this.#websocket.send(`|/trn ${psUsername},0,${assertion}|`);
                //Joins the battle
                await this.join();
            }

            else if (data.startsWith("|queryresponse|")) {
                if (data.startsWith("|queryresponse|savereplay")) {
                    //https://replay.pokemonshowdown.com/sports-gen8nationaldexdraft-44205
                    let replayJson = JSON.parse(data.split("|")[3]);
                    replay = `https://replay.pokemonshowdown.com/${replayJson.id}`;

                    let info = {
                        "replay": replay,
                        "turns": turns,
                        "winner": winner,
                        "loser": loser
                    };

                    if (winner.endsWith("p1") && loser.endsWith("p2")) {
                        await endscript(winner, killJsonp1, deathJsonp1, loser, killJsonp2, deathJsonp2, info);
                    }
                    else if (winner.endsWith("p2") && loser.endsWith("p1")) {
                        await endscript(winner, killJsonp2, deathJsonp2, loser, killJsonp1, deathJsonp1, info);
                    }
                    else {
                        return {"code": "-1"};
                    }

                    this.#websocket.close();
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
                    this.#websocket.send(`${this.battle}|/savereplay`);
                }
            }
        });

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

    async login(nonce) {
        let psUrl = "https://play.pokemonshowdown.com/action.php";
        let data = {
            act: "login",
            name: this.#username,
            pass: this.#password,
            challstr: nonce
        };
    
        let response = await axios.post(psUrl, data);
        let json = JSON.parse(response.data.substring(1));
        console.log("Logged in to PS.");
        return json.assertion;
    }

    async join() {
        this.#websocket.send(`|/join ${this.battle}`);
        this.message.channel.send("Battle joined! Keeping track of stats now.");
    }
}
//This is the code for connecting to and keeping track of a showdown match
const json = require("json");
const ws = require("ws");

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

    async winscript(player1, killJson1, deathJson1, player2, killJson2, deathJson2) {
        //TODO finish winscript

        //Getting players info from Airtable
        let recordJson = {
            "system": "",
            "players": {}
        };

        base("Leagues").select({
            maxRecords: 50,
            view: viewname
        }).eachPage(function page(records, fetchNextPage) {
            records.forEach(function(record) {
                if (record.get("Channel Name") === this.message.channel.name) {
                    let playersIds = record.get("Players");
                    for (playerId of playersIds) {
                        base("Players").find(playerId, function(err, record) {
                            if (err) {
                                console.error(err);
                                return;
                            }
                            if (record.get("Showdown Name") === player1) {
                                recordJson.players[player1] = {
                                    "ps": player1,
                                    "discord": record.get("Discord Tag"),
                                    "sheet_tab": record.get("Sheet Tab Name")
                                }
                            }
                            else if (record.get("Showdown Name") === player1) {
                                recordJson.players[player2] = {
                                    "ps": player2,
                                    "discord": record.get("Discord Tag"),
                                    "sheet_tab": record.get("Sheet Tab Name")
                                }
                            }
                        });
                    }

                    recordJson.system = record.get("Stats Storage System");
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
                let liner = GoogleSheetsLineStats();
                break;
            case "Google Sheets Mass":
                let masser = GoogleSheetsMassStats();
                break;
            default:
                let dmer = DiscordDMStats();
                break;
        }
    }

    async track() {
        let dataArr = [];
        let p1a = "";
        let p2a = "";
        let players = [];
        let battlelink = "";
        let pokes1 = [];
        let pokes2 = [];
        let killer = "";
        let victim = "";
        let killJsonp1 = {};
        let killJsonp2 = {};
        let deathJsonp1 = {};
        let deathJsonp2 = {};
        //when the this.#websocket sends a message
        this.#websocket.on("message", async function incoming(data) {
            let realdata = data.split("\n");
        
            //stuff to do after server connects
            if (data.startsWith("|challstr|")) {
                let nonce = data.substring(10);
                let assertion = await login(nonce);
                //logs in
                this.#websocket.send(`|/trn ${psUsername},0,${assertion}|`);
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
        
                if (line.startsWith(`battle`))
                    battlelink = line;
        
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
                    //TODO write this
                    let winner = parts[1];
                    winner = ((winner === players[0]) ? `${winner}p1` : `${winner}p2`);
                    let loser = ((winner === `${players[0]}p1`) ? `${players[1]}p2` : `${players[0]}p1`);

                    if (winner.endsWith("p1") && loser.endsWith("p2")) {
                        await winscript(winner, killJsonp1, deathJsonp1, loser, killJsonp2, deathJsonp2);
                    }
                    else if (winner.endsWith("p2") && loser.endsWith("p1")) {
                        await winscript(winner, killJsonp2, deathJsonp2, loser, killJsonp1, deathJsonp1);
                    }
                    else {
                        return {"code": "-1"};
                    }
                }
            }
        });

        let returndata = {
            "replay": "",
            "players": {
                "p1": "",
                "p2": ""
            },
            "kills": {
                "p1": {

                },
                "p2": {

                }
            },
            "deaths": {
                "p1": {

                },
                "p2": {

                }
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
}
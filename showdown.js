//This is the code for connecting to and keeping track of a showdown match
const json = require("json");
const ws = require("ws");

class Showdown {
    #username;
    #password;
    #websocket;
    constructor(battle, server, loginUser, loginPass) {
        this.battle = battle.split("/")[3];

        if (server == "Standard") this.server = "wss://sim.smogon.com/showdown/this.#websocket";
        else if (server == "Sports") this.server = "ws://34.222.148.43:8000/showdown/this.#websocket";
        this.#websocket = new ws(this.server);

        this.#username = loginUser;
        this.#password = loginPass;
    }

    async winscript() {
        let dmer = DiscordDMStats();
        let masser = GoogleSheetsMassStats();
        let liner = GoogleSheetsLineStats();


        //TODO finish winscript
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
                }
            }
        });
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
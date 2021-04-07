const Pokemon = require("./Pokemon");

class Battle {
    constructor(battleId, player1, player2) {
        //Player info
        this.p1 = player1;
        this.p1Pokemon = {};
        this.p2 = player2;
        this.p2Pokemon = {};

        //Battle info
        this.id = battleId;
        this.hazardsSet = {
            "p1": {
                "Stealth Rock": "",
                "Spikes": "",
                "Toxic Spikes": ""
            },
            "p2": {
                "Stealth Rock": "",
                "Spikes": "",
                "Toxic Spikes": ""
            }
        }
        this.history = [];
        this.weather = "";
        this.weatherInflictor = "";
        this.turns = 0;
        this.replay = "";
        this.winner = "";
        this.loser = "";
        this.forfeiter = "";
        //Player 1's pokemon
        this.p1a = new Pokemon("");
        this.p1b = new Pokemon("");
        //Ploayer 2's pokemon
        this.p2a = new Pokemon("");
        this.p2b = new Pokemon("");
    }

    static numBattles = 0;
    static battles = [];

    static incrementBattles(battleLink) {
        this.numBattles++;
        this.battles.push(battleLink);
    }

    static decrementBattles(battleLink) {
        this.numBattles--;
        this.battles.splice(this.battles.indexOf(battleLink));
    }

    addHazard(side, hazard, hazardInflictor) {
        if (side !== "") {
            this.hazardsSet[side][hazard] = hazardInflictor;
        }
    }

    endHazard(side, hazard) {
        this.hazardsSet[side][hazard] = undefined;
    }

    setWeather(weather, inflictor) {
        this.weather = weather;
        this.weatherInflictor = inflictor;
    }

    clearWeather() {
        this.weather = "";
        this.weatherInflictor = "";
    }
}

module.exports =  Battle;
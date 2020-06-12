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
                "Stealth Rock": undefined,
                "Spikes": undefined,
                "Toxic Spikes": undefined
            },
            "p2": {
                "Stealth Rock": undefined,
                "Spikes": undefined,
                "Toxic Spikes": undefined
            }
        }
        this.turns = 0;
        this.replay = "";
        this.winner = "";
        this.loser = "";
        this.p1a;
        this.p2a;
    }

    addHazard(side, hazard, hazardInflictor) {
        this.hazardsSet[side][hazard] = hazardInflictor;
    }

    endHazard(side, hazard) {
        this.hazardsSet[side][hazard] = undefined;
    }
}

module.exports = Battle;
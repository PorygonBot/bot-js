class Battle {
    constructor(player1, player2) {
        //Player info
        this.p1 = player1;
        this.p1Pokemon = [];
        this.p2 = player2;
        this.p2Pokemon = [];

        //Battle info
        this.hazardsSet = {
            "Stealth Rocks": undefined,
            "Spikes": undefined,
            "Toxic Spikes": undefined
        }
        this.turns = 0;
        this.replay = "";
        this.winner = "";
        this.loser = "";
        this.p1a;
        this.p2a;
    }

    addHazard(hazard, hazardInflictor) {
        this.hazardsSet[hazard] = hazardInflictor;
    }
}

module.exports = Battle;
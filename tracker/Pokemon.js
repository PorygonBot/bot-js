class Pokemon {
    constructor(pokemonName="Raichu", pokemonNickname=undefined) {
        this.name = pokemonName;
        this.nickname = pokemonNickname || pokemonName;
        this.status = "n/a";
        this.statusInflictor = "";
        this.otherAffliction = {}; //Like Leech Seed and stuff
        this.causeOfDeath = "n/a";
        this.directKills = 0;
        this.passiveKills = 0;
        this.isDead = false;
    }

    //If the pokemon gets poisoned, burned, etc.
    statusEffect(statusInflicted, statusInflictor) {
        this.status = statusInflicted;
        this.statusInflictor = statusInflictor;
    }

    //If the pokemon gets healed with healing bell, aromatherapy, etc.
    statusFix() {
        this.status = "n/a";
        this.statusInflictor = "";
    }

    clearAfflictions() {
        this.otherAffliction = {};
    }

    //When the pokemon has killed another pokemon in battle
    killed(deathJson) {
        if (deathJson.isPassive) this.passiveKills++;
        else this.directKills++;
    }

    //Run when the pokemon has died in battle
    died(causeOfDeath, killer, isPassive) {
        killer = killer || this.statusInflictor;
        this.causeOfDeath = causeOfDeath;
        this.isDead = true;

        return {
            "killer": killer,
            "isPassive": isPassive
        }
    }
}

module.exports = Pokemon;
class Pokemon {
    constructor(pokemonName, realName) {
        this.name = pokemonName;
        this.realName = realName || pokemonName;
        this.status = "n/a";
        this.statusInflictor = "";
        this.statusType = ""; //Passive or Direct or undefined
        this.otherAffliction = {}; //Like Leech Seed and stuff
        this.causeOfDeath = "n/a";
        this.currentDirectKills = 0;
        this.directKills = 0;
        this.currentPassiveKills = 0;
        this.passiveKills = 0;
        this.isDead = false;
        this.killer = "";
        this.hasSubstitute = false;
    }

    //If the pokemon gets poisoned, burned, etc.
    statusEffect(statusInflicted, statusInflictor, statusType) {
        this.status = statusInflicted;
        this.statusInflictor = statusInflictor;
        this.statusType = statusType;
    }

    //If the pokemon gets healed with healing bell, aromatherapy, etc.
    statusFix() {
        this.status = "n/a";
        this.statusInflictor = "";
        this.statusType = "";
    }

    clearAfflictions() {
        this.otherAffliction = {};
    }

    //When the pokemon has killed another pokemon in battle
    killed(deathJson) {
        if (deathJson.killer) {
            if (deathJson.isPassive) this.currentPassiveKills++;
            else this.currentDirectKills++;
        }
    }

    unkilled(isPassive) {
        if (isPassive) this.currentPassiveKills--;
        else this.currentDirectKills--;
    }

    //Run when the pokemon has died in battle
    died(causeOfDeath, killer, isPassive) {
        this.causeOfDeath = causeOfDeath;
        this.killer = killer ? killer : undefined;
        this.isDead = true;

        return {
            "killer": killer,
            "isPassive": isPassive
        }
    }

    undied() {
        this.causeOfDeath = "";
        this.isDead = false;
    }
}

module.exports =  Pokemon;
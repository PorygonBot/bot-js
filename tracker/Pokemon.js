class Pokemon {
    constructor(pokemonName) {
        this.name = pokemonName;
        this.status = "n/a";
        this.statusInflictor = "";
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

    setNickname(nickname) {
        this.nickname = nickname;
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
        if (deathJson.isPassive) this.currentPassiveKills++;
        else this.currentDirectKills++;
    }

    unkilled(isPassive) {
        if (isPassive) this.currentPassiveKills--;
        else this.currentDirectKills--;
    }

    //Run when the pokemon has died in battle
    died(causeOfDeath, killer, isPassive) {
        killer = killer || this.statusInflictor;
        this.causeOfDeath = causeOfDeath;
        this.killer = killer;
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

module.exports = Pokemon;
class Pokemon {
    contructor(name, nickname) {
        this.name = name;
        this.nickname = nickname || name;
        this.status = "n/a";
        this.statusInflictor = "";
        this.causeOfDeath = "n/a";
        this.directKills = 0;
        this.passiveKills = 0;
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

    //When the pokemon has killed another pokemon in battle
    killed(deathJson) {
        if (deathJson.isPassive) this.passiveKills++;
        else this.directKills++;
    }

    //Run when the pokemon has died in battle
    died(causeOfDeath, killer, isPassive) {
        killer = killer || this.statusInflictor;
        this.causeOfDeath = causeOfDeath;

        return {
            "killer": killer,
            "isPassive": isPassive
        }
    }
}

module.exports = Pokemon;
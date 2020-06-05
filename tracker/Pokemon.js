class Pokemon {
    contructor(name) {
        this.name = name;
        this.status = "n/a";
        this.statusInflictor = "";
        this.causeOfDeath = "n/a";
    }

    //If the pokemon gets poisoned, burned, etc.
    statusEffect(statusInflicted, statusInflictor) {
        this.status = statusInflicted;
        this.statusInflictor = statusInflictor;
    }

    //If the pokemon gets healed with healing bell, aromatherapy, etc.
    statusFix() {
        this.status = "n/a";
        this.statusInflictor = statusInflictor;
    }

    //Run when the pokemon has died in battle
    died(causeOfDeath, killer) {
        killer = killer || this.statusInflictor;
        this.causeOfDeath = causeOfDeath;

        return {
            "killer": killer,
            "isPassive": this.causeOfDeath === this.status ? true : false
        }
    }
}

module.exports = Pokemon;
class Pokemon {
    contructor(name) {
        this.name = name;
        this.status = "n/a";
        this.statusInflictor = "";
        this.causeOfDeath = "n/a";
        this.directKills = 0;
        this.passiveKills = 0;
    }

/**
|-damage|p2a: Shedinja|0 fnt|[from] Stealth Rock
|faint|p2a: Shedinja

|-damage|p2a: Aegislash|0 fnt|[from] brn
|faint|p2a: Aegislash

|-curestatus|p1a: Sylveon|brn|[msg]
|-curestatus|p1: Aegislash|brn|[msg]

|-damage|p2a: Heliolisk|0 fnt|[from] ability: Solar Power|[of] p2a: Heliolisk
|faint|p2a: Heliolisk

|-damage|p2a: Tyrogue|0 fnt|[from] highjumpkick
|faint|p2a: Tyrogue

|move|p2a: Electrode|Self-Destruct|p1a: Clefable
|-damage|p1a: Clefable|71/100
|faint|p2a: Electrode

|move|p1a: Latias|Healing Wish|p1a: Latias
|faint|p1a: Latias

|switch|p1a: Vulpix|Vulpix, M|41/100
|-heal|p1a: Vulpix|100/100|[from] move: Healing Wish

|-activate|p2a: Horsea|confusion
|-damage|p2a: Horsea|0 fnt|[from] confusion
|faint|p2a: Horsea
*/

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

    killed(deathJson) {
        if (deathJson.isPassive) this.passiveKills++;
        else this.directKills++;
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
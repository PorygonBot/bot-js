const ws = require("ws");
const axios = require("axios");
const querystring = require("querystring");

const Pokemon = require("./Pokemon");
const Battle = require("./Battle");
const util = require("../utils.js");

const DiscordDMStats = require("../updaters/DiscordDMStats");
const DiscordChannelStats = require("../updaters/DiscordChannelStats");
const DiscordDefaultStats = require("../updaters/DiscordDefaultStats");
const SheetsStats = require("../updaters/SheetsStats");

const { username, password, airtable_key, base_id } = require("../config.json");
const Airtable = require("airtable");
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);
const VIEW_NAME = "Grid view";

class ReplayTracker {
	constructor(replayLink, message, rules) {
		this.link = replayLink;
		this.battle = replayLink.split("/")[3];
		this.message = message;
		//Getting the custom rules for the battle
		this.rules = rules;
	}

	async endscript(
		playerp1,
		killJson1,
		deathJson1,
		playerp2,
		killJson2,
		deathJson2,
		info
	) {
		let player1 = playerp1
			.substring(0, playerp1.length - 2)
			.toLowerCase()
			.trim();
		let player2 = playerp2
			.substring(0, playerp2.length - 2)
			.toLowerCase()
			.trim();

		// Getting info from Airtable if required
		let recordJson = {
			players: {},
			system: "Discord",
			info: info,
		};
		recordJson.players[player1] = {
			ps: player1,
			kills: killJson1,
			deaths: deathJson1,
		};
		recordJson.players[player2] = {
			ps: player2,
			kills: killJson2,
			deaths: deathJson2,
		};

		//Send the stats
		let defaulter = new DiscordDefaultStats(this.message);
		await defaulter.update(recordJson);
	}

	async track(data) {
		let battle;
		let players = [];
		let dataArr = [];

		try {
			//Separates the data into lines so it's easy to parse
			let realdata = data.split("\n");

			for (const line of realdata) {
				//console.log(line);
				dataArr.push(line);

				//Separates the line into parts, separated by `|`
				const parts = line.split("|").slice(1); //The substring is because all lines start with | so the first element is always blank

				//At the beginning of every match, the title of a match contains the player's names.
				//As such, in order to get and verify the player's names in the database, this is the most effective.
				if (line.startsWith(`|player|`)) {
					players.push(parts[2]);
					if (parts[1] === "p2") {
						//Initializes the battle as an object
						battle = new Battle(
							this.battle,
							players[0],
							players[1]
						);
					}
				} else if (line.startsWith(`|tier|`)) {
					if (line.toLowerCase().includes("random")) {
						this.websocket.send(`${this.battle}|/leave`);
						return this.message.channel.send(
							":x: **Error!** This is a Randoms match. I don't work with Randoms matches."
						);
					}
				}

				//At the beginning of every non-randoms match, a list of Pokemon show up.
				//This code is to get all that
				else if (line.startsWith(`|poke|`)) {
					let pokemonName = parts[2].split(",")[0].split("-")[0];
					//console.log(pokemonName);
					let pokemon = new Pokemon(pokemonName); //Adding a pokemon to the list of pokemon in the battle
					if (parts[1] === "p1") {
						//If the pokemon belongs to Player 1
						battle.p1Pokemon[pokemonName] = pokemon;
					} else if (parts[1] === "p2") {
						//If the pokemon belongs to Player 2
						battle.p2Pokemon[pokemonName] = pokemon;
					}
				}

				//Increments the total number of turns at the beginning of every new turn
				else if (line.startsWith(`|turn|`)) {
					battle.turns++;
					console.log(battle.turns);
				}

				//If a Pokemon switches, the active Pokemon must now change
				else if (
					line.startsWith(`|switch|`) ||
					line.startsWith(`|drag|`)
				) {
					let replacer = parts[2].split(",")[0].split("-")[0];
					if (parts[1].startsWith("p1")) {
						//If Player 1's Pokemon get switched out
						battle.p1a.hasSubstitute = false;
						battle.p1a.clearAfflictions(); //Clears all afflictions of the pokemon that switches out, like confusion
						let oldPokemon = { name: "" };
						if (battle.p1a.name !== "") {
							let tempCurrentDirectKills =
								battle.p1a.currentDirectKills;
							let tempCurrentPassiveKills =
								battle.p1a.currentPassiveKills;
							battle.p1a.currentDirectKills = 0;
							battle.p1a.currentPassiveKills = 0;
							battle.p1a.directKills += tempCurrentDirectKills;
							battle.p1a.passiveKills += tempCurrentPassiveKills;
							oldPokemon = battle.p1a;

							battle.p1Pokemon[oldPokemon.name] = oldPokemon;
						}
						battle.p1a = battle.p1Pokemon[replacer];
						console.log(
							`${oldPokemon.name} has been switched into ${battle.p1a.name}`
						);
					} else if (parts[1].startsWith("p2")) {
						//If Player 2's Pokemon get switched out
						battle.p2a.hasSubstitute = false;
						battle.p2a.clearAfflictions(); //Clears all afflictions of the pokemon that switches out, like confusion
						let oldPokemon = { name: "" };
						if (battle.p2a.name !== "") {
							let tempCurrentDirectKills =
								battle.p2a.currentDirectKills;
							let tempCurrentPassiveKills =
								battle.p2a.currentPassiveKills;
							battle.p2a.currentDirectKills = 0;
							battle.p2a.currentPassiveKills = 0;
							battle.p2a.directKills += tempCurrentDirectKills;
							battle.p2a.passiveKills += tempCurrentPassiveKills;
							oldPokemon = battle.p2a;
							battle.p2Pokemon[oldPokemon.name] = oldPokemon;
						}
						battle.p2a = battle.p2Pokemon[replacer];
						console.log(
							`${oldPokemon.name} has been switched into ${battle.p2a.name}`
						);
					}
				}

				//If Zoroark replaces the pokemon due to Illusion
				else if (line.startsWith(`|replace|`)) {
					let side = parts[1].split(": ")[0];
					let replacer = parts[2].split(",")[0].split("-")[0];
					if (side === "p1a") {
						let tempCurrentDirectKills =
							battle.p1a.currentDirectKills;
						let tempCurrentPassiveKills =
							battle.p1a.currentPassiveKills;
						battle.p1a.currentDirectKills = 0;
						battle.p1a.currentPassiveKills = 0;
						let oldPokemon = battle.p1a;
						battle.p1a = battle.p1Pokemon[replacer];
						battle.p1a.currentDirectKills += tempCurrentDirectKills;
						battle.p1a.currentPassiveKills += tempCurrentPassiveKills;

						console.log(
							`${oldPokemon.name} has been replaced by ${battle.p1a.name}`
						);
					} else {
						let tempCurrentDirectKills =
							battle.p2a.currentDirectKills;
						let tempCurrentPassiveKills =
							battle.p2a.currentPassiveKills;
						battle.p2a.currentDirectKills = 0;
						battle.p2a.currentPassiveKills = 0;
						let oldPokemon = battle.p2a;
						battle.p2a = battle.p2Pokemon[replacer];
						battle.p2a.currentDirectKills += tempCurrentDirectKills;
						battle.p2a.currentPassiveKills += tempCurrentPassiveKills;

						console.log(
							`${oldPokemon.name} has been replaced by ${battle.p2a.name}`
						);
					}
				}

				//Removes the |-supereffective| or  |upkeep part of realdata if it exists
				else if (
					line.startsWith(`|-supereffective|`) ||
					line.startsWith(`|upkeep`) ||
					line.startsWith(`|-resisted|`) ||
					line.startsWith(`|-unboost|`) ||
					line.startsWith(`|-boost|`) ||
					line.startsWith(`|-activate|`) ||
					line.startsWith(`|-singleturn|`) ||
					line.startsWith(`|-crit|`)
				) {
					dataArr.splice(dataArr.length - 1, 1);
				}

				//If a weather condition is set
				else if (line.startsWith(`|-weather|`)) {
					if (!(line.includes("[upkeep]") || line.includes("none"))) {
						let weather = parts[1];
						let inflictor;
						try {
							//Weather is caused by an ability
							let side = parts[3].split("a: ")[0];
							if (side === "p1") {
								inflictor = battle.p1a.name;
							} else {
								inflictor = battle.p2a.name;
							}
						} catch (e) {
							//Weather is caused by a move
							let prevLine = dataArr[dataArr.length - 2];
							if (
								prevLine
									.split("|")
									.slice(1)[1]
									.startsWith("p1a")
							) {
								inflictor = battle.p1a.name;
							} else {
								inflictor = battle.p2a.name;
							}
						}
						console.log(`${inflictor} caused ${weather}.`);
						battle.setWeather(weather, inflictor);
					}

					//If the weather has been stopped
					if (parts[1] === "none") {
						battle.clearWeather();
					}
				}

				//Checks for certain specific moves: hazards, statuses, etc.
				else if (line.startsWith(`|move|`)) {
					let move = parts[2];
					console.log(line);

					if (
						move === "Stealth Rock" ||
						move === "Spikes" ||
						move === "Toxic Spikes"
					) {
						//Hazards
						//This would be true if there were already Rocks in the field
						let side = parts[3].split(": ")[0].split("a")[0];
						console.log(side);
						if (side.startsWith("p1")) {
							battle.addHazard(side, move, battle.p2a);
						} else {
							battle.addHazard(side, move, battle.p1a);
						}
					}
				}

				//Checks for statuses
				else if (line.startsWith(`|-status|`)) {
					let prevMoveLine = dataArr[dataArr.length - 2];
					let prevMove = prevMoveLine.split("|").slice(1)[2];
					let prevPrevMoveLine = dataArr[dataArr.length - 3];
					let prevPrevMove = prevPrevMoveLine.split("|").slice(1)[2];
					console.log("prevmove: " + prevMove);
					if (
						(prevMoveLine.startsWith(`|move|`) &&
							(util.toxicMoves.includes(prevMove) ||
								util.burnMoves.includes(prevMove))) ||
						(prevPrevMoveLine.startsWith(`|move|`) &&
							(util.toxicMoves.includes(prevPrevMove) ||
								util.burnMoves.includes(prevPrevMove)))
					) {
						//If status was caused by a move
						if (
							prevMoveLine
								.split("|")
								.slice(1)[1]
								.startsWith("p1a") ||
							prevPrevMoveLine
								.split("|")
								.slice(1)[1]
								.startsWith("p1a")
						) {
							battle.p2a.statusEffect(
								parts[2],
								battle.p1a,
								"Passive"
							);
						} else {
							battle.p1a.statusEffect(
								parts[2],
								battle.p2a,
								"Passive"
							);
						}
					} else if (
						line.includes("ability") &&
						util.statusAbility.includes(
							parts[3].split("ability: ")[1].split("|")[0]
						)
					) {
						//Ability status
						let victimSide = parts[1].split(": ")[0];
						if (victimSide === "p1a") {
							battle.p1a.statusEffect(
								parts[2],
								battle.p2a,
								this.rules.abilityitem
							);
						} else {
							battle.p2a.statusEffect(
								parts[2],
								battle.p1a,
								this.rules.abilityitem
							);
						}
					} else if (line.includes("item")) {
						let item = parts[3].split(": ")[1];
						let victimSide = parts[1].split(": ")[0];
						if (victimSide === "p1a") {
							battle.p1a.statusEffect(
								parts[2],
								battle.p2a,
								this.rules.abilityitem
							);
						} else {
							battle.p2a.statusEffect(
								parts[2],
								battle.p1a,
								this.rules.abilityitem
							);
						}
					} else {
						//If status wasn't caused by a move, but rather something like a hazard
						if (parts[1].split(": ")[0] === "p1a") {
							battle.p1a.statusEffect(
								parts[2],
								battle.hazardsSet.p1["Toxic Spikes"]
							);
						} else {
							battle.p2a.statusEffect(
								parts[2],
								battle.hazardsSet.p2["Toxic Spikes"]
							);
						}
					}
				}

				//If a hazard ends on a side
				else if (line.startsWith(`|-sideend|`)) {
					let side = parts[1].split(": ")[0];
					let hazard = parts[2];
					battle.endHazard(side, hazard);
				}

				//If an affliction like Leech Seed or confusion starts
				else if (line.startsWith(`|-start|`)) {
					let prevMove = dataArr[dataArr.length - 2];
					let affliction = parts[2];
					if (
						prevMove.startsWith(`|move|`) &&
						(prevMove.split("|").slice(1)[2] ===
							affliction.split("move: ")[1] ||
						util.confusionMoves.includes(
							prevMove.split("|").slice(1)[2]
						) || //For confusion
						affliction.includes("perish") || //For Perish Song
						affliction === "Curse" || //For Curse
							affliction === "Nightmare") //For Nightmare
					) {
						let move = affliction.split("move: ")[1]
							? affliction.split("move: ")[1]
							: affliction;
						let afflictor = prevMove
							.split("|")
							.slice(1)[1]
							.split(": ")[1];
						let side = parts[1].split(": ")[0];
						if (move === "Future Sight" || move === "Doom Desire") {
							if (side === "p2a") {
								battle.hazardsSet.p1[move] = battle.p2a.name;
							} else if (side === "p1a") {
								battle.hazardsSet.p2[move] = battle.p1a.name;
							}
						} else {
							console.log("Started " + move + " by " + afflictor);
							if (side === "p1a") {
								battle.p1a.otherAffliction[move] =
									battle.p2a.name;
							} else if (side === "p2a") {
								battle.p2a.otherAffliction[move] =
									battle.p1a.name;
							}
						}
					} else if (affliction === `perish0`) {
						//Pokemon dies of perish song
						let side = parts[1].split(": ")[0];
						if (side === "p1a") {
							let deathJson = battle.p1a.died(
								affliction,
								battle.p1a.otherAffliction["perish3"],
								true
							);
							battle.p2Pokemon[
								battle.p1a.otherAffliction["perish3"]
							].killed(deathJson);
						} else if (side === "p2a") {
							let deathJson = battle.p2a.died(
								affliction,
								battle.p2a.otherAffliction["perish3"],
								true
							);
							console.log(
								JSON.stringify(battle.p1a.otherAffliction)
							);
							battle.p1Pokemon[
								battle.p2a.otherAffliction["perish3"]
							].killed(deathJson);
						}
					} else if (affliction === `Substitute`) {
						let side = parts[1].split(": ")[0];
						if (side === `p1a`) {
							battle.p1a.hasSubstitute = true;
						} else {
							battle.p2a.hasSubstitute = true;
						}
					}
					dataArr.splice(dataArr.length - 1, 1);
				} else if (line.startsWith(`|-immune|`)) {
					let side = parts[1].split(": ")[0];
					if (side === "p1a") {
						if (battle.p1a.isDead) {
							battle.p1a.undied();
							battle[battle.p1a.killer].unkilled();
						}
					}
					if (side === "p2a") {
						if (battle.p2a.isDead) {
							battle.p2a.undied();
							battle[battle.p2a.killer.name].unkilled();
						}
					}
				}

				//If a pokemon's status is cured
				else if (line.startsWith(`|-curestatus|`)) {
					let side = parts[1].split(": ")[0];
					if (side.startsWith("p1")) {
						battle.p1a.statusFix();
					} else {
						battle.p2a.statusFix();
					}
				}

				//When a Pokemon is damaged, and possibly faints
				else if (line.startsWith(`|-damage|`)) {
					if (parts[2].endsWith("fnt")) {
						//A pokemon has fainted
						let victimSide = parts[1].split(": ")[0];
						let prevMoveLine = dataArr[dataArr.length - 2];
						let prevMove;
						try {
							prevMove = prevMoveLine
								.split("|")
								.slice(1)[2]
								.split(": ")[1];
						} catch (e) {
							prevMove = "";
						}
						let killer = "";
						let victim = "";
						let reason = "";

						if (parts[3] && parts[3].includes("[from]")) {
							//It's a special death, not a normal one.
							let move = parts[3].split("[from] ")[1];
							if (move === "Stealth Rock" || move === "Spikes") {
								//Hazards
								if (victimSide === "p1a") {
									killer = battle.hazardsSet.p1[move].name;
									let deathJson = battle.p1a.died(
										move,
										killer,
										true
									);
									battle.p2Pokemon[killer].killed(deathJson);
									victim = battle.p1a.name;
								} else if (victimSide === "p2a") {
									killer = battle.hazardsSet.p2[move].name;
									let deathJson = battle.p2a.died(
										move,
										killer,
										true
									);
									battle.p1Pokemon[killer].killed(deathJson);
									victim = battle.p2a.name;
								}
								reason = `${move} (passive)`;
							} else if (
								move === "Hail" ||
								move === "Sandstorm"
							) {
								//Weather
								killer = battle.weatherInflictor;
								if (victimSide === "p1a") {
									if (
										Object.keys(battle.p1Pokemon).includes(
											killer
										)
									) {
										if (this.rules.selfteam !== "None")
											killer = battle.p2a.name;
										else killer = undefined;
									}
									let deathJson = battle.p1a.died(
										move,
										killer,
										true
									);
									if (killer) {
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									}
									victim = battle.p1a.name;
								} else if (victimSide === "p2a") {
									if (
										Object.keys(battle.p2Pokemon).includes(
											killer
										)
									) {
										if (this.rules.selfteam !== "None")
											killer = battle.p1a.name;
										else killer = undefined;
									}
									let deathJson = battle.p2a.died(
										move,
										killer,
										true
									);
									if (killer) {
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									}
									victim = battle.p2a.name;
								}
								reason = `${move} (passive)`;
							} else if (
								move === "brn" ||
								move === "psn" ||
								move === "tox"
							) {
								if (victimSide === "p1a") {
									killer = battle.p1a.statusInflictor.name;
									if (
										Object.keys(battle.p1Pokemon).includes(
											killer
										)
									) {
										if (this.rules.selfteam !== "None")
											killer = battle.p2a.name;
										else killer = undefined;
									}
									let deathJson = battle.p1a.died(
										move,
										killer,
										battle.p1a.statusType === "Passive"
									);
									if (killer) {
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									}
									victim = battle.p1a.name;
									reason = `${move} (${
										battle.p1a.statusType === "Passive"
											? "passive"
											: "direct"
									})`;
								} else if (victimSide === "p2a") {
									killer = battle.p2a.statusInflictor.name;
									if (
										Object.keys(battle.p2Pokemon).includes(
											killer
										)
									) {
										if (this.rules.selfteam !== "None")
											killer = battle.p1a.name;
										else killer = undefined;
									}
									let deathJson = battle.p2a.died(
										move,
										killer,
										battle.p2a.statusType === "Passive"
									);
									if (killer) {
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									}
									victim = battle.p2a.name;
									reason = `${move} (${
										battle.p2a.statusType === "Passive"
											? "passive"
											: "direct"
									})`;
								}
							} else if (
								util.recoilMoves.includes(move) ||
								move === "Recoil"
							) {
								//Recoil deaths
								if (victimSide == "p1a") {
									if (this.rules.recoil !== "None")
										killer = battle.p2a.name;
									else killer = undefined;

									let deathJson = battle.p1a.died(
										"recoil",
										killer,
										this.rules.recoil === "Passive"
									);
									if (killer)
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									victim = battle.p1a.name;
								} else {
									if (this.rules.recoil !== "None")
										killer = battle.p1a.name;
									else killer = undefined;

									let deathJson = battle.p2a.died(
										"recoil",
										killer,
										this.rules.recoil === "Passive"
									);
									if (killer)
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									victim = battle.p2a.name;
								}
								reason = `recoil (${
									this.rules.recoil === "Passive"
										? "passive"
										: "direct"
								})`;
							} else if (move.startsWith(`item: `)) {
								let item = move.split(": ")[1];

								if (
									victimSide === "p1a" &&
									!battle.p1a.isDead
								) {
									if (this.rules.abilityitem !== "None")
										killer = battle.p2a.name;
									else killer = undefined;
									let deathJson = battle.p1a.died(
										item,
										killer,
										this.rules.abilityitem === "Passive"
									);
									battle.p2Pokemon[killer].killed(deathJson);
									victim = battle.p1a.name;
								} else if (
									victimSide === "p2a" &&
									!battle.p2a.isDead
								) {
									if (this.rules.abilityitem !== "None")
										killer = battle.p1a.name;
									else killer = undefined;
									let deathJson = battle.p2a.died(
										item,
										killer,
										this.rules.abilityitem === "Passive"
									);
									battle.p1Pokemon[killer].killed(deathJson);
									victim = battle.p2a.name;
								}
								reason = `${item} (${
									this.rules.abilityitem === "Passive"
										? "passive"
										: "direct"
								})`;
							} else if (move.includes(`ability`)) {
								//Ability deaths
								let ability = move.split(": ")[1];
								if (victimSide === "p1a") {
									if (this.rules.abilityitem !== "None")
										killer = battle.p2a.name;
									else killer = undefined;
									let deathJson = battle.p1a.died(
										ability,
										killer,
										this.rules.abilityitem === "Passive"
									);
									battle.p2Pokemon[killer].killed(deathJson);
									victim = battle.p1a.name;
								} else if (victimSide === "p2a") {
									if (this.rules.abilityitem !== "None")
										killer = battle.p1a.name;
									else killer = undefined;
									let deathJson = battle.p2a.died(
										ability,
										killer,
										this.rules.abilityitem === "Passive"
									);
									battle.p1Pokemon[killer].killed(deathJson);
									victim = battle.p2a.name;
								}
								reason = `${ability} (${
									this.rules.abilityitem === "Passive"
										? "passive"
										: "direct"
								})`;
							} else {
								//Affliction-caused deaths
								if (victimSide === "p1a") {
									let deathJson = battle.p1a.died(
										move,
										battle.p1a.otherAffliction[move],
										true
									);
									battle.p2Pokemon[
										battle.p1a.otherAffliction[move]
									].killed(deathJson);
								} else if (victimSide === "p2a") {
									let deathJson = battle.p2a.died(
										move,
										battle.p2a.otherAffliction[move],
										true
									);
									battle.p1Pokemon[
										battle.p2a.otherAffliction[move]
									].killed(deathJson);
								}
								reason = `${move} (passive)`;
							}
						} else if (
							prevMove === "Future Sight" ||
							prevMove === "Doom Desire"
						) {
							//Future Sight or Doom Desire Kill
							if (victimSide === "p1a") {
								killer = battle.hazardsSet.p1[prevMove];
								let deathJson = battle.p1a.died(
									prevMove,
									killer,
									true
								);
								battle.p2Pokemon[killer].killed(deathJson);
								victim = battle.p1a.name;
							} else if (victimSide === "p2a") {
								killer = battle.hazardsSet.p2[prevMove];
								let deathJson = battle.p2a.died(
									prevMove,
									killer,
									true
								);
								battle.p1Pokemon[killer].killed(deathJson);
								victim = battle.p2a.name;
							}
							reason = `${prevMove} (passive)`;
						} else {
							//It's just a regular effing kill
							prevMove = prevMoveLine.split("|").slice(1)[2];
							if (victimSide === "p1a" && !battle.p1a.isDead) {
								let deathJson = battle.p1a.died(
									"direct",
									battle.p2a,
									false
								);
								battle.p2a.killed(deathJson);
								killer = battle.p2a.name;
								victim = battle.p1a.name;
							} else if (
								victimSide === "p2a" &&
								!battle.p2a.isDead
							) {
								let deathJson = battle.p2a.died(
									"direct",
									battle.p1a,
									false
								);
								battle.p1a.killed(deathJson);
								killer = battle.p1a.name;
								victim = battle.p2a.name;
							}
							reason = `${prevMove} (direct)`;
						}
						console.log(
							`${victim} was killed by ${killer} due to ${reason}.`
						);
						battle.history.push(
							`${victim} was killed by ${killer} due to ${reason}.`
						);
					}
					dataArr.splice(dataArr.length - 1, 1);
				}

				//This is mostly only used for the victim of Destiny Bond
				else if (line.startsWith(`|faint|`)) {
					let victimSide = parts[1].split(": ")[0];
					let prevLine = dataArr[dataArr.length - 2];
					if (
						prevLine.startsWith(`|-activate|`) &&
						prevLine.endsWith(`Destiny Bond`)
					) {
						let killer = "";
						if (victimSide === "p1a") {
							if (this.rules.db !== "None") killer = battle.p2a;
							let deathJson = battle.p1a.died(
								"Destiny Bond",
								killer,
								this.rules.db === "Passive"
							);
							battle.p2a.killed(deathJson);
							console.log(
								`${battle.p1a.name} was killed by ${battle.p2a.name} due to Destiny Bond`
							);
							battle.history.push(
								`${battle.p1a.name} was killed by ${battle.p2a.name} due to Destiny Bond`
							);
						}
						if (victimSide === "p2a") {
							if (this.rules.db !== "None") killer = battle.p2a;
							let deathJson = battle.p2a.died(
								"Destiny Bond",
								killer,
								this.rules.db === "Passive"
							);
							battle.p1a.killed(deathJson);
							console.log(
								`${battle.p2a.name} was killed by ${battle.p1a.name} due to Destiny Bond`
							);
							battle.history.push(
								`${battle.p2a.name} was killed by ${battle.p1a.name} due to Destiny Bond`
							);
						}
					} else if (
						prevLine.startsWith(`|move|`) &&
						(prevLine.includes("Self-Destruct") ||
							prevLine.includes("Explosion") ||
							prevLine.includes("Memento") ||
							prevLine.includes("Healing Wish"))
					) {
						let prevParts = prevLine.split("|").slice(1);
						let prevMove = prevParts[2];

						let killer = "";
						if (victimSide === "p2a") {
							if (this.rules.suicide !== "None")
								killer = battle.p1a.name;
							else killer = undefined;
							let deathJson = battle.p2a.died(
								prevMove,
								killer,
								this.rules.suicide === "Passive"
							);
							if (killer) {
								battle.p1a.killed(deathJson);
								console.log(
									`${battle.p2a.name} was killed by ${
										battle.p1a.name
									} due to ${prevMove} (${
										this.rules.suicide === "Passive"
											? "passive"
											: "direct"
									})`
								);
								battle.history.push(
									`${battle.p2a.name} was killed by ${
										battle.p1a.name
									} due to ${prevMove} (${
										this.rules.suicide === "Passive"
											? "passive"
											: "direct"
									})`
								);
							} else {
								console.log(
									`${battle.p2a.name} died to ${prevMove}.`
								);
							}
						} else if (victimSide === "p1a") {
							if (this.rules.suicide !== "None")
								killer = battle.p2a.name;
							else killer = undefined;
							let deathJson = battle.p1a.died(
								prevMove,
								killer,
								this.rules.suicide === "Passive"
							);
							if (killer) {
								battle.p2a.killed(deathJson);
								console.log(
									`${battle.p1a.name} was killed by ${
										battle.p2a.name
									} due to ${prevMove} (${
										this.rules.suicide === "Passive"
											? "passive"
											: "direct"
									})`
								);
								battle.history.push(
									`${battle.p1a.name} was killed by ${
										battle.p2a.name
									} due to ${prevMove} (${
										this.rules.suicide === "Passive"
											? "passive"
											: "direct"
									})`
								);
							} else {
								console.log(
									`${battle.p1a.name} died to ${prevMove}.`
								);
							}
						}
					} else {
						//Regular kill if it wasn't picked up by the |-damage| statement
						if (victimSide === "p1a" && !battle.p1a.isDead) {
							let deathJson = battle.p1a.died(
								"faint",
								battle.p2a,
								false
							);
							battle.p2a.killed(deathJson);
							console.log(prevLine);
							console.log(
								`${battle.p1a.name} was killed by ${battle.p2a.name}`
							);
							battle.history.push(
								`${battle.p1a.name} was killed by ${battle.p2a.name}`
							);
						} else if (victimSide === "p2a" && !battle.p2a.isDead) {
							let deathJson = battle.p2a.died(
								"faint",
								battle.p1a,
								false
							);
							battle.p1a.killed(deathJson);
							console.log(
								`${battle.p2a.name} was killed by ${battle.p1a.name}`
							);
							battle.history.push(
								`${battle.p2a.name} was killed by ${battle.p1a.name}`
							);
						}
					}
				}
				//At the end of the match, when the winner is announced
				else if (line.startsWith(`|win|`)) {
					battle.winner = parts[1];
					battle.winner =
						battle.winner === battle.p1
							? `${battle.winner}p1`
							: `${battle.winner}p2`;
					battle.loser =
						battle.winner === `${battle.p1}p1`
							? `${battle.p2}p2`
							: `${battle.p1}p1`;

					//Giving mons their proper kills
					//Team 1
					for (let pokemon of Object.values(battle.p1Pokemon)) {
						battle.p1Pokemon[pokemon.name].directKills +=
							pokemon.currentDirectKills;
						battle.p1Pokemon[pokemon.name].passiveKills +=
							pokemon.currentPassiveKills;
					}
					//Team 2
					for (let pokemon of Object.values(battle.p2Pokemon)) {
						battle.p2Pokemon[pokemon.name].directKills +=
							pokemon.currentDirectKills;
						battle.p2Pokemon[pokemon.name].passiveKills +=
							pokemon.currentPassiveKills;
					}

					console.log(`${battle.winner} won!`);

					let info = {
						replay: this.link,
						turns: battle.turns,
						winner: battle.winner,
						loser: battle.loser,
						history: `https://kills.porygonbot.xyz/${this.battle}`
					};

					//Creating the objects for kills and deaths
					//Player 1
					let killJsonp1 = {};
					let deathJsonp1 = {};
					for (let pokemonObj of Object.values(battle.p1Pokemon)) {
						killJsonp1[pokemonObj.name] = {
							direct: pokemonObj.directKills,
							passive: pokemonObj.passiveKills,
						};
						deathJsonp1[pokemonObj.name] = pokemonObj.isDead
							? 1
							: 0;
					}
					//Player 2
					let killJsonp2 = {};
					let deathJsonp2 = {};
					for (let pokemonObj of Object.values(battle.p2Pokemon)) {
						killJsonp2[pokemonObj.name] = {
							direct: pokemonObj.directKills,
							passive: pokemonObj.passiveKills,
						};
						deathJsonp2[pokemonObj.name] = pokemonObj.isDead
							? 1
							: 0;
					}

					await axios.post(
						`https://kills.porygonbot.xyz/${
							this.battle
						}`,
						battle.history.join("<br>"),
						{
							headers: {
								"Content-Length": 0,
								"Content-Type": "text/plain",
							},
							responseType: "text",
						}
					);

					if (
						battle.winner.endsWith("p1") &&
						battle.loser.endsWith("p2")
					) {
						await this.endscript(
							battle.winner,
							killJsonp1,
							deathJsonp1,
							battle.loser,
							killJsonp2,
							deathJsonp2,
							info
						);
					} else if (
						battle.winner.endsWith("p2") &&
						battle.loser.endsWith("p1")
					) {
						await this.endscript(
							battle.winner,
							killJsonp2,
							deathJsonp2,
							battle.loser,
							killJsonp1,
							deathJsonp1,
							info
						);
					} else {
						return { code: "-1" };
					}

					let returndata = {
						info: info,
						code: "0",
					};

					return returndata;
				}
			}
		} catch (e) {
			this.message.channel.send(
				`:x: Error with this match. I will be unable to update this match until you screenshot this message and send it to the Porygon server's general channel and **@harbar20#9389**.\n**Error:**\`\`\`${e}\`\`\``
			);
			console.error(e);
		}
	}
}

module.exports = ReplayTracker;

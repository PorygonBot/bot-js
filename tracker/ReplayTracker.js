//This is the tracker for replays

//Importing all required modules
const axios = require("axios");
//Importing all tracking-related modules
const Pokemon = require("./Pokemon");
const Battle = require("./Battle");
const utils = require("../utils.js");
//Importing all updating-related modules
const DiscordDefaultStats = require("../updaters/DiscordDefaultStats");
const InteractionStats = require("../updaters/InteractionStats");

class ReplayTracker {
	constructor(replayLink, message, rules, interaction) {
		this.link = replayLink;
		this.battleLink = replayLink.split("/")[3];
		this.message = message;
		this.interaction = interaction;
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
			system: "",
			info: info,
			combinePD: info.combinePD,
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
		if (info.client) {
			let interacter = new InteractionStats(
				this.interaction,
				info.client
			);
			await interacter.update(recordJson);
		}
		let defaulter = new DiscordDefaultStats(this.message);
		await defaulter.update(recordJson);
	}

	async track(data, client) {
		let battle;
		let players = [];
		let dataArr = [];

		try {
			//Separates the data into lines so it's easy to parse
			let realdata = data.split("\n");

			for (const line of realdata) {
				console.log(line);
				dataArr.push(line);

				//Separates the line into parts, separated by `|`
				const parts = line.split("|").slice(1); //The substring is because all lines start with | so the first element is always blank

				//At the beginning of every match, the title of a match contains the player's names.
				if (line.startsWith(`|player|`)) {
					if (players.length < 2) {
						players.push(parts[2]);
						if (parts[1] === "p2") {
							//Initializes the battle as an object
							battle = new Battle(
								this.battleLink,
								players[0],
								players[1]
							);
						}
					}
				}

				//Increments the total number of turns at the beginning of every new turn
				else if (line.startsWith(`|turn|`)) {
					battle.turns++;
					console.log(battle.turns);
				}

				//Checks if the battle is a randoms match
				else if (line.startsWith(`|tier|`)) {
					if (line.toLowerCase().includes("random")) {
						return this.message.channel.send(
							":x: **Error!** This is a Randoms match. I don't work with Randoms matches."
						);
					}
				}

				//At the beginning of every non-randoms match, a list of Pokemon show up.
				//This code is to get all that
				else if (line.startsWith(`|poke|`)) {
					let realName = parts[2].split(",")[0];
					let pokemonName = realName.split("-")[0];
					let pokemon = new Pokemon(pokemonName, realName); //Adding a pokemon to the list of pokemon in the battle

					battle[`${parts[1]}Pokemon`][pokemonName] = pokemon;
				}

				//If a Pokemon switches, the active Pokemon must now change
				else if (
					line.startsWith(`|switch|`) ||
					line.startsWith(`|drag|`)
				) {
					let replacerRealName = parts[2].split(",")[0];
					let replacer = replacerRealName.split("-")[0];
					if (parts[1].startsWith("p1a")) {
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
						battle.p1a.realName = replacerRealName;
						battle.p1Pokemon[battle.p1a.realName] = battle.p1a;
						console.log(
							`${this.battleLink}: ${oldPokemon.name} has been switched into ${battle.p1a.name}`
						);
					} else if (parts[1].startsWith("p1b")) {
						//If Player 1's Pokemon get switched out
						battle.p1b.hasSubstitute = false;
						battle.p1b.clearAfflictions(); //Clears all afflictions of the pokemon that switches out, like confusion
						let oldPokemon = { name: "" };
						if (battle.p1b.name !== "") {
							let tempCurrentDirectKills =
								battle.p1b.currentDirectKills;
							let tempCurrentPassiveKills =
								battle.p1b.currentPassiveKills;
							battle.p1b.currentDirectKills = 0;
							battle.p1b.currentPassiveKills = 0;
							battle.p1b.directKills += tempCurrentDirectKills;
							battle.p1b.passiveKills += tempCurrentPassiveKills;
							oldPokemon = battle.p1b;

							battle.p1Pokemon[oldPokemon.name] = oldPokemon;
						}
						battle.p1b = battle.p1Pokemon[replacer];
						battle.p1b.realName = replacerRealName;
						battle.p1Pokemon[battle.p1b.realName] = battle.p1b;
						console.log(
							`${this.battleLink}: ${oldPokemon.name} has been switched into ${battle.p1b.name}`
						);
					} else if (parts[1].startsWith("p2a")) {
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
						battle.p2a.realName = replacerRealName;
						battle.p2Pokemon[battle.p2a.realName] = battle.p2a;
						console.log(
							`${this.battleLink}: ${oldPokemon.name} has been switched into ${battle.p2a.name}`
						);
					} else if (parts[1].startsWith("p2b")) {
						//If Player 1's Pokemon get switched out
						battle.p2b.hasSubstitute = false;
						battle.p2b.clearAfflictions(); //Clears all afflictions of the pokemon that switches out, like confusion
						let oldPokemon = { name: "" };
						if (battle.p2b.name !== "") {
							let tempCurrentDirectKills =
								battle.p2b.currentDirectKills;
							let tempCurrentPassiveKills =
								battle.p2b.currentPassiveKills;
							battle.p2b.currentDirectKills = 0;
							battle.p2b.currentPassiveKills = 0;
							battle.p2b.directKills += tempCurrentDirectKills;
							battle.p2b.passiveKills += tempCurrentPassiveKills;
							oldPokemon = battle.p2b;

							battle.p2Pokemon[oldPokemon.name] = oldPokemon;
						}
						battle.p2b = battle.p2Pokemon[replacer];
						battle.p2b.realName = replacerRealName;
						battle.p2Pokemon[battle.p2b.realName] = battle.p2b;
						console.log(
							`${this.battleLink}: ${oldPokemon.name} has been switched into ${battle.p2b.name}`
						);
					}
				}

				//Ally Switch and stuff
				else if (line.startsWith("|swap|")) {
					let userSide = parts[1].split(": ")[0];
					if (userSide.startsWith("p1")) {
						let temp = battle.p1a;
						battle.p1a = battle.p1b;
						battle.p1b = temp;

						console.log(
							`${this.battleLink}: ${
								battle.p1a
							} has switched with ${battle.p1b} due to ${
								parts[3].split(": ")[1]
							}`
						);
					} else if (userSide.startsWith("p2")) {
						let temp = battle.p2a;
						battle.p2a = battle.p2b;
						battle.p2b = temp;

						console.log(
							`${this.battleLink}: ${
								battle.p2a
							} has switched with ${battle.p2b} due to ${
								parts[3].split(": ")[1]
							}`
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
						battle.p1a.currentPassiveKills +=
							tempCurrentPassiveKills;

						console.log(
							`${this.battleLink}: ${oldPokemon.name} has been replaced by ${battle.p1a.name}`
						);
					} else if (side === "p1b") {
						let tempCurrentDirectKills =
							battle.p1b.currentDirectKills;
						let tempCurrentPassiveKills =
							battle.p1b.currentPassiveKills;
						battle.p1b.currentDirectKills = 0;
						battle.p1b.currentPassiveKills = 0;
						let oldPokemon = battle.p1b;
						battle.p1b = battle.p1Pokemon[replacer];
						battle.p1b.currentDirectKills += tempCurrentDirectKills;
						battle.p1b.currentPassiveKills +=
							tempCurrentPassiveKills;

						console.log(
							`${this.battleLink}: ${oldPokemon.name} has been replaced by ${battle.p1b.name}`
						);
					} else if (side === "p2a") {
						let tempCurrentDirectKills =
							battle.p2a.currentDirectKills;
						let tempCurrentPassiveKills =
							battle.p2a.currentPassiveKills;
						battle.p2a.currentDirectKills = 0;
						battle.p2a.currentPassiveKills = 0;
						let oldPokemon = battle.p2a;
						battle.p2a = battle.p2Pokemon[replacer];
						battle.p2a.currentDirectKills += tempCurrentDirectKills;
						battle.p2a.currentPassiveKills +=
							tempCurrentPassiveKills;

						console.log(
							`${this.battleLink}: ${oldPokemon.name} has been replaced by ${battle.p2a.name}`
						);
					} else if (side === "p2b") {
						let tempCurrentDirectKills =
							battle.p2b.currentDirectKills;
						let tempCurrentPassiveKills =
							battle.p2b.currentPassiveKills;
						battle.p2b.currentDirectKills = 0;
						battle.p2b.currentPassiveKills = 0;
						let oldPokemon = battle.p2b;
						battle.p2b = battle.p1Pokemon[replacer];
						battle.p2b.currentDirectKills += tempCurrentDirectKills;
						battle.p2b.currentPassiveKills +=
							tempCurrentPassiveKills;

						console.log(
							`${this.battleLink}: ${oldPokemon.name} has been replaced by ${battle.p2b.name}`
						);
					}
					dataArr.splice(dataArr.length - 1, 1);
				}

				//Removes the |-supereffective| or  |upkeep part of realdata if it exists
				else if (
					line.startsWith(`|-supereffective|`) ||
					line.startsWith(`|upkeep`) ||
					line.startsWith(`|-resisted|`) ||
					line.startsWith(`|-unboost|`) ||
					line.startsWith(`|-boost|`) ||
					line.startsWith(`|-singleturn|`) ||
					line.startsWith("|debug|") ||
					line.startsWith("|-enditem|") ||
					line.startsWith("|-fieldstart|") ||
					line.startsWith("|-zbroken|") ||
					line.startsWith("|-heal|") ||
					line.startsWith("|-hint|") ||
					line.startsWith("|-hitcount|") ||
					line.startsWith("|-ability|") ||
					line.startsWith("|-fieldactivate|") ||
					line.startsWith("|-fail|") ||
					line === "|"
				) {
					dataArr.splice(dataArr.length - 1, 1);
				}

				//When a Pokemon mega-evolves, I change its "realname"
				else if (line.startsWith(`|detailschange|`)) {
					if (
						parts[2].includes("Mega") ||
						parts[2].includes("Primal")
					) {
						let side = parts[1].split(": ")[0];
						let realName = parts[2].split(",")[0];
						battle[side].realName = realName;
					}
					dataArr.splice(dataArr.length - 1, 1);
				}

				//When a Pokemon Gigantamaxes, I change its "realname"
				else if (line.startsWith(`|-formechange|`)) {
					if (parts[2].includes("-Gmax")) {
						let side = parts[1].split(": ")[0];
						let realName = parts[2].split(",")[0];
						if (side === "p1a") {
							battle.p1a.realName = realName;
						} else if (side === "p1b") {
							battle.p1b.realName = realName;
						} else if (side === "p2a") {
							battle.p2a.realName = realName;
						} else if (side === "p2b") {
							battle.p2b.realName = realName;
						}
					}
					dataArr.splice(dataArr.length - 1, 1);
				}

				//If a weather condition is set
				else if (line.startsWith(`|-weather|`)) {
					if (!(line.includes("[upkeep]") || line.includes("none"))) {
						let weather = parts[1];
						let inflictor;
						try {
							//Weather is caused by an ability
							let side = parts[3].split(": ")[0];
							if (side.includes("p1a")) {
								inflictor = battle.p1a.name;
							} else if (side.includes("p1b")) {
								inflictor = battle.p1b.name;
							} else if (side.includes("p2a")) {
								inflictor = battle.p2a.name;
							} else if (side.includes("p2b")) {
								inflictor = battle.p2b.name;
							}
						} catch (e) {
							//Weather is caused by a move
							let prevLine = dataArr[dataArr.length - 2];
							let side = prevLine
								.split("|")
								.slice(1)[1]
								.split(": ")[0];
							if (side.includes("p1a")) {
								inflictor = battle.p1a.name;
							} else if (side.includes("p1b")) {
								inflictor = battle.p1b.name;
							} else if (side.includes("p2a")) {
								inflictor = battle.p2a.name;
							} else if (side.includes("p2b")) {
								inflictor = battle.p2b.name;
							}
						}
						console.log(
							`${this.battleLink}: ${inflictor} caused ${weather}.`
						);
						battle.setWeather(weather, inflictor);
					}

					//If the weather has been stopped
					if (parts[1] === "none") {
						battle.clearWeather();
					}

					dataArr.splice(dataArr.length - 1, 1);
				}

				//For moves like Infestation and Fire Spin
				else if (line.startsWith(`|-activate|`)) {
					let move =
						parts[2].includes("move") ||
						parts[2].includes("ability")
							? parts[2].split(": ")[1]
							: parts[2];
					if (
						!(
							parts.length < 4 ||
							!parts[3].includes(": ") ||
							parts[2].includes("ability") ||
							parts[2].includes("item")
						)
					) {
						let victimSide = parts[1].split(": ")[0];
						let inflictorSide = parts[3]
							.split(" ")[1]
							.split(":")[0];

						if (victimSide === "p1a") {
							if (inflictorSide === "p2a")
								battle.p1a.otherAffliction[move] =
									battle.p2a.name;
							else
								battle.p1a.otherAffliction[move] =
									battle.p2b.name;
						} else if (victimSide === "p1b") {
							if (inflictorSide === "p2a")
								battle.p1b.otherAffliction[move] =
									battle.p2a.name;
							else
								battle.p1b.otherAffliction[move] =
									battle.p2b.name;
						} else if (victimSide === "p2a") {
							if (inflictorSide === "p1a")
								battle.p2a.otherAffliction[move] =
									battle.p1a.name;
							else
								battle.p2a.otherAffliction[move] =
									battle.p1b.name;
						} else if (victimSide === "p2b") {
							if (inflictorSide === "p1a")
								battle.p2b.otherAffliction[move] =
									battle.p1a.name;
							else
								battle.p2b.otherAffliction[move] =
									battle.p1b.name;
						}
					}
					if (move !== "Destiny Bond" && move !== "Synchronize")
						dataArr.splice(dataArr.length - 1, 1);
				}

				//Checks for certain specific moves: hazards only for now
				else if (line.startsWith(`|move|`)) {
					let move = parts[2];
					console.log(`${this.battleLink}: ${line}`);

					if (line.includes("[miss]")) {
						//If a mon missed
						let inflictorSide = parts[1].split(": ")[0];
						let victimSide = parts[3].split(": ")[0];
						battle.history.push(
							`${battle[inflictorSide].name} missed ${move} against ${battle[victimSide].name} (Turn ${battle.turns}).`
						);
					}

					if (
						move === "Stealth Rock" ||
						move === "Spikes" ||
						move === "Toxic Spikes"
					) {
						//Hazards
						//The pokemon that inflicted the hazards
						let inflictorSide = parts[1].split(": ")[0];

						let inflictor;
						if (inflictorSide === "p1a") {
							inflictor = battle.p1a.name;
						} else if (inflictorSide === "p1b") {
							inflictor = battle.p1b.name;
						} else if (inflictorSide === "p2a") {
							inflictor = battle.p2a.name;
						} else if (inflictorSide === "p2b") {
							inflictor = battle.p1b.name;
						}
						battle.addHazard(
							inflictorSide.startsWith("p1") ? "p2" : "p1",
							move,
							inflictor
						);
						battle.history.push(
							`${inflictor} used ${move} (Turn ${battle.turns}).`
						);
					}
				} else if (line.startsWith(`|-crit|`)) {
					let victimSide = parts[1].split(": ")[0];
					let prevMoveLine = dataArr[dataArr.length - 2];
					let prevParts = prevMoveLine.split("|").slice(1);
					let prevMove = prevParts[2];
					let inflictorSide = prevParts[1].split(": ")[0];

					battle.history.push(
						`${battle[inflictorSide].name} used ${prevMove} with a critical hit against ${battle[victimSide].name} (Turn ${battle.turns}).`
					);
					dataArr.splice(dataArr.length - 1, 1);
				}

				//Checks for statuses
				else if (line.startsWith(`|-status|`)) {
					let prevMoveLine = dataArr[dataArr.length - 2];
					let prevMove = prevMoveLine.split("|").slice(1)[2];
					let prevParts = prevMoveLine.split("|").slice(1);
					let prevPrevMoveLine = dataArr[dataArr.length - 3];
					let prevPrevMove = prevPrevMoveLine.split("|").slice(1)[2];

					let victimSide = parts[1].split(": ")[0];
					let inflictor = "";
					let victim = "";

					//If status was caused by a move
					if (
						(prevMoveLine.startsWith(`|move|`) &&
							(utils.toxicMoves.includes(prevMove) ||
								utils.burnMoves.includes(prevMove))) ||
						(prevPrevMoveLine.startsWith(`|move|`) &&
							(utils.toxicMoves.includes(prevPrevMove) ||
								utils.burnMoves.includes(prevPrevMove)))
					) {
						//Getting the pokemon side that inflicted the status
						let inflictorSide =
							prevMoveLine.startsWith(`|move|`) &&
							(utils.toxicMoves.includes(prevMove) ||
								utils.burnMoves.includes(prevMove))
								? prevMoveLine
										.split("|")
										.slice(1)[1]
										.split(": ")[0]
								: prevPrevMoveLine
										.split("|")
										.slice(1)[1]
										.split(": ")[0];

						if (inflictorSide === "p1a") {
							if (victimSide === "p2a") {
								battle.p2a.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p1a.name,
									"Passive"
								);
								inflictor = battle.p1a.name;
								victim = battle.p2a.realName || battle.p2a.name;
							} else if (victimSide === "p2b") {
								battle.p2b.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p1a.name,
									"Passive"
								);
								inflictor = battle.p1a.name;
								victim = battle.p2b.realName || battle.p2b.name;
							}
						} else if (inflictorSide === "p1b") {
							if (victimSide === "p2a") {
								battle.p2a.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p1b.name,
									"Passive"
								);
								inflictor = battle.p1b.name;
								victim = battle.p2a.realName || battle.p2a.name;
							} else if (victimSide === "p2b") {
								battle.p2b.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p1b.name,
									"Passive"
								);
								inflictor = battle.p1b.name;
								victim = battle.p2a.realName || battle.p2b.name;
							}
						} else if (inflictorSide === "p2a") {
							if (victimSide === "p1a") {
								battle.p1a.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p2a.name,
									"Passive"
								);
								inflictor = battle.p2a.name;
								victim = battle.p1a.realName || battle.p1a.name;
							} else if (victimSide === "p1b") {
								battle.p1b.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p2a.name,
									"Passive"
								);
								inflictor = battle.p2a.name;
								victim = battle.p1b.realName || battle.p1b.name;
							}
						} else if (inflictorSide === "p2b") {
							if (victimSide === "p1a") {
								battle.p1a.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p2b.name,
									"Passive"
								);
								inflictor = battle.p2b.name;
								victim = battle.p1a.realName || battle.p1a.name;
							} else if (victimSide === "p1b") {
								battle.p1b.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p2b.name,
									"Passive"
								);
								inflictor = battle.p2b.name;
								victim = battle.p1b.realName || battle.p1b.name;
							}
						}
					} else if (
						(line.includes("ability") &&
							utils.statusAbility.includes(
								parts[3].split("ability: ")[1].split("|")[0]
							)) ||
						line.includes("item")
					) {
						//Ability status
						let inflictorSide = line.includes("item: ")
							? victimSide
							: parts[4].split("[of] ")[1].split(": ")[0];
						if (victimSide === "p1a") {
							if (inflictorSide === "p2a")
								inflictor = battle.p2a.name;
							else if (inflictorSide === "p2b")
								inflictor = battle.p2b.name;
							else inflictor = battle.p1a.name;

							victim = battle.p1a.realName || battle.p1a.name;
							battle.p1a.statusEffect(
								parts[2],
								inflictor,
								this.rules.abilityitem
							);
						} else if (victimSide === "p1b") {
							if (inflictorSide === "p2a")
								inflictor = battle.p2a.name;
							else if (inflictorSide === "p2b")
								inflictor = battle.p2b.name;
							else inflictor = battle.p1b.name;

							victim = battle.p1b.realName || battle.p1b.name;
							battle.p1b.statusEffect(
								parts[2],
								inflictor,
								this.rules.abilityitem
							);
						} else if (victimSide === "p2a") {
							if (inflictorSide === "p1a")
								inflictor = battle.p1a.name;
							else if (inflictorSide === "p1b")
								inflictor = battle.p2b.name;
							else inflictor = battle.p2a.name;

							victim = battle.p2a.realName || battle.p2a.name;
							battle.p2a.statusEffect(
								parts[2],
								inflictor,
								this.rules.abilityItem
							);
						} else if (victimSide === "p2b") {
							if (inflictorSide === "p1a")
								inflictor = battle.p1a.name;
							else if (inflictorSide === "p1b")
								inflictor = battle.p2b.name;
							else inflictor = battle.p2b.name;

							victim = battle.p2b.realName || battle.p2b.name;
							battle.p2b.statusEffect(
								parts[2],
								inflictor,
								this.rules.abilityItem
							);
						}
					} else if (prevMoveLine.includes("Synchronize")) {
						let inflictorSide = prevParts[1].split(": ")[0];

						if (inflictorSide === "p1a") {
							if (victimSide === "p2a") {
								battle.p2a.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p1a.name,
									"Passive"
								);
								inflictor = battle.p1a.name;
								victim = battle.p2a.realName || battle.p2a.name;
							} else if (victimSide === "p2b") {
								battle.p2b.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p1a.name,
									"Passive"
								);
								inflictor = battle.p1a.name;
								victim = battle.p2b.realName || battle.p2b.name;
							}
						} else if (inflictorSide === "p1b") {
							if (victimSide === "p2a") {
								battle.p2a.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p1b.name,
									"Passive"
								);
								inflictor = battle.p1b.name;
								victim = battle.p2a.realName || battle.p2a.name;
							} else if (victimSide === "p2b") {
								battle.p2b.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p1b.name,
									"Passive"
								);
								inflictor = battle.p1b.name;
								victim = battle.p2a.realName || battle.p2b.name;
							}
						} else if (inflictorSide === "p2a") {
							if (victimSide === "p1a") {
								battle.p1a.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p2a.name,
									"Passive"
								);
								inflictor = battle.p2a.name;
								victim = battle.p1a.realName || battle.p1a.name;
							} else if (victimSide === "p1b") {
								battle.p1b.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p2a.name,
									"Passive"
								);
								inflictor = battle.p2a.name;
								victim = battle.p1b.realName || battle.p1b.name;
							}
						} else if (inflictorSide === "p2b") {
							if (victimSide === "p1a") {
								battle.p1a.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p2b.name,
									"Passive"
								);
								inflictor = battle.p2b.name;
								victim = battle.p1a.realName || battle.p1a.name;
							} else if (victimSide === "p1b") {
								battle.p1b.statusEffect(
									parts[2] === "tox" ? "psn" : parts[2],
									battle.p2b.name,
									"Passive"
								);
								inflictor = battle.p2b.name;
								victim = battle.p1b.realName || battle.p1b.name;
							}
						}
					} else {
						//If status wasn't caused by a move, but rather Toxic Spikes
						if (victimSide === "p1a") {
							victim = battle.p1a.realName || battle.p1a.name;
							inflictor = battle.hazardsSet.p1["Toxic Spikes"];
							battle.p1a.statusEffect(
								parts[2],
								inflictor,
								"Passive"
							);
						} else if (victimSide === "p1b") {
							victim = battle.p1b.realName || battle.p1b.name;
							inflictor = battle.hazardsSet.p1["Toxic Spikes"];
							battle.p1b.statusEffect(
								parts[2],
								inflictor,
								"Passive"
							);
						} else if (victimSide === "p2a") {
							victim = battle.p2a.realName || battle.p2a.name;
							inflictor = battle.hazardsSet.p2["Toxic Spikes"];
							battle.p2a.statusEffect(
								parts[2],
								inflictor,
								"Passive"
							);
						} else if (victimSide === "p2b") {
							victim = battle.p2b.realName || battle.p2b.name;
							inflictor = battle.hazardsSet.p2["Toxic Spikes"];
							battle.p2b.statusEffect(
								parts[2],
								inflictor,
								"Passive"
							);
						}
					}
					console.log(
						`${this.battleLink}: ${inflictor} caused ${parts[2]} on ${victim}.`
					);
					battle.history.push(
						`${inflictor} caused ${parts[2]} on ${victim} (Turn ${battle.turns}).`
					);

					dataArr.splice(dataArr.length - 1, 1);
				}

				//If a mon flinches
				else if (line.startsWith("|cant|")) {
					let userSide = parts[1].split(": ")[0];

					if (parts[2].includes("flinch")) {
						battle.history.push(
							`${battle[userSide].realName} flinched (Turn ${battle.turns}).`
						);
					}
				}

				//Side-specific ailments e.g. Stealth Rock
				else if (line.startsWith("|-sidestart|")) {
					let prevLine = dataArr[dataArr.length - 2];
					let prevParts = prevLine.split("|").slice(1);
					let inflictorSide = prevParts[1].split(": ")[0];
					let inflictor = "";

					if (inflictorSide === "p1a") inflictor = battle.p1a.name;
					else if (inflictorSide === "p1b")
						inflictor = battle.p1b.name;
					else if (inflictorSide === "p2a")
						inflictor = battle.p2a.name;
					else if (inflictorSide === "p2b")
						inflictor = battle.p2b.name;

					battle.addHazard(
						parts[1].split(": ")[0],
						parts[2],
						inflictor
					);
				}

				//If a hazard ends on a side
				else if (line.startsWith(`|-sideend|`)) {
					let side = parts[1].split(": ")[0];
					let hazard = parts[2];
					let move = parts[3].split("move: ")[1];
					let removerSide = parts[4].split("[of] ")[1].split(": ")[0];
					battle.endHazard(side, hazard);
					battle.history.push(
						`${hazard} has been removed by ${battle[removerSide].realName} with ${move} (Turn ${battle.turns}).`
					);
					dataArr.splice(dataArr.length - 1, 1);
				}

				//If an affliction like Leech Seed or confusion starts
				else if (line.startsWith(`|-start|`)) {
					let prevMove = dataArr[dataArr.length - 2];
					let affliction = parts[2];
					if (
						prevMove.startsWith(`|move|`) &&
						(prevMove.split("|").slice(1)[2] ===
							affliction.split("move: ")[1] ||
							prevMove.split("|").slice(1)[2] === affliction ||
							utils.confusionMoves.includes(
								prevMove.split("|").slice(1)[2]
							) || //For confusion
							affliction.includes("perish") || //For Perish Song
							affliction === "Curse" || //For Curse
							affliction === "Nightmare") //For Nightmare
					) {
						let move = affliction.split("move: ")[1]
							? affliction.split("move: ")[1]
							: affliction;
						let afflictorSide = prevMove
							.split("|")
							.slice(1)[1]
							.split(": ")[0];
						let afflictor;
						let side = parts[1].split(": ")[0];

						if (move === "Future Sight" || move === "Doom Desire") {
							if (afflictorSide === "p2a") {
								battle.hazardsSet.p1[move] = battle.p2a.name;
							} else if (side === "p2b") {
								battle.hazardsSet.p1[move] = battle.p2b.name;
							} else if (side === "p1a") {
								battle.hazardsSet.p2[move] = battle.p1a.name;
							} else if (side === "p1b") {
								battle.hazardsSet.p2[move] = battle.p1b.name;
							}
						} else {
							let victim = "";
							if (side === "p1a") {
								afflictor = battle[afflictorSide].name;

								battle.p1a.otherAffliction[move] = afflictor;
								victim = battle.p1a.realName || battle.p1a.name;
							} else if (side === "p1b") {
								afflictor = battle[afflictorSide].name;

								battle.p1b.otherAffliction[move] = afflictor;
								victim = battle.p1b.realName || battle.p1b.name;
							} else if (side === "p2a") {
								afflictor = battle[afflictorSide].name;

								battle.p2a.otherAffliction[move] = afflictor;
								victim = battle.p2a.realName || battle.p2a.name;
							} else if (side === "p2b") {
								afflictor = battle[afflictorSide].name;

								battle.p2b.otherAffliction[move] = afflictor;
								victim = battle.p2b.realName || battle.p2b.name;
							}
							console.log(
								`${this.battleLink}: Started ${move} on ${victim} by ${afflictor}`
							);
						}
					} else if (affliction === `Substitute`) {
						let side = parts[1].split(": ")[0];
						if (side === `p1a`) {
							battle.p1a.hasSubstitute = true;
						} else if (side === `p1b`) {
							battle.p1b.hasSubstitute = true;
						} else if (side === `p2a`) {
							battle.p2a.hasSubstitute = true;
						} else if (side === `p2b`) {
							battle.p2b.hasSubstitute = true;
						}
					}

					if (affliction === `perish0`) {
						//Pokemon dies of perish song
						let side = parts[1].split(": ")[0];
						let afflictor;
						let victim;
						let killer;
						if (side === "p1a") {
							afflictor = battle.p1a.otherAffliction["perish3"];
							victim = battle.p1a.realName || battle.p1a.name;
							if (
								battle.p1Pokemon[afflictor] &&
								afflictor !== victim
							) {
								let deathJson = battle.p1a.died(
									affliction,
									afflictor,
									true
								);
								battle.p1Pokemon[afflictor].killed(deathJson);
							} else {
								if (this.rules.suicide !== "None") {
									killer = battle.p2a.name;
								}

								let deathJson = battle.p1a.died(
									prevMove,
									killer,
									this.rules.suicide === "Passive"
								);
								if (killer) {
									battle.p2Pokemon[killer].killed(deathJson);
								}
							}
						} else if (side === "p1b") {
							afflictor = battle.p1b.otherAffliction["perish3"];
							victim = battle.p1b.realName || battle.p1b.name;
							let deathJson = battle.p1b.died(
								affliction,
								afflictor,
								true
							);
							if (battle.p1Pokemon[afflictor])
								battle.p1Pokemon[afflictor].killed(deathJson);
							else {
								if (this.rules.suicide !== "None") {
									killer = battle.p2a.name;
								}

								let deathJson = battle.p1b.died(
									prevMove,
									killer,
									this.rules.suicide === "Passive"
								);
								if (killer) {
									battle.p2Pokemon[killer].killed(deathJson);
								}
							}
						} else if (side === "p2a") {
							afflictor = battle.p2a.otherAffliction["perish3"];
							victim = battle.p2a.realName || battle.p2a.name;
							let deathJson = battle.p2a.died(
								affliction,
								afflictor,
								true
							);
							if (battle.p1Pokemon[afflictor])
								battle.p1Pokemon[afflictor].killed(deathJson);
							else {
								if (this.rules.suicide !== "None") {
									killer = battle.p1a.name;
								}

								let deathJson = battle.p2a.died(
									prevMove,
									killer,
									this.rules.suicide === "Passive"
								);
								if (killer) {
									battle.p1Pokemon[killer].killed(deathJson);
								}
							}
						} else if (side === "p2b") {
							afflictor = battle.p2b.otherAffliction["perish3"];
							victim = battle.p2b.realName || battle.p2b.name;
							let deathJson = battle.p2b.died(
								affliction,
								afflictor,
								true
							);
							if (battle.p1Pokemon[afflictor])
								battle.p1Pokemon[afflictor].killed(deathJson);
							else {
								if (this.rules.suicide !== "None") {
									killer = battle.p1a.name;
								}

								let deathJson = battle.p2b.died(
									prevMove,
									killer,
									this.rules.suicide === "Passive"
								);
								if (killer) {
									battle.p1Pokemon[killer].killed(deathJson);
								}
							}
						}
						console.log(
							`${this.battleLink}: ${victim} was killed by ${killer} due to Perish Song (passive) (Turn ${battle.turns})`
						);
						battle.history.push(
							`${victim} was killed by ${killer} due to Perish Song (passive) (Turn ${battle.turns})`
						);
					}
					dataArr.splice(dataArr.length - 1, 1);
				}

				//If the pokemon didn't actually die, but it was immune.
				else if (line.startsWith(`|-immune|`)) {
					let side = parts[1].split(": ")[0];
					if (side === "p1a") {
						if (battle.p1a.isDead) {
							battle.p1a.undied();
							battle.p2Pokemon[battle.p1a.killer].unkilled();
						}
					} else if (side === "p1b") {
						if (battle.p1b.isDead) {
							battle.p1b.undied();
							battle.p2Pokemon[battle.p1b.killer].unkilled();
						}
					} else if (side === "p2a") {
						if (battle.p2a.isDead) {
							battle.p2a.undied();
							battle[battle.p2a.killer.name].unkilled();
						}
					} else if (side === "p2b") {
						if (battle.p2b.isDead) {
							battle.p2b.undied();
							battle[battle.p2b.killer.name].unkilled();
						}
					}

					dataArr.splice(dataArr.length - 1, 1);
				}

				//Mostly used for Illusion cuz frick Zoroark
				else if (line.startsWith(`|-end|`)) {
					let historyLine =
						battle.history.filter((line) =>
							line.includes(" was killed by ")
						)[battle.history.length - 1] || "";
					if (
						line.endsWith("Illusion") &&
						historyLine.includes(battle.turns.toString())
					) {
						let historyLineParts = historyLine.split(" ");
						let victim = historyLine.split(" was killed by ")[0];
						let killer = historyLine
							.split(" was killed by ")[1]
							.split(" due to ")[0];
						let isPassive =
							historyLineParts[historyLineParts.length - 2] ===
							"(passive)";

						if (battle.p1Pokemon[victim]) {
							battle.p1Pokemon[victim].undied();
							battle.p2Pokemon[killer].unkilled(isPassive);
						} else {
							battle.p2Pokemon[victim].undied();
							battle.p1Pokemon[killer].unkilled(isPassive);
						}
						battle.history.splice(battle.history.length - 1, 1);
					}
					if (
						!(
							line.endsWith("Future Sight") ||
							line.endsWith("Doom Desire")
						)
					)
						dataArr.splice(dataArr.length - 1, 1);
				}

				//If a pokemon's status is cured
				else if (line.startsWith(`|-curestatus|`)) {
					let side = parts[1].split(": ")[0];
					if (side.startsWith("p1a")) {
						battle.p1a.statusFix();
					} else if (side.startsWith("p1b")) {
						battle.p1b.statusFix();
					} else if (side.startsWith("p2a")) {
						battle.p2a.statusFix();
					} else if (side.startsWith("p2b")) {
						battle.p2b.statusFix();
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

							//Hazards
							if (utils.hazardMoves.includes(move)) {
								if (victimSide === "p1a") {
									killer = battle.hazardsSet.p1[move];
									let deathJson = battle.p1a.died(
										move,
										killer,
										true
									);
									battle.p2Pokemon[killer].killed(deathJson);
									victim =
										battle.p1a.realName || battle.p1a.name;
								} else if (victimSide === "p1b") {
									killer = battle.hazardsSet.p1[move];
									let deathJson = battle.p1b.died(
										move,
										killer,
										true
									);
									battle.p2Pokemon[killer].killed(deathJson);
									victim =
										battle.p1b.realName || battle.p1b.name;
								} else if (victimSide === "p2a") {
									killer = battle.hazardsSet.p2[move];
									let deathJson = battle.p2a.died(
										move,
										killer,
										true
									);
									battle.p1Pokemon[killer].killed(deathJson);
									victim =
										battle.p2a.realName || battle.p2a.name;
								} else if (victimSide === "p2b") {
									killer = battle.hazardsSet.p2[move];
									let deathJson = battle.p2b.died(
										move,
										killer,
										true
									);
									battle.p1Pokemon[killer].killed(deathJson);
									victim =
										battle.p2b.realName || battle.p2b.name;
								}
								reason = `${move} (passive) (Turn ${battle.turns})`;
							}

							//Weather
							else if (move === "Hail" || move === "Sandstorm") {
								killer = battle.weatherInflictor;
								if (victimSide === "p1a") {
									let deathJson = battle.p1a.died(
										move,
										killer,
										true
									);
									if (
										Object.keys(battle.p1Pokemon).includes(
											killer
										)
									) {
										killer =
											this.rules.selfteam !== "None"
												? battle.p2a.name
												: undefined;
									}
									if (killer)
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									victim =
										battle.p1a.realName || battle.p1a.name;
								} else if (victimSide === "p1b") {
									let deathJson = battle.p1b.died(
										move,
										killer,
										true
									);
									if (
										Object.keys(battle.p1Pokemon).includes(
											killer
										)
									) {
										killer =
											this.rules.selfteam !== "None"
												? battle.p2b.name
												: undefined;
									}
									if (killer)
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									victim =
										battle.p1b.realName || battle.p1b.name;
								} else if (victimSide === "p2a") {
									let deathJson = battle.p2a.died(
										move,
										killer,
										true
									);
									if (
										Object.keys(battle.p2Pokemon).includes(
											killer
										)
									) {
										killer =
											this.rules.selfteam !== "None"
												? battle.p1a.name
												: undefined;
									}
									console.log(killer);
									console.log(Object.keys(battle.p2Pokemon));
									console.log(
										Object.keys(battle.p2Pokemon).includes(
											killer
										)
									);
									if (killer)
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									victim =
										battle.p2a.realName || battle.p2a.name;
								} else if (victimSide === "p2b") {
									let deathJson = battle.p2b.died(
										move,
										killer,
										true
									);
									if (
										Object.keys(battle.p2Pokemon).includes(
											killer
										)
									) {
										killer =
											this.rules.selfteam !== "None"
												? battle.p1b.name
												: undefined;
									}
									if (killer)
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									victim =
										battle.p2b.realName || battle.p2b.name;
								}
								reason = `${move} (passive) (Turn ${battle.turns})`;
							}

							//Status
							else if (move === "brn" || move === "psn") {
								if (victimSide === "p1a") {
									killer = battle.p1a.statusInflictor;
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
									victim =
										battle.p1a.realName || battle.p1a.name;
									reason = `${move} (${
										battle.p1a.statusType === "Passive"
											? "passive"
											: "direct"
									}) (Turn ${battle.turns})`;
								} else if (victimSide === "p1b") {
									killer = battle.p1b.statusInflictor;
									if (
										Object.keys(battle.p1Pokemon).includes(
											killer
										)
									) {
										if (this.rules.selfteam !== "None")
											killer = battle.p2b.name;
										else killer = undefined;
									}
									let deathJson = battle.p1b.died(
										move,
										killer,
										true
									);
									if (killer) {
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									}
									victim =
										battle.p1b.realName || battle.p1b.name;
									reason = `${move} (${
										battle.p1b.statusType === "Passive"
											? "passive"
											: "direct"
									}) (Turn ${battle.turns})`;
								} else if (victimSide === "p2a") {
									killer = battle.p2a.statusInflictor;
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
									victim =
										battle.p2a.realName || battle.p2a.name;
									reason = `${move} (${
										battle.p2a.statusType === "Passive"
											? "passive"
											: "direct"
									}) (Turn ${battle.turns})`;
								} else if (victimSide === "p2b") {
									killer = battle.p2b.statusInflictor;
									if (
										Object.keys(battle.p2Pokemon).includes(
											killer
										)
									) {
										if (this.rules.selfteam !== "None")
											killer = battle.p1b.name;
										else killer = undefined;
									}
									let deathJson = battle.p2b.died(
										move,
										killer,
										true
									);
									if (killer) {
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									}
									victim =
										battle.p2b.realName || battle.p2b.name;
									reason = `${move} (${
										battle.p2b.statusType === "Passive"
											? "passive"
											: "direct"
									}) (Turn ${battle.turns})`;
								}
							}

							//Recoil
							else if (
								utils.recoilMoves.includes(move) ||
								move.toLowerCase() === "recoil"
							) {
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
									victim =
										battle.p1a.realName || battle.p1a.name;
								} else if (victimSide == "p1b") {
									if (this.rules.recoil !== "None")
										killer = battle.p2b.name;
									else killer = undefined;

									let deathJson = battle.p1b.died(
										"recoil",
										killer,
										this.rules.recoil === "Passive"
									);
									if (killer)
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									victim =
										battle.p1b.realName || battle.p1b.name;
								} else if (victimSide === "p2a") {
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
									victim =
										battle.p2a.realName || battle.p2a.name;
								} else if (victimSide === "p2b") {
									if (this.rules.recoil !== "None")
										killer = battle.p1b.name;
									else killer = undefined;

									let deathJson = battle.p2b.died(
										"recoil",
										killer,
										this.rules.recoil === "Passive"
									);
									if (killer)
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									victim =
										battle.p2b.realName || battle.p2b.name;
								}
								reason = `recoil (${
									this.rules.recoil === "Passive"
										? "passive"
										: "direct"
								}) (Turn ${battle.turns})`;
							}

							//Item or Ability
							else if (
								move.startsWith(`item: `) ||
								move.includes(`ability: `) ||
								(parts[3] && parts[3].includes("Spiky Shield"))
							) {
								let item = parts[3]
									? parts[3].split("[from] ")[1]
									: move.split(": ")[1];
								let owner = parts[4]
									? parts[4].split(": ")[0].split("] ")[1] ||
									  ""
									: parts[1].split(": ")[0];

								console.log(owner + victimSide)
								if (owner === victimSide) {
									victim =
										battle[owner].realName ||
										battle[owner].name;
									if (this.rules.suicide !== "None")
										victim =
											battle[victimSide].realName ||
											battle[victimSide].name;

									let deathJson = battle[victimSide].died(
										prevMove,
										killer,
										this.rules.suicide === "Passive"
									);
									if (killer) {
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									}
									killer = "suicide";
									reason = `${item} (${
										this.rules.suicide === "Passive"
											? "passive"
											: "direct"
									}) (Turn ${battle.turns})`;
								} else {
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
										if (killer) {
											battle.p2Pokemon[killer].killed(
												deathJson
											);
										}
										victim =
											battle.p1a.realName ||
											battle.p1a.name;
									} else if (
										victimSide === "p1b" &&
										!battle.p1b.isDead
									) {
										if (this.rules.abilityitem !== "None")
											killer = battle.p2b.name;
										else killer = undefined;
										let deathJson = battle.p1b.died(
											item,
											killer,
											this.rules.abilityitem === "Passive"
										);
										if (killer) {
											battle.p2Pokemon[killer].killed(
												deathJson
											);
										}
										victim =
											battle.p1b.realName ||
											battle.p1b.name;
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
										if (killer) {
											battle.p1Pokemon[killer].killed(
												deathJson
											);
										}
										victim =
											battle.p2a.realName ||
											battle.p2a.name;
									} else if (
										victimSide === "p2b" &&
										!battle.p2b.isDead
									) {
										if (this.rules.abilityitem !== "None")
											killer = battle.p1b.name;
										else killer = undefined;
										let deathJson = battle.p2b.died(
											item,
											killer,
											this.rules.abilityitem === "Passive"
										);
										if (killer) {
											battle.p1Pokemon[killer].killed(
												deathJson
											);
										}
										victim =
											battle.p2b.realName ||
											battle.p2b.name;
									}
									reason = `${item} (${
										this.rules.abilityitem === "Passive"
											? "passive"
											: "direct"
									}) (Turn ${battle.turns})`;
								}
							}

							//Affliction
							else {
								move = move.includes("move: ")
									? move.split(": ")[1]
									: move;
								if (victimSide === "p1a") {
									killer = battle.p1a.otherAffliction[move];
									victim =
										battle.p1a.realName || battle.p1a.name;

									if (
										victim.includes(killer) ||
										killer.includes(victim)
									) {
										killer = battle.p2a.realName;
										let deathJson = battle.p1a.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									} else {
										let deathJson = battle.p1a.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									}
								} else if (victimSide === "p1b") {
									killer = battle.p1b.otherAffliction[move];
									victim =
										battle.p1b.realName || battle.p1b.name;

									if (
										victim.includes(killer) ||
										killer.includes(victim)
									) {
										killer = battle.p2a.realName;
										let deathJson = battle.p1b.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									} else {
										let deathJson = battle.p1b.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									}
								} else if (victimSide === "p2a") {
									killer = battle.p2a.otherAffliction[move];
									victim =
										battle.p2a.realName || battle.p2a.name;

									if (
										victim.includes(killer) ||
										killer.includes(victim)
									) {
										killer = battle.p1a.realName;
										let deathJson = battle.p2a.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									} else {
										let deathJson = battle.p2a.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									}
								} else if (victimSide === "p2b") {
									killer = battle.p2b.otherAffliction[move];
									victim =
										battle.p2b.realName || battle.p2b.name;

									if (
										victim.includes(killer) ||
										killer.includes(victim)
									) {
										killer = battle.p1a.realName;
										let deathJson = battle.p2b.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									} else {
										let deathJson = battle.p2b.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									}
								}
								reason = `${move} (passive) (Turn ${battle.turns})`;
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
									false
								);
								battle.p2Pokemon[killer].killed(deathJson);
								victim = battle.p1a.realName || battle.p1a.name;
							} else if (victimSide === "p1b") {
								killer = battle.hazardsSet.p1[prevMove];
								let deathJson = battle.p1b.died(
									prevMove,
									killer,
									false
								);
								battle.p2Pokemon[killer].killed(deathJson);
								victim = battle.p1b.realName || battle.p1b.name;
							} else if (victimSide === "p2a") {
								killer = battle.hazardsSet.p2[prevMove];
								let deathJson = battle.p2a.died(
									prevMove,
									killer,
									false
								);
								battle.p1Pokemon[killer].killed(deathJson);
								victim = battle.p2a.realName || battle.p2a.name;
							} else if (victimSide === "p2b") {
								killer = battle.hazardsSet.p2[prevMove];
								let deathJson = battle.p2b.died(
									prevMove,
									killer,
									false
								);
								battle.p1Pokemon[killer].killed(deathJson);
								victim = battle.p2b.realName || battle.p2b.name;
							}
							reason = `${prevMove} (passive) (Turn ${battle.turns})`;
						} else {
							if (
								!(
									(prevMoveLine.startsWith(`|move|`) &&
										(prevMoveLine.includes(
											"Self-Destruct"
										) ||
											prevMoveLine.includes(
												"Explosion"
											) ||
											prevMoveLine.includes(
												"Misty Explosion"
											) ||
											prevMoveLine.includes("Memento") ||
											prevMoveLine.includes(
												"Healing Wish"
											) ||
											prevMoveLine.includes(
												"Final Gambit"
											) ||
											prevMoveLine.includes(
												"Lunar Dance"
											))) ||
									prevMoveLine.includes("Curse")
								)
							) {
								//It's just a regular effing kill
								prevMove = prevMoveLine.split("|").slice(1)[2];
								let prevMoveParts = prevMoveLine
									.split("|")
									.slice(1);
								let prevMoveUserSide =
									prevMoveParts[1].split(": ")[0];
								if (
									(victimSide === "p1a" ||
										(prevMoveParts[4] &&
											prevMoveParts[4].includes(
												"[spread]"
											) &&
											prevMoveParts[4].includes("p1a") &&
											victimSide === "p1a")) &&
									!battle.p1a.isDead
								) {
									if (prevMoveUserSide === "p2a") {
										let deathJson = battle.p1a.died(
											"direct",
											battle.p2a,
											false
										);
										battle.p2a.killed(deathJson);
										killer = battle.p2a.name;
									} else if (prevMoveUserSide === "p2b") {
										let deathJson = battle.p1a.died(
											"direct",
											battle.p2b,
											false
										);
										battle.p2b.killed(deathJson);
										killer = battle.p2b.name;
									} else if (prevMoveUserSide === "p1b") {
										killer = battle.p1b.name;
										let deathJson = battle.p1a.died(
											"direct",
											killer,
											this.rules.selfteam === "Passive"
										);
										if (this.rules.selfteam !== "None") {
											battle.p1b.killed(deathJson);
										}
									}
									victim =
										battle.p1a.realName || battle.p1a.name;
								} else if (
									(victimSide === "p1b" ||
										(prevMoveParts[4] &&
											prevMoveParts[4].includes(
												"[spread]"
											) &&
											prevMoveParts[4].includes("p1b") &&
											victimSide === "p1b")) &&
									!battle.p1b.isDead
								) {
									if (prevMoveUserSide === "p2a") {
										let deathJson = battle.p1b.died(
											"direct",
											battle.p2a,
											false
										);
										battle.p2a.killed(deathJson);
										killer = battle.p2a.name;
									} else if (prevMoveUserSide === "p2b") {
										let deathJson = battle.p1b.died(
											"direct",
											battle.p2b,
											false
										);
										battle.p2b.killed(deathJson);
										killer = battle.p2b.name;
									} else if (prevMoveUserSide === "p1a") {
										killer = battle.p1a.name;
										let deathJson = battle.p1b.died(
											"direct",
											killer,
											this.rules.selfteam === "Passive"
										);
										if (this.rules.selfteam !== "None") {
											battle.p1a.killed(deathJson);
										}
									}
									victim =
										battle.p1b.realName || battle.p1b.name;
								} else if (
									(victimSide === "p2a" ||
										(prevMoveParts[4] &&
											prevMoveParts[4].includes(
												"[spread]"
											) &&
											prevMoveParts[4].includes("p2a") &&
											victimSide === "p2a")) &&
									!battle.p2a.isDead
								) {
									if (prevMoveUserSide === "p1a") {
										let deathJson = battle.p2a.died(
											"direct",
											battle.p1a,
											false
										);
										battle.p1a.killed(deathJson);
										killer = battle.p1a.name;
									} else if (prevMoveUserSide === "p1b") {
										let deathJson = battle.p2a.died(
											"direct",
											battle.p1b,
											false
										);
										battle.p1b.killed(deathJson);
										killer = battle.p1b.name;
									} else if (prevMoveUserSide === "p2b") {
										killer = battle.p2b.name;
										let deathJson = battle.p2a.died(
											"direct",
											killer,
											this.rules.selfteam === "Passive"
										);
										if (this.rules.selfteam !== "None") {
											battle.p2b.killed(deathJson);
										}
									}
									victim =
										battle.p2a.realName || battle.p2a.name;
								} else if (
									(victimSide === "p2b" ||
										(prevMoveParts[4] &&
											prevMoveParts[4].includes(
												"[spread]"
											) &&
											prevMoveParts[4].includes("p2b") &&
											victimSide === "p2b")) &&
									!battle.p2b.isDead
								) {
									if (prevMoveUserSide === "p1a") {
										let deathJson = battle.p2b.died(
											"direct",
											battle.p1a,
											false
										);
										battle.p1a.killed(deathJson);
										killer = battle.p1a.name;
									} else if (prevMoveUserSide === "p1b") {
										let deathJson = battle.p2b.died(
											"direct",
											battle.p1b,
											false
										);
										battle.p1b.killed(deathJson);
										killer = battle.p1b.name;
									} else if (prevMoveUserSide === "p2a") {
										killer = battle.p2a.name;
										let deathJson = battle.p2b.died(
											"direct",
											killer,
											this.rules.selfteam === "Passive"
										);
										if (this.rules.selfteam !== "None") {
											battle.p2a.killed(deathJson);
										}
									}
									victim =
										battle.p2b.realName || battle.p2b.name;
								}
								reason = `${prevMove} (direct) (Turn ${battle.turns})`;
							}
						}
						if (victim && reason) {
							console.log(
								`${this.battleLink}: ${victim} was killed by ${killer} due to ${reason}.`
							);
							battle.history.push(
								`${victim} was killed by ${killer} due to ${reason}.`
							);
						}
					}
					dataArr.splice(dataArr.length - 1, 1);
				}

				//This is mostly only used for the victim of Destiny Bond
				else if (line.startsWith(`|faint|`)) {
					let victimSide = parts[1].split(": ")[0];
					let prevLine = dataArr[dataArr.length - 2];
					let prevParts = prevLine.split("|").slice(1);

					if (
						prevLine.startsWith(`|-activate|`) &&
						prevLine.endsWith(`Destiny Bond`)
					) {
						let killerSide = prevLine
							.split("|")
							.slice(1)[1]
							.split(": ")[0];
						let victim;
						let killer = "";
						if (victimSide === "p1a") {
							victim = battle.p1a.realName || battle.p1a.name;
							if (this.rules.db !== "None")
								if (killerSide === "p2a")
									killer = battle.p2a.name;
								else if (killerSide == "p2b")
									killer = battle.p2b.name;
							let deathJson = battle.p1a.died(
								"Destiny Bond",
								killer,
								this.rules.db === "Passive"
							);
							battle.p2Pokemon[killer].killed(deathJson);
						} else if (victimSide === "p1b") {
							victim = battle.p1b.realName || battle.p1b.name;
							if (this.rules.db !== "None")
								if (killerSide === "p2a")
									killer = battle.p2a.name;
								else if (killerSide == "p2b")
									killer = battle.p2b.name;
							let deathJson = battle.p1b.died(
								"Destiny Bond",
								killer,
								this.rules.db === "Passive"
							);
							battle.p2Pokemon[killer].killed(deathJson);
						} else if (victimSide === "p2a") {
							victim = battle.p2a.realName || battle.p2a.name;
							if (this.rules.db !== "None")
								if (killerSide === "p1a")
									killer = battle.p1a.name;
								else if (killerSide == "p1b")
									killer = battle.p1b.name;
							let deathJson = battle.p2a.died(
								"Destiny Bond",
								killer,
								this.rules.db === "Passive"
							);
							battle.p1Pokemon[killer].killed(deathJson);
						} else if (victimSide === "p2b") {
							victim = battle.p2b.realName || battle.p2b.name;
							if (this.rules.db !== "None")
								if (killerSide === "p1a")
									killer = battle.p1a.name;
								else if (killerSide == "p1b")
									killer = battle.p1b.name;
							let deathJson = battle.p2b.died(
								"Destiny Bond",
								killer,
								this.rules.db === "Passive"
							);
							battle.p1Pokemon[killer].killed(deathJson);
						}
						console.log(
							`${this.battleLink}: ${victim} was killed by ${killer} due to Destiny Bond (Turn ${battle.turns}).`
						);
						battle.history.push(
							`${victim} was killed by ${killer} due to Destiny Bond (Turn ${battle.turns}).`
						);
					} else if (
						(prevLine.startsWith(`|move|`) &&
							(prevLine.includes("Self-Destruct") ||
								prevLine.includes("Explosion") ||
								prevLine.includes("Misty Explosion") ||
								prevLine.includes("Memento") ||
								prevLine.includes("Healing Wish") ||
								prevLine.includes("Final Gambit") ||
								prevLine.includes("Lunar Dance"))) ||
						prevLine.includes("Curse")
					) {
						let prevMove = prevParts[2];

						let killer;
						let victim;
						if (this.rules.suicide !== "None") {
							let newSide =
								prevParts[1].split(": ")[0].endsWith("a") ||
								prevParts[1].split(": ")[0].endsWith("b")
									? prevParts[1].split(": ")[0]
									: `${prevParts[1].split(": ")[0]}a`;

							killer =
								battle[newSide].realName ||
								battle[newSide].name;
						}
						if (victimSide === "p2a" && !battle.p2a.isDead) {
							victim = battle.p2a.realName || battle.p2a.name;

							let deathJson = battle.p2a.died(
								prevMove,
								killer,
								this.rules.suicide === "Passive"
							);
							if (killer && killer !== victim) {
								battle.p1Pokemon[killer].killed(deathJson);
							}
						} else if (victimSide === "p2b" && !battle.p2b.isDead) {
							victim = battle.p2b.realName || battle.p2b.name;

							let deathJson = battle.p2b.died(
								prevMove,
								killer,
								this.rules.suicide === "Passive"
							);
							if (killer && killer !== victim) {
								battle.p1Pokemon[killer].killed(deathJson);
							}
						} else if (victimSide === "p1a" && !battle.p1a.isDead) {
							victim = battle.p1a.realName || battle.p1a.name;

							let deathJson = battle.p1a.died(
								prevMove,
								killer,
								this.rules.suicide === "Passive"
							);
							if (killer && killer !== victim) {
								battle.p2Pokemon[killer].killed(deathJson);
							}
						} else if (victimSide === "p1b" && !battle.p1b.isDead) {
							victim = battle.p1b.realName || battle.p1b.name;

							let deathJson = battle.p1b.died(
								prevMove,
								killer,
								this.rules.suicide === "Passive"
							);
							if (killer && killer !== victim) {
								battle.p2Pokemon[killer].killed(deathJson);
							}
						}

						console.log(
							`${this.battleLink}: ${victim} was killed by ${
								killer || "suicide"
							} due to ${prevMove} (${
								this.rules.suicide === "Passive"
									? "passive"
									: "direct"
							}) (Turn ${battle.turns}).`
						);
						battle.history.push(
							`${victim} was killed by ${
								killer || "suicide"
							} due to ${prevMove} (${
								this.rules.suicide === "Passive"
									? "passive"
									: "direct"
							}) (Turn ${battle.turns}).`
						);
					} else {
						console.log(JSON.stringify(battle.p2a));
						//Regular kill if it wasn't picked up by the |-damage| statement
						let killer;
						let victim;
						if (victimSide === "p1a" && !battle.p1a.isDead) {
							let killerSide = prevParts[1].split(": ")[0];
							if (killerSide === "p2a") {
								killer = battle.p2a.name;
							} else if (killerSide === "p2b") {
								killer = battle.p2b.name;
							}
							victim = battle.p1a.realName || battle.p1a.name;
							let deathJson = battle.p1a.died(
								"faint",
								killer,
								false
							);
							battle.p2Pokemon[killer].killed(deathJson);
						} else if (victimSide === "p1b" && !battle.p1b.isDead) {
							let killerSide = prevParts[1].split(": ")[0];
							if (killerSide === "p2a") {
								killer = battle.p2a.name;
							} else if (killerSide === "p2b") {
								killer = battle.p2b.name;
							}
							victim = battle.p1b.realName || battle.p1b.name;
							let deathJson = battle.p1b.died(
								"faint",
								killer,
								false
							);
							battle.p2Pokemon[killer].killed(deathJson);
						} else if (victimSide === "p2a" && !battle.p2a.isDead) {
							let killerSide = prevParts[1].split(": ")[0];
							if (killerSide === "p1a") {
								killer = battle.p1a.name;
							} else if (killerSide === "p1b") {
								killer = battle.p1b.name;
							}
							victim = battle.p2a.realName || battle.p2a.name;
							let deathJson = battle.p2a.died(
								"faint",
								killer,
								false
							);
							battle.p1Pokemon[killer].killed(deathJson);
						} else if (victimSide === "p2b" && !battle.p2b.isDead) {
							let killerSide = prevParts[1].split(": ")[0];
							if (killerSide === "p1a") {
								killer = battle.p1a.name;
							} else if (killerSide === "p1b") {
								killer = battle.p1b.name;
							}
							victim = battle.p2b.realName || battle.p2b.name;
							let deathJson = battle.p2b.died(
								"faint",
								killer,
								false
							);
							battle.p1Pokemon[killer].killed(deathJson);
						}

						if (killer && victim) {
							console.log(
								`${this.battleLink}: ${victim} was killed by ${killer} (Turn ${battle.turns}).`
							);
							battle.history.push(
								`${victim} was killed by ${killer} (Turn ${battle.turns}).`
							);
						}
					}

					dataArr.splice(dataArr.length - 1, 1);
				}

				//Messages sent by the server
				else if (line.startsWith(`|-message|`)) {
					let messageParts = parts[1].split(" forfeited");
					if (line.endsWith("forfeited.")) {
						let forfeiter = messageParts[0];
						if (this.rules.forfeit !== "None") {
							let numDead = 0;
							if (forfeiter === battle.p1) {
								for (let pokemon of Object.values(
									battle.p1Pokemon
								)) {
									if (!pokemon.isDead) {
										numDead++;
									}
								}
								battle.p2a[
									`current${this.rules.forfeit}Kills`
								] += numDead;
							} else if (forfeiter === battle.p2) {
								for (let pokemon of Object.values(
									battle.p2Pokemon
								)) {
									if (!pokemon.isDead) {
										numDead++;
									}
								}
								battle.p1a[
									`current${this.rules.forfeit}Kills`
								] += numDead;
							}
						}
						battle.forfeiter = forfeiter;
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
					battle.p1Pokemon[battle.p1a.name] = battle.p1a;
					for (let pokemonKey of Object.keys(battle.p1Pokemon)) {
						if (
							!(
								pokemonKey.includes("-") ||
								pokemonKey.includes(":")
							)
						) {
							let pokemon = battle.p1Pokemon[pokemonKey];
							battle.p1Pokemon[pokemon.name].directKills +=
								pokemon.currentDirectKills;
							battle.p1Pokemon[pokemon.name].passiveKills +=
								pokemon.currentPassiveKills;
						}
					}
					//Team 2
					battle.p2Pokemon[battle.p2a.name] = battle.p2a;
					for (let pokemonKey of Object.keys(battle.p2Pokemon)) {
						if (
							!(
								pokemonKey.includes("-") ||
								pokemonKey.includes(":")
							)
						) {
							let pokemon = battle.p2Pokemon[pokemonKey];
							battle.p2Pokemon[pokemon.name].directKills +=
								pokemon.currentDirectKills;
							battle.p2Pokemon[pokemon.name].passiveKills +=
								pokemon.currentPassiveKills;
						}
					}

					//Giving mons their proper names
					//Team 1
					for (let pokemonName of Object.keys(battle.p1Pokemon)) {
						const newName =
							battle.p1Pokemon[pokemonName].realName.split(
								"-"
							)[0];
						if (
							utils.misnomers.includes(newName) ||
							utils.misnomers.includes(pokemonName) ||
							utils.misnomers.includes(
								battle.p1Pokemon[pokemonName].realName
							)
						) {
							battle.p1Pokemon[pokemonName].realName = newName;
						}
						if (pokemonName === "") {
							battle.p1Pokemon.splice(
								battle.p1Pokemon.indexOf(pokemonName)
							);
						}
					}
					//Team 2
					for (let pokemonName of Object.keys(battle.p2Pokemon)) {
						const newName =
							battle.p2Pokemon[pokemonName].realName.split(
								"-"
							)[0];
						if (
							utils.misnomers.includes(newName) ||
							utils.misnomers.includes(pokemonName) ||
							utils.misnomers.includes(
								battle.p2Pokemon[pokemonName].realName
							)
						) {
							battle.p2Pokemon[pokemonName].realName = newName;
						}
						if (pokemonName === "") {
							battle.p2Pokemon.splice(
								battle.p2Pokemon.indexOf(pokemonName)
							);
						}
					}

					console.log(`${battle.winner} won!`);

					let info = {
						replay: this.link,
						turns: battle.turns,
						winner: battle.winner,
						loser: battle.loser,
						history: `https://server.porygonbot.xyz/kills/${this.battleLink}`,
						spoiler: this.rules.spoiler,
						format: this.rules.format,
						tb: this.rules.tb,
						combinePD: this.rules.combinePD,
						client: client,
					};

					//Creating the objects for kills and deaths
					//Player 1
					let killJsonp1 = {};
					let deathJsonp1 = {};
					for (let pokemonObj of Object.values(battle.p1Pokemon)) {
						if (
							!(
								Object.keys(killJsonp1).includes(
									pokemonObj.realName
								) ||
								Object.keys(deathJsonp1).includes(
									pokemonObj.realName
								)
							) &&
							pokemonObj.realName !== ""
						) {
							killJsonp1[pokemonObj.realName] = {
								direct: pokemonObj.directKills,
								passive: pokemonObj.passiveKills,
							};
							deathJsonp1[pokemonObj.realName] = pokemonObj.isDead
								? 1
								: 0;
						}
					}
					//Player 2
					let killJsonp2 = {};
					let deathJsonp2 = {};
					for (let pokemonObj of Object.values(battle.p2Pokemon)) {
						if (
							!(
								Object.keys(killJsonp2).includes(
									pokemonObj.realName
								) ||
								Object.keys(deathJsonp2).includes(
									pokemonObj.realName
								)
							) &&
							pokemonObj.realName !== ""
						) {
							killJsonp2[pokemonObj.realName] = {
								direct: pokemonObj.directKills,
								passive: pokemonObj.passiveKills,
							};
							deathJsonp2[pokemonObj.realName] = pokemonObj.isDead
								? 1
								: 0;
						}
					}

					battle.history =
						battle.history.length === 0
							? ["Nothing happened"]
							: battle.history;

					await axios
						.post(
							`https://server.porygonbot.xyz/kills/${this.battleLink}`,
							battle.history.join("<br>"),
							{
								headers: {
									"Content-Length": 0,
									"Content-Type": "text/plain",
								},
								responseType: "text",
							}
						)
						.catch(async (e) => {
							await this.message.channel.send(
								`:x: Error with match number \`${
									this.battleLink
								}\`. I will be unable to update this match until you screenshot this message and send it to the Porygon server's bugs-and-help channel and ping harbar20 in the same channel.\n\n**Error:**\`\`\`${
									e.message
								}\nLine number: ${e.stack.split(":")[2]}\`\`\``
							);

							console.error(e);
						});

					if (
						battle.winner.endsWith("p1") &&
						battle.loser.endsWith("p2")
					) {
						info.result = `${battle.p1} won ${
							Object.keys(killJsonp1).length -
							Object.keys(deathJsonp1).filter(
								(pokemonKey) => deathJsonp1[pokemonKey] === 1
							).length
						}-${
							Object.keys(killJsonp2).length -
							Object.keys(deathJsonp2).filter(
								(pokemonKey) => deathJsonp2[pokemonKey] === 1
							).length
						}`;

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
						info.result = `${battle.p2} won ${
							Object.keys(killJsonp2).length -
							Object.keys(deathJsonp2).filter(
								(pokemonKey) => deathJsonp2[pokemonKey] === 1
							).length
						}-${
							Object.keys(killJsonp1).length -
							Object.keys(deathJsonp1).filter(
								(pokemonKey) => deathJsonp1[pokemonKey] === 1
							).length
						}`;

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
			await this.message.channel.send(
				`:x: Error with match number \`${
					this.battleLink
				}\`. I will be unable to analyze this match until you screenshot this message and send it to the Porygon server's bugs-and-help channel and ping harbar20 in the same channel.\n\n**Error:**\`\`\`${
					e.message
				}\nLine number: ${e.stack.split(":")[2]}\`\`\``
			);

			console.error(e);
		}
	}
}

module.exports = ReplayTracker;

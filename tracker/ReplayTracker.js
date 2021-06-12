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
				//console.log(line);
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

					dataArr.splice(dataArr.length - 1, 1);
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
					let side = parts[1].split(": ")[0];

					//If the Pokemon gets switched out
					battle[side].hasSubstitute = false;
					battle[side].clearAfflictions();
					let oldPokemon = { name: "" };

					if (battle[side].name !== "") {
						//Adding the kills
						let tempCurrentDirectKills =
							battle[side].currentDirectKills;
						let tempCurrentPassiveKills =
							battle[side].currentPassiveKills;
						battle[side].currentDirectKills = 0;
						battle[side].currentPassiveKills = 0;
						battle[side].directKills += tempCurrentDirectKills;
						battle[side].passiveKills += tempCurrentPassiveKills;

						oldPokemon = battle[side];
						battle[`${side.substring(0, 2)}Pokemon`][
							oldPokemon.name
						] = oldPokemon;
					}

					battle[side] =
						battle[`${side.substring(0, 2)}Pokemon`][replacer];
					battle[side].realName = replacerRealName;
					battle[`${side.substring(0, 2)}Pokemon`][
						battle[side].realName
					] = battle[side];

					console.log(
						`${this.battleLink}: ${
							oldPokemon.realName || oldPokemon.name
						} has been switched into ${
							battle[side].realName || battle[side].name
						}`
					);
				}

				//Ally Switch and stuff
				else if (line.startsWith("|swap|")) {
					//Swapping the mons
					let userSide = parts[1].split(": ")[0].substring(0, 2);

					let temp = battle[`${userSide}a`];
					battle[`${userSide}a`] = battle[`${userSide}b`];
					battle[`${userSide}b`] = temp;

					console.log(
						`${this.battleLink}: ${
							battle[`${userSide}a`].realName ||
							battle[`${userSide}a`].name
						} has swapped with ${
							battle[`${userSide}b`].realName ||
							battle[`${userSide}b`].name
						} due to ${parts[3].split(": ")[1]}`
					);
				}

				//If Zoroark replaces the pokemon due to Illusion
				else if (line.startsWith(`|replace|`)) {
					let side = parts[1].split(": ")[0];
					let replacer = parts[2].split(",")[0].split("-")[0];

					let tempCurrentDirectKills =
						battle[side].currentDirectKills;
					let tempCurrentPassiveKills =
						battle[side].currentPassiveKills;
					battle[side].currentDirectKills = 0;
					battle[side].currentPassiveKills = 0;
					let oldPokemon = battle[side];
					battle[side] =
						battle[`${side.substring(0, 2)}Pokemon`][replacer];
					battle[side].currentDirectKills += tempCurrentDirectKills;
					battle[side].currentPassiveKills += tempCurrentPassiveKills;

					console.log(
						`${this.battleLink}: ${
							oldPokemon.realName || oldPokemon.name
						} has been replaced by ${
							battle[side].realName || battle[side].name
						}`
					);

					dataArr.splice(dataArr.length - 1, 1);
				}

				//Removes the |-supereffective| or  |upkeep part of realdata if it exists
				else if (
					line.startsWith(`|-supereffective|`) ||
					line.startsWith(`|upkeep`) ||
					line.startsWith(`|-resisted|`) ||
					line.startsWith(`|-unboost|`) ||
					line.startsWith(`|-boost|`) ||
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
					line.startsWith("|-combine") ||
					line.startsWith("|t:|") ||
					line.startsWith("|c|") ||
					line.startsWith("|l|") ||
					line.startsWith("|j|") ||
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

				//Moves that last for a single turn like Powder or Protect
				else if (line.startsWith(`|-singleturn|`)) {
					let move = parts[2];
					let victimSide = parts[1].split(": ")[0];
					let prevMoveLine = dataArr[dataArr.length - 2];
					console.log(prevMoveLine);
					let prevMoveUserSide = prevMoveLine
						.split("|")
						.slice(1)[1]
						.split(": ")[0];
					battle[victimSide].otherAffliction[move] =
						battle[prevMoveUserSide].realName ||
						battle[prevMoveUserSide].name;
					dataArr.splice(dataArr.length - 1, 1);
				}

				//When a Pokemon Gigantamaxes, I change its "realname"
				else if (line.startsWith(`|-formechange|`)) {
					if (parts[2].includes("-Gmax")) {
						let side = parts[1].split(": ")[0];
						let realName = parts[2].split(",")[0];
						battle[side].realName = realName;
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
							inflictor =
								battle[side].realName || battle[side].name;
						} catch (e) {
							//Weather is caused by a move
							let prevLine = dataArr[dataArr.length - 2];
							let side = prevLine
								.split("|")
								.slice(1)[1]
								.split(": ")[0];
							inflictor =
								battle[side].realName || battle[side].name;
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

						battle[victimSide].otherAffliction[move] =
							battle[inflictorSide].realName ||
							battle[inflictorSide].name;
					}
					if (
						!(
							move === "Destiny Bond" ||
							move === "Synchronize" ||
							move === "Powder"
						)
					)
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
							`${
								battle[inflictorSide].realName ||
								battle[inflictorSide].name
							} missed ${move} against ${
								battle[victimSide].realName ||
								battle[victimSide].name
							} (Turn ${battle.turns}).`
						);
					}
				}

				//Critical hit
				else if (line.startsWith(`|-crit|`)) {
					let victimSide = parts[1].split(": ")[0];
					let prevMoveLine = dataArr[dataArr.length - 2];
					let prevParts = prevMoveLine.split("|").slice(1);
					let prevMove = prevParts[2];
					let inflictorSide = prevParts[1].split(": ")[0];

					battle.history.push(
						`${
							battle[inflictorSide].realName ||
							battle[inflictorSide].name
						} used ${prevMove} with a critical hit against ${
							battle[victimSide].realName ||
							battle[victimSide].name
						} (Turn ${battle.turns}).`
					);
					dataArr.splice(dataArr.length - 1, 1);
				}

				//Statuses
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
					if (prevMoveLine.includes("Synchronize")) {
						let inflictorSide = prevParts[1].split(": ")[0];

						inflictor = battle[inflictorSide].name;
						victim =
							battle[victimSide].realName ||
							battle[victimSide].name;
						battle[victimSide].statusEffect(
							parts[2] === "tox" ? "psn" : parts[2],
							inflictor,
							"Passive"
						);
						inflictor =
							battle[inflictorSide].realName ||
							battle[inflictorSide].name;
					} else if (
						(prevMoveLine.startsWith(`|move|`) &&
							utils.statusMoves.includes(prevMove)) ||
						(prevPrevMoveLine.startsWith(`|move|`) &&
							utils.statusMoves.includes(prevPrevMove))
					) {
						//Getting the pokemon side that inflicted the status
						let inflictorSide =
							prevMoveLine.startsWith(`|move|`) &&
							utils.statusMoves.includes(prevMove)
								? prevMoveLine
										.split("|")
										.slice(1)[1]
										.split(": ")[0]
								: prevPrevMoveLine
										.split("|")
										.slice(1)[1]
										.split(": ")[0];

						inflictor = battle[inflictorSide].name;
						battle[victimSide].statusEffect(
							parts[2] === "tox" ? "psn" : parts[2],
							inflictor,
							"Passive"
						);
						inflictor =
							battle[inflictorSide].realName ||
							battle[inflictorSide].name;
						victim =
							battle[victimSide].realName ||
							battle[victimSide].name;
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
						inflictor = battle[inflictorSide].name;
						victim =
							battle[victimSide].realName ||
							battle[victimSide].name;
						battle[victimSide].statusEffect(
							parts[2],
							inflictor,
							this.rules.abilityitem
						);
						inflictor =
							battle[inflictorSide].realName ||
							battle[inflictorSide].name;
					} else {
						//If status wasn't caused by a move, but rather Toxic Spikes
						victim =
							battle[victimSide].realName ||
							battle[victimSide].name;
						if (victimSide.startsWith("p1")) {
							inflictor = battle.hazardsSet.p1["Toxic Spikes"];
						} else {
							inflictor = battle.hazardsSet.p2["Toxic Spikes"];
						}
						battle[victimSide].statusEffect(
							parts[2],
							inflictor,
							"Passive"
						);
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

					let inflictor = battle[inflictorSide].name;

					battle.addHazard(
						parts[1].split(": ")[0],
						parts[2].split(": ")[1] || parts[2],
						inflictor
					);

					dataArr.splice(dataArr.length - 1, 1);
				}

				//If a hazard ends on a side
				else if (line.startsWith(`|-sideend|`)) {
					let side = parts[1].split(": ")[0];
					let hazard = parts[2];
					let prevMoveLine = dataArr[dataArr.length - 2];
					let prevMoveParts = prevMoveLine.split("|").slice(1);
					let move = parts[3]
						? parts[3].split("move: ")[1]
						: prevMoveParts[2];
					let removerSide = parts[4]
						? parts[4].split("[of] ")[1].split(": ")[0]
						: prevMoveParts[1].split(": ")[0];
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
							console.log("yo");
							battle.hazardsSet[
								afflictorSide.substring(0, 2).includes("1")
									? afflictorSide
											.substring(0, 2)
											.replace("1", "2")
									: afflictorSide
											.substring(0, 2)
											.replace("2", "1")
							][move] =
								battle[afflictorSide].realName ||
								battle[afflictorSide].name;
						} else {
							let victim =
								battle[side].realName || battle[side].name;
							afflictor = battle[afflictorSide].name;
							battle[side].otherAffliction[move] = afflictor;

							console.log(
								`${this.battleLink}: Started ${move} on ${victim} by ${afflictor}`
							);
						}
					} else if (affliction === `Substitute`) {
						let side = parts[1].split(": ")[0];
						battle[side].hasSubstitute = true;
					}

					if (affliction === `perish0`) {
						//Pokemon dies of perish song
						let side = parts[1].split(": ")[0];
						let killer;
						let afflictor = battle[side].otherAffliction["perish3"];
						let victim = battle[side].realName || battle[side].name;
						let currentPlayer = side.substring(0, 2);

						if (
							battle[`${currentPlayer}Pokemon`][afflictor] &&
							afflictor !== victim
						) {
							let deathJson = battle[side].died(
								affliction,
								afflictor,
								true
							);
							battle[`${currentPlayer}Pokemon`][afflictor].killed(
								deathJson
							);
						} else {
							if (this.rules.suicide !== "None") {
								killer =
									battle[`${currentPlayer}a`].realName ||
									battle[`${currentPlayer}a`].name;
							}

							let deathJson = battle[side].died(
								prevMove,
								killer,
								this.rules.suicide === "Passive"
							);
							if (killer) {
								battle[`${currentPlayer}Pokemon`][
									killer
								].killed(deathJson);
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
					if (battle[side].isDead) {
						battle[side].undied();
						battle[`${side.startsWith("p1" ? "p2" : "p1")}Pokemon`][
							battle[side].killer.name
						].unkilled();
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
					if (!(side.endsWith("a") || side.endsWith("b"))) {
						for (let pokemon of Object.keys(
							battle[`${side}Pokemon`]
						)) {
							battle[`${side}Pokemon`][pokemon].statusFix();
						}
					} else {
						battle[side].statusFix();
					}
				}

				//When a Pokemon is damaged, and possibly faints
				else if (line.startsWith(`|-damage|`)) {
					if (parts[2].endsWith("fnt") || parts[2].startsWith("0")) {
						//A pokemon has fainted
						let victimSide = parts[1].split(": ")[0];
						let prevMoveLine = dataArr[dataArr.length - 2];
						let prevMoveParts = prevMoveLine.split("|").slice(1);
						let prevMove;
						try {
							prevMove = prevMoveParts[2].split(": ")[1];
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
								killer =
									battle.hazardsSet[
										victimSide.substring(0, 2)
									][move];
								let deathJson = battle[victimSide].died(
									move,
									killer,
									true
								);
								if (
									Object.keys(
										battle[
											`${victimSide.substring(
												0,
												2
											)}Pokemon`
										]
									).includes(killer)
								) {
									killer =
										this.rules.selfteam !== "None"
											? battle[
													victimSide.startsWith("p1")
														? victimSide.replace(
																"1",
																"2"
														  )
														: victimSide.replace(
																"2",
																"1"
														  )
											  ].realName ||
											  battle[
													victimSide.startsWith("p1")
														? victimSide.replace(
																"1",
																"2"
														  )
														: victimSide.replace(
																"2",
																"1"
														  )
											  ].name
											: undefined;
								}

								if (killer) {
									battle[
										`${
											victimSide.startsWith("p1")
												? "p2"
												: "p1"
										}Pokemon`
									][killer].killed(deathJson);
									killer = "an ally";
								}
								victim =
									battle[victimSide].realName ||
									battle[victimSide].name;

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
												? battle.p2a.realName ||
												  battle.p2a.name
												: undefined;
									}
									if (killer) {
										battle.p2Pokemon[killer].killed(
											deathJson
										);
										killer = "an ally";
									}
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
												? battle.p2b.realName ||
												  battle.p2b.name
												: undefined;
									}
									if (killer) {
										battle.p2Pokemon[killer].killed(
											deathJson
										);
										killer = "an ally";
									}
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
												? battle.p1a.realName ||
												  battle.p1a.name
												: undefined;
									}
									if (killer) {
										battle.p1Pokemon[killer].killed(
											deathJson
										);
										killer = "an ally";
									}
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
												? battle.p1b.realName ||
												  battle.p1b.name
												: undefined;
									}
									if (killer) {
										battle.p1Pokemon[killer].killed(
											deathJson
										);
										killer = "an ally";
									}
									victim =
										battle.p2b.realName || battle.p2b.name;
								}
								reason = `${move} (passive) (Turn ${battle.turns})`;
							}

							//Status
							else if (move === "brn" || move === "psn") {
								killer = battle[victimSide].statusInflictor;

								let deathJson = battle[victimSide].died(
									move,
									killer,
									true
								);
								if (
									Object.keys(
										battle[
											`${victimSide.substring(
												0,
												2
											)}Pokemon`
										]
									).includes(killer)
								) {
									killer =
										this.rules.selfteam !== "None"
											? battle[
													victimSide.startsWith("p1")
														? victimSide.replace(
																"1",
																"2"
														  )
														: victimSide.replace(
																"2",
																"1"
														  )
											  ].name
											: undefined;
								}

								if (killer) {
									battle[
										`${
											victimSide.startsWith("p1")
												? "p2"
												: "p1"
										}Pokemon`
									][killer].killed(deathJson);
									killer = "an ally";
								}

								victim =
									battle[victimSide].realName ||
									battle[victimSide].name;
								reason = `${move} (${
									battle[victimSide].statusType === "Passive"
										? "passive"
										: "direct"
								}) (Turn ${battle.turns})`;
							}

							//Recoil
							else if (
								utils.recoilMoves.includes(move) ||
								move.toLowerCase() === "recoil"
							) {
								if (this.rules.recoil !== "None")
									killer =
										battle[
											victimSide.includes("p1")
												? victimSide.replace("1", "2")
												: victimSide.replace("2", "1")
										].name;
								else killer = undefined;

								let deathJson = battle[victimSide].died(
									"recoil",
									killer,
									this.rules.recoil === "Passive"
								);

								if (killer)
									battle[
										`${
											victimSide.startsWith("p1")
												? "p2"
												: "p1"
										}Pokemon`
									][killer].killed(deathJson);
								victim =
									battle[victimSide].realName ||
									battle[victimSide].name;

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
									if (!battle[victimSide].isDead) {
										victim =
											battle[victimSide].realName ||
											battle[victimSide].name;

										if (victimSide.startsWith("p1")) {
											if (
												this.rules.abilityitem !==
												"None"
											)
												killer =
													battle.p2a.realName ||
													battle.p2a.name;
											else killer = undefined;

											let deathJson = battle[
												victimSide
											].died(
												item,
												killer,
												this.rules.abilityitem ===
													"Passive"
											);
											if (killer) {
												battle.p2Pokemon[killer].killed(
													deathJson
												);
											}
										} else {
											if (
												this.rules.abilityitem !==
												"None"
											)
												killer =
													battle.p1a.realName ||
													battle.p1a.name;
											else killer = undefined;

											let deathJson = battle[
												victimSide
											].died(
												item,
												killer,
												this.rules.abilityitem ===
													"Passive"
											);
											if (killer) {
												battle.p1Pokemon[killer].killed(
													deathJson
												);
											}
										}
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
									killer =
										battle.p1a.otherAffliction[move] || "";
									victim =
										battle.p1a.realName || battle.p1a.name;

									if (
										victim.includes(killer) ||
										killer.includes(victim)
									) {
										killer =
											battle.p2a.realName ||
											battle.p2a.name;
										let deathJson = battle.p1a.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p2Pokemon[
											battle.p2a.name
										].killed(deathJson);
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
									killer =
										battle.p1b.otherAffliction[move] || "";
									victim =
										battle.p1b.realName || battle.p1b.name;

									if (
										victim.includes(killer) ||
										killer.includes(victim)
									) {
										killer =
											battle.p2a.realName ||
											battle.p2a.name;
										let deathJson = battle.p1b.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p2Pokemon[
											battle.p2a.name
										].killed(deathJson);
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
									killer =
										battle.p2a.otherAffliction[move] || "";
									victim =
										battle.p2a.realName || battle.p2a.name;

									if (
										victim.includes(killer) ||
										killer.includes(victim)
									) {
										killer =
											battle.p1a.realName ||
											battle.p1a.name;
										let deathJson = battle.p2a.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p1Pokemon[
											battle.p1a.name
										].killed(deathJson);
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
									killer =
										battle.p2b.otherAffliction[move] || "";
									victim =
										battle.p2b.realName || battle.p2b.name;

									if (
										victim.includes(killer) ||
										killer.includes(victim)
									) {
										killer =
											battle.p1a.realName ||
											battle.p1a.name;
										let deathJson = battle.p2b.died(
											prevMove,
											killer,
											this.rules.suicide === "Passive"
										);
										battle.p1Pokemon[
											battle.p1a.name
										].killed(deathJson);
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
							if (victimSide.startsWith("p1")) {
								killer = battle.hazardsSet.p1[prevMove];
								let deathJson = battle[victimSide].died(
									prevMove,
									killer,
									false
								);
								battle.p2Pokemon[killer].killed(deathJson);
							} else {
								killer = battle.hazardsSet.p2[prevMove];
								let deathJson = battle[victimSide].died(
									prevMove,
									killer,
									false
								);
								battle.p1Pokemon[killer].killed(deathJson);
							}

							reason = `${prevMove} (passive) (Turn ${battle.turns})`;
						} else if (prevMoveLine.includes("|-activate|")) {
							killer =
								battle[victimSide].otherAffliction[prevMove];
							let deathJson = battle[victimSide].died(
								prevMove,
								killer,
								false
							);
							if (victimSide.startsWith("p1")) {
								battle.p2Pokemon[killer].killed(deathJson);
							} else {
								battle.p1Pokemon[killer].killed(deathJson);
							}

							victim =
								battle[victimSide].realName ||
								battle[victimSide].name;
							reason = `${prevMove} (direct) (Turn ${battle.turns})`;
						} else {
							if (
								!(
									((prevMoveLine.startsWith(`|move|`) &&
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
										prevMoveLine.includes("Curse")) &&
									prevMoveParts[1].includes(victimSide)
								)
							) {
								//It's just a regular effing kill
								prevMove = prevMoveLine.split("|").slice(1)[2];
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
									killer =
										battle[prevMoveUserSide].realName ||
										battle[prevMoveUserSide].name;
									let deathJson = battle[victimSide].died(
										"direct",
										killer,
										false
									);
									battle[prevMoveUserSide].killed(deathJson);
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
									killer =
										battle[prevMoveUserSide].realName ||
										battle[prevMoveUserSide].name;
									let deathJson = battle[victimSide].died(
										"direct",
										killer,
										false
									);
									battle[prevMoveUserSide].killed(deathJson);
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
									console.log(prevMoveUserSide);
									killer =
										battle[prevMoveUserSide].realName ||
										battle[prevMoveUserSide].name;
									let deathJson = battle[victimSide].died(
										"direct",
										killer,
										false
									);
									battle[prevMoveUserSide].killed(deathJson);
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
									killer =
										battle[prevMoveUserSide].realName ||
										battle[prevMoveUserSide].name;
									let deathJson = battle[victimSide].died(
										"direct",
										killer,
										false
									);
									battle[prevMoveUserSide].killed(deathJson);
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
						let killer = "";
						let victim =
							battle[victimSide].realName ||
							battle[victimSide].name;
						if (this.rules.db !== "None") {
							killer = battle[killerSide].name;
						}
						let deathJson = battle[victimSide].died(
							"Destiny Bond",
							killer,
							this.rules.db === "Passive"
						);
						if (victimSide.startsWith("p1")) {
							battle.p2Pokemon[killer].killed(deathJson);
						} else {
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

						if (!battle[victimSide].isDead) {
							victim =
								battle[victimSide].realName ||
								battle[victimSide].name;

							let deathJson = battle[victimSide].died(
								prevMove,
								killer,
								this.rules.suicide === "Passive"
							);
							if (killer && killer !== victim) {
								if (victimSide.startsWith("p1")) {
									battle.p2Pokemon[killer].killed(deathJson);
								} else {
									battle.p1Pokemon[killer].killed(deathJson);
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
						}
					} else {
						//Regular kill if it wasn't picked up by the |-damage| statement
						let killer;
						let victim;
						if (!battle[victimSide].isDead) {
							let killerSide = prevParts[1].split(": ")[0];
							killer =
								battle[killerSide].realName ||
								battle[killerSide].name;
							victim =
								battle[victimSide].realName ||
								battle[victimSide].name;

							let deathJson = battle[victimSide].died(
								"faint",
								killer,
								false
							);
							if (victimSide.startsWith("p1")) {
								battle.p2Pokemon[killer].killed(deathJson);
							} else {
								battle.p1Pokemon[killer].killed(deathJson);
							}
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

					dataArr.splice(dataArr.length - 1, 1);
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

//This is the code for connecting to and keeping track of a showdown match
//Importing all required modules
const ws = require("ws");
const axios = require("axios");
const querystring = require("querystring");
const Airtable = require("airtable");
//Importing all tracking-related modules
const Pokemon = require("./Pokemon");
const Battle = require("./Battle");
const utils = require("../utils.js");
//Importing all updating-related modules
const DiscordDMStats = require("../updaters/DiscordDMStats");
const DiscordChannelStats = require("../updaters/DiscordChannelStats");
const DiscordDefaultStats = require("../updaters/DiscordDefaultStats");
//Getting config vars frome env
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const airtable_key = process.env.AIRTABLE_KEY;
const base_id = process.env.BASE_ID;

const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);
const VIEW_NAME = "Grid view";

class Showdown {
	constructor(battle, server, message, rules) {
		this.battle = battle.split("/")[3];

		this.serverType = server.toLowerCase();

		let ip;
		switch (server) {
			case "Showdown":
				ip = "sim.smogon.com:8000";
				break;
			case "Sports":
				ip = "34.222.148.43:8000";
				break;
			case "Automatthic":
				ip = "185.224.89.75:8000";
				break;
			case "Dawn":
				ip = "oppai.azure.lol:80";
		}
		this.server = `ws://${ip}/showdown/websocket`;

		this.websocket = new ws(this.server);
		this.username = username;
		this.password = password;
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

		base("Leagues")
			.select({
				maxRecords: 500,
				view: VIEW_NAME,
			})
			.all()
			.then(async (records) => {
				for (let leagueRecord of records) {
					let channelId = await leagueRecord.get("Channel ID");
					if (channelId === this.message.channel.id) {
						let playersIds = await leagueRecord.get("Players");

						// Getting info from the league
						recordJson.system = await leagueRecord.get(
							"Stats System"
						);
						recordJson.sheetId = await leagueRecord.get("Sheet ID");
						recordJson.info = info;
						recordJson.combinePD = await leagueRecord.get(
							"Combine P/D?"
						);
						recordJson.streamChannel = await leagueRecord.get(
							"Stream Channel ID"
						);
						recordJson.battleId = this.battle;

						// Gets more info from each player if Google Sheets is the system
						if (playersIds) {
							let funcArr = [];
							for (let playerId of playersIds) {
								funcArr.push(
									new Promise((resolve, reject) => {
										base("Players").find(
											playerId,
											async (error, record) => {
												if (error) {
													console.error(error);
													reject(error);
												}

												let recordName = await record.get(
													"Showdown Name"
												);
												recordName.toLowerCase().trim();
												let recordRange = await record.get(
													"Range"
												);
												console.log(
													playerId +
														"    " +
														recordName +
														"player"
												);
												if (
													recordName.toLowerCase() ===
														player1.toLowerCase() ||
													recordName.toLowerCase() ===
														player2.toLowerCase()
												) {
													recordJson.players[
														recordName.toLowerCase() ===
														player1.toLowerCase()
															? player1
															: player2
													].range = recordRange;
												}

												resolve();
											}
										);
									})
								);
							}
							await Promise.all(funcArr).then(
								console.log("Players found! Updating now...")
							);
						}
					}
				}
			})
			.then(async () => {
				console.log(JSON.stringify(recordJson));

				//Instantiating updater objects
				let dmer = new DiscordDMStats(this.message);
				let channeler = new DiscordChannelStats(this.message);
				let defaulter = new DiscordDefaultStats(this.message);

				//Updating stats based on given method
				switch (recordJson.system) {
					case "DM":
						await dmer.update(recordJson);
						break;
					case "Channel":
						await channeler.update(recordJson);
						break;
					default:
						await defaulter.update(recordJson);
						break;
				}

				console.log("Updating done!");
			});
	}

	async login(nonce) {
		console.log("LOGGING IN");
		let psUrl = `https://play.pokemonshowdown.com/~~${this.serverType}/action.php`;
		let data = querystring.stringify({
			act: "login",
			name: this.username,
			pass: this.password,
			challstr: nonce,
		});

		let response = await axios.post(psUrl, data);
		let json;
		try {
			json = JSON.parse(response.data.substring(1));
			console.log("Login is a success!");
		} catch (e) {
			console.log("Response to login request: " + response);
			this.message.channel.send(
				`Error: \`${this.username}\` failed to login to Showdown. Contact Porygon support.`
			);
			console.error(e);
			return;
		}
		console.log("Logged in to PS.");
		return json.assertion;
	}

	async join() {
		console.log(this.battle);
		this.websocket.send(`|/join ${this.battle}`);
		this.message.channel.send(`Battle joined! Keeping track of stats now.`);
		this.websocket.send(
			`${this.battle}|Battle joined! Keeping track of stats now.`
		);
	}

	async requestReplay(data) {
		let url = `https://play.pokemonshowdown.com/~~${this.serverType}/action.php`;
		data.id = `${
			this.serverType === "showdown" ? "" : `${this.serverType}-`
		}${data.id}`;
		let newData = querystring.stringify({
			act: "uploadreplay",
			log: data.log,
			id: data.id,
		});
		//console.log("newData: " + JSON.stringify(newData) + "\n");

		let response = await axios.post(url, newData);

		console.log("Replay posted!");
		let replay = `https://replay.pokemonshowdown.com/${data.id}`;

		return replay;
	}

	async track() {
		let battle;
		let dataArr = [];

		this.websocket.on("message", async (data) => {
			try {
				//Separates the data into lines so it's easy to parse
				let realdata = data.split("\n");

				for (const line of realdata) {
					dataArr.push(line);

					//Separates the line into parts, separated by `|`
					const parts = line.split("|").slice(1); //The substring is because all lines start with | so the first element is always blank

					//Checks first and foremost if the battle even exists
					if (line.startsWith(`|noinit|`)) {
						if (line.includes("nonexistent|")) {
							return this.message.channel.send(
								":x: This link is invalid. The battleroom is either closed or non-existent. I have left the battle."
							);
						} else if (line.includes("joinfailed")) {
							return this.message.channel.send(
								":x: This link is closed to spectators. I have left the battle. Please start a new battle with spectators allowed if you want me to track it."
							);
						}
					}

					//Once the server connects, the bot logs in and joins the battle
					else if (data.startsWith("|challstr|")) {
						const nonce = data.substring(10);
						const assertion = await this.login(nonce);
						//logs in
						if (assertion) {
							this.websocket.send(
								`|/trn ${username},0,${assertion}|`
							);
							//Joins the battle
							await this.join();
						} else {
							return;
						}
					}

					//At the beginning of every match, the title of a match contains the player's names.
					//As such, in order to get and verify the player's names in the database, this is the most effective.
					else if (line.startsWith(`|title|`)) {
						let players = parts[1].split(" vs. ");
						console.log("Players: " + players);

						//Initializes the battle as an object
						battle = new Battle(
							this.battle,
							players[0],
							players[1]
						);
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
						let realName = parts[2].split(",")[0];
						let pokemonName = realName.split("-")[0];
						let pokemon = new Pokemon(pokemonName, realName); //Adding a pokemon to the list of pokemon in the battle
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
						if (battle.turns === 1 && this.rules.ping !== "")
							await this.message.channel.send(this.rules.ping);
						console.log(battle.turns);
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
							console.log(
								`${oldPokemon.name} has been switched into ${battle.p1a.name}`
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
							console.log(
								`${oldPokemon.name} has been switched into ${battle.p1b.name}`
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
							console.log(
								`${oldPokemon.name} has been switched into ${battle.p2a.name}`
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
							console.log(
								`${oldPokemon.name} has been switched into ${battle.p2b.name}`
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
								`${battle.p1a} has switched with ${
									battle.p1b
								} due to ${parts[3].split(": ")[1]}`
							);
						} else if (userSide.startsWith("p2")) {
							let temp = battle.p2a;
							battle.p2a = battle.p2b;
							battle.p2b = temp;

							console.log(
								`${battle.p2a} has switched with ${
									battle.p2b
								} due to ${parts[3].split(": ")[1]}`
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
							battle.p1b.currentPassiveKills += tempCurrentPassiveKills;

							console.log(
								`${oldPokemon.name} has been replaced by ${battle.p1b.name}`
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
							battle.p2a.currentPassiveKills += tempCurrentPassiveKills;

							console.log(
								`${oldPokemon.name} has been replaced by ${battle.p2a.name}`
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
							battle.p2b.currentPassiveKills += tempCurrentPassiveKills;

							console.log(
								`${oldPokemon.name} has been replaced by ${battle.p2b.name}`
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
						line.startsWith(`|-crit|`) ||
						line.startsWith("|debug|") ||
						line.startsWith("|-enditem|") ||
						line === "|"
					) {
						dataArr.splice(dataArr.length - 1, 1);
					} else if (line.startsWith(`|detailschange|`)) {
						if (parts[2].includes("Mega")) {
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
					}

					//If a weather condition is set
					else if (line.startsWith(`|-weather|`)) {
						if (
							!(
								line.includes("[upkeep]") ||
								line.includes("none")
							)
						) {
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
							console.log(`${inflictor} caused ${weather}.`);
							battle.setWeather(weather, inflictor);
						}

						//If the weather has been stopped
						if (parts[1] === "none") {
							battle.clearWeather();
						}
					}

					//For moves like Infestation and Fire Spin
					else if (line.startsWith(`|-activate|`)) {
						let move = parts[2].includes("move")
							? parts[2].split(": ")[1]
							: parts[2];
						if (
							!(
								utils.badActivateMoves.includes(move) ||
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
						if (move !== "Destiny Bond")
							dataArr.splice(dataArr.length - 1, 1);
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
							//The pokemon that inflicted the hazards
							let inflictorSide = parts[1].split(": ")[0];

							//Very inefficient, I know
							if (inflictorSide === "p1a")
								battle.addHazard("p2", move, battle.p1a.name);
							else if (inflictorSide === "p1b")
								battle.addHazard("p2", move, battle.p1b.name);
							else if (inflictorSide === "p2a")
								battle.addHazard("p1", move, battle.p2a.name);
							else if (inflictorSide === "p2b")
								battle.addHazard("p1", move, battle.p2b.name);
						}
					}

					//Checks for statuses
					else if (line.startsWith(`|-status|`)) {
						let prevMoveLine = dataArr[dataArr.length - 2];
						let prevMove = prevMoveLine.split("|").slice(1)[2];
						let prevPrevMoveLine = dataArr[dataArr.length - 3];
						let prevPrevMove = prevPrevMoveLine
							.split("|")
							.slice(1)[2];

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
									victim = battle.p2a.name;
								} else if (victimSide === "p2b") {
									battle.p2b.statusEffect(
										parts[2] === "tox" ? "psn" : parts[2],
										battle.p1a.name,
										"Passive"
									);
									inflictor = battle.p1a.name;
									victim = battle.p2b.name;
								}
							} else if (inflictorSide === "p1b") {
								if (victimSide === "p2a") {
									battle.p2a.statusEffect(
										parts[2] === "tox" ? "psn" : parts[2],
										battle.p1b.name,
										"Passive"
									);
									inflictor = battle.p1b.name;
									victim = battle.p2a.name;
								} else if (victimSide === "p2b") {
									battle.p2b.statusEffect(
										parts[2] === "tox" ? "psn" : parts[2],
										battle.p1b.name,
										"Passive"
									);
									inflictor = battle.p1b.name;
									victim = battle.p2b.name;
								}
							} else if (inflictorSide === "p2a") {
								if (victimSide === "p1a") {
									battle.p1a.statusEffect(
										parts[2] === "tox" ? "psn" : parts[2],
										battle.p2a.name,
										"Passive"
									);
									inflictor = battle.p2a.name;
									victim = battle.p1a.name;
								} else if (victimSide === "p1b") {
									battle.p1b.statusEffect(
										parts[2] === "tox" ? "psn" : parts[2],
										battle.p2a.name,
										"Passive"
									);
									inflictor = battle.p2a.name;
									victim = battle.p1b.name;
								}
							} else if (inflictorSide === "p2b") {
								if (victimSide === "p1a") {
									battle.p1a.statusEffect(
										parts[2] === "tox" ? "psn" : parts[2],
										battle.p2b.name,
										"Passive"
									);
									inflictor = battle.p2b.name;
									victim = battle.p1a.name;
								} else if (victimSide === "p1b") {
									battle.p1b.statusEffect(
										parts[2] === "tox" ? "psn" : parts[2],
										battle.p2b.name,
										"Passive"
									);
									inflictor = battle.p2b.name;
									victim = battle.p1b.name;
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
							let inflictorSide = line.includes("item")
								? victimSide
								: parts[4].split("[of]")[1].split(": ")[0];
							if (victimSide === "p1a") {
								if (inflictorSide === "p2a")
									inflictor = battle.p2a.name;
								else if (inflictorSide === "p2b")
									inflictor = battle.p2b.name;
								else inflictor = battle.p1a.name;

								victim = battle.p1a.name;
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

								victim = battle.p1b.name;
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

								victim = battle.p2a.name;
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

								victim = battle.p2b.name;
								battle.p2b.statusEffect(
									parts[2],
									inflictor,
									this.rules.abilityItem
								);
							}
						} else {
							//If status wasn't caused by a move, but rather Toxic Spikes
							if (parts[1].split(": ")[0] === "p1a") {
								victim = battle.p1a.name;
								inflictor =
									battle.hazardsSet.p1["Toxic Spikes"];
								battle.p1a.statusEffect(
									parts[2],
									inflictor,
									"Passive"
								);
							} else if (parts[1].split(": ")[0] === "p1b") {
								victim = battle.p1b.name;
								inflictor =
									battle.hazardsSet.p1["Toxic Spikes"];
								battle.p1b.statusEffect(
									parts[2],
									inflictor,
									"Passive"
								);
							} else if (parts[1].split(": ")[0] === "p2a") {
								victim = battle.p2a.name;
								inflictor =
									battle.hazardsSet.p2["Toxic Spikes"];
								battle.p2a.statusEffect(
									parts[2],
									inflictor,
									"Passive"
								);
							} else if (parts[1].split(": ")[0] === "p2b") {
								victim = battle.p2b.name;
								inflictor =
									battle.hazardsSet.p2["Toxic Spikes"];
								battle.p2b.statusEffect(
									parts[2],
									inflictor,
									"Passive"
								);
							}
						}
						console.log(
							`${inflictor} caused ${parts[2]} on ${victim}.`
						);
					} else if (line.startsWith("|-sidestart|")) {
						let prevLine = dataArr[dataArr.length - 2];
						let prevParts = prevLine.split("|").slice(1);
						let inflictorSide = prevParts[1].split(": ")[0];
						let inflictor = "";

						if (inflictorSide === "p1a")
							inflictor = battle.p1a.name;
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

							if (
								move === "Future Sight" ||
								move === "Doom Desire"
							) {
								if (afflictorSide === "p2a") {
									battle.hazardsSet.p1[move] =
										battle.p2a.name;
								} else if (side === "p2b") {
									battle.hazardsSet.p1[move] =
										battle.p2b.name;
								} else if (side === "p1a") {
									battle.hazardsSet.p2[move] =
										battle.p1a.name;
								} else if (side === "p1b") {
									battle.hazardsSet.p2[move] =
										battle.p1b.name;
								}
							} else {
								let victim = "";
								if (side === "p1a") {
									if (afflictorSide === "p2a")
										afflictor = battle.p2a.name;
									else if (afflictorSide === "p2b")
										afflictor = battle.p2b.name;
									battle.p1a.otherAffliction[
										move
									] = afflictor;
									victim = battle.p1a.name;
								} else if (side === "p1b") {
									if (afflictorSide === "p2a")
										afflictor = battle.p2a.name;
									else if (afflictorSide === "p2b")
										afflictor = battle.p2b.name;
									battle.p1b.otherAffliction[
										move
									] = afflictor;
									victim = battle.p1b.name;
								} else if (side === "p2a") {
									if (afflictorSide === "p1a")
										afflictor = battle.p1a.name;
									else if (afflictorSide === "p1b")
										afflictor = battle.p1b.name;
									battle.p2a.otherAffliction[
										move
									] = afflictor;
									victim = battle.p2a.name;
								} else if (side === "p2b") {
									if (afflictorSide === "p1a")
										afflictor = battle.p1a.name;
									else if (afflictorSide === "p1b")
										afflictor = battle.p1b.name;
									battle.p2b.otherAffliction[
										move
									] = afflictor;
									victim = battle.p2b.name;
								}
								console.log(
									`Started ${move} on ${victim} by ${afflictor}`
								);
							}
						} else if (affliction === `perish0`) {
							//Pokemon dies of perish song
							let side = parts[1].split(": ")[0];
							let afflictor;
							let victim;
							if (side === "p1a") {
								afflictor =
									battle.p1a.otherAffliction["perish3"];
								victim = battle.p1a.name;
								let deathJson = battle.p1a.died(
									affliction,
									afflictor,
									true
								);
								battle.p2Pokemon[afflictor].killed(deathJson);
							} else if (side === "p1b") {
								afflictor =
									battle.p1b.otherAffliction["perish3"];
								victim = battle.p1b.name;
								let deathJson = battle.p1b.died(
									affliction,
									afflictor,
									true
								);
								battle.p2Pokemon[afflictor].killed(deathJson);
							} else if (side === "p2a") {
								afflictor =
									battle.p2a.otherAffliction["perish3"];
								victim = battle.p2a.name;
								let deathJson = battle.p2a.died(
									affliction,
									afflictor,
									true
								);
								battle.p1Pokemon[afflictor].killed(deathJson);
							} else if (side === "p2b") {
								afflictor =
									battle.p2b.otherAffliction["perish3"];
								victim = battle.p2b.name;
								let deathJson = battle.p2b.died(
									affliction,
									afflictor,
									true
								);
								battle.p1Pokemon[afflictor].killed(deathJson);
							}
							console.log(
								`${victim} was killed by ${afflictor} due to Perish Song (passive) (Turn ${battle.turns})`
							);
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
					}

					//Mostly used for Illusion cuz frick Zoroark
					else if (line.startsWith(`|-end|`)) {
						let historyLine =
							battle.history[battle.history.length - 1];
						//If no one has died yet
						historyLine = historyLine || "";
						if (
							line.endsWith("Illusion") &&
							historyLine.includes(battle.turns.toString())
						) {
							let historyLineParts = historyLine.split(" ");
							let victim = historyLineParts[0];
							let killer = historyLineParts[4];
							let isPassive =
								historyLineParts[
									historyLineParts.length - 2
								] === "(passive)";

							if (battle.p1Pokemon[victim]) {
								battle.p1Pokemon[victim].undied();
								battle.p2Pokemon[killer].unkilled(isPassive);
							} else {
								battle.p2Pokemon[victim].undied();
								battle.p1Pokemon[killer].unkilled(isPassive);
							}
							battle.history.splice(battle.history.length - 1, 1);
						}
						if (!line.endsWith("Future Sight"))
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
								if (utils.hazardMoves.includes(move)) {
									//Hazards
									if (victimSide === "p1a") {
										killer = battle.hazardsSet.p1[move];
										let deathJson = battle.p1a.died(
											move,
											killer,
											true
										);
										battle.p2Pokemon[killer].killed(
											deathJson
										);
										victim = battle.p1a.name;
									} else if (victimSide === "p1b") {
										killer = battle.hazardsSet.p1[move];
										let deathJson = battle.p1b.died(
											move,
											killer,
											true
										);
										battle.p2Pokemon[killer].killed(
											deathJson
										);
										victim = battle.p1b.name;
									} else if (victimSide === "p2a") {
										killer = battle.hazardsSet.p2[move];
										let deathJson = battle.p2a.died(
											move,
											killer,
											true
										);
										battle.p1Pokemon[killer].killed(
											deathJson
										);
										victim = battle.p2a.name;
									} else if (victimSide === "p2b") {
										killer = battle.hazardsSet.p2[move];
										let deathJson = battle.p2b.died(
											move,
											killer,
											true
										);
										battle.p1Pokemon[killer].killed(
											deathJson
										);
										victim = battle.p2b.name;
									}
									reason = `${move} (passive) (Turn ${battle.turns})`;
								} else if (
									move === "Hail" ||
									move === "Sandstorm"
								) {
									//Weather
									killer = battle.weatherInflictor;
									if (victimSide === "p1a") {
										if (
											Object.keys(
												battle.p1Pokemon
											).includes(killer)
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
									} else if (victimSide === "p1b") {
										if (
											Object.keys(
												battle.p1Pokemon
											).includes(killer)
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
										victim = battle.p1a.name;
									} else if (victimSide === "p2a") {
										if (
											Object.keys(
												battle.p2Pokemon
											).includes(killer)
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
									} else if (victimSide === "p2b") {
										if (
											Object.keys(
												battle.p2Pokemon
											).includes(killer)
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
										victim = battle.p2a.name;
									}
									reason = `${move} (passive) (Turn ${battle.turn})`;
								} else if (move === "brn" || move === "psn") {
									if (victimSide === "p1a") {
										killer = battle.p1a.statusInflictor;
										if (
											Object.keys(
												battle.p1Pokemon
											).includes(killer)
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
										reason = `${move} (${
											battle.p1a.statusType === "Passive"
												? "passive"
												: "direct"
										}) (Turn ${battle.turns})`;
									} else if (victimSide === "p1b") {
										killer = battle.p1b.statusInflictor;
										if (
											Object.keys(
												battle.p1Pokemon
											).includes(killer)
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
										victim = battle.p1b.name;
										reason = `${move} (${
											battle.p1b.statusType === "Passive"
												? "passive"
												: "direct"
										}) (Turn ${battle.turns})`;
									} else if (victimSide === "p2a") {
										killer = battle.p2a.statusInflictor;
										if (
											Object.keys(
												battle.p2Pokemon
											).includes(killer)
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
										reason = `${move} (${
											battle.p2a.statusType === "Passive"
												? "passive"
												: "direct"
										}) (Turn ${battle.turns})`;
									} else if (victimSide === "p2b") {
										killer = battle.p2b.statusInflictor;
										if (
											Object.keys(
												battle.p2Pokemon
											).includes(killer)
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
										victim = battle.p2b.name;
										reason = `${move} (${
											battle.p2b.statusType === "Passive"
												? "passive"
												: "direct"
										}) (Turn ${battle.turns})`;
									}
								} else if (
									utils.recoilMoves.includes(move) ||
									move.toLowerCase() === "recoil"
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
										victim = battle.p1b.name;
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
										victim = battle.p2a.name;
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
										victim = battle.p2b.name;
									}
									reason = `recoil (${
										this.rules.recoil === "Passive"
											? "passive"
											: "direct"
									}) (Turn ${battle.turns})`;
								} else if (
									move.startsWith(`item: `) ||
									move.includes(`ability`)
								) {
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
										battle.p2Pokemon[killer].killed(
											deathJson
										);
										victim = battle.p1a.name;
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
										battle.p2Pokemon[killer].killed(
											deathJson
										);
										victim = battle.p1b.name;
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
										battle.p1Pokemon[killer].killed(
											deathJson
										);
										victim = battle.p2a.name;
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
										battle.p1Pokemon[killer].killed(
											deathJson
										);
										victim = battle.p2b.name;
									}
									reason = `${item} (${
										this.rules.abilityitem === "Passive"
											? "passive"
											: "direct"
									}) (Turn ${battle.turns})`;
								} else {
									move = move.includes("move: ")
										? move.split(": ")[1]
										: move;
									//Affliction-caused deaths
									if (victimSide === "p1a") {
										killer =
											battle.p1a.otherAffliction[move];
										victim = battle.p1a.name;

										let deathJson = battle.p1a.died(
											move,
											killer,
											true
										);
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									} else if (victimSide === "p1b") {
										killer =
											battle.p1b.otherAffliction[move];
										victim = battle.p1b.name;

										let deathJson = battle.p1b.died(
											move,
											killer,
											true
										);
										battle.p2Pokemon[killer].killed(
											deathJson
										);
									} else if (victimSide === "p2a") {
										killer =
											battle.p2a.otherAffliction[move];
										victim = battle.p2a.name;

										let deathJson = battle.p2a.died(
											move,
											killer,
											true
										);
										battle.p1Pokemon[killer].killed(
											deathJson
										);
									} else if (victimSide === "p2b") {
										killer =
											battle.p2b.otherAffliction[move];
										victim = battle.p2b.name;

										let deathJson = battle.p2b.died(
											move,
											killer,
											true
										);
										battle.p1Pokemon[killer].killed(
											deathJson
										);
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
										true
									);
									battle.p2Pokemon[killer].killed(deathJson);
									victim = battle.p1a.name;
								} else if (victimSide === "p1b") {
									killer = battle.hazardsSet.p1[prevMove];
									let deathJson = battle.p1b.died(
										prevMove,
										killer,
										true
									);
									battle.p2Pokemon[killer].killed(deathJson);
									victim = battle.p1b.name;
								} else if (victimSide === "p2a") {
									killer = battle.hazardsSet.p2[prevMove];
									let deathJson = battle.p2a.died(
										prevMove,
										killer,
										true
									);
									battle.p1Pokemon[killer].killed(deathJson);
									victim = battle.p2a.name;
								} else if (victimSide === "p2b") {
									killer = battle.hazardsSet.p2[prevMove];
									let deathJson = battle.p2b.died(
										prevMove,
										killer,
										true
									);
									battle.p1Pokemon[killer].killed(deathJson);
									victim = battle.p2b.name;
								}
								reason = `${prevMove} (passive) (Turn ${battle.turns})`;
							} else {
								//It's just a regular effing kill
								prevMove = prevMoveLine.split("|").slice(1)[2];
								let prevMoveUserSide = prevMoveLine
									.split("|")
									.slice(1)[1]
									.split(": ")[0];
								if (
									victimSide === "p1a" &&
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
									}
									victim = battle.p1a.name;
								} else if (
									victimSide === "p1b" &&
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
									}
									victim = battle.p1b.name;
								} else if (
									victimSide === "p2a" &&
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
									}
									victim = battle.p2a.name;
								} else if (
									victimSide === "p2b" &&
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
									}
									victim = battle.p2b.name;
								}
								reason = `${prevMove} (direct) (Turn ${battle.turns})`;
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
								victim = battle.p1a.name;
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
								victim = battle.p1b.name;
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
								victim = battle.p2a.name;
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
								victim = battle.p2b.name;
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
								`${victim} was killed by ${killer} due to Destiny Bond (Turn ${battle.turns}).`
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
									prevLine.includes("Final Gambit"))) ||
							prevLine.includes("Curse")
						) {
							let prevMove = prevParts[2];
							console.log("Curse BABY");

							let killer = "";
							let victim;
							let killerSide = prevParts[1].split(": ")[0];
							if (victimSide === "p2a" && !battle.p2a.isDead) {
								victim = battle.p2a.name;
								if (this.rules.suicide !== "None") {
									if (killerSide === "p1a")
										killer = battle.p1a.name;
									else if (killerSide === "p1b")
										killer = battle.p1b.name;
								}

								let deathJson = battle.p2a.died(
									prevMove,
									killer,
									this.rules.suicide === "Passive"
								);
								if (killer) {
									battle.p1Pokemon[killer].killed(deathJson);
								}
							} else if (
								victimSide === "p2b" &&
								!battle.p2b.isDead
							) {
								victim = battle.p2b.name;
								if (this.rules.suicide !== "None") {
									if (killerSide === "p1a")
										killer = battle.p1a.name;
									else if (killerSide === "p1b")
										killer = battle.p1b.name;
								}

								let deathJson = battle.p2b.died(
									prevMove,
									killer,
									this.rules.suicide === "Passive"
								);
								if (killer) {
									battle.p1Pokemon[killer].killed(deathJson);
								}
							} else if (
								victimSide === "p1a" &&
								!battle.p1a.isDead
							) {
								victim = battle.p1a.name;
								if (this.rules.suicide !== "None") {
									if (killerSide === "p2a")
										killer = battle.p2a.name;
									else if (killerSide === "p2b")
										killer = battle.p2b.name;
								}

								let deathJson = battle.p1a.died(
									prevMove,
									killer,
									this.rules.suicide === "Passive"
								);
								if (killer) {
									battle.p2Pokemon[killer].killed(deathJson);
								}
							} else if (
								victimSide === "p1b" &&
								!battle.p1b.isDead
							) {
								victim = battle.p1b.name;
								if (this.rules.suicide !== "None") {
									if (killerSide === "p2a")
										killer = battle.p2a.name;
									else if (killerSide === "p2b")
										killer = battle.p2b.name;
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

							console.log(
								`${victim} was killed by ${killer} due to ${prevMove} (${
									this.rules.suicide === "Passive"
										? "passive"
										: "direct"
								}) (Turn ${battle.turns}).`
							);
							battle.history.push(
								`${victim} was killed by ${killer} due to ${prevMove} (${
									this.rules.suicide === "Passive"
										? "passive"
										: "direct"
								}) (Turn ${battle.turns}).`
							);
						} else {
							//Regular kill if it wasn't picked up by the |-damage| statement
							let killer;
							let victim;
							let killerSide = prevParts[1].split(": ")[0];
							console.log("Curse BABYBABYBABY");
							if (victimSide === "p1a" && !battle.p1a.isDead) {
								if (killerSide === "p2a") {
									killer = battle.p2a.name;
								} else if (killerSide === "p2b") {
									killer = battle.p2b.name;
								}
								victim = battle.p1a.name;
								let deathJson = battle.p1a.died(
									"faint",
									killer,
									false
								);
								battle.p2Pokemon[killer].killed(deathJson);
							} else if (
								victimSide === "p1b" &&
								!battle.p1b.isDead
							) {
								if (killerSide === "p2a") {
									killer = battle.p2a.name;
								} else if (killerSide === "p2b") {
									killer = battle.p2b.name;
								}
								victim = battle.p1b.name;
								let deathJson = battle.p1b.died(
									"faint",
									killer,
									false
								);
								battle.p2Pokemon[killer].killed(deathJson);
							} else if (
								victimSide === "p2a" &&
								!battle.p2a.isDead
							) {
								if (killerSide === "p1a") {
									killer = battle.p1a.name;
								} else if (killerSide === "p1b") {
									killer = battle.p1b.name;
								}
								victim = battle.p2a.name;
								let deathJson = battle.p2a.died(
									"faint",
									killer,
									false
								);

								battle.p1Pokemon[killer].killed(deathJson);
							} else if (
								victimSide === "p2b" &&
								!battle.p2b.isDead
							) {
								if (killerSide === "p1a") {
									killer = battle.p1a.name;
								} else if (killerSide === "p1b") {
									killer = battle.p1b.name;
								}
								victim = battle.p2b.name;
								let deathJson = battle.p2b.died(
									"faint",
									killer,
									false
								);
								battle.p1Pokemon[killer].killed(deathJson);
							}

							if (killer && victim) {
								console.log(
									`${victim} was killed by ${killer} (Turn ${battle.turns}).`
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
						let messageParts = parts[1].split(" ");
						if (line.endsWith("forfeited.")) {
							let forfeiter = messageParts[0];
							if (this.rules.forfeit !== "None") {
								let numDead = 0;
								if (forfeiter === battle.p1) {
									for (let pokemon of Object.values(
										battle.p1Pokemon
									)) {
										if (!pokemon.isDead) numDead++;
									}
									if (this.rules.forfeit === "Direct") {
										battle.p2a.currentDirectKills += numDead;
									} else if (
										this.rules.forfeit === "Passive"
									) {
										battle.p2a.currentPassiveKills += numDead;
									}
								} else {
									for (let pokemon of Object.values(
										battle.p2Pokemon
									)) {
										if (!pokemon.isDead) numDead++;
									}
									if (this.rules.forfeit === "Direct") {
										battle.p1a.currentDirectKills += numDead;
									} else if (
										this.rules.forfeit === "Passive"
									) {
										battle.p1a.currentPassiveKills += numDead;
									}
								}
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
						battle.p1Pokemon[battle.p1a.name] = battle.p1a;
						for (let pokemon of Object.values(battle.p1Pokemon)) {
							battle.p1Pokemon[pokemon.name].directKills +=
								pokemon.currentDirectKills;
							battle.p1Pokemon[pokemon.name].passiveKills +=
								pokemon.currentPassiveKills;
						}
						//Team 2
						battle.p2Pokemon[battle.p2a.name] = battle.p2a;
						for (let pokemon of Object.values(battle.p2Pokemon)) {
							battle.p2Pokemon[pokemon.name].directKills +=
								pokemon.currentDirectKills;
							battle.p2Pokemon[pokemon.name].passiveKills +=
								pokemon.currentPassiveKills;
						}

						console.log(`${battle.winner} won!`);
						this.websocket.send(`${this.battle}|/uploadreplay`); //Requesting the replay from Showdown
					}

					//After the match is done and replay request is sent, it uploads the replay and gets the link
					else if (line.startsWith("|queryresponse|savereplay")) {
						let replayData = JSON.parse(data.substring(26));
						battle.replay = await this.requestReplay(replayData);
						await axios
							.post(
								`https://kills.porygonbot.xyz/${
									battle.replay.split("/")[3]
								}`,
								battle.history.join("<br>"),
								{
									headers: {
										"Content-Length": 0,
										"Content-Type": "text/plain",
									},
									responseType: "text",
								}
							)
							.catch((e) => {
								return;
							});

						let info = {
							replay: battle.replay,
							turns: battle.turns,
							winner: battle.winner,
							loser: battle.loser,
							history: `https://kills.porygonbot.xyz/${
								battle.replay.split("/")[3]
							}`,
							spoiler: this.rules.spoiler,
							format: this.rules.format,
						};

						//Creating the objects for kills and deaths
						//Player 1
						let killJsonp1 = {};
						let deathJsonp1 = {};
						for (let pokemonObj of Object.values(
							battle.p1Pokemon
						)) {
							killJsonp1[pokemonObj.realName] = {
								direct: pokemonObj.directKills,
								passive: pokemonObj.passiveKills,
							};
							deathJsonp1[pokemonObj.realName] = pokemonObj.isDead
								? 1
								: 0;
						}
						//Player 2
						let killJsonp2 = {};
						let deathJsonp2 = {};
						for (let pokemonObj of Object.values(
							battle.p2Pokemon
						)) {
							killJsonp2[pokemonObj.realName] = {
								direct: pokemonObj.directKills,
								passive: pokemonObj.passiveKills,
							};
							deathJsonp2[pokemonObj.realName] = pokemonObj.isDead
								? 1
								: 0;
						}

						if (
							battle.winner.endsWith("p1") &&
							battle.loser.endsWith("p2")
						) {
							info.result = `${battle.p1} won ${
								Object.values(battle.p1Pokemon).length -
								Object.values(battle.p1Pokemon).filter(
									(pokemon) => pokemon.isDead
								).length
							}-${
								Object.values(battle.p2Pokemon).length -
								Object.values(battle.p2Pokemon).filter(
									(pokemon) => pokemon.isDead
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
								Object.values(battle.p2Pokemon).length -
								Object.values(battle.p2Pokemon).filter(
									(pokemon) => pokemon.isDead
								).length
							}-${
								Object.values(battle.p1Pokemon).length -
								Object.values(battle.p1Pokemon).filter(
									(pokemon) => pokemon.isDead
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

						this.websocket.send(`|/leave ${this.battle}`);

						let returndata = {
							info: info,
							code: "0",
						};

						return returndata;
					}
				}
			} catch (e) {
				this.message.channel.send(
					`:x: Error with this match. I will be unable to update this match until you send this match's replay to the Porygon server's bugs-and-help channel. I have also left this battle so I will not send the stats for this match until the error is fixed and you analyze its replay again.\n**Error:**\`\`\`${e}\`\`\``
				);
				this.websocket.send(`${this.battle}|:x: Error with this match. I will be unable to update this match until you send this match's replay to the Porygon server's bugs-and-help channel. I have also left this battle so I will not send the stats for this match until the error is fixed and you analyze its replay again.`);
				this.websocket.send(`/leave ${this.battle}`);
				console.error(e);
			}
		});
	}
}

module.exports = Showdown;

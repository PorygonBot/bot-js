//This is the code for connecting to and keeping track of a showdown match
const json = require("json");
const ws = require("ws");
const axios = require("axios");
const querystring = require("querystring");

const Pokemon = require("./Pokemon");
const Battle = require("./Battle");

const DiscordDMStats = require("../updaters/DiscordDMStats");
const GoogleSheetsMassStats = require("../updaters/GoogleSheetsMassStats");

const { username, password, airtable_key, base_id } = require("../config.json");
const Airtable = require("airtable");
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);
const VIEW_NAME = "Grid view";

let findLeagueId = async (checkChannelId) => {
	let leagueId;
	let leagueName;
	await base("Leagues")
		.select({
			maxRecords: 500,
			view: "Grid view",
		})
		.all()
		.then(async (records) => {
			for (let leagueRecord of records) {
				let channelId = await leagueRecord.get("Channel ID");
				if (channelId === checkChannelId) {
					leagueId = leagueRecord.id;
					leagueName = await leagueRecord.get("Name");
				}
			}
		});

	let leagueJson = {
		id: leagueId,
		name: leagueName,
	};
	console.log("End of first function");
	return leagueJson;
};

let getPlayersIds = async (leagueId) => {
	console.log("Inside the second function");
	let recordsIds = await new Promise((resolve, reject) => {
		base("Leagues").find(leagueId, (err, record) => {
			if (err) reject(err);

			recordIds = record.get("Players");
			resolve(recordIds);
		});
	});

	return recordsIds;
};

let playerInLeague = async (playersIds, playerName) => {
	let funcarr = [];
	let isIn = false;
	for (let playerId of playersIds) {
		funcarr.push(
			new Promise((resolve, reject) => {
				base("Players").find(playerId, async (err, record) => {
					if (err) reject(err);

					let recordName = await record.get("Showdown Name");
					if (recordName.toLowerCase() === playerName.toLowerCase()) {
						isIn = true;
					}

					resolve();
				});
			})
		);
	}
	await Promise.all(funcarr);

	return isIn;
};

class Showdown {
	constructor(battle, server, message) {
		this.battle = battle.split("/")[3];

		this.serverType = server.toLowerCase();

		let ip;
		switch (server) {
			case "Showdown":
				ip = "sim.smogon.com";
				break;
			case "Sports":
				ip = "34.222.148.43";
				break;
			case "Automatthic":
				ip = "185.224.89.75";
				break;
		}
		this.server = `ws://${ip}:8000/showdown/websocket`;

		this.websocket = new ws(this.server);
		this.username = username;
		this.password = password;
		this.message = message;
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

		//Getting players info from Airtable
		let recordJson = {
			system: "",
			players: {},
			sheetId: "",
			mods: [],
		};

		console.log("Players: " + player1 + " and " + player2);
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
						let modsIds = await leagueRecord.get("Mods");

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

											let recordPSName = await record.get(
												"Showdown Name"
											);
											recordPSName = recordPSName
												.toLowerCase()
												.trim();
											let recordDiscord = await record.get(
												"Discord Tag"
											);
											let recordRange = await record.get(
												"Range"
											);

											console.log(
												playerId +
													"    " +
													recordPSName +
													"player"
											);

											if (
												recordPSName === player1 ||
												recordPSName === player2
											) {
												let player =
													recordPSName === player1
														? player1
														: player2;
												console.log(
													"Player inside if statement: " +
														player
												);

												recordJson.players[player] = {
													ps: player,
													discord: recordDiscord,
													range: recordRange,
													kills:
														player === player1
															? killJson1
															: killJson2,
													deaths:
														player === player1
															? deathJson1
															: deathJson2,
												};
											}

											resolve();
										}
									);
								})
							);
						}

						let modFuncArr = [];
						if (modsIds) {
							for (let modId of modsIds) {
								modFuncArr.push(
									new Promise((resolve, reject) => {
										base("Players").find(
											modId,
											async (err, record) => {
												if (err) reject(err);

												let recordDiscord = await record.get(
													"Discord Tag"
												);
												recordJson.mods.push(
													recordDiscord
												);

												resolve();
											}
										);
									})
								);
							}
						}

						await Promise.all(funcArr).then(() => {
							console.log("Players found! Updating now...");
						});
						await Promise.all(modFuncArr).then(() => {
							console.log("Mods found!");
						});

						recordJson.system = await leagueRecord.get(
							"Stats Storage System"
						);
						recordJson.sheetId = await leagueRecord.get("Sheet ID");
						recordJson.info = info;
						recordJson.dmMods = await leagueRecord.get("DM Mods?");
						recordJson.streamChannel = await leagueRecord.get(
							"Stream Channel ID"
						);
						recordJson.battleId = this.battle;
					}
				}
			})
			.then(async () => {
				console.log("Mods: " + recordJson.mods);
				console.log("yay: " + JSON.stringify(recordJson));

				//Instantiating updater objects
				let dmer = new DiscordDMStats(this.message);
				let masser = new GoogleSheetsMassStats(
					recordJson.sheetId,
					recordJson.players[player1],
					recordJson.players[player2],
					this.message
				);

				//Checking if the player was found in the database
				if (
					!recordJson.players[player1] ||
					!recordJson.players[player2]
				) {
					this.message.channel.send(
						`Player \`${
							!recordJson.players[player1] ? player1 : player2
						}\` was not found in the database for \`${
							this.battle
						}\`. Contact ${dmer.getUser(
							"harbar20#9389"
						)} for support and more information.`
					);
					return;
				}

				//Updating stats based on given method
				switch (recordJson.system) {
					case "Google Sheets Mass":
						await masser.update(recordJson);
						break;
					case "Discord DM":
						await dmer.update(recordJson);
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
		this.message.channel.send("Battle joined! Keeping track of stats now.");
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
		//console.log(`Response to replay: ${response.data}`);

		return replay;
	}

	async track() {
		let battle;
		let dataArr;

		this.websocket.on("message", async () => {
			//Separates the data into lines so it's easy to parse
			let realdata = data.split("\n");

			for (const line of realdata) {
				dataArr.push(line);

				//Separates the line into parts, separated by `|`
				const parts = line.split("|").split(1); //The split is because all lines start with | so the first element is always blank

				//Checks first and foremost if the battle even exists
				if (line.startsWith(`|noinit|nonexistent|`)) {
					return this.message.channel.send(
						":x: This link is invalid. The battleroom is either closed or non-existent. I have left the battle."
					);
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

					//Checking if either player isn't in the database
					const leagueJson = await findLeagueId(
						this.message.channel.id
					);
					const playersIds = await getPlayersIds(leagueJson.id);
					const containsOne = await playerInLeague(
						playersIds,
						players[0]
					);
					const containsTwo = await playerInLeague(
						playersIds,
						players[1]
					);

					if (!containsOne && !containsTwo) {
						//Both players aren't in the database
						this.message.channel.send(
							`:exclamation: \`${players[0]}\` and \`${players[1]}\` aren't in the database. Quick, add them before the match ends! Don't worry, I'll still track the battle just fine if you do that.`
						);
					} else if (!containsOne) {
						//Only player 1 isn't in the database
						this.message.channel.send(
							`:exclamation: \`${players[0]}\` isn't in the database. Quick, add them before the match ends! Don't worry, I'll still track the battle just fine if you do that.`
						);
					} else if (!containsTwo) {
						//Only player 2 isn't in the database
						this.message.channel.send(
							`:exclamation: \`${players[1]}\` isn't in the database. Quick, add them before the match ends! Don't worry, I'll still track the battle just fine if you do that.`
						);
					}

					//Initializes the battle as an object
					battle = new Battle(this.battle, players[0], players[1]);
				}

				//At the beginning of every non-randoms match, a list of Pokemon show up.
				//This code is to get all that
				else if (line.startsWith(`|poke|`)) {
					let pokemonName = parts[2].split(",")[0];
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
				}

				//If a Pokemon switches, the active Pokemon must now change
				else if (
					line.startsWith(`|switch|`) ||
					line.startsWith(`|drag|`)
				) {
					if (parts[1].startsWith("p1a")) {
						//If Player 1's Pokemon get switched out
						let oldPokemon = battle.p1a;
						if (oldPokemon) {
							battle.p1Pokemon[oldPokemon.name] = oldPokemon;
						}
						battle.p1a = battle.p1Pokemon[parts[2].split(",")[0]];
						console.log(
							`${oldPokemon.name} has been switched into ${battle.p1a.name}`
						);
					} else if (parts[1].startsWith("p2a")) {
						//If Player 2's Pokemon get switched out
						let oldPokemon = battle.p2a;
						if (oldPokemon) {
							battle.p2Pokemon[oldPokemon.name] = oldPokemon;
						}
						battle.p2a = battle.p2Pokemon[parts[2].split(",")[0]];
						console.log(
							`${oldPokemon.name} has been switched into ${battle.p2a.name}`
						);
					}
				}

				//Removes the |-supereffective| part of realdata if it exists
				else if (line.startsWith(`|-supereffective|`)) {
					line.splice(realdata.indexOf(line), 1);
				}

				/**
                |switch|p2a: Poochyena|Poochyena, F|211/211
                |-status|p2a: Poochyena|psn
                 */

				//Checks for certain specific moves: hazards, statuses, etc.
				else if (line.startsWith(`|move|`)) {
					let move = parts[2];

					if (
						move === "Stealth Rock" ||
						move === "Spikes" ||
						move === "Toxic Spikes"
					) {
						//Hazards
						let side = parts[3].split("a: ")[0];
						let inflictor = parts[1].split("a: ")[0];
						battle.addHazard(side, move, inflictor);
					}
				}

				//Checks for statuses
				else if (line.startsWith(`|-status|`)) {
					let prevMove = dataArr[dataArr.length - 2];
					if (prevMove.startsWith(`|move|`)) {
						//If status was caused by a move
						if (prevMove.split("|").slice(1)[1].startsWith("p1a")) {
							let moveUserNickname = prevMove
								.split("|")
								.slice(1)[1]
								.split(": ")[1];
							if (moveUserNickname === battle.p1a.nickname) {
								battle.p2a.statusEffect(parts[2], battle.p1a);
							}
						} else {
							let moveUserNickname = prevMove
								.split("|")
								.slice(1)[1]
								.split(": ")[1];
							if (moveUserNickname === battle.p2a.nickname) {
								battle.p1a.statusEffect(parts[2], battle.p2a);
							}
						}
					} else {
						//If status wasn't caused by a move, but rather something like a hazard
						if (parts[1].split(": ")[0] === "p1a") {
							battle.p1a.statusEffect(
								parts[2],
								battle.hazardsSet.p2["Toxic Spikes"]
							);
						} else {
							battle.p2a.statusEffect(
								parts[2],
								battle.hazardsSet.p1["Toxic Spikes"]
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

				//When a Pokemon is damaged, and possibly faints
				else if (line.startsWith(`|-damage|`)) {
					let move = parts[3].split("[from] ")[1];
					if (parts[2].endsWith("fnt")) {
						//A pokemon has fainted
						let victimSide = parts[1].split(": ")[0];
						if (move === "Stealth Rock" || move === "Spikes") {
							//Hazards
							if (victimSide === "p1a") {
								let killer = battle.hazardsSet.p1[move];
								p1a.died(move, killer, true);
							} else if (victimSide === "p2a") {
								let killer = battle.hazardsSet.p2[move];
								p2a.died(move, killer, true);
							}
						}
					}
				}

				//At the end of the match, when the winner is announced
				else if (line.startsWith(`|win|`)) {
					winner = parts[1];
					winner =
						winner === players[0] ? `${winner}p1` : `${winner}p2`;
					loser =
						winner === `${players[0]}p1`
							? `${players[1]}p2`
							: `${players[0]}p1`;

					this.websocket.send(`${this.battle}|/uploadreplay`); //Requesting the replay from Showdown
				}

				//After the match is done and replay request is sent, it uploads the replay and gets the link
				else if (line.startsWith("|queryresponse|savereplay")) {
					let replayData = JSON.parse(data.substring(26));
					battle.replay = await this.requestReplay(replayData);

					let info = {
						replay: battle.replay,
						turns: battle.turns,
						winner: battle.winner,
						loser: battle.loser,
					};

					if (
						battle.winner.endsWith("p1") &&
						battle.loser.endsWith("p2")
					) {
						await this.endscript(
							winner,
							killJsonp1,
							deathJsonp1,
							loser,
							killJsonp2,
							deathJsonp2,
							info
						);
					} else if (
						battle.winner.endsWith("p2") &&
						battle.loser.endsWith("p1")
					) {
						await this.endscript(
							winner,
							killJsonp2,
							deathJsonp2,
							loser,
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
		});
	}
}

module.exports = Showdown;

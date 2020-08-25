//actual bot goes here
const Discord = require("discord.js");
const Airtable = require("airtable");
const getUrls = require("get-urls");
const Showdown = require("./tracker/Showdown");
const ReplayTracker = require("./tracker/ReplayTracker");
const util = require("./utils.js");

//Getting config info
const { token, airtable_key, base_id } = require("./config.json");
const { default: Axios } = require("axios");
const utils = require("./utils.js");
//Creating the bot
const bot = new Discord.Client({ disableEveryone: true });

//When the bot is connected and logged in to Discord
bot.on("ready", async () => {
	console.log(`${bot.user.username} is online!`);
	bot.user.setActivity(`PS battles in ${bot.guilds.size} servers`, {
		type: "watching",
	});
});

const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

//When a message is sent
bot.on("message", async (message) => {
	let channel = message.channel;
	let channels = await util.getChannels();

	if (message.author.bot) return;

	let msgStr = message.content;
	let msgParams = msgStr.split(" ").slice(3).join(" "); //["porygon,", "use", "command", ...params]
	let prefix = "porygon, use";

	if (channel.type === "dm") return;
	else if (
		channel.name.includes("live-links") ||
		channel.name.includes("live-battles")
	) {
		//Extracting battlelink from the message
		let urls = getUrls(msgStr).values(); //This is because getUrls returns a Set
		let battlelink = urls.next().value;
		if (
			battlelink &&
			!battlelink.includes("google") &&
			!battlelink.includes("replay")
		) {
			let psServer = "";
			//Checking what server the battlelink is from
			if (battlelink.includes("sports.psim.us")) {
				psServer = "Sports";
			} else if (battlelink.includes("automatthic.psim.us")) {
				psServer = "Automatthic";
			} else if (battlelink.includes("play.pokemonshowdown.com")) {
				psServer = "Showdown";
			} else if (battlelink.includes("dawn.psim.us")) {
				psServer = "Dawn";
			} else {
				channel.send(
					"This link is not a valid Pokemon Showdown battle url."
				);
				return;
			}

			channel.send("Joining the battle...");
			//Getting the rules
			let rulesId = await util.findRulesId(channel.id);
			let rules = await util.getRules(rulesId);
			//Instantiating the Showdown client
			const psclient = new Showdown(battlelink, psServer, message, rules);
			//Tracking the battle
			await new Promise(async (resolve, reject) => {
				await psclient.track();
				resolve();
			});
		}
	}

	if (msgStr.toLowerCase().startsWith(`${prefix} help`)) {
		let bicon = bot.user.displayAvatarURL;
		let helpEmbed = new Discord.RichEmbed()
			.setTitle("Porygon Commands")
			.setDescription(`Prefix: ${prefix} _______`)
			.setThumbnail(bicon)
			.setColor(0xffc0cb)
			.addField(
				"help",
				"How to use the bot, and lists the commands it has."
			)
			.addField(
				"mode",
				"Command to get started with the bot in your server."
			)
			.addField(
				"analyze [replay link]",
				"Analyzes a given PS replay link."
			)
			.addField(
				"rule",
				"Command to see what custom rules are available for kill attributions while collecting stats."
			)
			.addField(
				"rename",
				"Command to rename your league in the bot's database."
			)
			.addField(
				"delete",
				"Command to permanently delete your league from the database. THIS CANNOT BE UNDONE."
			)
			.addField("tri-attack", "kek")
			.addField("conversion", "even more kek");

		return channel.send(helpEmbed);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} mode`)) {
		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to set the mode of this league for you."
			);
		}
		bot.user.setActivity(`PS battles in ${bot.guilds.size} servers`, {
			type: "watching",
		});

		let mode;
		let discordMode = msgParams.split(" ")[0];
		let streamChannel = "";
		switch (discordMode) {
			case "-c":
				mode = "Channel";
				streamChannel = msgParams.split(" ")[1];
				break;
			case "-dm":
				mode = "DM";
				break;
			case "-default":
				mode = "";
				break;
			default:
				return channel.send(
					"Need help? Here we go!\n```This command is used to either set up a new league or change the updating method of an existing league. To use the command, type this:\nporygon, use mode [either -c, -dm, or -default] [optional extension] [optionally --combine] \n\n-c: match-results channel mode. This is where the bot will send your stats to a separate match-results channel. Make sure to link to the channel you want to be the match-results channel to the end of the message. \n-dm: author DM mode. This mode will DM the author of the original message that sent the live link with the stats.\n-default: default mode. This will just send the stats in the same channel that the link was sent. \n\nMake sure you send this command in the channel you want to make the live-links channel; its name also has to have either live-links or live-battles in it.\nAttach --combine at the end of your message if you would like passive and direct kills combined in your stats.```"
				);
		}

		let leagueInfo = await util.findLeagueId(channel.id);
		if (leagueInfo.id) {
			await base("Leagues").update([
				{
					id: leagueInfo.id,
					fields: {
						"Channel ID": channel.id,
						"Combine P/D?": msgParams.includes("--combine"),
						"Stream Channel ID": streamChannel.substring(
							2,
							streamChannel.length - 1
						),
						"Stats System": mode,
					},
				},
			]);

			console.log(
				`${leagueInfo.name}'s mode has been changed to ${
					mode ? mode : "Default"
				} mode!`
			);
			return channel.send(
				`\`${leagueInfo.name}\`'s mode has been changed to ${
					mode ? mode : "Default"
				} mode!`
			);
		} else {
			// Message Collector for the required info for the bot
			const filter = (m) => m.author === message.author;
			const collector = message.channel.createMessageCollector(filter, {
				max: 3,
			});

			await channel.send(
				"What is this league's name? [the whole of your next message will be taken as the league's name]"
			);
			collector.on("collect", async (m) => {
				let leagueName = m.content;
				base("Leagues").create([
					{
						fields: {
							Name: leagueName,
							"Channel ID": channel.id,
							"Combine P/D?": msgParams.includes("--combine"),
							"Stream Channel ID": streamChannel.substring(
								2,
								streamChannel.length - 1
							),
							"Stats System": mode,
						},
					},
				]);
				collector.stop();

				console.log(
					`${leagueName}'s mode has been changed to ${
						mode ? mode : "Default"
					} mode!`
				);
				return channel.send(
					`\`${leagueName}\`'s mode has been changed to ${
						mode ? mode : "Default"
					} mode!`
				);
			});
		}
	} else if (msgStr.toLowerCase().startsWith(`${prefix} analyze`)) {
		let link = msgParams + ".log";
		let response = await Axios.get(link);
		let data = response.data;

		//Getting the rules
		let rulesId = await util.findRulesId(channel.id);
		let rules = await util.getRules(rulesId);
		console.log(rules);

		let replayer = new ReplayTracker(msgParams, message, rules);
		channel.send("Analyzing...");
		await replayer.track(data);
		console.log(`${link} has been analyzed!`);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} rules`)) {
		//Getting the rules
		let rulesId = await util.findRulesId(channel.id);
		let rules = await util.getRules(rulesId);
		//Getting the league's info
		let leagueJson = await util.findLeagueId(channel.id);
		let leagueName = leagueJson.name;

		let rulesEmbed = new Discord.RichEmbed()
			.setTitle(`${leagueName}'s Rules`)
			.setDescription(
				`The rules that have been attributed to ${leagueName}.`
			)
			.setColor(0xffc0cb);

		for (let rule of Object.keys(rules)) {
			rulesEmbed.addField(
				rule,
				rules[rule] === "" ? "None" : rules[rule]
			);
		}

		return channel.send(rulesEmbed);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} rule`)) {
		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to add this person for you."
			);
		}

		let params = msgParams.split(" ");
		let rule = params[0];
		let category = "";
		switch (rule) {
			case "-recoil":
				category = "Recoil";
				break;
			case "-suicide":
				category = "Suicide";
				break;
			case "-ability":
			case "-item":
				category = "Ability/Item";
				break;
			case "-self":
			case "-team":
				category = "Self or Teammate";
				break;
			case "-db":
				category = "Destiny Bond";
				break;
			case "-spoiler":
				category = "Spoiler";
				break;
			case "-ping":
				category = "Ping";
				break;
			case "-forfeit":
				category = "Forfeit";
				break;
			case "-csv":
				category = "CSV";
				break;
			default:
				return channel.send(
					"Want to set some custom kill rules? Here we go!```This command is used to set custom kill rules for how each kill is attributed. You have to set each rule one at a time. The command is as follows:\nporygon, use rule [rule extension] [either none, passive, or direct]\n\nThese are the rule extensions:\n-recoil: sets the kill rule of a recoil death.\n-suicide: sets the kill rule of a suicide death.\n-ability or -item: sets the kill rule of a kill caused by an ability or item.\n-self or -team: sets the kill rule of a kill caused by itself or a teammate.\n-db: sets the kill rule of a Destiny Bond death.\n-spoiler: changes if stats are spoiler tagged. Instead of none/passive/direct, you have the option of true/false.\n-ping: sets a rule so that the bot @'s this ping when it starts tracking a match. Instead of none/passive/direct, you have to @ the ping at the end of the command. To remove this rule, run the command but instead of the ping, type remove.\n-forfeit: if a player forfeits, you can choose to have the 'deaths' of the forfeiter be attributed as direct, passive, or no kills to the last mon that was on the field.\n-csv: add true if you want the stats format to be in CSV form or false if you don't. Default is false.\n\nEnding the command with none means no pokemon gets a kill; with passive means a pokemon gets a passive kill; with direct means a pokemon gets a direct kill.```"
				);
		}
		let result =
			rule !== "-ping"
				? `${params[1].charAt(0).toUpperCase()}${params[1]
						.replace(params[1].charAt(0), "")
						.toLowerCase()}`
				: params[1];
		//If the mode is csv
		if (rule === "-csv") {
			result = rule === "-csv" && result === "True";
		}

		// Updating the rule in the database for the league
		let rulesId = await util.findRulesId(channel.id);
		let leagueJson = await util.findLeagueId(channel.id);
		let fields = { League: [leagueJson.id], "Channel ID": channel.id };
		fields[category] = result === "remove" ? "" : result;
		if (rulesId) {
			await base("Custom Rules").update([
				{
					id: rulesId,
					fields: fields,
				},
			]);

			console.log(
				`${leagueJson.name}'s ${category} property has been set to ${result}!`
			);
			return channel.send(
				`\`${leagueJson.name}\`'s ${category} property has been set to ${result}!`
			);
		} else {
			if (!leagueJson.id) {
				// Message Collector for the required info for the bot
				const filter = (m) => m.author === message.author;
				const collector = message.channel.createMessageCollector(
					filter,
					{
						max: 3,
					}
				);

				await channel.send(
					"What is this league's name? [the whole of your next message will be taken as the league's name]"
				);
				collector.on("collect", async (m) => {
					let leagueName = m.content;
					base("Leagues").create(
						[
							{
								fields: {
									Name: leagueName,
									"Channel ID": channel.id,
								},
							},
						],
						async (err, records) => {
							if (err) console.error(err);
							fields["League"] = [records[0].getId()];
							console.log(fields["League"]);

							collector.stop();

							await base("Custom Rules").create(
								[
									{
										fields: fields,
									},
								],
								async (err2, records2) => {
									if (err2) console.error(err2);
								}
							);

							console.log(
								`${leagueName}'s ${category} property has been set to ${result}!`
							);
							return channel.send(
								`\`${leagueName}\`'s ${category} property has been set to ${result}!`
							);
						}
					);
				});
			} else {
				await base("Custom Rules").create([
					{
						fields: fields,
					},
				]);

				console.log(
					`${leagueJson.name}'s ${category} property has been set to ${result}!`
				);
				return channel.send(
					`\`${leagueJson.name}\`'s ${category} property has been set to ${result}!`
				);
			}
		}
	} else if (msgStr.toLowerCase().startsWith(`${prefix} tri-attack`)) {
		let rand = Math.round(Math.random() * 5);
		let m = await channel.send("Porygon used Tri-Attack!");
		switch (rand) {
			case 1:
				return m.edit("Porygon used Tri-Attack! It burned the target!");
			case 2:
				return m.edit("Porygon used Tri-Attack! It froze the target!");
			case 3:
				return m.edit(
					"Porygon used Tri-Attack! It paralyzed the target!"
				);
			default:
				return m.edit(
					"Porygon used Tri-Attack! No secondary effect on the target."
				);
		}
	} else if (msgStr.toLowerCase().startsWith(`${prefix} conversion`)) {
		let rand = Math.round(Math.random() * (17 - 0 + 1) + 0);
		let type = "";
		switch (rand) {
			case 0:
				type = "Bug";
				break;
			case 1:
				type = "Dark";
				break;
			case 2:
				type = "Dragon";
				break;
			case 3:
				type = "Electric";
				break;
			case 4:
				type = "Fairy";
				break;
			case 5:
				type = "Fighting";
				break;
			case 6:
				type = "Fire";
				break;
			case 7:
				type = "Flying";
				break;
			case 8:
				type = "Ghost";
				break;
			case 9:
				type = "Grass";
				break;
			case 10:
				type = "Ground";
				break;
			case 11:
				type = "Ice";
				break;
			case 12:
				type = "Normal";
				break;
			case 13:
				type = "Poison";
				break;
			case 14:
				type = "Psychic";
				break;
			case 15:
				type = "Rock";
				break;
			case 16:
				type = "Steel";
				break;
			case 17:
				type = "Water";
				break;
		}
		return channel.send(
			`Porygon used Conversion! Porygon's type changed to ${type}!`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} rename`)) {
		if (!channels.includes(channel.id)) {
			return channel.send(":x: This is not a valid live-links channel.");
		}
		const newName = msgParams;

		//Getting league info
		const leagueJson = await utils.findLeagueId(channel.id);
		const leagueId = leagueJson.id;
		const oldLeagueName = leagueJson.name;

		//Updating the league's record with the new name
		await base("Leagues").update(
			[
				{
					id: leagueId,
					fields: {
						Name: newName,
					},
				},
			],
			(err, records) => {
				console.log(
					`Changed this league's name from ${oldLeagueName} to ${newName}!`
				);
			}
		);

		return channel.send(
			`Changed this league's name from \`${oldLeagueName}\` to \`${newName}\`!`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} delete`)) {
		if (!channels.includes(channel.id)) {
			return channel.send(":x: This is not a valid live-links channel.");
		}

		//Getting league info
		const leagueJson = await utils.findLeagueId(channel.id);
		//Getting rules info
		const rulesId = await utils.findRulesId(channel.id);

		//Asking for confirmation
		const filter = (m) => m.author === message.author;
		const collector = message.channel.createMessageCollector(filter, {
			max: 3,
		});
		await channel.send(
			`Are you sure you want to delete \`${leagueJson.name}\` from the database? All your custom rules and modes will be deleted and cannot be undone (respond with "yes").`
		);
		collector.on("collect", (m) => {
			if (m.content.toLowerCase() === "yes") {
				/* Deleting the rules record first. */
				base("Custom Rules").destroy(
					[rulesId],
					(err, deletedRecords) => {
						console.log(
							`${leagueJson.name}'s custom rules have been deleted`
						);
					}
				);
				/* Deleting the leagues record next. */
				base("Leagues").destroy(
					[leagueJson.id],
					(err, deletedRecords) => {
						console.log(
							`${leagueJson.name}'s league has been deleted.`
						);
					}
				);

				channel.send(
					`\`${leagueJson.name}\`'s records have been deleted from the Porygon database permanently.`
				);
			}
		});
	}
});

bot.login(token);

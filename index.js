//actual bot goes here
const Discord = require("discord.js");
const Airtable = require("airtable");
const getUrls = require("get-urls");
const Showdown = require("./tracker/Showdown");

//Getting config info
const { token, airtable_key, base_id } = require("./config.json");
//Creating the bot
const bot = new Discord.Client({ disableEveryone: true });

//When the bot is connected and logged in to Discord
bot.on("ready", async () => {
	console.log(`${bot.user.username} is online!`);
	bot.user.setActivity(`PS battles`, { type: "watching" });
});

const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

//Getting the list of available channels
const getChannels = async () => {
	let channels = [];
	await base("Leagues")
		.select({
			maxRecords: 50,
			view: "Grid view",
		})
		.all()
		.then((records) => {
			records.forEach(async (record) => {
				let channelId = await record.get("Channel ID");
				channels.push(channelId);
			});
		});

	return channels;
};

const findLeagueId = async (checkChannelId) => {
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
	return leagueJson;
};

const getPlayersIds = async (leagueId) => {
	let recordsIds = await new Promise((resolve, reject) => {
		base("Leagues").find(leagueId, (err, record) => {
			if (err) reject(err);

			recordIds = record.get("Players");
			resolve(recordIds);
		});
	});

	return recordsIds;
};

//When a message is sent
bot.on("message", async (message) => {
	let channel = message.channel;
	let channels = await getChannels();

	if (message.author.bot) return;

	let msgStr = message.content;
	let msgParams = msgStr.split(" ").slice(3).join(" "); //["porygon,", "use", "command", ...params]
	let prefix = "porygon, use";

	if (channel.type === "dm") return;
	else if (channels.includes(channel.id)) {
		//Extracting battlelink from the message
		let urls = getUrls(msgStr).values(); //This is because getUrls returns a Set
		let battlelink = urls.next().value;
		if (battlelink) {
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
			//Instantiating the Showdown client
			const psclient = new Showdown(battlelink, psServer, message);
			//Tracking the battle
			let battleInfo = await new Promise(async (resolve, reject) => {
				resolve(await psclient.track());
			}).then(() => {
				console.log("Tracking done!");
			});
		}
	}

	if (msgStr.toLowerCase().startsWith(`${prefix} help`)) {
		let bicon = bot.user.displayAvatarURL;
		if (msgStr.endsWith("commands")) {
			let helpEmbed = new Discord.RichEmbed()
				.setTitle("Porygon Commands")
				.setDescription(`Prefix: ${prefix} _______`)
				.setThumbnail(bicon)
				.setColor(0xffc0cb)
				.addField(
					'help [optional: "commands"]',
					"How to use the bot, and lists the commands it has."
				)
				.addField(
					"setup",
					"The setup command for servers who are new to Porygon. You have to send this command in the live links channel you want to use for the league you are setting up"
				)
				.addField(
					"add [Showdown name] --r=[Range to be updated on Sheet]",
					'Adds a player to the database of the league whose live links channel the command is sent in. If the "--r=" field is provided, it updates the range of the player\'s stats in the Google Sheet as well.'
				)
				.addField(
					"remove [Showdown name]",
					"Removes a player from the database of the league whose live links channel the command is sent in."
				)
				.addField(
					"edit [old Showdown name] --nn=[new Showdown name] --r=[optional Sheet range]",
					"Edits the given player's Showdown name and, optionally, the player's Sheet range."
				)
				.addField(
					"list",
					"Lists the players of the league whose live links channel the command is sent in."
				);

			return channel.send(helpEmbed);
		}
		let helpEmbed = new Discord.RichEmbed()
			.setTitle("Porygon Help")
			.setThumbnail(bicon)
			.setColor(0xffc0cb)
			.addField("Prefix", `${prefix} _____`)
			.addField(
				"What does Porygon do? ",
				"It joins a Pokemon Showdown battle when the live battle link is sent to a dedicated channel and keeps track of the deaths/kills in the battle."
			)
			.addField(
				"How do I use Porygon?",
				`Make a dedicated live-battle-links channel, invite the bot, fill out the online dashboard (coming soon!), and start battling!!`
			)
			.addField("Source", "https://github.com/PorygonBot/bot")
			.setFooter(
				"Made by @harbar20#9389",
				`https://pm1.narvii.com/6568/c5817e2a693de0f2f3df4d47b0395be12c45edce_hq.jpg`
			);

		return channel.send(helpEmbed);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} add`)) {
		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to add this person for you."
			);
		}
		if (!channels.includes(channel.id)) {
			return channel.send(
				":x: This is not a valid live-links channel. Try this command again in the proper channel."
			);
		}

		//Getting info from the command
		const rangeParams = msgParams.split(" --r=");
		let player = rangeParams[0];
		let range = rangeParams[1] ? rangeParams[1].split("--")[0] : "";

		//Finding the league that the player is going to get added to
		let leagueJson = await findLeagueId(channel.id);
		let leagueRecordId = leagueJson.id;
		let leagueName = leagueJson.name;
		let playersIds = await getPlayersIds(leagueRecordId);

		//Checking if the player is already in the database
		let funcarr = [];
		let isIn = false;
		for (let playerId of playersIds) {
			funcarr.push(
				new Promise((resolve, reject) => {
					base("Players").find(playerId, async (err, record) => {
						if (err) reject(err);

						let recordName = await record.get("Showdown Name");
						if (recordName.toLowerCase() === player.toLowerCase()) {
							isIn = true;
						}

						resolve();
					});
				})
			);
		}
		await Promise.all(funcarr);
		if (isIn) {
			return message.channel.send(
				`${player} is already in this league's database!`
			);
		}

		//Creates a new record for the player
		await base("Players").create([
			{
				fields: {
					"Showdown Name": player,
					Leagues: [leagueRecordId],
					Range: range,
				},
			},
		]);

		console.log(`${player} has been added to ${leagueName}!`);
		return channel.send(
			`\`${player}\` has been added to \`${leagueName}\`!`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} remove`)) {
		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to remove this person for you."
			);
		}
		if (!channels.includes(channel.id)) {
			return channel.send(
				":x: This is not a valid live-links channel. Try this command again in the proper channel."
			);
		}

		//Finding the league that the player is going to get added to
		let player = msgParams;
		let leagueJson = await findLeagueId(channel.id);
		let leagueRecordId = leagueJson.id;
		let leagueName = leagueJson.name;
		let playersIds = await getPlayersIds(leagueRecordId);

		//Checking if the player is already in the database
		let funcarr = [];
		let isIn = false;
		let realPlayerId;
		for (let playerId of playersIds) {
			funcarr.push(
				new Promise((resolve, reject) => {
					base("Players").find(playerId, async (err, record) => {
						if (err) reject(err);

						let recordName = await record.get("Showdown Name");
						if (recordName.toLowerCase() === player.toLowerCase()) {
							isIn = true;
							realPlayerId = playerId;
						}

						resolve();
					});
				})
			);
		}
		await Promise.all(funcarr);
		if (!isIn) {
			return message.channel.send(
				`\`${player}\` is not in this league's database!`
			);
		}

		//Creates a new record for the player
		await base("Players").destroy([realPlayerId], (err, deletedRecords) => {
			if (err) console.error(err);
		});

		console.log(`${player} has been removed from ${leagueName}!`);
		return channel.send(
			`\`${player}\` has been removed from \`${leagueName}\`!`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} edit`)) {
		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to edit this person for you."
			);
		}
		if (!channels.includes(channel.id)) {
			return channel.send(
				":x: This is not a valid live-links channel. Try this command again in the proper channel."
			);
		}

		//Getting info from the command
		// let nnParams = msgParams.split(" --nn=");
		// let oldName = nnParams[0];
		// let newName;
		// let range = "";
		// if (nnParams[1].includes(" --r=")) {
		// 	let rParams = nnParams[1].split(" --r=");
		// 	newName = rParams[0];
		// 	range = rParams[1];
		// } else {
		// 	newName = nnParams[1];
		// }
		// Getting info from the command
		let oldName;
		let newName;
		let range;
		if (msgParams.includes("--nn=") && msgParams.includes("--r=")) {
			// Both are given
			let nnParams = msgParams.split(" --nn=");
			oldName = nnParams[0];
			let rParams = nnParams[1].split(" --r=");
			newName = rParams[0];
			range = rParams[1];
		} else if (msgParams.includes("--nn=")) {
			let nnParams = msgParams.split(" --nn=");
			oldName = nnParams[0];
			newName = nnParams[1];
			range = "None";
		} else if (msgParams.includes("--r=")) {
			let rParams = msgParams.split(" --r=");
			oldName = rParams[0];
			newName = oldName;
			range = rParams[1];
		}

		//Updates the record in the database
		//Finding the league that the player is going to get edited in
		let leagueJson = await findLeagueId(channel.id);
		let leagueRecordId = leagueJson.id;
		let leagueName = leagueJson.name;
		let playersIds = await getPlayersIds(leagueRecordId);

		//Finding the player's recordId
		let funcarr = [];
		let recordId = "";
		for (let playerId of playersIds) {
			funcarr.push(
				new Promise((resolve, reject) => {
					base("Players").find(playerId, async (err, record) => {
						if (err) reject(err);

						let recordName = await record.get("Showdown Name");
						if (
							recordName.toLowerCase() === oldName.toLowerCase()
						) {
							recordId = playerId;
						}

						resolve();
					});
				})
			);
		}
		await Promise.all(funcarr);
		//Editing the record
		base("Players").update([
			{
				id: recordId,
				fields: {
					"Showdown Name": newName,
					Range: range,
				},
			},
		]);

		//Edited!
		console.log(
			`Edited ${oldName} to become ${newName} in ${leagueName} with ${range} range.`
		);
		message.channel.send(
			`Edited \`${oldName}\` to become \`${newName}\` in \`${leagueName}\ with \`${range}\` range!`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} list`)) {
		if (!channels.includes(channel.id)) {
			return channel.send(
				":x: This is not a valid live-links channel. Try this command again in the proper channel."
			);
		}
		let leagueJson = await findLeagueId(channel.id);
		let playersIds = await getPlayersIds(leagueJson.id);

		let players = [];
		let funcarr = [];
		for (let playerId of playersIds) {
			funcarr.push(
				new Promise(async (resolve, reject) => {
					await base("Players").find(
						playerId,
						async (err, record) => {
							if (err) reject(err);

							let name = await record.get("Showdown Name");
							players.push(`\n${name}`);
							resolve();
						}
					);
				})
			);
		}
		await Promise.all(funcarr);
		playersStr = players.join();

		//const serverImage = message.guild.iconURL();
		//console.log(serverImage);
		const listEmbed = new Discord.RichEmbed()
			.setTitle(leagueJson.name)
			.addField("Players", playersStr);

		return channel.send(listEmbed);
	}
});

bot.login(token);

const { Client, Message } = require("discord.js");
const getUrls = require("get-urls");
const axios = require("axios");

const Showdown = require("../../tracker/Showdown");
const ReplayTracker = require("../../tracker/ReplayTracker");
const Battle = require("../../tracker/Battle");
const utils = require("../../utils");

/**
 * When a message is sent
 * @param {Client} client
 * @param {Message} message
 */
module.exports = async (client, message) => {
	const channel = message.channel;
	const msgStr = message.content;
	const prefix = "porygon, use ";

	//If it's a DM, analyze the replay
	if (channel.type === "dm") {
		if (msgStr.includes("replay.pokemonshowdown.com") && message.author.id !== client.user.id) {
			let urls = getUrls(msgStr).values(); //This is because getUrls returns a Set
			let arg = await urls.next().value;

			let link = arg + ".log";
			console.log(link)
			let response = await axios.get(link, {
				headers: { "User-Agent": "PorygonTheBot" },
			}).catch(e => console.error(e));
			let data = response.data;

			//Getting the rules
			let rulesId = await utils.findRulesId(channel.id);
			let rules = await utils.getRules(rulesId);

			let replayer = new ReplayTracker(arg, message, rules);
			await replayer.track(data);
			console.log(`${link} has been analyzed!`);
		}
	} else if (
		channel.name.includes("live-links") ||
		channel.name.includes("live-battles")
	) {
		//Extracting battlelink from the message
		let urls = getUrls(msgStr).values(); //This is because getUrls returns a Set
		let battlelink = await urls.next().value;
		let battleID = battlelink && battlelink.split("/")[3];

		if (Battle.battles.includes(battleID)) {
			return channel.send(
				`:x: I'm already tracking this battle. If you think this is incorrect, send a replay of this match in the #bugs-and-help channel in the Porygon server.`
			);
		}
		if (
			battlelink &&
			!(
				battlelink.includes("google") ||
				battlelink.includes("replay") ||
				battlelink.includes("draft-league.nl") ||
				battlelink.includes("porygonbot.xyz")
			)
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
			} else if (battlelink.includes("drafthub.psim.us")) {
				psServer = "Drafthub";
			} else if (battlelink.includes("clover.weedl.es")) {
				psServer = "Clover";
			} else {
				channel.send(
					"This link is not a valid Pokemon Showdown battle url."
				);
				return;
			}

			//Getting the rules
			let rulesId = await utils.findRulesId(channel.id);
			let rules = await utils.getRules(rulesId);

			if (!rules.stopTalking)
				await channel
					.send("Joining the battle...")
					.catch((e) => console.error(e));

			Battle.incrementBattles(battleID);
			client.user.setActivity(
				`${Battle.numBattles} PS Battles in ${client.guilds.cache.size} servers.`,
				{
					type: "WATCHING",
				}
			);
			//Instantiating the Showdown client
			const psclient = new Showdown(
				battleID,
				psServer,
				message,
				rules,
				client
			);
			//Tracking the battle
			await new Promise(async (resolve, reject) => {
				await psclient.track();
				resolve();
			});
		}
	}
	// Checks if the Message contains the Prefix at the start.
	if (message.content.toLowerCase().startsWith(prefix)) {
		//Getting info from the message if it's not a live link
		const args = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();

		//Running commands as normal
		const command =
			client.commands.get(commandName) ||
			client.commands.find(
				(cmd) => cmd.aliases && cmd.aliases.includes(commandName)
			);

		if (!command) return;

		try {
			await command.execute(message, args, client);
		} catch (error) {
			console.error(error);
			message.reply("There was an error trying to execute that command!");
		}
	}
};

const { Client, Message } = require("discord.js");
const getUrls = require("get-urls");
const Showdown = require("../../tracker/Showdown");
const utils  = require('../../utils');
/**
 * When a message is sent
 * @param {Client} client 
 * @param {Message} message 
 */
module.exports = async (client, message) => {
	const channel = message.channel;
	const msgStr = message.content;
	const prefix = "porygon, use ";

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
			let rulesId = await utils.findRulesId(channel.id);
			let rules = await utils.getRules(rulesId);
			//Instantiating the Showdown client
			const psclient = new Showdown(battlelink, psServer, message, rules);
			//Tracking the battle
			await new Promise(async (resolve, reject) => {
				await psclient.track();
				resolve();
			});
		}
	}
	// Checks if the Message contains the Prefix at the start.
	if(message.content.startsWith(prefix))
	{
	//Getting info from the message if it's not a live link
	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	//Running commands as normal
	const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
	
	if(!command) return;

	try {
		await command.execute(message, args);
	} catch(error) {
		console.error(error);
		message.reply("There was an error trying to execute that command!");
	}
	}
}

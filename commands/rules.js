const Discord = require("discord.js");
const utils = require("../utils");

module.exports = {
	name: "rules",
	description: "Gets a list of the custom kill rules that a league has set.",
	async execute(message, args, client) {
		const channel = message.channel;

		//Getting the rules
		let rulesId = await utils.findRulesId(channel.id);
		let rules = await utils.getRules(rulesId);
		//Getting the league's info
		let leagueJson = await utils.findLeagueId(channel.id);
		let leagueName = leagueJson.name;

		let rulesEmbed = new Discord.MessageEmbed()
			.setTitle(`${leagueName}'s Rules`)
			.setDescription(
				`The rules that have been attributed to ${leagueName}.`
			)
			.setColor(0xffc0cb);

		for (let rule of Object.keys(rules)) {
			rulesEmbed.addField(
				rule,
				rules[rule] === "" ? "None" : rules[rule] || false
			);
		}

		return channel.send(rulesEmbed);
	},
};

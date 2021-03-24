const axios = require("axios");
const utils = require("../utils");
const ReplayTracker = require("../tracker/ReplayTracker");

module.exports = {
	name: "analyze",
	description: "Analyzes Pokemon Showdown replays.",
	aliases: ["analyse"],
	usage: "[replay link]",
	async execute(message, args, client) {
		const channel = message.channel;

		channel.send("Analyzing...");
		for (let arg of args) {
			let link = arg + ".log";
			let response = await axios.get(link, {
				headers: { "User-Agent": "PorygonTheBot" },
			});
			let data = response.data;

			//Getting the rules
			let rulesId = await utils.findRulesId(channel.id);
			let rules = await utils.getRules(rulesId);

			let replayer = new ReplayTracker(arg, message, rules);
			await replayer.track(data);
			console.log(`${link} has been analyzed!`);
		}
	},
};

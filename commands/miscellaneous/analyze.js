const axios = require('axios');
const utils = require('../../utils');
const ReplayTracker = require('../../tracker/ReplayTracker');

module.exports =  {
	name: "analyze",
	aliases: ['analyse'],
    description: "Analyze replays instead of live links.",
    async execute(message, args) {
        const channel = message.channel;
        
        let link = args[0] + ".log";
		let response = await axios.get(link);
		let data = response.data;

		//Getting the rules
		let rulesId = await utils.findRulesId(channel.id);
		let rules = await utils.getRules(rulesId);
		console.log(rules);

		let replayer = new ReplayTracker(args[0], message, rules);
		channel.send("Analyzing...");
		await replayer.track(data);
		console.log(`${link} has been analyzed!`);
    }
}
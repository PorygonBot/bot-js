const axios = require('axios');
const utils = require('../utils');
const ReplayTracker = require('../tracker/ReplayTracker');

module.exports =  {
    name: "analyze",
    description: "Analyze replays instead of live links.",
    aliases: ['analyse'],
    async execute(message, args) {
        const channel = message.channel;
		
		channel.send("Analyzing...");
		for (let arg of args) {
			let link = arg + ".log";
			let response = await axios.get(link);
			let data = response.data;
	
			//Getting the rules
			let {combinePD} = await utils.findLeagueId(channel.id);
			let rulesId = await utils.findRulesId(channel.id);
			let rules = await utils.getRules(rulesId);
			rules.combinePD = combinePD;
	
			let replayer = new ReplayTracker(arg, message, rules);
			await replayer.track(data);
			console.log(`${link} has been analyzed!`);
		}
    }
}

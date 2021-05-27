//Setting up process.env
require("dotenv").config();
//Importing all required modules
const { Client, Collection } = require("discord.js");
const axios = require("axios");
const utils = require("./utils.js");
const ReplayTracker = require("./tracker/ReplayTracker")

const client = new Client({ disableMentions: "everyone" });
// Initializing The commands Collection.
["commands"].forEach((x) => (client[x] = new Collection()));
// Calling on the event.js & command.js files to load events and commands.
["event", "command"].forEach((x) => require(`./handlers/${x}`)(client));

//Websocket for listening for interactions for slash commands
client.ws.on("INTERACTION_CREATE", async (interaction) => {
	let link = interaction.data.options[0].value + ".log";
	let response = await axios
		.get(link, {
			headers: { "User-Agent": "PorygonTheBot" },
		})
		.catch((e) => console.error(e));
	let data = response.data;

	//Getting the rules
	let rulesId = await utils.findRulesId(interaction.channel_id);
	let rules = await utils.getRules(rulesId);
    rules.isSlash = true;
    
    const messagePlaceholder = {
        channel: {
            async send(message) {
                return message;
            }
        }
    }

	let replayer = new ReplayTracker(interaction.data.options[0].value, messagePlaceholder, rules, interaction);
	await replayer.track(data, client);
	console.log(`${link} has been analyzed!`);
});

// Log the bot in.
client.login(process.env.TOKEN);

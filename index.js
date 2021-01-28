//Setting up process.env
require("dotenv").config();
//Importing all required modules
const { Client, Collection } = require("discord.js");

const client = new Client({ disableMentions: "everyone" });
// Initializing The commands Collection.
["commands"].forEach((x) => (client[x] = new Collection()));
// Calling on the event.js & command.js files to load events and commands.
["event", "command"].forEach((x) => require(`./handlers/${x}`)(client));

// Login the bot in.
client.login(process.env.TOKEN);

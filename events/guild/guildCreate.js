const { Client, Guild } = require("discord.js");

/**
 * When the client joins a new server
 * @param {Client} client 
 * @param {Guild} guild 
 */
module.exports = (client, guild) => {
	client.user.setActivity(`PS Battles in ${client.guilds.size} servers.`, {
		type: "Watching",
	});
}

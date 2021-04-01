const { Client, Guild } = require("discord.js");

const Battle = require("../../tracker/Battle");

/**
 * When the client joins a new server
 * @param {Client} client 
 * @param {Guild} guild 
 */
module.exports = (client, guild) => {
	client.user.setActivity(`${/*Battle.numBattles*/ 69} PS Battles in ${/*client.guilds.cache.size*/ 420} servers.`, {
		type: "WATCHING",
	});
}

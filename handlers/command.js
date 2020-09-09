const { Client } = require("discord.js");
const { readdirSync } = require("fs");

/**
 * Loads all of the commands in the command Folder in their respected folders.
 * @param {Client} client
 */
module.exports = (client) => {
	const load = (dir) => {
		const commands = readdirSync(`./commands/${dir}`).filter((d) =>
			d.endsWith(".js")
		);
		for (let file of commands) {
			const command = require(`../commands/${dir}/${file}`);
			client.commands.set(command.name, command);
		}
	};
	["miscellaneous"].forEach((x) => load(x));
};

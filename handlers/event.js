const { Client } = require("discord.js");
const { readdirSync } = require("fs");

/**
 * Loads all the events in the event folder under their respected Folders.
 * @param {Client} client 
 */
module.exports = (client) => {
	const load = (dir) => {
		const events = readdirSync(`./events/${dir}`).filter(d => d.endsWith(".js"));
		for(let file of events) {
			let evt = require(`../events/${dir}/${file}`);
			let eName = file.split(".")[0];
			client.on(eName, evt.bind(null, client));
		}
	}
	["client", "guild"].forEach(x => load(x));
}
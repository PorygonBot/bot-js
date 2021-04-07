const { Client, Guild } = require("discord.js");
const Airtable = require("airtable");
const utils = require("../../utils");
const util = require("../../utils");

// You should move this to be all in one file,
// so you can call on one method, instead of
// rewritting the same thing.
const airtable_key = process.env.AIRTABLE_KEY;
const base_id = process.env.BASE_ID;
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

const Battle = require("../../tracker/Battle");

/**
 * When the client leaves/gets kicked from a server
 * @param {Client} client
 * @param {Guild} guild
 */
module.exports = async (client, guild) => {
	//Getting the channels that this server has
	const channels = await utils.getChannels();
	const toDelete = [];
	for (let channel of channels) {
		if (util.getChannel(guild, channel)) {
			toDelete.push(channel);
		}
	}

	//Deleting the records for those channels, but Custom Rules and Leagues
	for (let channel of toDelete) {
		const leagueJson = await utils.findLeagueId(channel);
		const rulesId = await utils.findRulesId(channel);
		/* Deleting the rules record first. */
		base("Custom Rules").destroy([rulesId], (err, deletedRecords) => {
			console.log(`${leagueJson.name}'s custom rules have been deleted`);
		});
		/* Deleting the leagues record next. */
		base("Leagues").destroy([leagueJson.id], (err, deletedRecords) => {
			console.log(`${leagueJson.name}'s league has been deleted.`);
		});
	}

	client.user.setActivity(
		`${Battle.numBattles} PS Battles in ${client.guilds.cache.size} servers.`,
		{
			type: "WATCHING",
		}
	);
};

const Airtable = require("airtable");
const utils = require("../utils");
const airtable_key = process.env.AIRTABLE_KEY;
const base_id = process.env.BASE_ID;
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

module.exports = {
	name: "delete",
	description: "Deletes the league's record from the Porygon database",
	async execute(message, args, client) {
		const channel = message.channel;
		const channels = await utils.getChannels();
		if (!channels.includes(channel.id)) {
			return channel.send(":x: This is not a valid live-links channel.");
		}

		//Getting league info
		const leagueJson = await utils.findLeagueId(channel.id);
		//Getting rules info
		const rulesId = await utils.findRulesId(channel.id);

		//Asking for confirmation
		const filter = (m) => m.author === message.author;
		const collector = channel.createMessageCollector(filter, {
			max: 3,
		});
		await channel.send(
			`Are you sure you want to delete \`${leagueJson.name}\` from the database? All your custom rules and modes will be deleted and cannot be undone (respond with "yes").`
		);
		collector.on("collect", async (m) => {
			if (m.content.toLowerCase() === "yes") {
				/* Deleting the rules record first. */
				base("Custom Rules").destroy(
					[rulesId],
					(err, deletedRecords) => {
						console.log(
							`${leagueJson.name}'s custom rules have been deleted`
						);
					}
				);
				/* Deleting the leagues record next. */
				base("Leagues").destroy(
					[leagueJson.id],
					(err, deletedRecords) => {
						console.log(
							`${leagueJson.name}'s league has been deleted.`
						);
					}
				);

				channel.send(
					`\`${leagueJson.name}\`'s records have been deleted from the Porygon database permanently.`
				);
			}
		});
	},
};

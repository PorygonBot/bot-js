const Airtable = require("airtable");
const utils = require("../utils");
const airtable_key = process.env.AIRTABLE_KEY;
const base_id = process.env.BASE_ID;
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

module.exports = {
	name: "rename",
    description: "Renames your league in the Porygon database",
    usage: "[new name, including spaces and all special characters]",
	async execute(message, args, client) {
		const channel = message.channel;
		const channels = await utils.getChannels();
		if (!channels.includes(channel.id)) {
			return channel.send(":x: This is not a valid live-links channel.");
		}
		const newName = args.join(" ");

		//Getting league info
		const leagueJson = await utils.findLeagueId(channel.id);
		const leagueId = leagueJson.id;
		const oldLeagueName = leagueJson.name;

		//Updating the league's record with the new name
		await base("Leagues").update(
			[
				{
					id: leagueId,
					fields: {
						Name: newName,
					},
				},
			],
			(err, records) => {
				console.log(
					`Changed this league's name from ${oldLeagueName} to ${newName}!`
				);
			}
		);

		return channel.send(
			`Changed this league's name from \`${oldLeagueName}\` to \`${newName}\`!`
		);
	},
};

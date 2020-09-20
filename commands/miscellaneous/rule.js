const Airtable = require('airtable');;
const utils = require('../../utils');;
const airtable_key = process.env.AIRTABLE_KEY;
const base_id = process.env.BASE_ID;
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

module.exports =  {
    name: "rule",
    description: "Creates a custom kill rule depending on the parameters. Run command without parameters for more info.",
    async execute(message, args) {
		const channel = message.channel;

        if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to add this person for you."
			);
		}

		let rule = args[0];
		let category = "";
		switch (rule) {
			case "-recoil":
				category = "Recoil";
				break;
			case "-suicide":
				category = "Suicide";
				break;
			case "-ability":
			case "-item":
				category = "Ability/Item";
				break;
			case "-self":
			case "-team":
				category = "Self or Teammate";
				break;
			case "-db":
				category = "Destiny Bond";
				break;
			case "-spoiler":
				category = "Spoiler";
				break;
			case "-ping":
				category = "Ping";
				break;
			case "-forfeit":
				category = "Forfeit";
				break;
			case "-format":
				category = "Format";
				break;
			default:
				return channel.send(
					"Want to set some custom kill rules? Here we go!```This command is used to set custom kill rules for how each kill is attributed. You have to set each rule one at a time. The command is as follows:\nporygon, use rule [rule extension] [either none, passive, or direct]\n\nThese are the rule extensions:\n-recoil: sets the kill rule of a recoil death.\n-suicide: sets the kill rule of a suicide death.\n-ability or -item: sets the kill rule of a kill caused by an ability or item.\n-self or -team: sets the kill rule of a kill caused by itself or a teammate.\n-db: sets the kill rule of a Destiny Bond death.\n-spoiler: changes if stats are spoiler tagged. Instead of none/passive/direct, you have the option of true/false.\n-ping: sets a rule so that the client @'s this ping when it starts tracking a match. Instead of none/passive/direct, you have to @ the ping at the end of the command. To remove this rule, run the command but instead of the ping, type remove.\n-forfeit: if a player forfeits, you can choose to have the 'deaths' of the forfeiter be attributed as direct, passive, or no kills to the last mon that was on the field.\n-format: add csv if you want the stats format to be in CSV form, sheets if you don't, default if you want the default. Default is false.\n\nEnding the command with none means no pokemon gets a kill; with passive means a pokemon gets a passive kill; with direct means a pokemon gets a direct kill.```"
				);
		}
		let result =
			rule !== "-ping"
				? `${args[1].charAt(0).toUpperCase()}${args[1]
						.replace(args[1].charAt(0), "")
						.toLowerCase()}`
				: args[1];

		// Updating the rule in the database for the league
		let rulesId = await utils.findRulesId(channel.id);
		let leagueJson = await utils.findLeagueId(channel.id);
		let fields = { League: [leagueJson.id], "Channel ID": channel.id };
		fields[category] = result === "remove" ? "" : result;
		if (rulesId) {
			await base("Custom Rules").update([
				{
					id: rulesId,
					fields: fields,
				},
			]);

			console.log(
				`${leagueJson.name}'s ${category} property has been set to ${result}!`
			);
			return channel.send(
				`\`${leagueJson.name}\`'s ${category} property has been set to ${result}!`
			);
		} else {
			if (!leagueJson.id) {
				// Message Collector for the required info for the client
				const filter = (m) => m.author === message.author;
				const collector = message.channel.createMessageCollector(
					filter,
					{
						max: 3,
					}
				);

				await channel.send(
					"What is this league's name? [the whole of your next message will be taken as the league's name]"
				);
				collector.on("collect", async (m) => {
					let leagueName = m.content;
					base("Leagues").create(
						[
							{
								fields: {
									Name: leagueName,
									"Channel ID": channel.id,
								},
							},
						],
						async (err, records) => {
							if (err) console.error(err);
							fields["League"] = [records[0].getId()];
							console.log(fields["League"]);

							collector.stop();

							await base("Custom Rules").create(
								[
									{
										fields: fields,
									},
								],
								async (err2, records2) => {
									if (err2) console.error(err2);
								}
							);

							console.log(
								`${leagueName}'s ${category} property has been set to ${result}!`
							);
							return channel.send(
								`\`${leagueName}\`'s ${category} property has been set to ${result}!`
							);
						}
					);
				});
			} else {
				await base("Custom Rules").create([
					{
						fields: fields,
					},
				]);

				console.log(
					`${leagueJson.name}'s ${category} property has been set to ${result}!`
				);
				return channel.send(
					`\`${leagueJson.name}\`'s ${category} property has been set to ${result}!`
				);
			}
		}
    }
}
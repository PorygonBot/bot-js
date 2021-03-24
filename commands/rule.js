const Discord = require("discord.js");
const Airtable = require("airtable");
const utils = require("../utils");
const airtable_key = process.env.AIRTABLE_KEY;
const base_id = process.env.BASE_ID;
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

module.exports = {
	name: "rule",
	description:
		"Creates a custom kill rule depending on the parameters. Run command without parameters for more info.",
	usage: "[rule name with hyphen] [parameter]",
	async execute(message, args, client) {
		const channel = message.channel;

		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to add this person for you."
			);
		}

		let rulesId = await utils.findRulesId(channel.id);
		let leagueJson = await utils.findLeagueId(channel.id);

		const ruleEmbed = new Discord.MessageEmbed()
			.setTitle("Rule Command Help")
			.setDescription(
				"This command is used to set custom kill rules for how each kill is attributed. You can add multiple rules in the same message. The command is as follows:\nporygon, use rule [rule extension] [option]\n\nThese are the rule extensions: "
			)
			.setColor(0xffc0cb)
			.addField(
				"-recoil",
				"sets the kill rule of a recoil death.\nOptions: none (no kill), passive (passive kill), direct (direct kill)."
			)
			.addField(
				"-suicide",
				"sets the kill rule of a suicide death.\nOptions: none, passive, direct."
			)
			.addField(
				"-ability or -item",
				"sets the kill rule of a kill caused by an ability or item.\nOptions: none, passive, direct."
			)
			.addField(
				"-self or -team",
				"sets the kill rule of a kill caused by itself or a teammate.\nOptions: none, passive, direct."
			)
			.addField(
				"-db",
				"sets the kill rule of a Destiny Bond death.\nOptions: none, passive, direct."
			)
			.addField(
				"-spoiler",
				"changes if stats are spoiler tagged.\nOptions: true, false."
			)
			.addField(
				"-forfeit",
				"sets the type of kills attributed after a forfeit.\nOptions: none, passive, direct."
			)
			.addField(
				"-ping",
				"sets a rule so that the client @'s this ping when it starts tracking a match.\nOptions: none, @ping."
			)
			.addField(
				"-format",
				"changes the way stats are formatted when outputted.\nOptions: csv (comma-separated), sheets (space-separated), tour, default."
			)
			.addField(
				"-quirks",
				"sets whether you want quirky messages sent by the bot or not.\nOptions: true, false."
			)
			.addField(
				"-pingtime",
				"sets when you want the bot to ping, if at all.\nOptions: sent (immediately after the link is sent), first (immediately as the first turn starts)."
			)
			.addField(
				"-notalk",
				"sets whether you want the bot to not talk while analyzing a live battle.\nOptions: true, false."
			)
			.addField(
				"-tb",
				"sets whether you want extra tidbits in the stats message (replay, history link, etc.).\nOptions: true, false."
			)
			.addField(
				"-combine",
				"sets whether you want passive and direct kills combined or separated.\nOptions: true, false"
			)
			.addField(
				"-redirect",
				"sets the redirect channel if you use a non-Discord updating mode."
			);

		//Gets the rule args and params from the command
		const ruleArgs = args.filter((arg) => arg.includes("-"));
		if (!ruleArgs.length) {
			return channel.send(ruleEmbed);
		}
		let currentRules = {};
		for (let ruleArg of ruleArgs) {
			currentRules[ruleArg] = args[args.indexOf(ruleArg) + 1];
		}

		let categoryRules = {};
		for (let rule of Object.keys(currentRules)) {
			let result = currentRules[rule];

			//Choosing the proper Airtable key name
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
				case "-quirks":
					category = "Quirky Messages?";
					break;
				case "-pingtime":
					category = "Time of Ping";
					break;
				case "-notalk":
					category = "Stop Talking?";
					break;
				case "-tb":
					category = "Tidbits?";
					break;
				case "-combine":
					category = "Combine P/D?";
                    break;
                case "-redirect":
                    category = "Redirect";
                    break;
				default:
					return channel.send(ruleEmbed);
			}

			//Fine-tuning the value of result to match the options in the Airtable
			result =
				!(rule === "-ping" || rule === "-redirect")
					? `${result.charAt(0).toUpperCase()}${result
							.replace(result.charAt(0), "")
							.toLowerCase()}`
					: result;
			if (
				(rule === "-spoiler" ||
					rule === "-quirks" ||
					rule === "-notalk" ||
					rule === "-tb" ||
					rule === "-combine") &&
				result == "True"
			)
				result = true;
			else if (
				(rule === "-spoiler" ||
					rule === "-quirks" ||
					rule === "-notalk" ||
					rule === "-tb" ||
					rule === "-combine") &&
				result != "True"
			)
				result = false;
			result = result === "remove" || result === "none" ? "" : result;

			//Adding to the list of fields
			categoryRules[category] = result;
		}

		// Updating the rule in the database for the league
		let fields = {
			League: [leagueJson.id],
			"Channel ID": channel.id,
			...categoryRules,
		};
		if (rulesId) {
			await base("Custom Rules").update([
				{
					id: rulesId,
					fields: fields,
				},
			]);

			console.log(
				`${leagueJson.name}'s ${Object.keys(
					categoryRules
				)} properties have been set to ${Object.values(
					categoryRules
				)}, respectively!`
			);
			return channel.send(
				`\`${leagueJson.name}\`'s ${Object.keys(
					categoryRules
				)} properties have been set to ${Object.values(
					categoryRules
				)}, respectively!`
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
									"Guild ID": channel.guild.id,
									"Channel ID": channel.id,
								},
							},
						],
						async (err, records) => {
							if (err) console.error(err);
							const leagueName = await records[0].get("Name");
							fields["League"] = [records[0].getId()];

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
								`${leagueName}'s ${Object.keys(
									categoryRules
								)} properties have been set to ${Object.values(
									categoryRules
								)}, respectively!`
							);
							return channel.send(
								`\`${leagueName}\`'s ${Object.keys(
									categoryRules
								)} properties have been set to ${Object.values(
									categoryRules
								)}, respectively!`
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
					`${leagueJson.name}'s ${Object.keys(
						categoryRules
					)} properties have been set to ${Object.values(
						categoryRules
					)}, respectively!`
				);
				return channel.send(
					`\`${leagueJson.name}\`'s ${Object.keys(
						categoryRules
					)} properties have been set to ${Object.values(
						categoryRules
					)}, respectively!`
				);
			}
		}
	},
};

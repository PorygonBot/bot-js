const Airtable = require("airtable");
const axios = require("axios");
const querystring = require("querystring");

const utils = require("../utils");
const airtable_key = process.env.AIRTABLE_KEY;
const base_id = process.env.BASE_ID;
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

module.exports = {
	name: "mode",
	description:
		"Sets the stats updating mode. Run without any parameters to get more info.",
	usage: "[mode name with hyphen] [parameter]",
	async execute(message, args, client) {
		const channel = message.channel;
		const author = message.author;

		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to set the mode of this league for you."
			);
		}

		let mode;
		let discordMode = args[0].toLowerCase();
		let streamChannel = "";
		let sheetsID = "";
		let dlID = "";
		switch (discordMode) {
			case "-channel":
			case "-c":
				mode = "Channel";
				streamChannel = args[1].substring(2, args[1].length - 1);
				if (
					!(
						streamChannel &&
						message.guild.channels.cache.get(streamChannel)
					)
				) {
					return channel.send(
						":x: You didn't link a valid channel. Please run the command again and link the channel you'd like the stats to be put in."
					);
				}
				break;
			case "-dm":
				mode = "DM";
				break;
			case "-sheets":
				mode = "Sheets";
				let sheetsLink = args[1];
				if (
					!sheetsLink.includes(
						"https://docs.google.com/spreadsheets/d"
					)
				) {
					return channel.send(
						":x: This is not a Google Sheets link. Please copy-paste the URL of your Google Sheets file."
					);
				}
				sheetsID = sheetsLink.split("/")[5];
				break;
			case "-nl":
			case "-draft-league.nl":
			case "-draftleaguenl":
			case "-draftleague":
			case "-dl":
				mode = "DL";
				dlID = querystring.parse(args[1].split("?")[1]).league;
				const dlResponse = await axios.get(
					`${process.env.DL_API_URL}/league/${dlID}?key=${process.env.DL_API_KEY}`,
					{
						headers: { "User-Agent": "PorygonTheBot" },
					}
				);
				const dlData = dlResponse.data;
				if (!dlData.mod_discords.includes(`<@${author.id}>`)) {
					return channel.send(
						":x: You're not a moderator on the website for the given league."
					);
				}
				break;
			case "-defualt":
			case "-default":
				mode = "";
				break;
			default:
				const modeEmbed = new Discord.MessageEmbed()
					.setColor("#fc03d7")
					.setTitle("Porygon Mode Command Info")
					.setDescription(
						"Need help on how to use the mode command? This is what you need to know!\n The command goes `porygon, use mode [extension] [extra parameter]`. Each extension is listed below and each parameter required by that extension is listed under it."
					)
					.setThumbnail(
						"https://images.discordapp.net/avatars/692091256477581423/634148e2b64c4cd5e555d9677188e1e2.png"
					)
					.addField(
						"-default",
						"Sends the stats in the same channel that the live link was sent in.\nExtra parameters: N/A\nExample: `porygon, use mode -default`"
					)
					.addField(
						"-c",
						"Sends the stats to another channel that is provided by the mods.\nExtra parameters: a link to the channel\nExample: `porygon, use mode -c #match-results`"
					)
					.addField(
						"-dm",
						"DM's the stats to the user who sent the live link.\nExtra parameters: N/A\nExample: `porygon, use mode -dm`"
					)
					.addField(
						"-sheets",
						"Updates a Google Sheet with the stats automatically. Click [here](https://www.notion.so/harshithpersonal/Sheets-Updating-is-Back-13898436a3c648789d9b7aaa788752ed) for info."
					)
					.addField(
						"-dl",
						"Updates draft-league.nl page with the stats automatically. Click [here](https://discord.com/channels/685139768840945674/734963749966053376/819300373143486475) for more info."
					);
				return message.channel.send(modeEmbed).catch((e) => {
					message.channel.send(
						":x: You need to enable embeds in this channel to use this command."
					);
				});
		}

		let leagueInfo = await utils.findLeagueId(channel.id);
		if (leagueInfo.id) {
			await base("Leagues").update([
				{
					id: leagueInfo.id,
					fields: {
						"Guild ID": channel.guild.id,
						"Channel ID": channel.id,
						"Stream Channel ID": streamChannel,
						"DL ID": dlID,
						"Stats System": mode,
						"Sheet ID": sheetsID,
					},
				},
			]);

			console.log(
				`${leagueInfo.name}'s mode has been changed to ${
					mode || "Default"
				} mode!`
			);
			return channel.send(
				`\`${leagueInfo.name}\`'s mode has been changed to ${
					mode || "Default"
				} mode! ${
					mode === "Sheets"
						? "Please give full editing permissions to `master@porygonthebot.iam.gserviceaccount.com`; I won't be able to work without it."
						: ""
				}`
			);
		} else {
			// Message Collector for the required info for the client
			const filter = (m) => m.author === message.author;
			const collector = message.channel.createMessageCollector(filter, {
				max: 3,
			});

			await channel.send(
				"What is this league's name? [the whole of your next message will be taken as the league's name]"
			);
			collector.on("collect", async (m) => {
				let leagueName = m.content;
				base("Leagues").create([
					{
						fields: {
							"Guild ID": channel.guild.id,
							"Channel ID": channel.id,
							"Stream Channel ID": streamChannel,
							"DL ID": dlID,
							"Stats System": mode,
							"Sheet ID": sheetsID,
						},
					},
				]);
				collector.stop();

				console.log(
					`${leagueName}'s mode has been changed to ${
						mode || "Default"
					} mode!`
				);
				return channel.send(
					`\`${leagueName}\`'s mode has been changed to ${
						mode || "Default"
					} mode! ${
						mode === "Sheets"
							? "Please give full editing permissions to `master@porygonthebot.iam.gserviceaccount.com`; I won't be able to work without it."
							: ""
					}`
				);
			});
		}
	},
};

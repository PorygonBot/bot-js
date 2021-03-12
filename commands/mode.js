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
		"Set the stats updating mode. Run without any parameters to get more info!",
	async execute(message, args, client) {
        const channel = message.channel;
        const author = message.author;

		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to set the mode of this league for you."
			);
		}

		let mode;
		let discordMode = args[0];
		let streamChannel = "";
		let sheetsID = "";
		let dlID = "";
		switch (discordMode) {
			case "-c":
				mode = "Channel";
				streamChannel = args[1].substring(2, args[1].length - 1);
				if (!streamChannel) {
					return channel.send(
						":x: You didn't link a channel. Please run the command again and link the channel you'd like the stats to be put in."
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
            case "-dl":
                mode = "DL";
                dlID = querystring.parse(args[1].split("?")[1]).league;
                const dlResponse = await axios.get(`${process.env.DL_API_URL}/league/${dlID}?key=${process.env.DL_API_KEY}`);
                const dlData = dlResponse.data;
                if (!dlData.mod_discords.includes(`<@${author.id}>`)) {
                    return channel.send(":x: You're not a moderator on the website for the given league.")
                }
                break;
			case "-default":
				mode = "";
				break;
			default:
				return channel.send(
					"Need help? Here we go!\n```This command is used to either set up a new league or change the updating method of an existing league. To use the command, type this:\nporygon, use mode [either -c, -dm, or -default] [optional extension] \n\n-c: match-results channel mode. This is where the client will send your stats to a separate match-results channel. Make sure to link to the channel you want to be the match-results channel to the end of the message. \n-dm: author DM mode. This mode will DM the author of the original message that sent the live link with the stats.\n-default: default mode. This will just send the stats in the same channel that the link was sent. \n\nMake sure you send this command in the channel you want to make the live-links channel; its name also has to have either live-links or live-battles in it.```"
				); //TODO add sheets and draft league part, and make this an embed.
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
							Name: leagueName,
							"Guild ID": channel.guild.id,
							"Channel ID": channel.id,
							"Stream Channel ID": streamChannel.substring(
								2,
								streamChannel.length - 1
							),
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

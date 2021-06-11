const axios = require("axios");

const utils = require("../utils.js");
const DiscordChannelStats = require("../updaters/DiscordChannelStats");
const DiscordDefaultStats = require("../updaters/DiscordDefaultStats");

class DraftLeagueStats {
	constructor(message) {
		//Requires that message is a Discord Message object
		this.message = message;
		this.author = message.author;
		this.channel = message.channel;
	}

	async update(matchJson) {
		let psPlayer1 = Object.keys(matchJson.players)[0];
		let psPlayer2 = Object.keys(matchJson.players)[1];
		let info = matchJson.info;

		try {
			//Getting league data
			const leagueResponse = await axios.get(
				`${process.env.DL_API_URL}/league/${matchJson.league_id}?key=${process.env.DL_API_KEY}`,
				{
					headers: { "User-Agent": "PorygonTheBot" },
				}
			);
			const leagueData = leagueResponse.data;
			console.log("League recieved.");

			//Getting the Discord user player from their Discord ID
			const authorID = this.author.id;
			const playerResponse = await axios.get(
				`${process.env.DL_API_URL}/league/${matchJson.league_id}/player/<@${authorID}>?key=${process.env.DL_API_KEY}`,
				{
					headers: { "User-Agent": "PorygonTheBot" },
				}
			);
			const discordPlayerData = playerResponse.data;
			//Check which player the Discord user is.
			const discordUserPS = utils.findCommonElements(
				Object.keys(
					matchJson.players[Object.keys(matchJson.players)[0]].kills
				),
				discordPlayerData.pokemon
			)
				? Object.keys(matchJson.players)[0]
				: Object.keys(matchJson.players)[1];
			const nonDiscordUserPS =
				discordUserPS === Object.keys(matchJson.players)[0]
					? Object.keys(matchJson.players)[1]
					: Object.keys(matchJson.players)[0];
			console.log("Players recieved.");

			//Getting the Match ID based on opponent's pokemon
			const matchURL = `${process.env.DL_API_URL}/league/${
				matchJson.league_id
			}/player/<@${authorID}>?pokemon=${Object.keys(
				matchJson.players[nonDiscordUserPS].kills
			)
				.join(",")
				.replace("’", "")}&key=${process.env.DL_API_KEY}`;
			console.log(matchURL);
			const matchResponse = await axios.get(matchURL, {
				headers: { "User-Agent": "PorygonTheBot" },
			});
			const matchData = matchResponse.data;
			console.log("Match recieved.");
			console.log(matchData);

			matchJson.players[discordUserPS].league_id = discordPlayerData.id;
			matchJson.players[nonDiscordUserPS].league_id = matchData.opponent;

			const final = {
				...matchJson,
				...matchData,
				discord_user: discordUserPS,
				headers: { "User-Agent": "PorygonTheBot" },
			};

			//Making the submission
			const submissionResponse = await axios.post(
				`${process.env.DL_API_URL}/submission?key=${process.env.DL_API_KEY}`,
				final
			);
			console.log("Submitted");

			//Posting to the replay webhook
			let result = matchJson.info.result
				.toLowerCase()
				.startsWith(discordUserPS)
				? matchJson.info.result.substring(
						matchJson.info.result.length - 3
				  )
				: `${matchJson.info.result.substring(
						matchJson.info.result.length - 1
				  )}-${matchJson.info.result.substring(
						matchJson.info.result.length - 3,
						matchJson.info.result.length - 2
				  )}`;
			await axios.post(leagueData.replay_webhook, {
				content: `A match in the ${leagueData.league_name} between the ${discordPlayerData.team_name} and the ${matchData.opponent_team_name} has just been submitted by Porygon Automatic Import.\nReplay: <${matchJson.info.replay}>\nResult: ||${result}||`,
			});
			if (info.redirect) {
				matchJson.streamChannel = info.redirect.substring(
					2,
					info.redirect.length - 1
				);
				let channeler = new DiscordChannelStats(this.message);
				await channeler.update(matchJson);
			} else {
				await this.channel.send(
					`Battle between \`${psPlayer1}\` and \`${psPlayer2}\` is complete and info has been updated!`
				);
			}
		} catch (e) {
			await this.channel.send(
				`:x: Error with match number \`${
					matchJson.battleId
				}\`. I will be unable to analyze this match until you screenshot this message and send it to the Porygon server's bugs-and-help channel and ping harbar20 in the same channel.\n\n**Error:**\`\`\`${JSON.stringify(
					e.response.data
				)}\nLine number: ${
					e.stack.split(":")[2]
				}\`\`\`\nPlease paste these stats instead: `
			);
			console.error(e);
			//Send the stats
			let defaulter = new DiscordDefaultStats(this.message);
			await defaulter.update(matchJson);
		}
	}
}

module.exports = DraftLeagueStats;

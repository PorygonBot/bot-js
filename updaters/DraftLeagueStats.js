const axios = require("axios");

const utils = require("../utils.js");

class DraftLeagueStats {
	constructor(message) {
		//Requires that message is a Discord Message object
		this.message = message;
		this.author = message.author;
		this.channel = message.channel;
	}

	async update(matchJson) {
		try {
			//Getting league data
			const leagueResponse = await axios.get(
				`${process.env.DL_API_URL}/league/${matchJson.league_id}?key=${process.env.DL_API_KEY}`
			);
			const leagueData = leagueResponse.data;

			//Getting the Discord user player from their Discord ID
			const authorID = this.author.id;
			const playerResponse = await axios.get(
				`${process.env.DL_API_URL}/league/${matchJson.league_id}/player/<@${authorID}>?key=${process.env.DL_API_KEY}`
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

			//Getting the Match ID based on opponent's pokemon
			const matchResponse = await axios.get(
				`${process.env.DL_API_URL}/league/${
					matchJson.league_id
				}/player/<@${authorID}>?pokemon=${Object.keys(
					matchJson.players[nonDiscordUserPS].kills
				).join(",")}&key=${process.env.DL_API_KEY}`
			);
			const matchData = matchResponse.data;

			matchJson.players[discordUserPS].league_id = discordPlayerData.id;
			matchJson.players[nonDiscordUserPS].league_id = matchData.opponent;

			const final = {
				...matchJson,
				...matchData,
				discord_user: discordUserPS,
			};

			//Making the submission
			const submissionResponse = await axios.post(
				`${process.env.DL_API_URL}/submission?key=${process.env.DL_API_KEY}`,
				final
			);

			//Posting to the replay webhook
			let result = matchJson.info.result;
			result = result.startsWith(discordUserPS)
				? result.substring(result.length - 3)
				: `${result.substring(result.length - 1)}-${result.substring(
						result.length - 3,
						result.length - 2
				  )}}}`;
			await axios.post(leagueData.replay_webhook, {
				content: `A match in the ${leagueData.league_name} between the ${discordPlayerData.team_name} and the ${matchData.opponent_team_name} has just been submitted *by Porygon*.\nReplay: ${matchJson.info.replay}\n**History:** ${matchJson.info.history}\nResult: ||${result}||`,
			});
		} catch (e) {
			await this.channel.send(
				":x: There was an error updating this match. Please paste these stats instead: "
			);
			//Send the stats
			let defaulter = new DiscordDefaultStats(this.message);
			await defaulter.update(matchJson);
		}
	}
}

module.exports = DraftLeagueStats;

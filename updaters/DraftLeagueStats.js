const axios = require("axios");

const utils = require("../utils.js");

class DraftLeagueStats {
	constructor(message) {
		//Requires that message is a Discord Message object
		this.author = message.author;
		this.channel = message.channel;
	}

	async update(matchJson) {
		matchJson.league_id = 7;

		//Getting the Discord user player from their Discord ID
		const authorID = this.author.id;
		const playerResponse = await axios.get(
			`${process.env.DL_API_URL}/league/${matchJson.league_id}/player/<@${authorID}>`
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
			).join(",")}`
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
			`${process.env.DL_API_URL}/submission`,
			final
		);

		await this.channel.send(
			`Battle between \`${Object.keys(matchJson.players)[0]}\` and \`${
				Object.keys(matchJson.players)[1]
			}\` is complete and info has been updated!\n**Replay:** ${
				matchJson.info.replay
			}\n**History:** ${matchJson.info.history}`
		);
	}
}

module.exports = DraftLeagueStats;

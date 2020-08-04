const util = require("../utils.js");

class DiscordChannelStats {
	constructor(message) {
		//Requires that message is a Discord Message object
		this.message = message;
		this.channel = this.message.channel;
		this.server = this.message.guild;
	}

	async update(matchJson) {
		let info = matchJson.info;
		let messages = info.csv ? util.genCSV(matchJson) : util.genMessage(matchJson);
		let psPlayer1 = Object.keys(matchJson.players)[0];
		let psPlayer2 = Object.keys(matchJson.players)[1];
		let message1 = messages[0];
		let message2 = messages[1];
		if (!matchJson.streamChannel) {
			return this.channel.send(
				":x: Error! You don't have a match results channel in the database for this server. "
			);
		}
		let streamChannel = util.getChannel(
			this.server,
			matchJson.streamChannel
		);

		//finally sending players the info
		if (info.spoiler) {
			streamChannel.send(
				`||**${psPlayer1}**: \n${message1}|| \n\n||**${psPlayer2}**: \n${message2}|| \n\n**Replay: **${info.replay}\n**History: **${info.history}`
			);
		}
		else {
			streamChannel.send(
				`**${psPlayer1}**: \n${message1} \n\n**${psPlayer2}**: \n${message2} \n\n**Replay: **${info.replay}\n**History: **${info.history}`
			);
		}

		this.channel.send(
			`Battle between \`${psPlayer1}\` and \`${psPlayer2}\` is complete and info has been updated!`
		);
	}
}

module.exports = DiscordChannelStats;

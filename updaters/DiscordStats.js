class DiscordStats {
	constructor(message) {
		//Requires that message is a Discord Message object
		this.message = message;
		this.channel = this.message.channel;
		this.server = this.message.guild;
		this.author = this.message.author;
	}

	getUser(usernameWithDisc) {
		let username = usernameWithDisc.substring(
			0,
			usernameWithDisc.length - 5
		);
		let userObj = this.server.members.find(
			(m) => m.user.username === username
		).user;

		//just double checking to make sure the user is correct
		if (
			`${userObj.username}#${userObj.discriminator}` === usernameWithDisc
		) {
			return userObj;
		} else {
			return "Invalid user";
		}
	}

	getChannel(channelID) {
		return this.server.channels.get(channelID);
	}

	//async update(player1, killJson1, deathJson1, player2, killJson2, deathJson2, info) {
	async update(matchJson) {
		//retrieving info from the json object
		let psPlayer1 = Object.keys(matchJson.players)[0];
		let psPlayer2 = Object.keys(matchJson.players)[1];
		let killJson1 =
			matchJson.players[psPlayer1].kills;
		let deathJson1 =
			matchJson.players[psPlayer1].deaths;
		let killJson2 =
			matchJson.players[psPlayer2].kills;
		let deathJson2 =
			matchJson.players[psPlayer2].deaths;
		let info = matchJson.info;
		let dmAuthor = matchJson.dmAuthor;
        let combinePD = matchJson.combinePD;
		let streamChannelId = matchJson.streamChannel;

		let message1 = "";
		let message2 = "";

        //Drafting the message to be sent to the users\
        if (!combinePD) {
            for (let pokemon of Object.keys(killJson1)) {
                message1 += `${pokemon} has ${killJson1[pokemon].direct} direct kills, ${killJson1[pokemon].passive} passive kills, and ${deathJson1[pokemon]} deaths. \n`;
            }
    
            for (let pokemon of Object.keys(killJson2)) {
                message2 += `${pokemon} has ${killJson2[pokemon].direct} direct kills, ${killJson2[pokemon].passive} passive kills, and ${deathJson2[pokemon]} deaths. \n`;
            }
        }
        else {
            for (let pokemon of Object.keys(killJson1)) {
                message1 += `${pokemon} has ${killJson1[pokemon].direct + killJson1[pokemon].passive} kills and ${deathJson1[pokemon]} deaths. \n`;
            }
    
            for (let pokemon of Object.keys(killJson2)) {
                message2 += `${pokemon} has ${killJson2[pokemon].direct + killJson2[pokemon].passive} kills and ${deathJson2[pokemon]} deaths. \n`;
            }
        }

		//Spoiler tagging the stats
		message1 = `||${message1}||`;
		message2 = `||${message2}||`;

		//finally sending players the info
		if (streamChannelId) {
			let streamChannelObj = this.getChannel(streamChannelId);
			streamChannelObj.send(
				`**${psPlayer1}**: \n${message1} \n\n**${psPlayer2}**: \n${message2} \n\n**Replay: **${info.replay}`
			);
		} else {
			this.author.send(`**${psPlayer1}**: \n${message1} \n\n**${psPlayer2}**: \n${message2} \n\n**Replay: **${info.replay}`)
		}
		
		this.channel.send(
			`Battle between \`${psPlayer1}\` and \`${psPlayer2}\` is complete and info has been updated!`
		);
	}
}

module.exports = DiscordStats;

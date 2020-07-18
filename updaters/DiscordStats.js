const discord = require("discord");

class DiscordDMStats {
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
		let player1 =
			matchJson.players[Object.keys(matchJson.players)[0]].discord;
		let player2 =
			matchJson.players[Object.keys(matchJson.players)[1]].discord;
		let killJson1 =
			matchJson.players[Object.keys(matchJson.players)[0]].kills;
		let deathJson1 =
			matchJson.players[Object.keys(matchJson.players)[0]].deaths;
		let killJson2 =
			matchJson.players[Object.keys(matchJson.players)[1]].kills;
		let deathJson2 =
			matchJson.players[Object.keys(matchJson.players)[1]].deaths;
		let info = matchJson.info;
		let mods = matchJson.mods;
		let dmMods = matchJson.dmMods;
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

		//getting User objects from Discord given their username
		let modsUsers = [];
		let user1;
		let user2;
		if (dmMods) {
			for (let mod of mods) {
				modsUsers.push(this.getUser(mod));
				console.log("Mod: " + mod);
			}
		} 
		
		else if (dmAuthor) {
			modsUsers.push(this.author);
		}

		else if (streamChannelId) {
			message1 = `||${message1}||`;
			message2 = `||${message2}||`;
		} else {
			user1 = this.getUser(player1);
			user2 = this.getUser(player2);
		}

		//finally sending players the info
		if (dmMods || dmAuthor) {
			for (let mod of modsUsers) {
				mod.send(
					`**${psPlayer1}**: \n${message1} \n\n**${psPlayer2}**: \n${message2} \n\n**Replay: **${info.replay}`
				);
			}
		} else if (streamChannelId) {
			let streamChannelObj = this.getChannel(streamChannelId);
			streamChannelObj.send(
				`**${psPlayer1}**: \n${message1} \n\n**${psPlayer2}**: \n${message2} \n\n**Replay: **${info.replay}`
			);
		} else {
			user1.send(`${message1} \n\n**Replay: **${info.replay}`);
			user2.send(`${message2} \n\n**Replay: **${info.replay}`);
		}
		this.channel.send(
			`Battle between \`${psPlayer1}\` and \`${psPlayer2}\` is complete and info has been updated!`
		);
	}
}

module.exports = DiscordDMStats;

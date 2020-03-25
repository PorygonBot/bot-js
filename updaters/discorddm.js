const discord = require("discord");

class DiscordDMStats {
    constructor (message) {
        //Requires that message is a Discord Message object
        this.message = message;
        this.channel = this.message.channel;
        this.server = this.message.guild;
    }

    async update(player1, killJson1, deathJson1, player2, killJson2, deathJson2, info) {
        let message1 = "";
        let message2 = "";

        //Drafting the message to be sent to the users
        for (let pokemon of Object.keys(killJson1)) {
            message1 += `${pokemon} has ${killJson1[pokemon]} kills and ${deathJson1[pokemon]} deaths. \n`;
        }
        message1 += `\n Replay: ${info.replay}`;
        for (let pokemon of Object.keys(killJson2)) {
            message2 += `${pokemon} has ${killJson2[pokemon]} kills and ${deathJson2[pokemon]} deaths. \n`;
        }
        message2 += `\n Replay: ${info.replay}`;

        //getting User objects from Discord given their username
        let user1 = getUser(player1);
        let user2 = getUser(player2);

        //finally sending players the info
        user1.send(message1);
        user2.send(message2);
    }

    async getUser(username) {
        return this.server.members.cache.get(m => m.username === username);
    }
}

module.exports = DiscordDMStats
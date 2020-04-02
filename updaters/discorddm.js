const discord = require("discord");

class DiscordDMStats {
    constructor (message) {
        //Requires that message is a Discord Message object
        this.message = message;
        this.channel = this.message.channel;
        this.server = this.message.guild;
    }

    getUser(usernameWithDisc) {
        //console.log(this.server.members.find(m => m.user.username === "harbar20").user)
        //return this.server.members.cache.get(m => m.username === username);
        let username = usernameWithDisc.substring(0, usernameWithDisc.length - 5);
        let userObj = this.server.members.find(m => m.user.username === username).user;

        //just double checking to make sure the user is correct
        if (`${userObj.username}#${userObj.discriminator}` === usernameWithDisc) {
            return userObj;
        }
        else {
            return "Invalid user";
        }
    }

    async update(player1, killJson1, deathJson1, player2, killJson2, deathJson2, info) {
        let message1 = "";
        let message2 = "";

        //Drafting the message to be sent to the users
        for (let pokemon of Object.keys(killJson1)) {
            message1 += `${pokemon} has ${killJson1[pokemon]} kills and ${deathJson1[pokemon]} deaths. \n`;
        }
        message1 += `\nReplay: ${info.replay}`;
        for (let pokemon of Object.keys(killJson2)) {
            message2 += `${pokemon} has ${killJson2[pokemon]} kills and ${deathJson2[pokemon]} deaths. \n`;
        }
        message2 += `\nReplay: ${info.replay}`;

        //getting User objects from Discord given their username
        let user1 = this.getUser(player1);
        let user2 = this.getUser(player2);

        //finally sending players the info
        user1.send(message1);
        user2.send(message2);
        this.channel.send(`Battle between ${user1} and ${user2} is complete! Replay: ${info.replay}`);
    }
}

module.exports = DiscordDMStats
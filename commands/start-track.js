const Discord = require("discord.js");

module.exports = {
	name: "start-track",
	description:
		"Set the bot up to start tracking the users that reacted to messages sent between the calling of start-track and end-track.",
	execute(message, args) {
		return message.channel.send("Tracking now!");
	},
};

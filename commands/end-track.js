const Discord = require("discord.js");

module.exports = {
	name: "end-track",
	description:
		"Set the bot up to end tracking the users that reacted to messages sent between the calling of start-track and end-track.",
	async execute(message, args, client) {
		const author = message.author;

		let messages = await message.channel.messages.fetch().catch((e) => {
			message.channel.send(
				":x: Error! I don't have `Read Message History` permissions."
			);
			console.error(e);
		});

		//Creating the array of messages between the start and end of tracking
		messages = messages.array();
		let msgs = [];
		for (const msg of messages) {
			if (msg.content === "Tracking now!") break;
			else msgs.push(msg);
		}
		msgs.splice(0, 1);

		//Collecting the reactions and stuff
		msgs = msgs.reverse();
		let sentData = {};
		for (const msg of msgs) {
			const reactions = msg.reactions.cache.array();

			sentData[msg.content] = "";

			for (const reaction of reactions) {
				const emoji = reaction._emoji.name;

				let reactorsArr = await reaction.users.fetch();
				reactorsArr = reactorsArr.array();
				reactorsArr = reactorsArr.map(
					(reactor) =>
						`- ${reactor.username + "#" + reactor.discriminator}`
				);

				const reactors = reactorsArr.join("\n");

				sentData[msg.content] += `${emoji}\n${reactors}\n\n`;
			}
			//Sending the reactions for each message one by one
			author.send(
				`> ${msg.content}\n${
					sentData[msg.content]
				}\n============================================================================================================`
			);
		}
	},
};

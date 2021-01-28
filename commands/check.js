const utils = require("../utils");

module.exports = {
	name: "check",
	description:
		"Checks if the owner of the server that this command is run in is a Patron of Porygon.",
	async execute(message, args, client) {
		const channel = message.channel;

		const guild = message.guild;

		const isTrue = await utils.isPatron(client, guild.id);
		await channel.send(
			isTrue
				? "The owner of this server is, in fact, a Patron of Porygon."
				: "The owner of this server is not, in fact, a Patron of Porygon."
		);
	},
};

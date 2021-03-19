module.exports = {
	name: "ping",
	description: "Tests the server and API ping of the bot.",
	async execute(message, args, client) {
		let m = await message.channel.send("Ping?");
		m.edit(
			`Pong! Latency is ${
				m.createdTimestamp - message.createdTimestamp
			}ms. API Latency is ${Math.round(client.ws.ping)}ms`
		);
	},
};

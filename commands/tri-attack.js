module.exports = {
	name: "tri-attack",
	description:
		"Causes Porygon to use the Tri-Attack move, with a 20% chance each for 3 statuses.",
	async execute(message, args, client) {
		const channel = message.channel;

		let rand = Math.round(Math.random() * 5);
		let m = await channel.send("Porygon used Tri-Attack!");
		switch (rand) {
			case 1:
				return m.edit("Porygon used Tri-Attack! It burned the target!");
			case 2:
				return m.edit("Porygon used Tri-Attack! It froze the target!");
			case 3:
				return m.edit(
					"Porygon used Tri-Attack! It paralyzed the target!"
				);
			default:
				return m.edit(
					"Porygon used Tri-Attack! No secondary effect on the target."
				);
		}
	},
};

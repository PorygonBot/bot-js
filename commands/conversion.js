module.exports = {
	name: "conversion",
	description:
		"Causes Porygon to use the Conversion move, with Porygon changing to a random Pokemon type.",
	async execute(message, args, client) {
		const channel = message.channel;

		let rand = Math.round(Math.random() * (17 - 0 + 1) + 0);
		let type = "";
		switch (rand) {
			case 0:
				type = "Bug";
				break;
			case 1:
				type = "Dark";
				break;
			case 2:
				type = "Dragon";
				break;
			case 3:
				type = "Electric";
				break;
			case 4:
				type = "Fairy";
				break;
			case 5:
				type = "Fighting";
				break;
			case 6:
				type = "Fire";
				break;
			case 7:
				type = "Flying";
				break;
			case 8:
				type = "Ghost";
				break;
			case 9:
				type = "Grass";
				break;
			case 10:
				type = "Ground";
				break;
			case 11:
				type = "Ice";
				break;
			case 12:
				type = "Normal";
				break;
			case 13:
				type = "Poison";
				break;
			case 14:
				type = "Psychic";
				break;
			case 15:
				type = "Rock";
				break;
			case 16:
				type = "Steel";
				break;
			case 17:
				type = "Water";
				break;
		}
		return channel.send(
			`Porygon used Conversion! Porygon's type changed to ${type}!`
		);
	},
};

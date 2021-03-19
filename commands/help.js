const Discord = require("discord.js");

module.exports = {
	name: "help",
	description: "List all of my commands or info about a specific command.",
	aliases: ["commands"],
	usage: "[command name]",
	cooldown: 5,
	async execute(message, args, client) {
		const prefix = "porygon, use ";
		// const data = [];
		const { commands } = message.client;

		// if (!args.length) {
		// 	data.push("Here's a list of all my commands:");
		// 	data.push(commands.map((command) => command.name).join(", "));
		// 	data.push(
		// 		`\nYou can send \`${prefix}help [command name]\` to get info on a specific command!`
		// 	);

		// 	return message.author
		// 		.send(data, { split: true })
		// 		.then(() => {
		// 			if (message.channel.type === "dm") return;
		// 			message.reply("I've sent you a DM with all my commands!");
		// 		})
		// 		.catch((error) => {
		// 			console.error(
		// 				`Could not send help DM to ${message.author.tag}.\n`,
		// 				error
		// 			);
		// 			message.reply(
		// 				"it seems like I can't DM you! Do you have DMs disabled?"
		// 			);
		// 		});
		// }

		// const name = args[0].toLowerCase();
		// const command =
		// 	commands.get(name) ||
		// 	commands.find((c) => c.aliases && c.aliases.includes(name));

		// if (!command) {
		// 	return message.reply("that's not a valid command!");
		// }

		// data.push(`**Name:** ${command.name}`);

		// if (command.aliases)
		// 	data.push(`**Aliases:** ${command.aliases.join(", ")}`);
		// if (command.description)
		// 	data.push(`**Description:** ${command.description}`);
		// if (command.usage)
		// 	data.push(`**Usage:** ${prefix}${command.name} ${command.usage}`);

		// data.push(`**Cooldown:** ${command.cooldown || 3} second(s)`);

		// message.channel.send(data, { split: true });

		const helpEmbed = new Discord.MessageEmbed()
			.setColor("#fc03d7")
			.setTitle("Porygon Help")
			.setURL("https://discord.gg/ZPTMZ8f")
			.setDescription(
				'Porygon is a bot that automatically joins and tracks the stats of a Pokemon Showdown battle. Click on "Porygon FAQ" in this message for a tutorial.'
			)
			.setThumbnail(
				"https://images.discordapp.net/avatars/692091256477581423/634148e2b64c4cd5e555d9677188e1e2.png"
			);
		//Adding each command
        for (let command of commands) {
            command = command[1];
			helpEmbed.addField(
				command.name,
				`${prefix}${command.name} ${command.usage || ""}\n${
					command.description
				}\nAliases: ${command.aliases ? command.aliases.join(", ") : "None"}`
			);
        }
        
        return message.channel.send(helpEmbed);
	},
};

const qs = require("querystring");
const patreon = require("patreon");
const axios = require("axios");
const Airtable = require("airtable");

const base = new Airtable({
	apiKey: process.env.AIRTABLE_KEY,
}).base(process.env.BASE_ID);
const VIEW_NAME = "Grid view";

module.exports = {
	name: "verify",
	aliases: [],
	description: "Allows users to verify that they're Patreon supporters.",
	async execute(message, args) {
		const channel = message.channel;

		let oauthData = qs.stringify({
			response_type: "code",
			client_id: process.env.PATREON_CLIENT_ID,
			redirect_uri: "https://porygon-bot.herokuapp.com/patreon-redirect",
			state: message.author.id,
		});

		await channel.send(
			`Please click on this link to verify that you are a Patreon supporter within the next 15 seconds.\nhttps://www.patreon.com/oauth2/authorize?${oauthData}`
		);

		setTimeout(async () => {
			const patreonUserResponse = await axios.get(
				"https://jsonbase.com/PorygonBot/patreon-user"
			);
			const patreonUser =
				patreonuserResponse.data[message.author.id].data;
			if (patreonUserResponse !== 200) {
				return channel.send(
					":x: Error. Please contact Porygon support for more help."
				);
			} else {
                //Getting the leagues that the patron is in.
                let valid = [];
				base("Leagues")
					.select({
						maxRecords: 1000,
						view: VIEW_NAME,
					})
					.all().then(async (records) => {
                        for (let record of records) {
                            const guildID = await record.get("Guild ID");
                            const guild = await axios.get(`https://discord.com/api/v7/guilds/${guildID}`, {
                                headers: {
                                    "Authentication": `Bot ${process.env.TOKEN}`
                                }
                            });
                            if (guild.data.owner_id === message.author.id) {
                                valid.push(record.id);
                            }
                        }
                    });
				//Creating the patron's page.
				base("Patreon").create([
					{
						fields: {
							"Discord User ID": message.author.id,
							"Patreon Username": patreonUser.attributes.vanity,
							Leagues: valid,
						},
					},
				]);
			}
		}, 15000);
	},
};

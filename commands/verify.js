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
	description: "Allows users to verify that they're Patreon supporters.",
	async execute(message, args, client) {
		const channel = message.channel;

		let oauthData = qs.stringify({
			response_type: "code",
			client_id: process.env.PATREON_CLIENT_ID,
			redirect_uri: "https://server.porygonbot.xyz/patreon-redirect",
			scope: "identity",
			state: message.author.id,
		});

		await channel.send(
			`Please click on this link to verify that you are a Patreon supporter within the next 40 seconds.\nhttps://www.patreon.com/oauth2/authorize?${oauthData}`
		);

		setTimeout(async () => {
			const patreonUserResponse = await axios.get(
				"https://jsonbase.com/PorygonBot/patreon-user",
                {
                    headers: { "User-Agent": "PorygonTheBot" },
                }
			).catch((e) => {console.error(e);});
			const patreonUser = patreonUserResponse.data[message.author.id];
			if (patreonUserResponse.status !== 200) {
				return channel.send(
					":x: Error. Please contact Porygon support for more help."
				);
			} else {
				//Creating the patron's page.
				base("Patreon").create([
					{
						fields: {
							"Discord User ID": message.author.id,
							"Patreon Link": patreonUser.links.self,
						},
					},
				]).catch((e) => {console.error(e);});

				await channel.send(
					"Verified! You are now able to use Patreon-exclusive features!"
				);
			}
		}, 40000);
	},
};

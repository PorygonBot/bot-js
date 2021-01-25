//Setting up process.env
require("dotenv").config();
//Importing all required modules
const { Client, Collection } = require("discord.js");
const express = require("express");
const patreon = require("patreon");
const request = require("request");

const client = new Client({ disableMentions: "everyone" });
// Initializing The commands Collection.
["commands"].forEach((x) => (client[x] = new Collection()));
// Calling on the event.js & command.js files to load events and commands.
["event", "command"].forEach((x) => require(`./handlers/${x}`)(client));

const app = express();
const patreonAPI = patreon.patreon;
const patreonOAuth = patreon.oauth;
const patreonOAuthClient = patreonOAuth(
	process.env.PATREON_CLIENT_ID,
	process.env.PATREON_CLIENT_SECRET
);
//Redirect for Patreon OAuth
app.get("/patreon-redirect", async (req, res) => {
	const code = req.query.code;
	const discordID = req.query.state;

	await patreonOAuthClient
		.getTokens(code, "https://porygon-bot.herokuapp.com/patreon-redirect")
		.then(async (response) => {
			const patreonAPIClient = patreonAPI(response.access_token);
			return patreonAPIClient("/current_user");
		})
		.then(async (result) => {
			const store = result.store;
			const user = store.findAll("user").map((user) => user.serialize());
			let newData = {};
			newData[discordID] = user;

			let response = await request({
				url: `https://jsonbase.com/PorygonBot/patreon-user`,
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(newData),
			});

			res.end("Done, baby!");
		})
		.catch((err) => {
			console.error(err);
			res.end(err);
		});

	server.close();
});
const server = app.listen(3000);

// Login the bot in.
client.login(process.env.TOKEN);

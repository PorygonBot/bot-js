const Airtable = require("airtable");
//Getting config info
const { token, airtable_key, base_id } = require("./config.json");
const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

const getUser = (server, usernameWithDisc) => {
	let username = usernameWithDisc.substring(0, usernameWithDisc.length - 5);
	let userObj = server.members.find((m) => m.user.username === username).user;

	//just double checking to make sure the user is correct
	if (`${userObj.username}#${userObj.discriminator}` === usernameWithDisc) {
		return userObj;
	} else {
		return "Invalid user";
	}
};

const getChannel = (server, channelID) => {
	return server.channels.get(channelID);
};

const genMessage = (matchJson) => {
	//retrieving info from the json object
	let psPlayer1 = Object.keys(matchJson.players)[0];
	let psPlayer2 = Object.keys(matchJson.players)[1];
	let killJson1 = matchJson.players[psPlayer1].kills;
	let deathJson1 = matchJson.players[psPlayer1].deaths;
	let killJson2 = matchJson.players[psPlayer2].kills;
	let deathJson2 = matchJson.players[psPlayer2].deaths;
	let combinePD = matchJson.combinePD;

	let message1 = "";
	let message2 = "";

	//Drafting the message to be sent to the users\
	if (!combinePD) {
		for (let pokemon of Object.keys(killJson1)) {
			message1 += `${pokemon} has ${killJson1[pokemon].direct} direct kills, ${killJson1[pokemon].passive} passive kills, and ${deathJson1[pokemon]} deaths. \n`;
		}

		for (let pokemon of Object.keys(killJson2)) {
			message2 += `${pokemon} has ${killJson2[pokemon].direct} direct kills, ${killJson2[pokemon].passive} passive kills, and ${deathJson2[pokemon]} deaths. \n`;
		}
	} else {
		for (let pokemon of Object.keys(killJson1)) {
			message1 += `${pokemon} has ${
				killJson1[pokemon].direct + killJson1[pokemon].passive
			} kills and ${deathJson1[pokemon]} deaths. \n`;
		}

		for (let pokemon of Object.keys(killJson2)) {
			message2 += `${pokemon} has ${
				killJson2[pokemon].direct + killJson2[pokemon].passive
			} kills and ${deathJson2[pokemon]} deaths. \n`;
		}
	}

	//Spoiler tagging the stats
	message1 = `||${message1}||`;
	message2 = `||${message2}||`;
	return [message1, message2];
};

const getChannels = async () => {
	let channels = [];
	await base("Leagues")
		.select({
			maxRecords: 50,
			view: "Grid view",
		})
		.all()
		.then((records) => {
			records.forEach(async (record) => {
				let channelId = await record.get("Channel ID");
				channels.push(channelId);
			});
		});

	return channels;
};

const findLeagueId = async (checkChannelId) => {
	let leagueId;
	let leagueName;
	await base("Leagues")
		.select({
			maxRecords: 500,
			view: "Grid view",
		})
		.all()
		.then(async (records) => {
			for (let leagueRecord of records) {
				let channelId = await leagueRecord.get("Channel ID");
				if (channelId === checkChannelId) {
					leagueId = leagueRecord.id;
					leagueName = await leagueRecord.get("Name");
				}
			}
		});

	let leagueJson = {
		id: leagueId,
		name: leagueName,
	};
	return leagueJson;
};

const findRulesId = async (checkChannelId) => {
	let recordId = "";

	await base("Custom Rules")
		.select({
			maxRecords: 500,
			view: "Grid view",
		})
		.all()
		.then(async (records) => {
			for (let leagueRecord of records) {
				let channelId = await leagueRecord.get("Channel ID");
				if (channelId === checkChannelId) {
					recordId = leagueRecord.id;
				}
			}
		});

	return recordId;
};

const getPlayersIds = async (leagueId) => {
	let recordsIds = await new Promise((resolve, reject) => {
		base("Leagues").find(leagueId, (err, record) => {
			if (err) reject(err);

			recordIds = record.get("Players");
			resolve(recordIds);
		});
	});

	if (!recordsIds) return [];
	return recordsIds;
};

//Pokemon-related Constants
const recoilMoves = [
	"bravebird",
	"doubleedge",
	"flareblitz",
	"headcharge",
	"headsmash",
	"highjumpkick",
	"jumpkick",
	"lightofruin",
	"shadowend",
	"shadowrush",
	"struggle",
	"submission",
	"takedown",
	"volttackle",
	"wildcharge",
	"woodhammer",
];

const confusionMoves = [
	"Chatter",
	"Confuse Ray",
	"Confusion",
	"Dizzy Punch",
	"Dynamic Punch",
	"Flatter",
	"Hurricane",
	"Outrage",
	"Petal Dance",
	"Psybeam",
	"Rock Climb",
	"Secret Power",
	"Shadow Panic",
	"Signal Beam",
	"Strange Stream",
	"Supersonic",
	"Swagger",
	"Sweet Kiss",
	"Teeter Dance",
	"Thrash",
	"Water Pulse",
];

const toxicMoves = [
	"Baneful Bunker",
	"Cross Poison",
	"Fling",
	"Gunk Shot",
	"Poison Fang",
	"Poison Gas",
	"Poison Jab",
	"Poison Powder",
	"Poison Sting",
	"Poison Tail",
	"Psycho Shift",
	"Secret Power",
	"Shell Side Arm",
	"Sludge",
	"Sludge Bomb",
	"Sludge Wave",
	"Smog",
	"Toxic",
	"Toxic Thread",
	"Twineedle",
];

const burnMoves = [
	"Beak Blast",
	"Blaze Kick",
	"Blue Flare",
	"Burning Jealousy",
	"Ember",
	"Fire Blast",
	"Fire Fang",
	"Fire Punch",
	"Flame Wheel",
	"Flamethrower",
	"Flare Blitz",
	"Fling",
	"Heat Wave",
	"Ice Burn",
	"Inferno",
	"Lava Plume",
	"Psycho Shift",
	"Pyro Ball",
	"Sacred Fire",
	"Scald",
	"Scorching Sands",
	"Searing Shot",
	"Secret Power",
	"Shadow Fire",
	"Sizzly Slide",
	"Steam Eruption",
	"Tri Attack",
	"Will-O-Wisp",
];
const statusAbility = ["Poison Point", "Poison Touch", "Flame Body"];

module.exports = {
	getUser,
	getChannel,
	genMessage,
	getChannels,
	findLeagueId,
	findRulesId,
	getPlayersIds,
	recoilMoves,
	confusionMoves,
	toxicMoves,
	burnMoves,
	statusAbility,
};

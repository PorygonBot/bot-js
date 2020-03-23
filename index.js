//actual bot goes here
const Discord = require("discord");
const Airtable = require("airtable");
const getUrls = require("get-urls");
const psClient = require("./showdown");

//Getting config info
const { username, password, airtable_key, base_id, google_key } = require("./config.json");
//Creating the bot
const bot = new Discord.Client({ disableEveryone: true });

//When the bot goes online
bot.on("ready", async() => {
    console.log(`${bot.user.username} is online!`);
    bot.user.setActivity(`PS battles`, { type: "watching" });
});

//Getting the list of available channels
let channels = [];
const base = new Airtable({
    apiKey: airtable_key
}).base(base_id);
var viewname = "Grid view";
base('Leagues').select({
    // Selecting the first 3 records in Grid view:
    maxRecords: 3,
    view: "Grid view"
}).eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(function(record) {
        channels.push(record.get("Channel ID"));
    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    fetchNextPage();

}, function done(err) {
    if (err) { console.error(err); return; }
});

//When a message is sent
bot.on("message", async (message) => {
    let channel = message.channel;

    if (message.author.bot) return;

    let msgStr = message.content;
    let prefix = "porygon, use";

    if (channel.type === "dm") return;
    else if (channels.includes(channel.id)) {
        //Extracting battlelink from the message
        let urls = Array.from(getUrls(msgStr));
        let battlelink = urls[0];
        let psServer = "";
        //Checking what server the battlelink is from
        if (battlelink.includes("play.pokemonshowdown.com")) {
            psServer = "Standard";
        }
        else if (battlelink.includes("sports.psim.us")) {
            psServer = "Sports";
        }

        channel.send("Joining the battle...");
        //Instantiating the Showdown client
        const showdown = new psClient.Showdown(battlelink, psServer, message);
        //Tracking the battle
        let battleInfo = await showdown.track();
        channel.send(`Battle is complete! Here's the replay: ${battleInfo.replay}`);
    }
})
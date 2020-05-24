//actual bot goes here
const Discord = require("discord.js");
const Airtable = require("airtable");
const getUrls = require("get-urls");
const Showdown = require("./showdown");

//Getting config info
const { username, password, token, airtable_key, base_id, google_key } = require("./config.json");
//Creating the bot
const bot = new Discord.Client({ disableEveryone: true });

//When the bot is connected and logged in to Discord
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
    maxRecords: 50,
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
        let urls = getUrls(msgStr).values(); //This is because getUrls returns a Set
        let battlelink = urls.next().value;
        if (battlelink) {
            let psServer = "";
            //Checking what server the battlelink is from
            console.log(battlelink);
            if (battlelink.includes("sports.psim.us")) {
                psServer = "Sports";
            }
            else if (battlelink.includes("automatthic.psim.us")) {
                psServer = "Automatthic";
            }
            else if (battlelink.includes("play.pokemonshowdown.com")) {
                psServer = "Showdown";
            }
            else {
                channel.send("This link is not a valid Pokemon Showdown battle url.");
                return;
            }
    
            channel.send("Joining the battle...");
            //Instantiating the Showdown client
            const psclient = new Showdown(battlelink, psServer, message);
            //Tracking the battle
            let battleInfo = await new Promise(async (resolve, reject) => {
                resolve(await psclient.track());
            }).then(() => {
                console.log("Tracking done!");
            });
        }
    }

    if (msgStr.toLowerCase() === `${prefix} help`) {
        let bicon = bot.user.displayAvatarURL;
        let helpEmbed = new Discord.RichEmbed()
        .setTitle("Porygon Help")
        .setThumbnail(bicon)
        .setColor(0xffc0cb)
        .addField("Prefix", "porygon, use ___")
        .addField("What does Porygon do? ", "It joins a Pokemon Showdown battle when the live battle link is sent to a dedicated channel and keeps track of the deaths/kills in the battle.")
        .addField("How do I use Porygon?", `Make a dedicated live-battle-links channel, invite the bot, fill out the online dashboard (coming soon!), and start battling!!`)
        .addField("Source", "https://github.com/PorygonBot/bot")
        .setFooter("Made by @harbar20#9389", `https://pm1.narvii.com/6568/c5817e2a693de0f2f3df4d47b0395be12c45edce_hq.jpg`);

        return channel.send(helpEmbed);
    }
});

bot.login(token);

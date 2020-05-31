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

const base = new Airtable({
    apiKey: airtable_key
}).base(base_id);

//Getting the list of available channels
const getChannels = async () => {
    let channels = [];
    await base('Leagues').select({
        maxRecords: 50,
        view: "Grid view"
    }).all().then((records) => {
        records.forEach(async (record) => {
            let channelId = await record.get("Channel ID");
            channels.push(channelId);
        });
    });
    
    return channels;
}

let findLeagueId = async (checkChannelId) => {
    let leagueId;
    let leagueName;
    await base("Leagues").select({
        maxRecords: 500,
        view: "Grid view"
    }).all().then(async (records) => {
        for (let leagueRecord of records) {
            let channelId = await leagueRecord.get('Channel ID');
            if (channelId === checkChannelId) {
                leagueId = leagueRecord.id;
                leagueName = await leagueRecord.get("Name");
            }
        }
    });

    let leagueJson = {
        id: leagueId,
        name: leagueName
    };
    return leagueJson;
};

let getPlayersIds = async (leagueId) => {
    let recordsIds = await new Promise((resolve, reject) => {
        base("Leagues").find(leagueId, (err, record) => {
            if (err) reject(err);

            recordIds = record.get("Players");
            resolve(recordIds);
        });
    });

    return recordsIds;
};

let getPlayerRecordId = async (playerName) => {
    let playerId;
    
    await base("Players").select({
        maxRecords: 1000,
        view: "Grid view"
    }).all().then(async (playerRecords) => {
        for (let playerRecord of playerRecords) {
            let recordId = playerRecord.id;
            let showdownName = playerRecord.get("Showdown Name");
            if (showdownName.toLowerCase() === playerName.toLowerCase()) playerId = recordId;
        }
    });
    
    if (!playerId) playerId = false;
    return playerId;
};

//When a message is sent
bot.on("message", async (message) => {
    let channel = message.channel;
    let channels = await getChannels();

    if (message.author.bot) return;

    let msgStr = message.content;
    let msgParams = msgStr.split(" ").slice(3); //["porygon,", "use", "command", ...params]
    let prefix = "porygon, use";

    if (channel.type === "dm") return;
    if (channels.includes(channel.id)) {
        //Extracting battlelink from the message
        let urls = getUrls(msgStr).values(); //This is because getUrls returns a Set
        let battlelink = urls.next().value;
        if (battlelink) {
            let psServer = "";
            //Checking what server the battlelink is from
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

    if (msgStr.toLowerCase().startsWith( `${prefix} help`)) {
        let bicon = bot.user.displayAvatarURL;
        if (msgStr.endsWith("commands")) {
            let helpEmbed = new Discord.RichEmbed()
            .setTitle("Porygon Commands")
            .setDescription(`Prefix: ${prefix} _______`)
            .setThumbnail(bicon)
            .setColor(0xffc0cb)
            .addField("help [optional: \"commands\"]", "How to use the bot, and lists the commands it has.")
            .addField("setup", "The setup command for servers who are new to Porygon. You have to send this command in the live links channel you want to use for the league you are setting up") //TODO fix the league setup command and this help field
            .addField("add [Showdown name]", "Adds a player to the database of the league whose live links channel the command is sent in.")
            .addField("remove [Showdown name]", "Removes a player from the database of the league whose live links channel the command is sent in.")
            .addField("list", "Lists the players of the league whose live links channel the command is sent in.");

            return channel.send(helpEmbed);
        }
        let helpEmbed = new Discord.RichEmbed()
        .setTitle("Porygon Help")
        .setThumbnail(bicon)
        .setColor(0xffc0cb)
        .addField("Prefix", `${prefix} _____`)
        .addField("What does Porygon do? ", "It joins a Pokemon Showdown battle when the live battle link is sent to a dedicated channel and keeps track of the deaths/kills in the battle.")
        .addField("How do I use Porygon?", `Make a dedicated live-battle-links channel, invite the bot, fill out the online dashboard (coming soon!), and start battling!!`)
        .addField("Source", "https://github.com/PorygonBot/bot")
        .setFooter("Made by @harbar20#9389", `https://pm1.narvii.com/6568/c5817e2a693de0f2f3df4d47b0395be12c45edce_hq.jpg`);

        return channel.send(helpEmbed);
    }
    else if (msgStr.toLowerCase().startsWith(`${prefix} add`)) { //Command name might be changed
        if (!message.member.hasPermission("MANAGE_ROLES")) {
            return channel.send(":x: You're not a moderator. Ask a moderator to add this person for you.");
        }
        if (!channels.includes(channel.id)) {
            return channel.send(":x: This is not a valid live-links channel. Try this command again in the proper channel.");
        }

        //Finding the league that the player is going to get added to
        let player = msgParams.join(" ");
        let leagueJson = await findLeagueId(channel.id);
        let leagueRecordId = leagueJson.id;
        let leagueName = leagueJson.name;
        let playersIds = await getPlayersIds(leagueRecordId);
        let newId = await getPlayerRecordId(player);
        if (playersIds.includes(newId)) {
            return channel.send("This player is already in this league's database.");
        }

        //Creates a new record for the player
        await base("Players").create([
            {
                "fields": {
                    "Showdown Name": player,
                    "Leagues": [
                        leagueRecordId
                    ]
                }
            }
        ]);

        console.log(`${player} has been added to ${leagueName}!`);
        return channel.send(`\`${player}\` has been added to \`${leagueName}\`!`);
    }
    else if (msgStr.toLowerCase().startsWith(`${prefix} remove`)) {
        if (!message.member.hasPermission("MANAGE_ROLES")) {
            return channel.send(":x: You're not a moderator. Ask a moderator to remove this person for you.");
        }
        if (!channels.includes(channel.id)) {
            return channel.send(":x: This is not a valid live-links channel. Try this command again in the proper channel.");
        }

        let player = msgParams.join(" ");
        let leagueJson = await findLeagueId(channel.id);
        let leagueRecordId = leagueJson.id;
        let leagueName = leagueJson.name;
        let playersIds = await getPlayersIds(leagueRecordId);
        let newId = await getPlayerRecordId(player);
        if (!playersIds.includes(newId)) {
            return channel.send(`${player} is not in this league's database.`);
        }
        playersIds.splice(playersIds.indexOf(newId), 1);

        base("Leagues").update([
            {
                id: leagueRecordId,
                fields: {
                    "Players": playersIds
                }
            }
        ]);

        console.log(`\`${player}\` has been removed from \`${leagueName}\`.`);
        return channel.send(`\`${player}\` has been removed from \`${leagueName}\`.`);
    }
    else if (msgStr.toLowerCase().startsWith(`${prefix} list`)) {
        if (!channels.includes(channel.id)) {
            return channel.send(":x: This is not a valid live-links channel. Try this command again in the proper channel.");
        }
        let leagueJson = await findLeagueId(channel.id);
        let playersIds = await getPlayersIds(leagueJson.id);

        let players = [];
        let funcarr = [];
        for (let playerId of playersIds) {
            funcarr.push(new Promise(async (resolve, reject) => {
                await base("Players").find(playerId, async (err, record) => {
                    if (err) reject(err);

                    let name = await record.get("Showdown Name");
                    players.push(`\n${name}`);
                    resolve();
                });
            }));
        }
        await Promise.all(funcarr);
        playersStr = players.join();

        //const serverImage = message.guild.iconURL();
        //console.log(serverImage);
        const listEmbed = new Discord.RichEmbed()
        .setTitle(leagueJson.name)
        .addField('Players', playersStr);

        return channel.send(listEmbed);
    }
    /*
    else if (msgStr.toLowerCase().contains(`${prefix} setup`)) {
        if (!message.member.hasPermission("MANAGE_ROLES")) {
            return channel.send(":x: You're not a moderator. Ask a moderator to set up the bot for this server.");
        }
        const filter = (m) => m.author.id === message.author.id;
        const collector = message.channel.createMessageCollector(filter);

        //Creating a record in the Servers table for this new server
        let serverRecord = await new Promise((resolve, reject) => {
            base("Servers").create([
                {
                    "fields": {
                        "Name": message.guild.name
                    }
                }
            ], (err, records) => {
                if (err) reject(err);

                resolve(records[0]);
            });
        });

        message.channel.send("Setup has begun. To add this league, send the following command: \`porygon, use league [INSERT LEAGUE NAME HERE]\`. Spaces are ok.");
        let leagueRecord;
        collector.on("collect", async (m) => {
            if (m.content.toLowerCase() === `${prefix} endsetup`) {
                collector.stop();
            }
            //Adding a league to the server record
            else if (m.content.toLowerCase().startsWith(`${prefix} league`)) {
                console.log("Starting league creation...");
                leagueName = m.content.split(" ").slice(3).join(" ");

                //To get stream channel id
                message.channel.send(`Now, run \`porygon, use statschannel [INSERT CHANNEL HERE]\`. This channel that you are inserting is the channel that you want the match results, or stats & replay, to go in. Make sure you actually include the #, etc. part in the channel area like you normally would when referring to a channel.`);

                //Creating the record in the database
                leagueRecord = await new Promise((resolve, reject) => {
                    base("Leagues").create([
                        {
                            "fields": {
                                "Name": leagueName,
                                "Server": [serverRecord.id],
                                "Channel ID": message.channel.id,
                                "Stats Storage System": "Discord DM"
                            }
                        }
                    ], (err, records) => {
                        if (err) reject(err);

                        resolve(records[0]);
                    });
                });
            }
            else if (m.content.toLowerCase().startsWith(`${prefix} statschannel`)) {
                let streamChannel = m.content.split(" ")[3];

                base("Leagues").update([
                    {
                        "id": leagueRecord.id,
                        "fields": {
                            "Stream Channel ID": streamChannel.id
                        }
                    }
                ]);
                message.channel.send("I've set the current channel to your live links channel and received the stream channel as well.");
                message.channel.send(`\`${leagueName}\` setup is complete. If you'd like to add another league, go to that league's live links channel and run \`porygon, use setup\` there. For now, run \`porygon, use endsetup\` in this channel.`);
            }
        });

        collector.on("end", async (collected) => {
            let leagueName = await leagueRecord.get("Name");
            message.channel.send(`${leagueName} setup complete. You may now start adding players to your league.`);
            console.log(`${leagueName} has just been setup.`);
        });
    }
    */
});

bot.login(token);

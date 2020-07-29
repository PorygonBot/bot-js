const Client = require('ps-client').Client;
let Bot = new Client({username: 'PorygonTesting', password: 'porygonisverycool', debug: true, avatar: 'supernerd'});

Bot.connect();

Bot.on("connect", () => {
    console.log(Bot.send('/join botdevelopment'));
})

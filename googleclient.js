const {google} = require('googleapis');
const http = require('http');
const url = require('url');
const opn = require('open');
const destroyer = require('server-destroy');
const fs = require('fs');
const path = require('path');

const keyfile = path.join(__dirname, "client_secret.json");
const keys = JSON.parse(fs.readFileSync(keyfile)).web;

class GoogleClient {
    constructor(options) {
        this._options = options || {scopes: ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/spreadsheets']}

        const redirectUri = keys.redirect_uris[0];
    
        //Create an OAuth client to authorize the API call
        this.oAuth2Client = new google.auth.OAuth2(
            keys.client_id,
            keys.client_secret,
            redirectUri
        );
    }

    async authenticate(scopes) {
        return new Promis((resolve, reject) => {
            this.authorizeUrl = this.oAuth2Client.generateAuthUrl({
                access_type: "offline",
                scope: scopes.join(" ")
            });

            const server = http.createServer(async (req, res) => {
                try {
                    if (req.url.indexOf("/oauth2callback") > -1) {
                        const qs = new url.URL(req.url, "").searchParams;
                        res.end(`Authentication successful! Please return to the console.`);
                        server.destroy();

                        const {tokens} = await this.oAuth2Client.getToken(qs.get("code"));
                        this.oAuth2Client.credentials = tokens;

                        resolve(this.oAuth2Client);
                    }
                }
                catch (e) {
                    reject(e);
                }
            }).listen(3000, () => {
                opn(this.authorizeUrl, {wait: false}).then(cp => cp.unref());
            });

            destroyer(server);
        })
    }
}

module.exports = new GoogleClient();
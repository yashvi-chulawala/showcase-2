const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// The file downloaded from Google Cloud Console containing client ID and secret
const CLIENT_SECRET_FILE = 'oauth-client.json';
const TOKEN_PATH = 'oauth-tokens.json';
const SCOPES = ['https://www.googleapis.com/auth/drive'];

fs.readFile(CLIENT_SECRET_FILE, (err, content) => {
  if (err) {
    console.error('Error loading client secret file:', err);
    console.log('\nPlease download your OAuth 2.0 Client credentials from Google Cloud Console');
    console.log('and save them as "oauth-client.json" in this directory.');
    return;
  }
  authorize(JSON.parse(content), getAccessToken);
});

function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  // Use the first redirect URI or a standard OOB port if none available
  const redirectUri = (redirect_uris && redirect_uris.length > 0) ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob';
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  callback(oAuth2Client);
}

function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force to get refresh token
  });
  
  console.log('\n======================================');
  console.log('Authorize this app by visiting this url:');
  console.log(authUrl);
  console.log('======================================\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      
      fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
        console.log('Setup complete! You can now start the backend server.');
      });
    });
  });
}

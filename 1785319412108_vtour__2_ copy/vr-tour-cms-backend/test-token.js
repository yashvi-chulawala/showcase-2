const { GoogleAuth } = require('google-auth-library');
async function run() {
  try {
    const auth = new GoogleAuth({
      keyFile: './service-account.json',
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log("Token generated:", token.token ? "YES" : "NO");
  } catch(e) {
    console.error(e);
  }
}
run();

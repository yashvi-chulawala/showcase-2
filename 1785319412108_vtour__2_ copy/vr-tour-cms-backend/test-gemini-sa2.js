const { GoogleAuth } = require('google-auth-library');
async function run() {
  const auth = new GoogleAuth({
    keyFile: './service-account.json',
    scopes: ['https://www.googleapis.com/auth/generative-language']
  });
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log("Token:", token.token ? "YES" : "NO");
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'Authorization': `Bearer ${token.token}` }
    });
    const json = await res.json();
    console.log("Generative Language Models:", json.models ? json.models.length : json);
  } catch(e) { console.error(e.message); }
}
run();

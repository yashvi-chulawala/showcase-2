const { GoogleAuth } = require('google-auth-library');
async function run() {
  const auth = new GoogleAuth({
    keyFile: './service-account.json',
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const res = await fetch('https://us-central1-aiplatform.googleapis.com/v1beta1/projects/lively-tensor-500910-u0/locations/us-central1/publishers/google/models', {
    headers: { 'Authorization': `Bearer ${token.token}` }
  });
  const json = await res.json();
  console.log(JSON.stringify(json).substring(0, 500));
}
run();

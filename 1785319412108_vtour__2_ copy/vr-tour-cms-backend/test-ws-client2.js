const WebSocket = require('ws');
const { GoogleAuth } = require('google-auth-library');

async function run(modelName) {
  const auth = new GoogleAuth({
    keyFile: './service-account.json',
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const projectId = await auth.getProjectId();
  const region = 'us-central1';

  const wsUrl = `wss://${region}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent?access_token=${token.token}`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    ws.send(JSON.stringify({
      setup: {
        model: modelName
      }
    }));
  });
  ws.on('close', (code, reason) => {
    console.log(`[${modelName}] Closed: ${code} - ${reason.toString()}`);
  });
}

run(`projects/lively-tensor-500910-u0/locations/us-central1/publishers/google/models/gemini-2.0-flash-exp`);
run(`publishers/google/models/gemini-2.0-flash-exp`);
run(`projects/lively-tensor-500910-u0/locations/us-central1/publishers/google/models/gemini-1.5-pro`);

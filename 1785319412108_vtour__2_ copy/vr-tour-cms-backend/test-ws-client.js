const WebSocket = require('ws');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function run() {
  const ai = new GoogleGenAI({});
  const response = await ai.authTokens.create({ config: {} });
  const token = response.name.replace('auth_tokens/', '');
  
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?bearer_token=${token}`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log("WS Opened. Sending setup...");
    ws.send(JSON.stringify({
      setup: {
        model: `models/gemini-2.0-flash-exp`
      }
    }));
  });

  ws.on('message', (data) => {
    console.log("WS Message received:", data.toString());
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error("WS Error:", err);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WS Closed: ${code} - ${reason.toString()}`);
  });
}
run();

const WebSocket = require('ws');
require('dotenv').config();

async function run() {
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log("WS Opened");
    ws.send(JSON.stringify({
      setup: { model: `models/gemini-2.5-flash-native-audio-latest` }
    }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log("Msg:", Object.keys(msg));
    if (msg.setupComplete) {
      console.log("Sending turnComplete...");
      ws.send(JSON.stringify({
        clientContent: {
          turnComplete: true
        }
      }));
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WS Closed: ${code} - ${reason.toString()}`);
  });
}
run();

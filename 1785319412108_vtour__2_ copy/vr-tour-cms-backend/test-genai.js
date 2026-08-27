require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
async function run() {
  try {
    const ai = new GoogleGenAI({});
    const response = await ai.authTokens.create({ config: {} });
    console.log(response);
  } catch(e) {
    console.error(e);
  }
}
run();

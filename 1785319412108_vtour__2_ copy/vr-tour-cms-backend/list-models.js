require('dotenv').config();
async function run() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
  const json = await res.json();
  if (json.models) {
    const bidiModels = json.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('bidiGenerateContent'));
    console.log("Models supporting Bidi:", bidiModels.map(m => m.name));
  } else {
    console.log("Error:", json);
  }
}
run();

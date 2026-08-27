const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ vertexai: { project: 'test-project', location: 'us-central1' }, apiKey: 'mock' });
ai.live.connect({ model: 'gemini-2.0-flash-exp' }).catch(() => {});

const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let key = '';
for (const line of env) {
  if (line.startsWith('KIE_API_KEY=')) {
    key = line.split('=')[1].trim();
  }
}
if (!key) { console.log('NO KEY'); process.exit(0); }

const requestBody = {
  "input": [
    {
      "content": [
        {
          "text": "{\n  \"operation\": \"knowledge_analysis\",\n  \"input\": {\n    \"retrievedContext\": {\n      \"items\": []\n    },\n    \"userMessage\": \"Hello world\",\n    \"responseText\": \"Hi there\"\n  }\n}",
          "type": "input_text"
        }
      ],
      "role": "user"
    }
  ],
  "instructions": "Extract knowledge. Return JSON.",
  "max_output_tokens": 128000,
  "model": "gpt-6-luna",
  "reasoning": {
    "effort": "none"
  },
  "temperature": 0,
  "text": {
    "format": {
      "type": "text"
    }
  }
};

fetch('https://api.kie.ai/codex/v1/responses', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody)
})
.then(async r => {
  console.log("HTTP STATUS:", r.status);
  const text = await r.text();
  console.log('RAW RESPONSE:\n' + text);
})
.catch(e => console.error(e));

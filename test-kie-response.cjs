const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let key = '';
for (const line of env) {
  if (line.startsWith('KIE_API_KEY=')) {
    key = line.split('=')[1].trim();
  }
}
if (!key) { console.log('NO KEY'); process.exit(0); }

fetch('https://api.kie.ai/codex/v1/responses', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-6-luna',
    text: { format: { type: 'text' } },
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: 'Reply with {"ok": true}' }]
      }
    ]
  })
}).then(r => r.text()).then(t => console.log('RAW RESPONSE:\n' + t.substring(0, 1000))).catch(e => console.error(e));

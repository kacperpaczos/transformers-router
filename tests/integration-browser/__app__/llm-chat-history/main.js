/* eslint-env browser */
/* global document */
import { initProviderWithUI } from '../../__assets__/common.js';

const provider = await initProviderWithUI({
  modality: 'llm',
  config: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 40 }
});

const input = document.getElementById('chat-input');
const btnSend = document.getElementById('send-btn');
const btnClear = document.getElementById('clear-btn');
const btnDemo = document.getElementById('demo-turns');
const btnSystem = document.getElementById('system-prompt');
const messagesEl = document.getElementById('messages');

let messages = [];

function render() {
  const text = messages.map(m => `${m.role}> ${m.content}`).join('\n');
  messagesEl.textContent = text;
}

btnSend?.addEventListener('click', async () => {
  const content = input?.value?.trim();
  if (!content) return;
  input.value = '';
  try {
    messages.push({ role: 'user', content });
    render();
    const res = await provider.chat(messages);
    messages.push({ role: 'assistant', content: res.content });
    render();
  } catch (e) {
    console.error(e);
  }
});

btnClear?.addEventListener('click', () => {
  messages = [];
  render();
});

btnDemo?.addEventListener('click', async () => {
  try {
    messages = [{ role: 'system', content: 'You are concise.' }];
    messages.push({ role: 'user', content: 'My name is Alice' });
    let r1 = await provider.chat(messages);
    messages.push({ role: 'assistant', content: r1.content });
    messages.push({ role: 'user', content: 'What is my name?' });
    let r2 = await provider.chat(messages);
    messages.push({ role: 'assistant', content: r2.content });
    render();
  } catch (e) { console.error(e); }
});

btnSystem?.addEventListener('click', async () => {
  try {
    messages = [];
    const r = await provider.chat('What is 2+2?', {
      systemPrompt: 'You are a helpful math assistant.'
    });
    messages = [
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: r.content }
    ];
    render();
  } catch (e) { console.error(e); }
});



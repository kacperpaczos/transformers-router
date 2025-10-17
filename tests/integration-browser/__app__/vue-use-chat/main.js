/* eslint-env browser */
import { createApp, h, ref } from 'vue';

const App = {
  setup() {
    const messages = ref([]);
    const input = ref('Hello');
    const isLoading = ref(false);
    const error = ref(null);
    let providerRef = null;

    (async () => {
      const { useAIProvider } = await import('/dist/vue/useAIProvider.js');
      const { useChat } = await import('/dist/vue/useChat.js');
      const prov = useAIProvider({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 10 }, autoLoad: true });
      providerRef = prov.provider;
      const chat = useChat(prov.provider, {});
      Object.assign(messages, chat.messages);
      Object.assign(isLoading, chat.isLoading);
      Object.assign(error, chat.error);
      // expose send
      // @ts-ignore
      window._send = chat.send;
      window.testReady = true;
    })();

    const send = async () => {
      if (!window._send) return;
      await window._send(input.value);
      input.value = '';
    };

    return { messages, input, isLoading, error, send };
  },
  template: `
    <div>
      <div class="status-row">
        <input v-model="input" placeholder="Wiadomość..." style="flex:1; padding:8px; border:1px solid #e5e7eb; border-radius:8px;" />
        <button class="btn" @click="send" :disabled="isLoading">Wyślij</button>
      </div>
      <pre>{{ messages }}</pre>
      <div v-if="error">Error: {{ error.message }}</div>
    </div>
  `
};

createApp({ render: () => h(App) }).mount('#app');



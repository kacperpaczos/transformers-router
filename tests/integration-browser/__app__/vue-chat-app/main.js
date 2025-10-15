/* eslint-env browser */
import { createApp, h, ref } from 'vue';

const ChatApp = {
  setup() {
    const messages = ref([]);
    const input = ref('Hello');
    const isLoading = ref(false);
    let chatApi = null;

    (async () => {
      const { useAIProvider } = await import('/dist/vue/useAIProvider.js');
      const { useChat } = await import('/dist/vue/useChat.js');
      const prov = useAIProvider({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 12 }, autoLoad: true });
      chatApi = useChat(prov.provider, {});
      Object.assign(messages, chatApi.messages);
      Object.assign(isLoading, chatApi.isLoading);
      window.testReady = true;
    })();

    const send = async () => {
      if (!chatApi) return;
      await chatApi.send(input.value);
      input.value = '';
    };

    const clear = () => {
      chatApi?.clear?.();
    };

    return { messages, input, isLoading, send, clear };
  },
  template: `
    <div>
      <div class="status-row">
        <input v-model="input" placeholder="Wiadomość..." style="flex:1; padding:8px; border:1px solid #e5e7eb; border-radius:8px;" />
        <button class="btn" @click="send" :disabled="isLoading">Wyślij</button>
        <button class="btn" @click="clear">Wyczyść</button>
      </div>
      <pre>{{ messages }}</pre>
    </div>
  `
};

createApp({ render: () => h(ChatApp) }).mount('#app');



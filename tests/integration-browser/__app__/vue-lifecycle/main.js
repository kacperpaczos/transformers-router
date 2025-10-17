/* eslint-env browser */
import { createApp, h, ref, onUnmounted } from 'vue';

const App = {
  setup() {
    const isReady = ref(false);
    const statuses = ref([]);
    let provider = null;

    (async () => {
      const { useAIProvider } = await import('/dist/vue/useAIProvider.js');
      const p = useAIProvider({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 } });
      provider = p.provider.value;
      window.testReady = true;
    })();

    const warmup = async () => {
      if (!provider) return;
      await provider.warmup('llm');
      isReady.value = provider.isReady('llm');
      statuses.value = provider.getAllStatuses();
    };

    const dispose = async () => {
      if (!provider) return;
      await provider.dispose();
      isReady.value = false;
      statuses.value = [];
    };

    onUnmounted(() => {
      provider?.dispose?.();
    });

    return { isReady, statuses, warmup, dispose };
  },
  template: `
    <div>
      <div class="status-row">
        <button class="btn" @click="warmup">Warmup</button>
        <button class="btn" @click="dispose">Dispose</button>
        <div>{{ isReady ? 'ready' : 'idle' }}</div>
      </div>
      <pre>{{ statuses }}</pre>
    </div>
  `
};

createApp({ render: () => h(App) }).mount('#app');



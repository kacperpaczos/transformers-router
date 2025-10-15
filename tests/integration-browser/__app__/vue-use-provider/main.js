/* eslint-env browser */
import { createApp, h } from 'vue';

const App = {
  template: `
  <div>
    <div class="status-row">
      <button class="btn" data-testid="start-warmup" @click="warmup">Warmup LLM</button>
      <div data-testid="status">{{ isReady ? 'ready' : (isLoading ? 'loading' : 'idle') }}</div>
      <div data-testid="file">-</div>
      <div data-testid="progress">{{ progress?.progress || 0 }}</div>
    </div>
    <div class="progressbar"><div class="progressbar__fill" :style="{ width: (progress?.progress||0)+'%' }"></div></div>

    <pre>{{ statuses }}</pre>
  </div>
  `,
  data() {
    return { provider: null, isReady: false, isLoading: false, progress: null, statuses: [] };
  },
  methods: {
    async warmup() {
      if (!this.provider) return;
      this.isLoading = true;
      await this.provider.warmup('llm');
      this.isReady = true;
      this.isLoading = false;
      this.statuses = this.provider.getAllStatuses();
    }
  },
  async mounted() {
    const { useAIProvider } = await import('/dist/vue/useAIProvider.js');
    const hook = useAIProvider({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 } });
    this.provider = hook.provider.value;
    this.progress = hook.progress.value;
    this.isReady = hook.isReady.value;
    this.isLoading = hook.isLoading.value;
    this.statuses = hook.statuses.value;
    window.testReady = true;
  }
};

createApp({ render: () => h(App) }).mount('#app');



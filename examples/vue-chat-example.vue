<template>
  <div class="chat-app">
    <h1>🤖 Vue Chat z Transformers.js</h1>
    
    <!-- Status -->
    <div class="status-card" :class="{ ready: isReady, loading: isLoading }">
      <div v-if="isLoading">
        <strong>Ładowanie modelu...</strong>
        <div v-if="progress">
          {{ progress.file }}: {{ progress.progress }}%
        </div>
      </div>
      <div v-else-if="isReady">
        <strong>✅ Model gotowy</strong>
      </div>
      <div v-if="providerError" class="error">
        ❌ Błąd: {{ providerError.message }}
      </div>
    </div>

    <!-- Messages -->
    <div class="messages-container" ref="messagesContainer">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="message"
        :class="msg.role"
      >
        <div class="message-content">
          <em v-if="msg.role === 'system'">System: {{ msg.content }}</em>
          <template v-else>{{ msg.content }}</template>
        </div>
      </div>
      <div v-if="isSending" class="loading-message">
        Generowanie odpowiedzi...
      </div>
    </div>

    <!-- Input -->
    <div class="input-container">
      <input
        v-model="input"
        @keypress.enter="handleSend"
        placeholder="Napisz wiadomość..."
        :disabled="!isReady || isSending"
        class="message-input"
      />
      <button
        @click="handleSend"
        :disabled="!isReady || isSending || !input.trim()"
        class="send-button"
      >
        Wyślij
      </button>
      <button
        @click="clear"
        :disabled="messages.length === 0"
        class="clear-button"
      >
        Wyczyść
      </button>
    </div>

    <div v-if="chatError" class="error-message">
      Błąd: {{ chatError.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useAIProvider, useChat } from 'transformers-router/vue';

// Initialize AI Provider
const {
  provider,
  isReady,
  isLoading,
  progress,
  error: providerError,
} = useAIProvider({
  llm: {
    model: 'onnx-community/Qwen2.5-0.5B-Instruct',
    dtype: 'q4',
  },
  autoLoad: true,
});

// Initialize Chat
const {
  messages,
  isLoading: isSending,
  error: chatError,
  send,
  clear,
} = useChat(provider, {
  initialMessages: [
    {
      role: 'system',
      content: 'Jesteś pomocnym asystentem AI.',
    },
  ],
});

const input = ref('');
const messagesContainer = ref<HTMLElement>();

// Handle send message
const handleSend = async () => {
  if (!input.value.trim()) return;
  
  await send(input.value);
  input.value = '';
  
  // Scroll to bottom
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Auto-scroll on new messages
watch(messages, async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}, { deep: true });
</script>

<style scoped>
.chat-app {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 20px;
}

.status-card {
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 10px;
  background: #fff3cd;
}

.status-card.ready {
  background: #d4edda;
}

.status-card.loading {
  background: #cce5ff;
}

.messages-container {
  height: 400px;
  overflow-y: auto;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 10px;
  margin-bottom: 20px;
}

.message {
  display: flex;
  margin-bottom: 10px;
}

.message.user {
  justify-content: flex-end;
}

.message.assistant,
.message.system {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 10px 15px;
  border-radius: 15px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.message.user .message-content {
  background: #667eea;
  color: #fff;
}

.message.assistant .message-content,
.message.system .message-content {
  background: #fff;
  color: #333;
}

.loading-message {
  text-align: center;
  color: #666;
  font-style: italic;
}

.input-container {
  display: flex;
  gap: 10px;
}

.message-input {
  flex: 1;
  padding: 12px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
}

.message-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-button,
.clear-button {
  padding: 12px 24px;
  font-size: 16px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  color: #fff;
}

.send-button {
  background: #667eea;
}

.clear-button {
  background: #6c757d;
}

.send-button:disabled,
.clear-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message,
.error {
  margin-top: 10px;
  padding: 10px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 5px;
}
</style>


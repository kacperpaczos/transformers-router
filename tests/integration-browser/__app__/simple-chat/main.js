import { initProviderWithUI } from '/tests/integration-browser/__assets__/common.js';

class SimpleChat {
  constructor() {
    this.provider = null;
    this.conversation = [];
    this.isReady = false;
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.chatArea = document.getElementById('chat-area');
    this.messageInput = document.getElementById('message-input');
    this.sendButton = document.getElementById('send-button');
    this.loadModelButton = document.getElementById('load-model');
    this.clearChatButton = document.getElementById('clear-chat');
    this.statusElement = document.querySelector('[data-testid="status"]');
    this.progressElement = document.querySelector('[data-testid="progress"]');
    this.progressFill = document.querySelector('.progressbar__fill');
  }

  setupEventListeners() {
    this.loadModelButton.addEventListener('click', () => this.loadModel());
    this.clearChatButton.addEventListener('click', () => this.clearChat());
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  async loadModel() {
    if (this.provider) return;
    
    this.loadModelButton.disabled = true;
    this.loadModelButton.textContent = 'Loading...';
    
    try {
      this.provider = await initProviderWithUI({
        modality: 'llm',
        config: {
          model: 'Xenova/gpt2', // Fast model for quick testing
          dtype: 'fp32',
          device: 'cpu',
          maxTokens: 50,
        }
      });

      this.provider.on('ready', () => {
        this.isReady = true;
        this.loadModelButton.textContent = 'Model Ready';
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        this.addMessage('ai', 'Model loaded! You can now chat with me.');
      });

      this.provider.on('error', ({ error }) => {
        console.error('Error:', error);
        this.addMessage('ai', `Error: ${error.message}`);
        this.loadModelButton.textContent = 'Load Model';
        this.loadModelButton.disabled = false;
      });

    } catch (error) {
      console.error('Error loading model:', error);
      this.addMessage('ai', `Error loading model: ${error.message}`);
      this.loadModelButton.textContent = 'Load Model';
      this.loadModelButton.disabled = false;
    }
  }

  addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type === 'user' ? 'user-message' : 'ai-message'}`;
    messageDiv.textContent = content;
    
    this.chatArea.appendChild(messageDiv);
    this.chatArea.scrollTop = this.chatArea.scrollHeight;
  }

  async sendMessage() {
    if (!this.isReady || !this.messageInput.value.trim()) return;

    const userMessage = this.messageInput.value.trim();
    this.messageInput.value = '';
    this.sendButton.disabled = true;
    
    // Add user message to chat
    this.addMessage('user', userMessage);
    
    // Add to conversation history
    this.conversation.push({ role: 'user', content: userMessage });

    try {
      // Show typing indicator
      this.addMessage('ai', '...');
      
      // Get AI response
      const response = await this.provider.chat(this.conversation);
      
      // Remove typing indicator
      this.chatArea.removeChild(this.chatArea.lastChild);
      
      // Add AI response
      this.addMessage('ai', response.content);
      this.conversation.push({ role: 'assistant', content: response.content });
      
    } catch (error) {
      console.error('Error getting response:', error);
      // Remove typing indicator
      this.chatArea.removeChild(this.chatArea.lastChild);
      this.addMessage('ai', `Error: ${error.message}`);
    } finally {
      this.sendButton.disabled = false;
      this.messageInput.focus();
    }
  }

  clearChat() {
    this.conversation = [];
    this.chatArea.innerHTML = '<div class="message ai-message">Chat cleared. Start a new conversation!</div>';
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new SimpleChat();
});

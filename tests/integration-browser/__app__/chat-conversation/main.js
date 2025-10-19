import { initProviderWithUI } from '/tests/integration-browser/__assets__/common.js';

class ChatApp {
  constructor() {
    this.provider = null;
    this.conversation = [];
    this.isLoading = false;
    
    this.initializeElements();
    this.setupEventListeners();
    this.updateStatus('idle', 'Not loaded');
  }

  initializeElements() {
    this.modelSelect = document.getElementById('model-select');
    this.maxTokensInput = document.getElementById('max-tokens');
    this.temperatureInput = document.getElementById('temperature');
    this.statusIndicator = document.getElementById('status-indicator');
    this.statusText = document.getElementById('status-text');
    this.typingIndicator = document.getElementById('typing-indicator');
    this.chatMessages = document.getElementById('chat-messages');
    this.messageInput = document.getElementById('message-input');
    this.sendButton = document.getElementById('send-button');
    this.statusElement = document.querySelector('[data-testid="status"]');
    this.fileElement = document.querySelector('[data-testid="file"]');
    this.progressElement = document.querySelector('[data-testid="progress"]');
    this.progressFill = document.querySelector('.progressbar__fill');
  }

  setupEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Load model button
    const loadButton = document.createElement('button');
    loadButton.textContent = 'Load Model';
    loadButton.className = 'btn';
    loadButton.addEventListener('click', () => this.loadModel());
    
    const controls = document.querySelector('.controls');
    controls.appendChild(loadButton);

    // Clear conversation button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Chat';
    clearButton.className = 'btn';
    clearButton.addEventListener('click', () => this.clearConversation());
    
    controls.appendChild(clearButton);
  }

  updateStatus(status, text) {
    this.statusIndicator.className = `status-indicator status-${status}`;
    this.statusText.textContent = text;
    this.statusElement.textContent = status;
  }

  updateProgress(progress, file = '') {
    this.progressElement.textContent = Math.round(progress);
    this.progressFill.style.width = `${progress}%`;
    this.fileElement.textContent = file;
  }

  async loadModel() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.updateStatus('loading', 'Loading model...');
    this.updateProgress(0, 'Initializing...');

    try {
      const modelName = this.modelSelect.value;
      
      // Create provider with selected model using initProviderWithUI
      this.provider = await initProviderWithUI({
        modality: 'llm',
        config: {
          model: modelName,
          dtype: 'fp32',
          device: 'cpu',
          maxTokens: parseInt(this.maxTokensInput.value),
        }
      });

      // Listen to progress events
      this.provider.on('progress', ({ modality, status, file, progress }) => {
        if (modality === 'llm') {
          this.updateProgress(progress || 0, file || status);
          console.log(`[${status}] ${file || ''} ${progress ? `${progress}%` : ''}`);
        }
      });

      this.provider.on('ready', ({ modality }) => {
        if (modality === 'llm') {
          this.updateStatus('ready', 'Model ready');
          this.updateProgress(100, 'Ready');
          this.enableChat();
          this.addSystemMessage('Model loaded successfully! You can now start chatting.');
        }
      });

      // Load the model
      await this.provider.warmup('llm');
      
    } catch (error) {
      console.error('Error loading model:', error);
      this.updateStatus('error', `Error: ${error.message}`);
      this.addSystemMessage(`Error loading model: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  enableChat() {
    this.messageInput.disabled = false;
    this.sendButton.disabled = false;
    this.messageInput.focus();
  }

  addMessage(role, content, isTyping = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.textContent = role === 'user' ? 'You' : role === 'assistant' ? 'AI' : 'System';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    
    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    
    return messageDiv;
  }

  addSystemMessage(content) {
    this.addMessage('system', content);
  }

  showTypingIndicator() {
    this.typingIndicator.classList.add('show');
  }

  hideTypingIndicator() {
    this.typingIndicator.classList.remove('show');
  }

  async sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message || !this.provider || this.isLoading) return;

    // Add user message
    this.addMessage('user', message);
    this.conversation.push({ role: 'user', content: message });
    
    // Clear input and disable
    this.messageInput.value = '';
    this.sendButton.disabled = true;
    this.messageInput.disabled = true;
    this.isLoading = true;

    // Show typing indicator
    this.showTypingIndicator();
    this.updateStatus('loading', 'AI is thinking...');

    try {
      // Send to AI
      const response = await this.provider.chat(this.conversation, {
        maxTokens: parseInt(this.maxTokensInput.value),
        temperature: parseFloat(this.temperatureInput.value),
      });

      // Add AI response
      this.addMessage('assistant', response.content);
      this.conversation.push({ role: 'assistant', content: response.content });
      
      this.updateStatus('ready', 'Model ready');

    } catch (error) {
      console.error('Error getting AI response:', error);
      this.addSystemMessage(`Error: ${error.message}`);
      this.updateStatus('error', `Error: ${error.message}`);
    } finally {
      // Re-enable input
      this.hideTypingIndicator();
      this.sendButton.disabled = false;
      this.messageInput.disabled = false;
      this.messageInput.focus();
      this.isLoading = false;
    }
  }

  clearConversation() {
    this.conversation = [];
    this.chatMessages.innerHTML = '';
    this.addSystemMessage('Conversation cleared. Start a new chat!');
  }
}

// Initialize the chat app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});

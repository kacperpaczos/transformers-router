/**
 * React Chat Example with Transformers Router
 * 
 * To use this example:
 * 1. Install dependencies: npm install react react-dom @types/react @types/react-dom
 * 2. Add to your React app
 */

import React, { useEffect } from 'react';
import { useAIProvider, useChat } from 'transformers-router/react';

export function ChatApp() {
  const {
    provider,
    isReady,
    isLoading,
    progress,
    error: providerError,
    warmup,
  } = useAIProvider({
    llm: {
      model: 'onnx-community/Qwen2.5-0.5B-Instruct',
      dtype: 'q4',
    },
    autoLoad: true, // Auto-load model on mount
  });

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

  const [input, setInput] = React.useState('');

  const handleSend = async () => {
    if (!input.trim()) return;
    
    await send(input);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>React Chat with Transformers.js</h1>
      
      {/* Status */}
      <div style={{ 
        padding: '15px', 
        marginBottom: '20px', 
        borderRadius: '10px',
        background: isReady ? '#d4edda' : '#fff3cd'
      }}>
        {isLoading && (
          <div>
            <strong>Ładowanie modelu...</strong>
            {progress && (
              <div>
                {progress.file}: {progress.progress}%
              </div>
            )}
          </div>
        )}
        {isReady && <strong>Model ready</strong>}
        {providerError && (
          <div style={{ color: '#721c24' }}>
            Error: {providerError.message}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        height: '400px',
        overflowY: 'auto',
        padding: '20px',
        background: '#f5f5f5',
        borderRadius: '10px',
        marginBottom: '20px',
      }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '10px 15px',
                borderRadius: '15px',
                background: msg.role === 'user' ? '#667eea' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#333',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              }}
            >
              {msg.role === 'system' ? (
                <em>System: {msg.content}</em>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div style={{ textAlign: 'center', color: '#666' }}>
            Generowanie odpowiedzi...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Napisz wiadomość..."
          disabled={!isReady || isSending}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '16px',
            border: '2px solid #e0e0e0',
            borderRadius: '10px',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!isReady || isSending || !input.trim()}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#667eea',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: !isReady || isSending ? 'not-allowed' : 'pointer',
            opacity: !isReady || isSending ? 0.6 : 1,
          }}
        >
          Wyślij
        </button>
        <button
          onClick={clear}
          disabled={messages.length === 0}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
            opacity: messages.length === 0 ? 0.6 : 1,
          }}
        >
          Wyczyść
        </button>
      </div>

      {chatError && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          background: '#f8d7da',
          color: '#721c24',
          borderRadius: '5px',
        }}>
          Błąd: {chatError.message}
        </div>
      )}
    </div>
  );
}

// Example usage in your app:
// import { ChatApp } from './examples/react-chat-example';
// 
// function App() {
//   return <ChatApp />;
// }


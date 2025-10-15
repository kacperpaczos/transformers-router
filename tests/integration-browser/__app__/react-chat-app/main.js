/* eslint-env browser */
import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('Hello');
  const [isLoading, setIsLoading] = React.useState(false);
  const chatRef = React.useRef(null);

  React.useEffect(() => {
    (async () => {
      const { useAIProvider } = await import('/dist/react/useAIProvider.js');
      const { useChat } = await import('/dist/react/useChat.js');
      const hook = useAIProvider({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 12 }, autoLoad: true });
      const chat = useChat(hook.provider, {});
      chatRef.current = chat;
      setMessages(chat.messages);
      setIsLoading(chat.isLoading);
      window.testReady = true;
    })();
  }, []);

  const send = async () => {
    if (!chatRef.current) return;
    await chatRef.current.send(input);
    setMessages(chatRef.current.messages);
    setInput('');
  };

  const clear = () => chatRef.current?.clear?.();

  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'status-row' },
        React.createElement('input', { value: input, onChange: (e) => setInput(e.target.value), placeholder: 'Wiadomość...', style: { flex: 1, padding: '8px', border: '1px solid #e5e7eb', borderRadius: '8px' } }),
        React.createElement('button', { className: 'btn', onClick: send, disabled: isLoading }, 'Wyślij'),
        React.createElement('button', { className: 'btn', onClick: clear }, 'Wyczyść')
      ),
      React.createElement('pre', null, JSON.stringify(messages, null, 2))
    )
  );
}

createRoot(document.getElementById('root')).render(React.createElement(App));



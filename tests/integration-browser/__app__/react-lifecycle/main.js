/* eslint-env browser */
import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [isReady, setIsReady] = React.useState(false);
  const [statuses, setStatuses] = React.useState([]);
  const providerRef = React.useRef(null);

  React.useEffect(() => {
    (async () => {
      const { useAIProvider } = await import('/dist/react/useAIProvider.js');
      const hook = useAIProvider({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }, autoLoad: false });
      providerRef.current = hook.provider;
      window.testReady = true;
    })();
  }, []);

  const warmup = async () => {
    if (!providerRef.current) return;
    await providerRef.current.warmup('llm');
    setIsReady(true);
    setStatuses(providerRef.current.getAllStatuses());
  };

  const dispose = async () => {
    if (!providerRef.current) return;
    await providerRef.current.dispose();
    setIsReady(false);
    setStatuses([]);
  };

  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'status-row' },
        React.createElement('button', { className: 'btn', onClick: warmup }, 'Warmup'),
        React.createElement('button', { className: 'btn', onClick: dispose }, 'Dispose'),
        React.createElement('div', null, isReady ? 'ready' : 'idle')
      ),
      React.createElement('pre', null, JSON.stringify(statuses, null, 2))
    )
  );
}

createRoot(document.getElementById('root')).render(React.createElement(App));



/* eslint-env browser */
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [state, setState] = React.useState({ isReady: false, isLoading: false, progress: null, statuses: [] });
  const providerRef = React.useRef(null);

  useEffect(() => {
    (async () => {
      const { useAIProvider } = await import('/dist/react/useAIProvider.js');
      const hook = useAIProvider({ llm: { model: 'Xenova/gpt2', device: 'wasm', dtype: 'fp32', maxTokens: 5 }, autoLoad: false });
      providerRef.current = hook.provider;
      setState({
        isReady: hook.isReady,
        isLoading: hook.isLoading,
        progress: hook.progress,
        statuses: hook.statuses,
      });
      window.testReady = true;
    })();
  }, []);

  const warmup = async () => {
    if (!providerRef.current) return;
    await providerRef.current.warmup('llm');
    setState((s) => ({ ...s, isReady: true, statuses: providerRef.current.getAllStatuses() }));
  };

  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'status-row' },
        React.createElement('button', { className: 'btn', onClick: warmup, 'data-testid': 'start-warmup' }, 'Warmup LLM'),
        React.createElement('div', { 'data-testid': 'status' }, state.isReady ? 'ready' : (state.isLoading ? 'loading' : 'idle')),
        React.createElement('div', { 'data-testid': 'file' }, '-'),
        React.createElement('div', { 'data-testid': 'progress' }, String(state.progress?.progress || 0))
      ),
      React.createElement('div', { className: 'progressbar' }, React.createElement('div', { className: 'progressbar__fill', style: { width: `${Math.round(state.progress?.progress || 0)}%` } })),
      React.createElement('pre', null, JSON.stringify(state.statuses, null, 2))
    )
  );
}

createRoot(document.getElementById('root')).render(React.createElement(App));



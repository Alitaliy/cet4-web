import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { VocabularyProvider } from './context';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="fatal-error">
        <h1>页面暂时遇到问题</h1>
        <p>已写入本地目录的数据不受影响。请保存错误信息后重新打开页面。</p>
        <pre>{this.state.error}</pre>
        <button onClick={() => location.reload()}>重新打开</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <VocabularyProvider>
      <App />
    </VocabularyProvider>
  </ErrorBoundary>,
);

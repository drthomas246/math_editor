import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ManualErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Manual rendering failed", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="centered-state manual-error-state">
        <div className="brand-mark large">Σ</div>
        <h1>マニュアルを表示できませんでした</h1>
        <p>ページを再読み込みしてください。改善しない場合は、はじめに戻ってください。</p>
        <div className="manual-error-actions">
          <button className="primary-button" onClick={() => window.location.reload()}>再読み込み</button>
          <a className="secondary-button" href="/help/overview">はじめに</a>
        </div>
      </main>
    );
  }
}

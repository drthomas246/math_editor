import { Component, type ErrorInfo, type ReactNode } from "react";
type Props = {
    children: ReactNode;
};
type State = {
    failed: boolean;
};
export class ManualErrorBoundary extends Component<Props, State> {
    state: State = { failed: false };
    /**
     * getDerivedStateFromErrorで必要な値を取得する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    static getDerivedStateFromError(): State {
        return { failed: true };
    }
    /**
     * componentDidCatchに必要な処理を実行する。
     *
     * @param error 処理中に発生したエラー
     * @param info infoとして使用する値
     */
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Manual rendering failed", error, info);
    }
    /**
     * renderに対応する画面表示を更新する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    render() {
        if (!this.state.failed)
            return this.props.children;
        return (<main className="centered-state manual-error-state">
        <div className="brand-mark large">Σ</div>
        <h1>マニュアルを表示できませんでした</h1>
        <p>ページを再読み込みしてください。改善しない場合は、はじめに戻ってください。</p>
        <div className="manual-error-actions">
          <button className="primary-button" onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClick1() {
            return window.location.reload();
        })}>再読み込み</button>
          <a className="secondary-button" href="/help/overview">はじめに</a>
        </div>
      </main>);
    }
}

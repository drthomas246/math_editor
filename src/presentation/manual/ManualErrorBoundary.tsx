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
     * failedを持つオブジェクトを一つの結果へまとめる。
     *
     * @returns failedを持つオブジェクト
     */
    static getDerivedStateFromError(): State {
        return { failed: true };
    }
    /**
     * component・Did・Catchをエラーで処理し、その結果を呼び出し元へ反映する。
     *
     * @param error 処理中に発生したエラー
     * @param info Reactが報告したエラー発生位置
     */
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Manual rendering failed", error, info);
    }
    /**
     * テスト対象コンポーネントを規定のルーターと依存モックを使って描画する。
     *
     * テスト対象コンポーネントを規定のルーターと依存モックを使って描画する。
      * @returns 正常時の子要素または描画失敗時の再読み込み案内を表示するReact要素
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
         * 「再読み込み」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
         *
         */
        function handleClick1() {
            return window.location.reload();
        })}>再読み込み</button>
          <a className="secondary-button" href="/help/overview">はじめに</a>
        </div>
      </main>);
    }
}

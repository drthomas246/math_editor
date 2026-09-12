import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerSujitaTools } from "./infrastructure/webmcp/register-sujita-tools";
import "mathlive/fonts.css";
import "mathlive/static.css";
import "./styles.css";
// StrictModeを有効にしたアプリケーションをHTMLのルート要素へ接続する。
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

// Reactの再描画やStrictModeによるEffect再実行から登録の寿命を独立させる。
const webMcpRegistration = registerSujitaTools();
if (import.meta.hot) import.meta.hot.dispose(webMcpRegistration.dispose);

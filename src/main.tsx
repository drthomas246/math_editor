import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "mathlive/fonts.css";
import "mathlive/static.css";
import "./styles.css";
// StrictModeを有効にしたアプリケーションをHTMLのルート要素へ接続する。
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

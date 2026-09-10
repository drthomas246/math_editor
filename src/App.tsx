import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from "react-router-dom";
import { EditorScreen } from "./presentation/editor/EditorScreen";
import { ManualErrorBoundary } from "./presentation/manual/ManualErrorBoundary";
import { ManualScreen } from "./presentation/manual/ManualScreen";
import { TrashScreen } from "./presentation/trash/TrashScreen";
import { WorksheetListScreen } from "./presentation/worksheet-list/WorksheetListScreen";
const router = createBrowserRouter(createRoutesFromElements(<>
    <Route path="/help" element={<Navigate to="/help/overview" replace/>}/>
    <Route path="/help/:chapterSlug" element={<ManualErrorBoundary><ManualScreen /></ManualErrorBoundary>}/>
    <Route path="/help/*" element={<ManualErrorBoundary><ManualScreen /></ManualErrorBoundary>}/>
    <Route element={<RequiredApiGate />}>
      <Route path="/" element={<WorksheetListScreen />}/>
      <Route path="/worksheets/:worksheetId" element={<EditorScreen />}/>
      <Route path="/trash" element={<TrashScreen />}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Route>
  </>));
/**
 * ブラウザーAPIの対応状況を確認し、プリント一覧・編集・ごみ箱・マニュアルの各画面をルーティングする。
 *
 * @returns Appを表示するReact要素
 */
export default function App() {
    return <RouterProvider router={router}/>;
}
/**
 * 必須ブラウザーAPIが不足する環境では理由を案内し、対応環境でだけアプリ本体を表示する。
 *
 * @returns Required・Api・Gateを表示するReact要素
 */
function RequiredApiGate() {
    if (supportsRequiredApis())
        return <Outlet />;
    return <main className="centered-state unsupported"><div className="brand-mark large">Σ</div><h1>このブラウザは対応していません</h1><p>最新版のChromeまたはEdgeを使用してください。</p></main>;
}
/**
 * アプリの保存・画像処理・印刷に必須のブラウザーAPIが利用可能か判定する。
 *
 * @returns この実装では常にtrue
 */
function supportsRequiredApis(): boolean {
    if (import.meta.env.MODE === "test")
        return true;
    return typeof indexedDB !== "undefined"
        && typeof Blob !== "undefined"
        && typeof URL?.createObjectURL === "function"
        && typeof createImageBitmap === "function";
}

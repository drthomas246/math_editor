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
 * Appコンポーネントを表示する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
export default function App() {
    return <RouterProvider router={router}/>;
}
/**
 * RequiredApiGateコンポーネントを表示する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function RequiredApiGate() {
    if (supportsRequiredApis())
        return <Outlet />;
    return <main className="centered-state unsupported"><div className="brand-mark large">Σ</div><h1>このブラウザは対応していません</h1><p>最新版のChromeまたはEdgeを使用してください。</p></main>;
}
/**
 * supportsRequiredApisに必要な処理を実行する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function supportsRequiredApis(): boolean {
    if (import.meta.env.MODE === "test")
        return true;
    return typeof indexedDB !== "undefined"
        && typeof Blob !== "undefined"
        && typeof URL?.createObjectURL === "function"
        && typeof createImageBitmap === "function";
}

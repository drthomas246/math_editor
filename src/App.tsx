import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { EditorScreen } from "./presentation/editor/EditorScreen";
import { ManualErrorBoundary } from "./presentation/manual/ManualErrorBoundary";
import { ManualScreen } from "./presentation/manual/ManualScreen";
import { TrashScreen } from "./presentation/trash/TrashScreen";
import { WorksheetListScreen } from "./presentation/worksheet-list/WorksheetListScreen";

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/help" element={<Navigate to="/help/overview" replace />} />
    <Route path="/help/:chapterSlug" element={<ManualErrorBoundary><ManualScreen /></ManualErrorBoundary>} />
    <Route path="/help/*" element={<ManualErrorBoundary><ManualScreen /></ManualErrorBoundary>} />
    <Route element={<RequiredApiGate />}>
      <Route path="/" element={<WorksheetListScreen />} />
      <Route path="/worksheets/:worksheetId" element={<EditorScreen />} />
      <Route path="/trash" element={<TrashScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></BrowserRouter>;
}

function RequiredApiGate() {
  if (supportsRequiredApis()) return <Outlet />;
  return <main className="centered-state unsupported"><div className="brand-mark large">Σ</div><h1>このブラウザは対応していません</h1><p>最新版のChromeまたはEdgeを使用してください。</p></main>;
}

function supportsRequiredApis(): boolean {
  if (import.meta.env.MODE === "test") return true;
  return typeof indexedDB !== "undefined" && typeof Blob !== "undefined" && typeof URL?.createObjectURL === "function" && typeof BroadcastChannel !== "undefined";
}

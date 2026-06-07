import { Navigate, Route, Routes } from "react-router";
import ParserPage from "./pages/Parser";
import BuilderPage from "./pages/Builder";
import CardsPage from "./pages/Cards";
import BitmapPage from "./pages/Bitmap";
import EmvPage from "./pages/Emv";
import SimulatorPage from "./pages/Simulator";
import WorkspacePage from "./pages/Workspace";
import DocsPage from "./pages/Docs";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/parser" replace />} />
      <Route path="/parser" element={<ParserPage />} />
      <Route path="/builder" element={<BuilderPage />} />
      <Route path="/bitmap" element={<BitmapPage />} />
      <Route path="/cards" element={<CardsPage />} />
      <Route path="/emv" element={<EmvPage />} />
      <Route path="/simulator" element={<SimulatorPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/workspace" element={<WorkspacePage />} />
      <Route path="*" element={<Navigate to="/parser" replace />} />
    </Routes>
  );
}

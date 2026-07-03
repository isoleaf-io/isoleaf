import { Navigate, Route, Routes } from "react-router";
import ParserPage from "./pages/Parser";
import BuilderPage from "./pages/Builder";
import CardsPage from "./pages/Cards";
import BitmapPage from "./pages/Bitmap";
import EmvPage from "./pages/Emv";
import SimulatorPage from "./pages/Simulator";
import WorkspacePage from "./pages/Workspace";
import DocsPage from "./pages/Docs";
import ApiDocsPage from "./pages/Docs/ApiDocsPage";
import Iso20022ParserPage from "./pages/Iso20022Parser";
import Iso20022ReferencePage from "./pages/Iso20022Reference";
import Iso20022ComparatorPage from "./pages/Iso20022Comparator";
import Iso20022BuilderPage from "./pages/Iso20022Builder";
import PixQrCodePage from "./pages/PixQrCode";
import PixFlowVisualizerPage from "./pages/PixFlow";
import MtParserPage from "./pages/MtParser";

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
      <Route path="/iso20022/parser" element={<Iso20022ParserPage />} />
      <Route path="/iso20022/reference" element={<Iso20022ReferencePage />} />
      <Route path="/iso20022/compare" element={<Iso20022ComparatorPage />} />
      <Route path="/iso20022/builder" element={<Iso20022BuilderPage />} />
      <Route path="/pix/qrcode" element={<PixQrCodePage />} />
      <Route path="/pix/flow" element={<PixFlowVisualizerPage />} />
      <Route path="/swift/mt-parser" element={<MtParserPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/docs/api" element={<ApiDocsPage />} />
      <Route path="/workspace" element={<WorkspacePage />} />
      <Route path="*" element={<Navigate to="/parser" replace />} />
    </Routes>
  );
}

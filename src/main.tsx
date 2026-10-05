import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { convex, convexConfigured } from "./lib/convex";
import { TeamProvider } from "./lib/team";
import { TeamGate } from "./components/TeamGate";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ErrorBox } from "./components/ui";
import { Home } from "./pages/Home";
import { ExercisePage } from "./pages/Exercise";
import { DayReportPage, SchoolReportPage } from "./pages/Report";
import { PaperSheet } from "./pages/PaperSheet";
import { AdminPage } from "./pages/Admin";
import { MySubmissions } from "./pages/MySubmissions";

function App() {
  if (!convexConfigured) {
    return (
      <main className="p-4">
        <ErrorBox>Configuration manquante : VITE_CONVEX_URL n'est pas défini.</ErrorBox>
      </main>
    );
  }
  return (
    <ConvexProvider client={convex}>
      <TeamProvider>
        <HashRouter>
          <Routes>
            <Route path="/fiche" element={<PaperSheet />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="*"
              element={
                <ErrorBoundary>
                <TeamGate>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/x/:id" element={<ExercisePage />} />
                    <Route path="/rapport/jour/:date" element={<DayReportPage />} />
                    <Route path="/rapport/:id" element={<SchoolReportPage />} />
                    <Route path="/mes-saisies" element={<MySubmissions />} />
                    <Route path="*" element={<Home />} />
                  </Routes>
                </TeamGate>
                </ErrorBoundary>
              }
            />
          </Routes>
        </HashRouter>
      </TeamProvider>
    </ConvexProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

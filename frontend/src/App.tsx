import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { AgentPage } from "./pages/Agent";
import { HomePage } from "./pages/Home";
import { LoginPage } from "./pages/Login";
import { SchedulesPage } from "./pages/Schedules";
import { ProjectEditPage } from "./pages/ProjectEdit";
import { SettingsPage } from "./pages/Settings";
import { ToastHost } from "./components/ToastHost";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastHost />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/agents/:agentId" element={<AgentPage />} />
          <Route
            path="/agents/:agentId/projects/:projectId/edit"
            element={<ProjectEditPage />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

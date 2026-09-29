import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@chrisasstanina/auth';
import { ShellLayout } from '@/components/layout/ShellLayout';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RemoteAppPage } from '@/pages/RemoteAppPage';
import { SettingsPage } from '@/pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="apps/:appName/*"
          element={
            <ProtectedRoute>
              <RemoteAppPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

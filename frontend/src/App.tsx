import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
import { Dashboard, ForgotPassword, Login, Register, ResetPassword, StudioSettings, Team } from './pages';

function App() {
  return (
    <Routes>
      {/* Auth routes - no layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* App routes - with layout */}
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/team" element={<Team />} />
              <Route path="/settings" element={<StudioSettings />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

export default App;

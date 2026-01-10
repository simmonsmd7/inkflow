import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
import { Dashboard, Login, Register } from './pages';

function App() {
  return (
    <Routes>
      {/* Auth routes - no layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* App routes - with layout */}
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              {/* Future routes will be added here */}
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

export default App;

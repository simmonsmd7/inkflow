import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ClientProtectedRoute } from './components/ClientProtectedRoute';
import {
  Aftercare,
  ArtistPerformance,
  ArtistProfile,
  Availability,
  BookingForm,
  BookingQueue,
  ClientAftercareInstructions,
  ClientBookingHistory,
  ClientConsentForms,
  ClientForgotPassword,
  ClientLogin,
  ClientResetPassword,
  ClientPortal,
  ClientRebooking,
  ClientRegister,
  ClientUpcomingAppointments,
  ClientRetention,
  Commissions,
  ConsentForms,
  ConsentSigning,
  ConsentView,
  Dashboard,
  DepositPayment,
  ForgotPassword,
  Inbox,
  LandingPage,
  Login,
  NoShowTracking,
  NotFound,
  Onboarding,
  PaymentSuccess,
  PopularTimeSlots,
  Register,
  ResetPassword,
  RevenueReports,
  StubCheckout,
  StudioSettings,
  Team,
  TouchUpRequest,
} from './pages';

function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public routes - no auth required */}
      <Route path="/book/:studioSlug" element={<BookingForm />} />
      <Route path="/pay-deposit/:token" element={<DepositPayment />} />
      <Route path="/pay-deposit/:token/stub-checkout" element={<StubCheckout />} />
      <Route path="/pay-deposit/:token/success" element={<PaymentSuccess />} />
      <Route path="/sign/:studioSlug/:templateId" element={<ConsentSigning />} />
      <Route path="/consent/view/:accessToken" element={<ConsentView />} />
      <Route path="/aftercare/:accessToken/touch-up" element={<TouchUpRequest />} />

      {/* Auth routes - no layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Onboarding route - requires auth but no layout */}
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      {/* Client Portal routes - public (login/register) */}
      <Route path="/client/login" element={<ClientLogin />} />
      <Route path="/client/register" element={<ClientRegister />} />
      <Route path="/client/forgot-password" element={<ClientForgotPassword />} />
      <Route path="/client/reset-password" element={<ClientResetPassword />} />

      {/* Client Portal routes - protected */}
      <Route path="/client" element={<ClientProtectedRoute><ClientPortal /></ClientProtectedRoute>} />
      <Route path="/client/bookings" element={<ClientProtectedRoute><ClientBookingHistory /></ClientProtectedRoute>} />
      <Route path="/client/appointments" element={<ClientProtectedRoute><ClientUpcomingAppointments /></ClientProtectedRoute>} />
      <Route path="/client/consent" element={<ClientProtectedRoute><ClientConsentForms /></ClientProtectedRoute>} />
      <Route path="/client/aftercare" element={<ClientProtectedRoute><ClientAftercareInstructions /></ClientProtectedRoute>} />
      <Route path="/client/aftercare/:aftercareId" element={<ClientProtectedRoute><ClientAftercareInstructions /></ClientProtectedRoute>} />
      <Route path="/client/rebook/:bookingId" element={<ClientProtectedRoute><ClientRebooking /></ClientProtectedRoute>} />

      {/* Redirect /client/history to /client/bookings */}
      <Route path="/client/history" element={<Navigate to="/client/bookings" replace />} />

      {/* App routes - with layout, requires staff authentication */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/bookings" element={<BookingQueue />} />
                <Route path="/profile" element={<ArtistProfile />} />
                <Route path="/availability" element={<Availability />} />
                <Route path="/team" element={<Team />} />
                <Route path="/artists" element={<Navigate to="/team" replace />} />
                <Route path="/clients" element={<Navigate to="/bookings" replace />} />
                <Route path="/commissions" element={<Commissions />} />
                <Route path="/artist-performance" element={<ArtistPerformance />} />
                <Route path="/client-retention" element={<ClientRetention />} />
                <Route path="/revenue-reports" element={<RevenueReports />} />
                <Route path="/no-show-tracking" element={<NoShowTracking />} />
                <Route path="/popular-time-slots" element={<PopularTimeSlots />} />
                <Route path="/consent" element={<ConsentForms />} />
                <Route path="/aftercare" element={<Aftercare />} />
                <Route path="/settings" element={<StudioSettings />} />
                {/* Catch-all 404 route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;

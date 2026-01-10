import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
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
  ClientLogin,
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
  Login,
  NoShowTracking,
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

      {/* Client Portal routes - no layout */}
      <Route path="/client/login" element={<ClientLogin />} />
      <Route path="/client/register" element={<ClientRegister />} />
      <Route path="/client" element={<ClientPortal />} />
      <Route path="/client/bookings" element={<ClientBookingHistory />} />
      <Route path="/client/appointments" element={<ClientUpcomingAppointments />} />
      <Route path="/client/consent" element={<ClientConsentForms />} />
      <Route path="/client/aftercare" element={<ClientAftercareInstructions />} />
      <Route path="/client/aftercare/:aftercareId" element={<ClientAftercareInstructions />} />
      <Route path="/client/rebook/:bookingId" element={<ClientRebooking />} />

      {/* App routes - with layout */}
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/bookings" element={<BookingQueue />} />
              <Route path="/profile" element={<ArtistProfile />} />
              <Route path="/availability" element={<Availability />} />
              <Route path="/team" element={<Team />} />
              <Route path="/commissions" element={<Commissions />} />
              <Route path="/artist-performance" element={<ArtistPerformance />} />
              <Route path="/client-retention" element={<ClientRetention />} />
              <Route path="/revenue-reports" element={<RevenueReports />} />
              <Route path="/no-show-tracking" element={<NoShowTracking />} />
              <Route path="/popular-time-slots" element={<PopularTimeSlots />} />
              <Route path="/consent" element={<ConsentForms />} />
              <Route path="/aftercare" element={<Aftercare />} />
              <Route path="/settings" element={<StudioSettings />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

export default App;

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import GuestLayout from './layouts/GuestLayout';
import AuthLayout from './layouts/AuthLayout';

// Public Pages (Lazy Loaded)
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Amenities = lazy(() => import('./pages/Amenities'));
const Apartments = lazy(() => import('./pages/Apartments'));
const Booking = lazy(() => import('./pages/Booking'));
const Contact = lazy(() => import('./pages/Contact'));
const RoomDetails = lazy(() => import('./pages/RoomDetails'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));

// Legal Pages (Lazy Loaded)
const Terms = lazy(() => import('./pages/legal/Terms'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const CancellationPolicy = lazy(() => import('./pages/legal/CancellationPolicy'));
const FAQ = lazy(() => import('./pages/legal/FAQ'));

// Auth Pages (Lazy Loaded)
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

// Admin Pages (Lazy Loaded)
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminFrontDesk = lazy(() => import('./pages/admin/FrontDesk'));
const AdminReservations = lazy(() => import('./pages/admin/Reservations'));
const AdminRooms = lazy(() => import('./pages/admin/Rooms'));
const AdminPricing = lazy(() => import('./pages/admin/Pricing'));
const AdminCalendar = lazy(() => import('./pages/admin/Calendar'));
const AdminHousekeeping = lazy(() => import('./pages/admin/Housekeeping'));
const AdminMaintenance = lazy(() => import('./pages/admin/Maintenance'));
const AdminGuests = lazy(() => import('./pages/admin/Guests'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminCMS = lazy(() => import('./pages/admin/CMS'));
const AdminBilling = lazy(() => import('./pages/admin/Billing'));
const AdminChannelManager = lazy(() => import('./pages/admin/ChannelManager'));
const AdminStaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const AdminAutomations = lazy(() => import('./pages/admin/Automations'));
const AdminSecurity = lazy(() => import('./pages/admin/Security'));
const AdminGuestServices = lazy(() => import('./pages/admin/GuestServices'));
const AdminLaundry = lazy(() => import('./pages/admin/Laundry'));
const AdminAccounting = lazy(() => import('./pages/admin/Accounting'));
const AdminPOS = lazy(() => import('./pages/admin/POS'));
const AdminStoreKeeping = lazy(() => import('./pages/admin/StoreKeeping'));
const AdminDutyReports = lazy(() => import('./pages/admin/DutyReports'));
const AdminLostFound = lazy(() => import('./pages/admin/LostFound'));
const AdminReminders = lazy(() => import('./pages/admin/Reminders'));
const AdminInternalMessages = lazy(() => import('./pages/admin/InternalMessages'));
const AdminMonthlyReports = lazy(() => import('./pages/admin/MonthlyReports'));
const AdminRestaurantKitchen = lazy(() => import('./pages/admin/RestaurantKitchen'));
const AdminServicesPortal = lazy(() => import('./pages/admin/ServicesPortal'));

// Guest Pages (Lazy Loaded)
const GuestDashboard = lazy(() => import('./pages/guest/Dashboard'));
const MyBookings = lazy(() => import('./pages/guest/MyBookings'));
const CheckIn = lazy(() => import('./pages/guest/CheckIn'));
const Profile = lazy(() => import('./pages/guest/Profile'));
const GuestRequestServices = lazy(() => import('./pages/guest/RequestServices'));
const GuestFinancials = lazy(() => import('./pages/guest/Financials'));

// Context & Providers
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Toaster } from 'react-hot-toast';

import ErrorBoundary from './components/ErrorBoundary';

// Global Loading Fallback UI
const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-dark-900">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gold-500"></div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Toaster position="top-center" />
          <Router>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/amenities" element={<Amenities />} />
                <Route path="/apartments" element={<Apartments />} />
                <Route path="/booking" element={<Booking />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/room/:id" element={<RoomDetails />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/cancellation" element={<CancellationPolicy />} />
                <Route path="/faq" element={<FAQ />} />
              </Route>

              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="frontdesk" element={<AdminFrontDesk />} />
                <Route path="calendar" element={<AdminCalendar />} />
                <Route path="reservations" element={<AdminReservations />} />
                <Route path="rooms" element={<AdminRooms />} />
                <Route path="pricing" element={<AdminPricing />} />
                <Route path="housekeeping" element={<AdminHousekeeping />} />
                <Route path="maintenance" element={<AdminMaintenance />} />
                <Route path="crm" element={<AdminGuests />} />
                <Route path="billing" element={<AdminBilling />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="staff" element={<AdminStaffManagement />} />
                <Route path="channel-manager" element={<AdminChannelManager />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="cms" element={<AdminCMS />} />
                <Route path="automations" element={<AdminAutomations />} />
                <Route path="services" element={<AdminGuestServices />} />
                <Route path="laundry" element={<AdminLaundry />} />
                <Route path="pos" element={<AdminPOS />} />
                <Route path="store" element={<AdminStoreKeeping />} />
                <Route path="security" element={<AdminSecurity />} />
                <Route path="accounting" element={<AdminAccounting />} />
                <Route path="duty-reports" element={<AdminDutyReports />} />
                <Route path="lost-found" element={<AdminLostFound />} />
                <Route path="reminders" element={<AdminReminders />} />
                <Route path="messages" element={<AdminInternalMessages />} />
                <Route path="monthly-reports" element={<AdminMonthlyReports />} />
                <Route path="restaurant" element={<AdminRestaurantKitchen />} />
                <Route path="services-portal" element={<AdminServicesPortal />} />
              </Route>

              {/* Guest Routes */}
              <Route path="/guest" element={<GuestLayout />}>
                <Route index element={<GuestDashboard />} />
                <Route path="bookings" element={<MyBookings />} />
                <Route path="check-in" element={<CheckIn />} />
                <Route path="profile" element={<Profile />} />
                <Route path="services" element={<GuestRequestServices />} />
                <Route path="financials" element={<GuestFinancials />} />
              </Route>

              {/* Catch-all 404 Route */}
              <Route path="*" element={
                <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4">
                  <div className="glass-panel text-center p-8 rounded-2xl max-w-md w-full border border-dark-700 shadow-2xl">
                    <h1 className="text-6xl font-black text-brand-500 mb-4">404</h1>
                    <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
                    <p className="text-gray-400 mb-8">The page you are looking for doesn't exist or has been moved.</p>
                    <a href="/" className="btn-primary w-full py-3 inline-block">Return Home</a>
                  </div>
                </div>
              } />
            </Routes>
          </Suspense>
        </Router>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

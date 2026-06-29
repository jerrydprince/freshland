import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, ChevronUp } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

const GuestLayout = () => {
  const { user } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  const guestName = user ? `${user.first_name || 'Guest'} ${user.last_name || 'User'}` : 'Guest User';
  const guestEmail = user?.email || 'guest@example.com';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(guestName)}&background=D97706&color=fff`;

  const isActive = (path) => location.pathname === path || (path !== '/guest' && location.pathname.startsWith(path));
  const linkClass = (path) => `block px-4 py-3 md:py-2 rounded transition-colors ${isActive(path) ? 'bg-gold-500/10 text-gold-500 font-medium' : 'text-gray-200 hover:bg-dark-700 hover:text-white'}`;

  return (
    <div className="flex flex-col min-h-screen bg-dark-900">
      <Navbar />
      
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar */}
            <aside className="w-full md:w-64 flex-shrink-0">
              <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
                {/* Mobile Toggle Header */}
                <div 
                  className="p-4 flex justify-between items-center md:hidden cursor-pointer bg-dark-700/50"
                  onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-dark-700 rounded-full border border-gold-500 overflow-hidden">
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-white">{guestName}</h3>
                      <p className="text-gray-200 text-xs">Guest Menu</p>
                    </div>
                  </div>
                  {isMobileNavOpen ? <ChevronUp size={20} className="text-gray-200"/> : <ChevronDown size={20} className="text-gray-200"/>}
                </div>

                {/* Desktop Profile Info */}
                <div className="p-6 text-center border-b border-dark-700 hidden md:block">
                  <div className="w-20 h-20 bg-dark-700 rounded-full mx-auto mb-4 border-2 border-gold-500 overflow-hidden">
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                  <h3 className="font-medium text-lg text-white">{guestName}</h3>
                  <p className="text-gray-200 text-sm">{guestEmail}</p>
                </div>
                
                <nav className={`p-4 md:p-6 space-y-1 ${isMobileNavOpen ? 'block' : 'hidden md:block'}`}>
                  <Link to="/guest" onClick={() => setIsMobileNavOpen(false)} className={linkClass('/guest')}>
                    Dashboard
                  </Link>
                  <Link to="/guest/bookings" onClick={() => setIsMobileNavOpen(false)} className={linkClass('/guest/bookings')}>
                    My Bookings
                  </Link>
                  <Link to="/guest/services" onClick={() => setIsMobileNavOpen(false)} className={linkClass('/guest/services')}>
                    Request Services
                  </Link>
                  <Link to="/guest/check-in" onClick={() => setIsMobileNavOpen(false)} className={linkClass('/guest/check-in')}>
                    Online Check-in
                  </Link>
                  <Link to="/guest/profile" onClick={() => setIsMobileNavOpen(false)} className={linkClass('/guest/profile')}>
                    Profile Settings
                  </Link>
                  <Link to="/guest/financials" onClick={() => setIsMobileNavOpen(false)} className={linkClass('/guest/financials')}>
                    Wallet & Financials
                  </Link>
                </nav>
              </div>
            </aside>
            
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default GuestLayout;

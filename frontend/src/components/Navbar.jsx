import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getDefaultAdminRoute } from '../utils/routes';
import { supabase } from '../lib/supabase';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [contactLogo, setContactLogo] = useState(() => localStorage.getItem('contact_logo') || '');
  const location = useLocation();
  const { user, logout, hasAccess } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHeroPage = location.pathname === '/' || location.pathname === '/about';
  const showSolid = scrolled || !isHeroPage;

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'contact_logo')
          .single();
        if (data && data.setting_value) {
          setContactLogo(data.setting_value);
          localStorage.setItem('contact_logo', data.setting_value);
        }
      } catch (e) {}
    };
    fetchLogo();
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Gallery', path: '/gallery' },
    { name: 'Amenities', path: '/amenities' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <header className={`fixed w-full z-50 transition-all duration-300 ${showSolid ? 'bg-dark-900/95 backdrop-blur-md py-4 shadow-lg' : 'bg-transparent py-6'}`}>
      <div className="container mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3">
          {contactLogo ? (
            <img src={contactLogo} alt="Logo" className="h-10 max-w-[180px] object-contain" />
          ) : (
            <>
              <svg width="45" height="45" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10 L10 90 L35 90 L60 40 Z" fill="#DF6853"/>
                <path d="M40 90 L90 90 L75 60 L50 90 Z" fill="#DF6853"/>
                <path d="M25 15 L28 25 L38 28 L28 31 L25 41 L22 31 L12 28 L22 25 Z" fill="#DF6853"/>
              </svg>
              <div className="flex flex-col justify-center">
                <span className={`text-[22px] font-sans font-extrabold leading-none tracking-wide transition-colors duration-300 ${showSolid ? 'text-[#4A4A4A] dark:text-white' : 'text-[#ffffff]'}`}>SPARKLES</span>
                <span className={`text-[11px] font-sans leading-tight tracking-[0.25em] mt-1 transition-colors duration-300 ${showSolid ? 'text-[#6B7280] dark:text-gray-400' : 'text-[#ffffff]/85'}`}>APARTMENTS</span>
              </div>
            </>
          )}
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={link.path}
              className={`text-sm tracking-wide uppercase transition-all duration-300 ${
                showSolid 
                  ? (location.pathname === link.path ? 'text-brand-500 font-bold border-b border-brand-500/30' : 'text-gray-600 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-500') 
                  : (location.pathname === link.path ? 'text-[#ffffff] font-bold border-b border-[#ffffff]/70' : 'text-[#ffffff]/80 hover:text-[#ffffff]')
              }`}
            >
              {link.name}
            </Link>
          ))}
          {user ? (
            <div className="flex items-center space-x-4 ml-4">
              <Link 
                to={user.role === 'guest' ? '/guest' : getDefaultAdminRoute(user.role, hasAccess)} 
                className={`text-sm tracking-wide uppercase font-medium transition-colors duration-300 ${showSolid ? 'text-gray-600 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-500' : 'text-[#ffffff]/80 hover:text-[#ffffff]'}`}
              >
                Portal
              </Link>
              <button onClick={logout} className="text-sm tracking-wide uppercase text-red-500 hover:text-red-600 font-medium transition-colors duration-300">
                Logout
              </button>
            </div>
          ) : (
            <Link 
              to="/login" 
              className={`text-sm tracking-wide uppercase font-medium transition-colors duration-300 ml-4 ${showSolid ? 'text-gray-600 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-500' : 'text-[#ffffff]/80 hover:text-[#ffffff]'}`}
            >
              Login
            </Link>
          )}
          <Link to="/booking" className="btn-primary ml-4">
            Book Now
          </Link>
        </nav>

        {/* Mobile Toggle */}
        <button 
          className={`md:hidden focus:outline-none transition-colors duration-300 ${showSolid ? 'text-[#4A4A4A] dark:text-white' : 'text-[#ffffff]'}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-dark-800 shadow-xl md:hidden"
          >
            <div className="flex flex-col py-4 px-6 space-y-4">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`text-base tracking-wide uppercase py-2 border-b border-dark-700 ${location.pathname === link.path ? 'text-gold-500 font-medium' : 'text-gray-300'}`}
                >
                  {link.name}
                </Link>
              ))}
              <Link to="/booking" onClick={() => setIsOpen(false)} className="btn-primary mt-4 text-center">
                Book Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;

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
    <header className={`fixed w-full z-50 transition-all duration-500 ${showSolid ? 'bg-white/90 dark:bg-dark-900/90 backdrop-blur-lg py-4 shadow-[0_4px_30px_rgba(0,0,0,0.05)] border-b border-gray-200/50 dark:border-dark-700/50' : 'bg-transparent py-6'}`}>
      <div className="container mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3 mr-auto hover:opacity-80 transition-opacity">
          <img src="/Images/logo.svg" alt="Freshland Logo" className="h-10 object-contain drop-shadow-md" />
          <div className="flex flex-col justify-center ml-2">
            <span className={`text-[22px] font-sans font-extrabold leading-none tracking-wide transition-colors duration-300 ${showSolid ? 'text-gray-900 dark:text-white' : 'text-[#ffffff] drop-shadow-md'}`}>Freshland</span>
            <span className={`text-[11px] font-sans leading-tight tracking-[0.25em] mt-1 transition-colors duration-300 ${showSolid ? 'text-brand-500 font-semibold' : 'text-[#ffffff]/90 font-medium drop-shadow-md'}`}>HOTELS</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={link.path}
              className={`text-sm tracking-widest uppercase transition-all duration-300 ${
                showSolid 
                  ? (location.pathname === link.path ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-400') 
                  : (location.pathname === link.path ? 'text-white font-bold drop-shadow-md' : 'text-white/90 hover:text-white drop-shadow-sm')
              }`}
            >
              {link.name}
            </Link>
          ))}
          {user ? (
            <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-gray-300/30">
              <Link 
                to={user.role === 'guest' ? '/guest' : getDefaultAdminRoute(user.role, hasAccess)} 
                className={`text-sm tracking-widest uppercase font-medium transition-colors duration-300 ${showSolid ? 'text-gray-600 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-400' : 'text-white/90 hover:text-white'}`}
              >
                Portal
              </Link>
              <button onClick={logout} className={`text-sm tracking-widest uppercase font-medium transition-colors duration-300 ${showSolid ? 'text-red-500 hover:text-red-600' : 'text-red-400 hover:text-red-300'}`}>
                Logout
              </button>
            </div>
          ) : (
            <Link 
              to="/login" 
              className={`text-sm tracking-widest uppercase font-medium transition-colors duration-300 ml-4 pl-4 border-l border-gray-300/30 ${showSolid ? 'text-gray-600 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-400' : 'text-white/90 hover:text-white'}`}
            >
              Login
            </Link>
          )}
          <Link to="/booking" className="btn-primary ml-6 shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50">
            Book Now
          </Link>
        </nav>

        {/* Mobile Toggle */}
        <button 
          className={`md:hidden focus:outline-none transition-colors duration-300 ${showSolid ? 'text-gray-900 dark:text-white' : 'text-white drop-shadow-md'}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 w-full bg-white dark:bg-dark-900 shadow-2xl md:hidden overflow-hidden border-t border-gray-100 dark:border-dark-800"
          >
            <div className="flex flex-col py-6 px-8 space-y-5">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`text-sm tracking-widest uppercase pb-2 border-b border-gray-100 dark:border-dark-800 ${location.pathname === link.path ? 'text-brand-500 font-bold' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  {link.name}
                </Link>
              ))}
              <Link to="/booking" onClick={() => setIsOpen(false)} className="btn-primary mt-6 text-center w-full">
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

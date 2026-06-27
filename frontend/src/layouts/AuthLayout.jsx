import { useState, useEffect } from 'react';
import { Outlet, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDefaultAdminRoute } from '../utils/routes';
import { supabase } from '../lib/supabase';

const AuthLayout = () => {
  const { user, hasAccess } = useAuth();
  const [brandLogo, setBrandLogo] = useState('');

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'contact_logo')
          .single();
        
        if (!error && data?.setting_value) {
          setBrandLogo(data.setting_value);
        } else {
          const localLogo = localStorage.getItem('contact_logo');
          if (localLogo) setBrandLogo(localLogo);
        }
      } catch (e) {
        console.warn("Failed to fetch brand logo in AuthLayout:", e);
        const localLogo = localStorage.getItem('contact_logo');
        if (localLogo) setBrandLogo(localLogo);
      }
    };
    fetchLogo();
  }, []);

  if (user) {
    const target = user.role === 'guest' ? '/guest' : '/admin';
    return <Navigate to={target} replace />;
  }

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col justify-center items-center relative overflow-hidden">
      {/* Background styling */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
          alt="Luxury background" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900/50 to-dark-900/90" />
      </div>

      <div className="z-10 w-full max-w-md px-6">
        <div className="flex flex-col items-center mb-10">
          <Link to="/" className="flex flex-col items-center gap-3">
            {brandLogo ? (
              <img 
                src={brandLogo} 
                alt="Brand Logo" 
                className="h-24 max-w-[300px] object-contain transition-all duration-300 hover:scale-105"
              />
            ) : (
              <>
                <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 10 L10 90 L35 90 L60 40 Z" fill="#DF6853"/>
                  <path d="M40 90 L90 90 L75 60 L50 90 Z" fill="#DF6853"/>
                  <path d="M25 15 L28 25 L38 28 L28 31 L25 41 L22 31 L12 28 L22 25 Z" fill="#DF6853"/>
                </svg>
                <div className="flex flex-col justify-center items-center">
                  <span className="text-[28px] font-sans font-extrabold text-white leading-none tracking-wide">SPARKLES</span>
                  <span className="text-[12px] font-sans text-[#DF6853] leading-tight tracking-[0.25em] mt-1">APARTMENTS</span>
                </div>
              </>
            )}
          </Link>
          <p className="text-gray-400 mt-4 tracking-widest uppercase text-xs">Guest & Admin Portal</p>
        </div>
        
        <div className="bg-dark-800/80 backdrop-blur-md p-8 shadow-2xl border border-dark-700">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

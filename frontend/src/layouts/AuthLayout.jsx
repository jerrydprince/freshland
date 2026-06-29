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
          src="/Images/Reception.jfif" 
          alt="Luxury background" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900/50 to-dark-900/90" />
      </div>

      <div className="z-10 w-full max-w-md px-6">
        <div className="flex flex-col items-center mb-10">
            <Link to="/" className="flex flex-col items-center gap-3">
              <>
                <img src="/Images/logo.svg" alt="Freshland Logo" className="h-16 object-contain mb-2" />
                <div className="flex flex-col justify-center ml-2 text-left">
                  <span className="text-[22px] font-sans font-extrabold leading-none tracking-wide text-[#ffffff]">Freshland</span>
                  <span className="text-[11px] font-sans leading-tight tracking-[0.25em] mt-1 text-brand-400">HOTELS</span>
                </div>
              </>
            </Link>
          <p className="text-gray-200 mt-4 tracking-widest uppercase text-xs">Guest & Admin Portal</p>
        </div>
        
        <div className="bg-dark-800/80 backdrop-blur-md p-8 shadow-2xl border border-dark-700">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

import { Link } from 'react-router-dom';
import { Instagram, Twitter, Facebook, MapPin, Phone, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Footer = () => {
  const [contactInfo, setContactInfo] = useState({
    address: 'No2. Gowon P Haruna Close, Karu, Abuja', // Default fallback
    phone: '08103694837, 08174971881',
    email: 'info@Freshlandhotels.com'
  });

  useEffect(() => {
    fetchContactSettings();
  }, []);

  const fetchContactSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['contact_address', 'contact_phone', 'contact_email']);
        
      if (!error && data) {
        const settingsMap = data.reduce((acc, curr) => {
          acc[curr.setting_key] = curr.setting_value;
          return acc;
        }, {});
        
        setContactInfo(prev => ({
          address: settingsMap.contact_address || prev.address,
          phone: settingsMap.contact_phone || prev.phone,
          email: settingsMap.contact_email || prev.email
        }));
      }
    } catch (e) {
      console.error("Failed to load footer settings:", e);
    }
  };

  return (
    <footer className="bg-dark-900 pt-20 pb-10 border-t border-dark-700">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-3 mb-6 inline-flex">
              <>
                <img src="/Images/logo.svg" alt="Freshland Logo" className="h-10 object-contain" />
                <div className="flex flex-col justify-center ml-2">
                  <span className="text-[20px] font-sans font-extrabold leading-none tracking-wide text-white">Freshland</span>
                  <span className="text-[10px] font-sans leading-tight tracking-[0.25em] mt-1 text-brand-500">HOTELS</span>
                </div>
              </>
            </Link>
            <p className="text-gray-200 mb-6 leading-relaxed">
              Experience unparalleled luxury and comfort in our premium hotel apartments designed for the elite.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-gray-200 hover:bg-brand-500 hover:text-white transition-colors shadow-lg shadow-black/20 hover:shadow-brand-500/30">
                <Instagram size={20} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-gray-200 hover:bg-brand-500 hover:text-white transition-colors shadow-lg shadow-black/20 hover:shadow-brand-500/30">
                <Twitter size={20} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-gray-200 hover:bg-brand-500 hover:text-white transition-colors shadow-lg shadow-black/20 hover:shadow-brand-500/30">
                <Facebook size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xl font-medium mb-6 text-white drop-shadow-sm">Quick Links</h4>
            <ul className="space-y-4">
              <li><Link to="/about" className="text-gray-200 hover:text-brand-500 transition-colors flex items-center gap-2"><span className="w-1 h-1 bg-brand-500 rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>About Us</Link></li>
              <li><Link to="/amenities" className="text-gray-200 hover:text-brand-500 transition-colors flex items-center gap-2"><span className="w-1 h-1 bg-brand-500 rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>Amenities</Link></li>
              <li><Link to="/gallery" className="text-gray-200 hover:text-brand-500 transition-colors flex items-center gap-2"><span className="w-1 h-1 bg-brand-500 rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>Gallery</Link></li>
              <li><Link to="/contact" className="text-gray-200 hover:text-brand-500 transition-colors flex items-center gap-2"><span className="w-1 h-1 bg-brand-500 rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xl font-medium mb-6 text-white drop-shadow-sm">Legal</h4>
            <ul className="space-y-4">
              <li><Link to="/terms" className="text-gray-200 hover:text-brand-500 transition-colors flex items-center gap-2"><span className="w-1 h-1 bg-brand-500 rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>Terms & Conditions</Link></li>
              <li><Link to="/privacy" className="text-gray-200 hover:text-brand-500 transition-colors flex items-center gap-2"><span className="w-1 h-1 bg-brand-500 rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>Privacy Policy</Link></li>
              <li><Link to="/cancellation" className="text-gray-200 hover:text-brand-500 transition-colors flex items-center gap-2"><span className="w-1 h-1 bg-brand-500 rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>Cancellation Policy</Link></li>
              <li><Link to="/faq" className="text-gray-200 hover:text-brand-500 transition-colors flex items-center gap-2"><span className="w-1 h-1 bg-brand-500 rounded-full opacity-0 hover:opacity-100 transition-opacity"></span>FAQ</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xl font-medium mb-6 text-white drop-shadow-sm">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <MapPin className="text-brand-500 mt-1 flex-shrink-0 drop-shadow-md" size={20} />
                <span className="text-gray-200">{contactInfo.address}</span>
              </li>
              {contactInfo.phone.split(',').map((phoneStr, idx) => (
                <li key={idx} className="flex items-center space-x-3">
                  <Phone className="text-brand-500 flex-shrink-0 drop-shadow-md" size={20} />
                  <span className="text-gray-200">{phoneStr.trim()}</span>
                </li>
              ))}
              <li className="flex items-center space-x-3">
                <Mail className="text-brand-500 flex-shrink-0 drop-shadow-md" size={20} />
                <span className="text-gray-200">{contactInfo.email}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-dark-700 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-300 text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Freshland. All rights reserved.
          </p>
          <div className="flex space-x-4">
            <span className="text-gray-300 text-sm font-medium">Secured by Paystack</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

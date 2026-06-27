import { Link } from 'react-router-dom';
import { Instagram, Twitter, Facebook, MapPin, Phone, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Footer = () => {
  const [contactInfo, setContactInfo] = useState({
    address: '123 Luxury Avenue, Victoria Island, Lagos, Nigeria', // Default fallback
    phone: '+234 800 LUXE APT',
    email: 'reservations@luxe.com'
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
              <svg width="45" height="45" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10 L10 90 L35 90 L60 40 Z" fill="#DF6853"/>
                <path d="M40 90 L90 90 L75 60 L50 90 Z" fill="#DF6853"/>
                <path d="M25 15 L28 25 L38 28 L28 31 L25 41 L22 31 L12 28 L22 25 Z" fill="#DF6853"/>
              </svg>
              <div className="flex flex-col justify-center">
                <span className="text-[22px] font-sans font-extrabold text-[#4A4A4A] leading-none tracking-wide">SPARKLES</span>
                <span className="text-[11px] font-sans text-[#6B7280] leading-tight tracking-[0.25em] mt-1">APARTMENTS</span>
              </div>
            </Link>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Experience unparalleled luxury and comfort in our premium shortlet apartments designed for the elite.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-gray-400 hover:bg-gold-500 hover:text-dark-900 transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-gray-400 hover:bg-gold-500 hover:text-dark-900 transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-gray-400 hover:bg-gold-500 hover:text-dark-900 transition-colors">
                <Facebook size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xl font-medium mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li><Link to="/about" className="text-gray-400 hover:text-gold-500 transition-colors">About Us</Link></li>
              <li><Link to="/amenities" className="text-gray-400 hover:text-gold-500 transition-colors">Amenities</Link></li>
              <li><Link to="/gallery" className="text-gray-400 hover:text-gold-500 transition-colors">Gallery</Link></li>
              <li><Link to="/contact" className="text-gray-400 hover:text-gold-500 transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xl font-medium mb-6">Legal</h4>
            <ul className="space-y-4">
              <li><Link to="/terms" className="text-gray-400 hover:text-gold-500 transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/privacy" className="text-gray-400 hover:text-gold-500 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/cancellation" className="text-gray-400 hover:text-gold-500 transition-colors">Cancellation Policy</Link></li>
              <li><Link to="/faq" className="text-gray-400 hover:text-gold-500 transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xl font-medium mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <MapPin className="text-gold-500 mt-1 flex-shrink-0" size={20} />
                <span className="text-gray-400">{contactInfo.address}</span>
              </li>
              {contactInfo.phone.split(',').map((phoneStr, idx) => (
                <li key={idx} className="flex items-center space-x-3">
                  <Phone className="text-gold-500 flex-shrink-0" size={20} />
                  <span className="text-gray-400">{phoneStr.trim()}</span>
                </li>
              ))}
              <li className="flex items-center space-x-3">
                <Mail className="text-gold-500 flex-shrink-0" size={20} />
                <span className="text-gray-400">{contactInfo.email}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-dark-700 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Sparkles Apartments. All rights reserved.
          </p>
          <div className="flex space-x-4">
            <span className="text-gray-500 text-sm font-medium">Secured by Paystack</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

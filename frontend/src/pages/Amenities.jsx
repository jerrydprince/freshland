import React, { useState, useEffect } from 'react';
import { Wifi, Coffee, Car, Shield, Tv, Wind, Waves, Dumbbell, CheckCircle, Film, Sofa, Gamepad2, Zap, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedData, setCachedData } from '../utils/cache';

const defaultAmenitiesList = [
  { title: 'High-Speed WiFi', desc: 'Uninterrupted internet access throughout the property.' },
  { title: '24/7 Security', desc: 'Advanced security systems and round-the-clock personnel.' },
  { title: 'Private Parking', desc: 'Secure, dedicated parking spaces for residents and guests.' },
  { title: 'Gourmet Kitchen', desc: 'Fully equipped kitchens with top-tier appliances.' },
  { title: 'Smart Entertainment', desc: 'Large smart TVs with premium streaming services.' },
  { title: 'Climate Control', desc: 'Centralized air conditioning for ultimate comfort.' },
  { title: 'Swimming Pool', desc: 'Access to a pristine, temperature-controlled pool.' },
  { title: 'Fitness Center', desc: 'State-of-the-art gym equipment available 24/7.' },
  { title: 'Netflix', desc: 'Premium Netflix streaming subscription for unlimited movies and show options.' },
  { title: 'Luxuriously Furnished', desc: 'Exquisite interior design with premium, high-end contemporary furnishings.' },
  { title: 'PS5', desc: 'PlayStation 5 gaming console equipped with popular games for your entertainment.' },
  { title: 'Secured, Serene and Cozy Environment', desc: 'Located in a highly secured, peaceful, and cozy neighborhood.' },
  { title: 'Excellent Road Network', desc: 'Accessible tarred roads linking to key areas smoothly.' },
  { title: '24/7 Light and Running Water', desc: 'Uninterrupted power supply with backup generators and continuous clean water access.' },
  { title: 'Close Proximity to Abuja Hotspots', desc: 'Close proximity to all popular hotspots, restaurants, and shopping centers in Abuja.' }
];

const getIconForTitle = (title) => {
  const t = title.toLowerCase();
  if (t.includes('wifi') || t.includes('internet')) return <Wifi size={40} />;
  if (t.includes('secur') || t.includes('safe') || t.includes('serene') || t.includes('cozy') || t.includes('environment')) return <Shield size={40} />;
  if (t.includes('park') || t.includes('car') || t.includes('road') || t.includes('network')) return <Car size={40} />;
  if (t.includes('kitchen') || t.includes('coffee') || t.includes('food')) return <Coffee size={40} />;
  if (t.includes('netflix') || t.includes('film') || t.includes('movie')) return <Film size={40} />;
  if (t.includes('ps5') || t.includes('game') || t.includes('playstation')) return <Gamepad2 size={40} />;
  if (t.includes('tv') || t.includes('smart') || t.includes('entertainment')) return <Tv size={40} />;
  if (t.includes('furnish') || t.includes('luxury') || t.includes('design') || t.includes('sofa')) return <Sofa size={40} />;
  if (t.includes('light') || t.includes('electricity') || t.includes('power') || t.includes('water')) return <Zap size={40} />;
  if (t.includes('proximity') || t.includes('hotspot') || t.includes('abuja') || t.includes('map')) return <MapPin size={40} />;
  if (t.includes('air') || t.includes('climate') || t.includes('cool')) return <Wind size={40} />;
  if (t.includes('pool') || t.includes('swim')) return <Waves size={40} />;
  if (t.includes('fit') || t.includes('gym')) return <Dumbbell size={40} />;
  return <CheckCircle size={40} />;
};

const Amenities = () => {
  const cachedCmsContent = getCachedData('cmsContent');
  
  const getInitialAmenities = () => {
    if (cachedCmsContent && cachedCmsContent.cms_amenities_list) {
      try {
        const parsed = JSON.parse(cachedCmsContent.cms_amenities_list);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return defaultAmenitiesList;
  };

  const [amenities, setAmenities] = useState(getInitialAmenities());

  useEffect(() => {
    fetchAmenities();
  }, []);

  const fetchAmenities = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'cms_amenities_list').single();
      if (data && data.setting_value) {
        const parsed = JSON.parse(data.setting_value);
        if (parsed && parsed.length > 0) {
          setAmenities(parsed);
          
          const currentCms = getCachedData('cmsContent') || {};
          currentCms.cms_amenities_list = data.setting_value;
          setCachedData('cmsContent', currentCms);
          return;
        }
      }
    } catch (e) { console.error("CMS amenities load error:", e); }
  };

  return (
    <div className="pt-24 min-h-screen">
      <div className="container mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">Premium Amenities</h1>
        <p className="text-gray-200 text-center mb-16 max-w-2xl mx-auto">Experience a new standard of living with our carefully curated facilities designed to cater to your every need.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {amenities.map((amenity, idx) => (
            <div key={idx} className="bg-dark-800 p-8 border border-dark-700 hover:border-gold-500 transition-colors duration-300 text-center group">
              <div className="text-gold-500 mb-6 flex justify-center group-hover:scale-110 transition-transform duration-300">
                {getIconForTitle(amenity.title)}
              </div>
              <h3 className="text-xl font-semibold mb-4">{amenity.title}</h3>
              <p className="text-gray-200">{amenity.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Amenities;

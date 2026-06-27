import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Award, Users, Home as HomeIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedData, setCachedData } from '../utils/cache';

const About = () => {
  const cachedCmsContent = getCachedData('cmsContent') || {};
  const [cmsContent, setCmsContent] = useState(cachedCmsContent);

  useEffect(() => {
    fetchCmsContent();
  }, []);

  const fetchCmsContent = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*').like('setting_key', 'cms_about_%');
      if (data) {
        const contentMap = {};
        data.forEach(item => contentMap[item.setting_key] = item.setting_value);
        
        const mergedCms = { ...getCachedData('cmsContent'), ...contentMap };
        setCmsContent(mergedCms);
        setCachedData('cmsContent', mergedCms);
      }
    } catch (e) { console.error("CMS load error:", e); }
  };

  return (
    <div className="min-h-screen bg-dark-900 overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/60 z-10" />
          {cmsContent.cms_about_hero_bg ? (
            <img 
              src={cmsContent.cms_about_hero_bg} 
              alt="About Luxe Apartments" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full"
              style={{
                background: 'radial-gradient(circle at center, #27272a 0%, #09090b 100%)'
              }}
            />
          )}
        </div>
        <div className="relative z-20 text-center px-6 max-w-4xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-bold text-white mb-6"
          >
            {cmsContent.cms_about_title || "Our Story"}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-gray-300 font-light"
          >
            {cmsContent.cms_about_subtitle || "Redefining luxury living and hospitality, one exquisite apartment at a time."}
          </motion.p>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2"
            >
              <h4 className="text-gold-500 font-medium tracking-widest uppercase mb-4">The Vision</h4>
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">{cmsContent.cms_about_vision_title || "Elevating the standard of modern hospitality."}</h2>
              <div className="space-y-6 text-gray-400 text-lg leading-relaxed">
                <p>{cmsContent.cms_about_vision_text_1 || "Welcome to Luxe Apartments, where we redefine the art of fine living. Located in the heart of the city's most exclusive district, our shortlet apartments are designed for those who appreciate the finer things in life."}</p>
                <p>{cmsContent.cms_about_vision_text_2 || "Our journey began with a simple yet ambitious goal: to provide an unparalleled experience that perfectly combines the comfort of a luxury private home with the premium, uncompromising services of a five-star hotel."}</p>
                <p>{cmsContent.cms_about_vision_text_3 || "Every detail, from the bespoke furnishings, curated art pieces, to the state-of-the-art smart home amenities, has been meticulously selected by award-winning interior designers to ensure your stay is nothing short of absolute perfection."}</p>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2 grid grid-cols-2 gap-4 relative"
            >
              {cmsContent.cms_about_img_1 ? (
                <img src={cmsContent.cms_about_img_1} alt="Interior 1" className="w-full h-72 object-cover rounded-sm mt-12 shadow-2xl" />
              ) : (
                <div className="w-full h-72 rounded-sm mt-12 bg-dark-800 border border-dark-700 flex flex-col items-center justify-center p-6 text-center shadow-2xl">
                  <span className="text-gold-500 font-bold uppercase tracking-widest text-xs">Exquisite Spaces</span>
                  <p className="text-gray-500 text-[10px] mt-2">Premium design and aesthetics</p>
                </div>
              )}
              {cmsContent.cms_about_img_2 ? (
                <img src={cmsContent.cms_about_img_2} alt="Interior 2" className="w-full h-72 object-cover rounded-sm shadow-2xl" />
              ) : (
                <div className="w-full h-72 rounded-sm bg-dark-800 border border-dark-700 flex flex-col items-center justify-center p-6 text-center shadow-2xl">
                  <span className="text-gold-500 font-bold uppercase tracking-widest text-xs">Unmatched Comfort</span>
                  <p className="text-gray-500 text-[10px] mt-2">Redefining luxury shortlets</p>
                </div>
              )}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gold-500 text-dark-900 p-8 text-center shadow-2xl z-10 w-48">
                <p className="text-5xl font-bold mb-1">{cmsContent.cms_about_years || "10+"}</p>
                <p className="text-sm uppercase tracking-widest font-semibold">Years of Excellence</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="py-24 bg-dark-800 border-t border-dark-700">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h4 className="text-gold-500 font-medium tracking-widest uppercase mb-4">Our Core Values</h4>
            <h2 className="text-4xl font-bold">What drives us forward</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Award size={32} />, title: "Excellence", desc: "We never compromise on the quality of your stay or the aesthetics of our spaces." },
              { icon: <Users size={32} />, title: "Guest-Centric", desc: "Your comfort, privacy, and satisfaction are at the absolute center of our universe." },
              { icon: <HomeIcon size={32} />, title: "Sanctuary", desc: "We create peaceful, secure environments that feel like a true home away from home." },
              { icon: <CheckCircle size={32} />, title: "Integrity", desc: "Honesty and transparency in every interaction, booking, and service provided." }
            ].map((value, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-dark-900 border border-dark-700 p-8 text-center hover:border-gold-500 transition-colors group"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-500/10 text-gold-500 mb-6 group-hover:scale-110 transition-transform">
                  {value.icon}
                </div>
                <h3 className="text-xl font-semibold mb-4 text-white">{value.title}</h3>
                <p className="text-gray-400">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default About;

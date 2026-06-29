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
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-fixed bg-center bg-cover" style={{ backgroundImage: `url(${"/Images/aireal view.jfif"})` }}>
          <div className="absolute inset-0 bg-black/60 z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent z-10" />
        </div>
        <div className="relative z-20 text-center px-6 max-w-5xl mx-auto pt-32">
          <motion.h4 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-brand-500 font-sans tracking-[0.3em] uppercase text-xs font-bold mb-8 drop-shadow-md"
          >
            The Freshland Story
          </motion.h4>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-8xl lg:text-9xl font-serif font-bold text-white mb-10 leading-none drop-shadow-2xl"
          >
            {cmsContent.cms_about_title || "Redefining Luxury"}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-3xl text-gray-100 font-light max-w-4xl mx-auto leading-relaxed drop-shadow-xl"
          >
            {cmsContent.cms_about_subtitle || "A sanctuary of elegance designed for those who appreciate the finer things in life."}
          </motion.p>
        </div>
      </section>

      {/* Main Content Section - Timeline Layout */}
      <section className="py-32 bg-dark-950 relative">
        <div className="container mx-auto px-6 relative">
          {/* Vertical Line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-[1px] bg-dark-800 -translate-x-1/2 hidden md:block" />

          <div className="flex flex-col gap-32">
            {/* Block 1 */}
            <div className="flex flex-col md:flex-row items-center justify-between w-full relative z-10">
              <div className="md:w-5/12 text-left md:text-right pr-0 md:pr-16 order-2 md:order-1 mt-12 md:mt-0">
                <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-4">Our Vision</h4>
                <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 leading-tight text-white">{cmsContent.cms_about_vision_title || "Elevating modern hospitality."}</h2>
                <p className="text-gray-200 text-lg leading-relaxed font-light">
                  {cmsContent.cms_about_vision_text_1 || "Welcome to Freshland, where we redefine the art of fine living. Located in the heart of the city's most exclusive district, our hotel apartments are designed for those who appreciate the finer things in life."}
                </p>
              </div>
              <div className="absolute left-6 md:left-1/2 w-4 h-4 bg-brand-500 rounded-full -translate-x-1/2 shadow-[0_0_15px_rgba(104,180,56,0.5)] hidden md:block" />
              <div className="md:w-5/12 pl-0 md:pl-16 order-1 md:order-2 w-full">
                <img src={"/Images/front view 1.jfif"} alt="Our Vision" className="w-full h-[400px] md:h-[500px] object-cover rounded-[3rem] shadow-2xl" />
              </div>
            </div>

            {/* Block 2 */}
            <div className="flex flex-col md:flex-row items-center justify-between w-full relative z-10">
              <div className="md:w-5/12 pr-0 md:pr-16 order-1 md:order-1 w-full">
                <img src={"/Images/front view 2.jfif"} alt="Our Journey" className="w-full h-[400px] md:h-[500px] object-cover rounded-[3rem] shadow-2xl" />
              </div>
              <div className="absolute left-6 md:left-1/2 w-4 h-4 bg-brand-500 rounded-full -translate-x-1/2 shadow-[0_0_15px_rgba(104,180,56,0.5)] hidden md:block" />
              <div className="md:w-5/12 text-left pl-0 md:pl-16 order-2 md:order-2 mt-12 md:mt-0">
                <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-4">The Journey</h4>
                <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 leading-tight text-white">An uncompromising experience.</h2>
                <p className="text-gray-200 text-lg leading-relaxed font-light">
                  {cmsContent.cms_about_vision_text_2 || "Our journey began with a simple yet ambitious goal: to provide an unparalleled experience that perfectly combines the comfort of a luxury private home with the premium services of a five-star hotel."}
                </p>
              </div>
            </div>
            
            {/* Block 3 */}
            <div className="flex flex-col md:flex-row items-center justify-between w-full relative z-10">
              <div className="md:w-5/12 text-left md:text-right pr-0 md:pr-16 order-2 md:order-1 mt-12 md:mt-0">
                <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-4">The Details</h4>
                <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 leading-tight text-white">Meticulously crafted perfection.</h2>
                <p className="text-gray-200 text-lg leading-relaxed font-light">
                  {cmsContent.cms_about_vision_text_3 || "Every detail, from the bespoke furnishings, curated art pieces, to the state-of-the-art smart home amenities, has been meticulously selected to ensure your stay is nothing short of absolute perfection."}
                </p>
              </div>
              <div className="absolute left-6 md:left-1/2 w-4 h-4 bg-brand-500 rounded-full -translate-x-1/2 shadow-[0_0_15px_rgba(104,180,56,0.5)] hidden md:block" />
              <div className="md:w-5/12 pl-0 md:pl-16 order-1 md:order-2 w-full">
                <div className="bg-dark-800 p-16 rounded-[3rem] text-center border border-dark-700 shadow-2xl h-[400px] md:h-[500px] flex flex-col items-center justify-center">
                  <p className="text-8xl font-serif text-brand-500 mb-6 italic">{cmsContent.cms_about_years || "10+"}</p>
                  <p className="text-lg uppercase tracking-[0.2em] font-bold text-white">Years of Excellence</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Core Values Section - Large Typography */}
      <section className="py-32 bg-dark-900 border-t border-dark-800">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-end justify-between gap-12 mb-24">
            <div className="max-w-4xl">
              <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-6 flex items-center gap-4">
                <span className="w-12 h-[2px] bg-brand-500"></span> Our Core Values
              </h4>
              <h2 className="text-5xl md:text-7xl font-serif font-bold text-white leading-tight">What drives us forward</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {[
              { icon: <Award size={48} strokeWidth={1} />, title: "Excellence", desc: "We never compromise on the quality of your stay or the aesthetics of our spaces." },
              { icon: <Users size={48} strokeWidth={1} />, title: "Guest-Centric", desc: "Your comfort, privacy, and satisfaction are at the absolute center of our universe." },
              { icon: <HomeIcon size={48} strokeWidth={1} />, title: "Sanctuary", desc: "We create peaceful, secure environments that feel like a true home away from home." },
              { icon: <CheckCircle size={48} strokeWidth={1} />, title: "Integrity", desc: "Honesty and transparency in every interaction, booking, and service provided." }
            ].map((value, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="group flex flex-col sm:flex-row gap-10 p-12 bg-dark-950 rounded-[3rem] border border-dark-800 hover:border-brand-500/50 hover:bg-dark-900 transition-all duration-500 shadow-xl"
              >
                <div className="text-brand-500 shrink-0 group-hover:scale-110 transition-transform duration-500">
                  {value.icon}
                </div>
                <div>
                  <h3 className="text-3xl font-serif font-bold mb-4 text-white group-hover:text-brand-500 transition-colors">{value.title}</h3>
                  <p className="text-gray-200 font-light leading-relaxed text-lg">{value.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default About;

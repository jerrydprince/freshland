import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Coffee, Car, Shield, ChevronRight, ChevronLeft, Star, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedData, setCachedData } from '../utils/cache';

const defaultHeroSlides = [
  {
    image: 'https://pjmdlifojfwoviyugjwq.supabase.co/storage/v1/object/public/gallery_images/uploads/9a48a660-5a10-4f00-9690-6f2833d95c17.jpg',
    title: 'Experience True Luxury',
    subtitle: 'Elevate your stay in the heart of the city with our premium shortlets.'
  },
  {
    image: 'https://pjmdlifojfwoviyugjwq.supabase.co/storage/v1/object/public/gallery_images/uploads/1aec7ea7-b33f-4a56-9a98-527a63534b8d.webp',
    title: 'Designed for Comfort',
    subtitle: 'Every detail meticulously crafted for your ultimate relaxation.'
  },
  {
    image: 'https://pjmdlifojfwoviyugjwq.supabase.co/storage/v1/object/public/gallery_images/uploads/c4727319-aff1-4e23-8afa-305b63f4029e.webp',
    title: 'Your Private Sanctuary',
    subtitle: 'Exclusive amenities and serene environments await.'
  }
];

const Home = () => {
  const cachedFeaturedRooms = getCachedData('featuredRooms');
  const cachedCmsContent = getCachedData('cmsContent');

  const [currentSlide, setCurrentSlide] = useState(0);
  const [featuredRooms, setFeaturedRooms] = useState(cachedFeaturedRooms || []);
  const [cmsContent, setCmsContent] = useState(cachedCmsContent || {});
  const sliderRef = useRef(null);

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -380, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 380, behavior: 'smooth' });
    }
  };

  // Build hero slides array from cached CMS content instantly on initial load
  const getInitialHeroSlides = () => {
    if (!cachedCmsContent) return defaultHeroSlides;
    const newSlides = [];
    
    // Slide 1
    if (cachedCmsContent.cms_home_hero_bg_1 || cachedCmsContent.cms_home_hero_title) {
      newSlides.push({
        image: cachedCmsContent.cms_home_hero_bg_1 || defaultHeroSlides[0].image,
        title: cachedCmsContent.cms_home_hero_title || defaultHeroSlides[0].title,
        subtitle: cachedCmsContent.cms_home_hero_subtitle || defaultHeroSlides[0].subtitle
      });
    } else { newSlides.push(defaultHeroSlides[0]); }
    
    // Slide 2
    if (cachedCmsContent.cms_home_hero_bg_2 || cachedCmsContent.cms_home_hero_title_2) {
      newSlides.push({
        image: cachedCmsContent.cms_home_hero_bg_2 || defaultHeroSlides[1].image,
        title: cachedCmsContent.cms_home_hero_title_2 || defaultHeroSlides[1].title,
        subtitle: cachedCmsContent.cms_home_hero_subtitle_2 || defaultHeroSlides[1].subtitle
      });
    } else { newSlides.push(defaultHeroSlides[1]); }
    
    // Slide 3
    if (cachedCmsContent.cms_home_hero_bg_3 || cachedCmsContent.cms_home_hero_title_3) {
      newSlides.push({
        image: cachedCmsContent.cms_home_hero_bg_3 || defaultHeroSlides[2].image,
        title: cachedCmsContent.cms_home_hero_title_3 || defaultHeroSlides[2].title,
        subtitle: cachedCmsContent.cms_home_hero_subtitle_3 || defaultHeroSlides[2].subtitle
      });
    } else { newSlides.push(defaultHeroSlides[2]); }

    return newSlides;
  };

  const [heroSlides, setHeroSlides] = useState(getInitialHeroSlides());

  useEffect(() => {
    fetchAllHomeData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const fetchAllHomeData = async () => {
    try {
      // Parallelize both fetches to cut query waterfall and latency
      const [cmsRes, roomsRes] = await Promise.all([
        supabase.from('system_settings').select('*').like('setting_key', 'cms_%'),
        supabase.from('rooms').select('id, name, type, capacity, size_sqm, base_price_ngn, image_url, status, amenities').order('name')
      ]);

      if (cmsRes && cmsRes.data) {
        const contentMap = {};
        cmsRes.data.forEach(item => contentMap[item.setting_key] = item.setting_value);
        setCmsContent(contentMap);
        setCachedData('cmsContent', contentMap);
        
        // Build hero slides array from CMS content
        const newSlides = [];
        
        // Slide 1
        if (contentMap.cms_home_hero_bg_1 || contentMap.cms_home_hero_title) {
          newSlides.push({
            image: contentMap.cms_home_hero_bg_1 || defaultHeroSlides[0].image,
            title: contentMap.cms_home_hero_title || defaultHeroSlides[0].title,
            subtitle: contentMap.cms_home_hero_subtitle || defaultHeroSlides[0].subtitle
          });
        } else { newSlides.push(defaultHeroSlides[0]); }
        
        // Slide 2
        if (contentMap.cms_home_hero_bg_2 || contentMap.cms_home_hero_title_2) {
          newSlides.push({
            image: contentMap.cms_home_hero_bg_2 || defaultHeroSlides[1].image,
            title: contentMap.cms_home_hero_title_2 || defaultHeroSlides[1].title,
            subtitle: contentMap.cms_home_hero_subtitle_2 || defaultHeroSlides[1].subtitle
          });
        } else { newSlides.push(defaultHeroSlides[1]); }
        
        // Slide 3
        if (contentMap.cms_home_hero_bg_3 || contentMap.cms_home_hero_title_3) {
          newSlides.push({
            image: contentMap.cms_home_hero_bg_3 || defaultHeroSlides[2].image,
            title: contentMap.cms_home_hero_title_3 || defaultHeroSlides[2].title,
            subtitle: contentMap.cms_home_hero_subtitle_3 || defaultHeroSlides[2].subtitle
          });
        } else { newSlides.push(defaultHeroSlides[2]); }

        setHeroSlides(newSlides);
      }

      if (roomsRes && roomsRes.data) {
        setFeaturedRooms(roomsRes.data);
        setCachedData('featuredRooms', roomsRes.data);
      }
    } catch (e) {
      console.error("Home page background data load error:", e);
    }
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-[#09090b]">
        <AnimatePresence>
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-0"
            style={{
              background: 'radial-gradient(circle at center, #1e1e24 0%, #09090b 100%)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80 z-10" />
            {heroSlides[currentSlide].image ? (
              <img 
                src={heroSlides[currentSlide].image} 
                alt={heroSlides[currentSlide].title}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="text-gold-500/10 font-serif text-6xl md:text-8xl lg:text-9xl select-none tracking-widest font-black mb-4 animate-pulse">
                  SPARKLES
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Global overlay above all slides for maximum text legibility */}
        <div className="absolute inset-0 bg-black/55 z-10 pointer-events-none" />

        <div className="relative z-20 container mx-auto px-6 text-center">
          <motion.h1 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold text-[#ffffff] mb-6 drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)] tracking-tight"
          >
            {heroSlides[currentSlide].title}
          </motion.h1>
          <motion.p 
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-lg md:text-2xl text-[#ffffff]/95 mb-10 max-w-3xl mx-auto font-normal drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] leading-relaxed"
          >
            {heroSlides[currentSlide].subtitle}
          </motion.p>
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6"
          >
            <Link to="/booking" className="btn-primary w-full sm:w-auto text-lg px-8 py-4">
              Reserve Now
            </Link>
            <Link to="/gallery" className="btn-outline w-full sm:w-auto text-lg px-8 py-4 bg-black/20 backdrop-blur-sm border-white text-white hover:bg-white hover:text-dark-900">
              Take a Tour
            </Link>
          </motion.div>
        </div>

        {/* Slider Controls */}
        <button onClick={prevSlide} className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-gold-500 hover:text-dark-900 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <button onClick={nextSlide} className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-gold-500 hover:text-dark-900 transition-colors">
          <ChevronRight size={24} />
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex space-x-3">
          {heroSlides.map((_, idx) => (
            <button 
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${currentSlide === idx ? 'bg-gold-500 w-8' : 'bg-white/50 hover:bg-white'}`}
            />
          ))}
        </div>
      </section>

      {/* Overview Section */}
      <section className="py-24 bg-dark-900">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <h4 className="text-gold-500 font-medium tracking-widest uppercase mb-4">About Luxe</h4>
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">{cmsContent.cms_home_about_title || 'Redefining the standard of luxury living.'}</h2>
              <p className="text-gray-400 text-lg mb-6 leading-relaxed">
                {cmsContent.cms_home_about_text_1 || 'Nestled in the most prestigious neighborhood, Luxe offers an unparalleled living experience. Our carefully curated apartments blend contemporary design with ultimate comfort, creating a sanctuary for both business travelers and leisure seekers.'}
              </p>
              <p className="text-gray-400 text-lg mb-10 leading-relaxed">
                {cmsContent.cms_home_about_text_2 || 'Every corner is thoughtfully designed to anticipate your needs, providing a seamless blend of aesthetics and functionality.'}
              </p>
              <Link to="/about" className="inline-flex items-center text-gold-500 font-medium hover:text-gold-400 transition-colors">
                Discover our story <ChevronRight size={20} className="ml-2" />
              </Link>
            </div>
            <div className="lg:w-1/2 grid grid-cols-2 gap-6 relative">
              {cmsContent.cms_home_about_img_1 ? (
                <img src={cmsContent.cms_home_about_img_1} alt="Interior 1" className="w-full h-80 object-cover rounded-sm mt-12" />
              ) : (
                <div className="w-full h-80 rounded-sm mt-12 bg-dark-800 border border-dark-700 flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-gold-500 font-bold uppercase tracking-widest text-xs">Exquisite Spaces</span>
                  <p className="text-gray-500 text-[10px] mt-2">Premium design and aesthetics</p>
                </div>
              )}
              {cmsContent.cms_home_about_img_2 ? (
                <img src={cmsContent.cms_home_about_img_2} alt="Interior 2" className="w-full h-80 object-cover rounded-sm" />
              ) : (
                <div className="w-full h-80 rounded-sm bg-dark-800 border border-dark-700 flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-gold-500 font-bold uppercase tracking-widest text-xs">Unmatched Comfort</span>
                  <p className="text-gray-500 text-[10px] mt-2">Redefining luxury shortlets</p>
                </div>
              )}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-800 p-8 text-center shadow-2xl border border-dark-700">
                <p className="text-5xl font-serif text-gold-500 mb-2">5</p>
                <p className="text-sm uppercase tracking-widest text-gray-300">Star Rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Apartments Section */}
      <section className="py-24 bg-dark-900 border-t border-dark-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h4 className="text-gold-500 font-medium tracking-widest uppercase mb-4">Our Residences</h4>
            <h2 className="text-4xl md:text-5xl font-bold">Discover Your Perfect Space</h2>
          </div>
          
          <div className="relative group/slider px-4 md:px-12">
            {/* Left Control Arrow */}
            <button 
              onClick={scrollLeft} 
              className="absolute left-0 md:left-2 top-1/2 -translate-y-1/2 z-20 bg-dark-800/90 hover:bg-gold-500 hover:text-dark-900 border border-dark-700 hover:border-gold-500 text-white p-3 rounded-full shadow-2xl transition-all duration-300 backdrop-blur-sm opacity-0 group-hover/slider:opacity-100 focus:opacity-100 flex items-center justify-center"
              aria-label="Scroll Left"
            >
              <ChevronLeft size={24} />
            </button>
            
            {/* Right Control Arrow */}
            <button 
              onClick={scrollRight} 
              className="absolute right-0 md:right-2 top-1/2 -translate-y-1/2 z-20 bg-dark-800/90 hover:bg-gold-500 hover:text-dark-900 border border-dark-700 hover:border-gold-500 text-white p-3 rounded-full shadow-2xl transition-all duration-300 backdrop-blur-sm opacity-0 group-hover/slider:opacity-100 focus:opacity-100 flex items-center justify-center"
              aria-label="Scroll Right"
            >
              <ChevronRight size={24} />
            </button>

            {/* Horizontal Scroll Container */}
            <div 
              ref={sliderRef}
              className="flex gap-8 overflow-x-auto pb-8 pt-2 px-1 scroll-smooth snap-x snap-mandatory no-scrollbar"
            >
              {featuredRooms.map(room => (
                <div 
                  key={room.id} 
                  className="bg-dark-800 border border-dark-700 group overflow-hidden flex flex-col h-full flex-shrink-0 w-[300px] sm:w-[350px] md:w-[380px] snap-start transition-all duration-300 hover:shadow-[0_10px_30px_rgba(245,158,11,0.15)] hover:border-gold-500/50"
                >
                  <div className="relative h-64 overflow-hidden">
                    {room.image_url ? (
                      <img 
                        src={room.image_url} 
                        alt={room.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-dark-900 to-black text-center p-4">
                        <span className="text-gold-500 font-serif text-base tracking-widest uppercase">Luxe Residence</span>
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div className="absolute top-4 left-4 bg-dark-900/90 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold border border-dark-700 uppercase tracking-wider flex items-center gap-1.5 rounded-sm">
                      <span className={`w-2 h-2 rounded-full ${room.status === 'available' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                      <span className={room.status === 'available' ? 'text-green-400' : 'text-amber-400'}>
                        {room.status === 'available' ? 'Available' : 'Reserved'}
                      </span>
                    </div>

                    <div className="absolute top-4 right-4 bg-dark-900/90 backdrop-blur-sm px-4 py-2 text-gold-500 font-semibold border border-dark-700 rounded-sm">
                      ₦{Number(room.base_price_ngn).toLocaleString()} <span className="text-sm text-gray-400 font-normal">/ night</span>
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                    <Link to={`/room/${room.id}`}>
                      <h3 className="text-2xl font-semibold mb-2 group-hover:text-gold-500 transition-colors">{room.name}</h3>
                    </Link>
                    <div className="flex gap-4 text-sm text-gray-400 mb-6 pb-6 border-b border-dark-700">
                      <span>{room.type}</span>
                      <span>•</span>
                      <span>Up to {room.capacity} Guests</span>
                      <span>•</span>
                      <span>{room.size_sqm} sqm</span>
                    </div>
                    <div className="flex-grow">
                      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                        {room.amenities ? room.amenities.slice(0, 3).join(' • ') : 'Premium features included'}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <Link to={`/room/${room.id}`} className="btn-outline flex-1 text-center py-2">
                        View Details
                      </Link>
                      <Link to={`/booking?room=${room.id}`} className="btn-primary flex-1 text-center flex justify-center items-center gap-2">
                        Book <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center mt-8">
            <Link to="/apartments" className="inline-flex items-center text-gold-500 font-medium hover:text-gold-400 transition-colors">
              View all apartments <ChevronRight size={20} className="ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* Amenities Section */}
      <section className="py-24 bg-dark-800">
        <div className="container mx-auto px-6 text-center">
          <h4 className="text-gold-500 font-medium tracking-widest uppercase mb-4">Premium Facilities</h4>
          <h2 className="text-4xl md:text-5xl font-bold mb-16">Unmatched Amenities</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Wifi size={32} />, title: 'High-Speed WiFi', desc: 'Stay connected with blazing fast internet access.' },
              { icon: <Shield size={32} />, title: '24/7 Security', desc: 'Your safety is our priority with round-the-clock surveillance.' },
              { icon: <Car size={32} />, title: 'Private Parking', desc: 'Secure and designated parking spaces for your vehicles.' },
              { icon: <Coffee size={32} />, title: 'Gourmet Kitchen', desc: 'Fully equipped modern kitchen for your culinary desires.' },
            ].map((amenity, idx) => (
              <div key={idx} className="bg-dark-900 p-8 border border-dark-700 hover:border-gold-500 transition-colors duration-300 group">
                <div className="text-gold-500 mb-6 flex justify-center group-hover:scale-110 transition-transform duration-300">{amenity.icon}</div>
                <h3 className="text-xl font-semibold mb-4">{amenity.title}</h3>
                <p className="text-gray-400">{amenity.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-16">
            <Link to="/amenities" className="btn-outline">View All Amenities</Link>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-dark-950">
          <div className="absolute inset-0 bg-dark-900/90 z-10" />
          {cmsContent.cms_home_cta_bg ? (
            <img src={cmsContent.cms_home_cta_bg} alt="CTA Background" className="w-full h-full object-cover" />
          ) : (
            <div 
              className="w-full h-full"
              style={{
                background: 'radial-gradient(circle at center, #27272a 0%, #09090b 100%)'
              }}
            />
          )}
        </div>
        <div className="relative z-20 text-center px-6 max-w-4xl">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">{cmsContent.cms_home_cta_title || 'Ready to experience the exceptional?'}</h2>
          <p className="text-xl text-gray-300 mb-10 font-light drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)]">{cmsContent.cms_home_cta_subtitle || 'Book your stay today and step into a world of comfort and luxury.'}</p>
          <Link to="/booking" className="btn-primary text-lg px-10 py-5">
            Book Your Stay
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;

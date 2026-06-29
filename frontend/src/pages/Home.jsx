import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Coffee, Car, Shield, ChevronRight, ChevronLeft, Star, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedData, setCachedData } from '../utils/cache';

const defaultHeroSlides = [
  {
    image: '/Images/front view 1.jfif',
    title: 'Experience True Luxury',
    subtitle: 'Elevate your stay in the heart of the city with our premium hotel.'
  },
  {
    image: '/Images/Room 1.jfif',
    title: 'Designed for Comfort',
    subtitle: 'Every detail meticulously crafted for your ultimate relaxation.'
  },
  {
    image: '/Images/Pool.jfif',
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
        image: '/Images/front view 1.jfif',
        title: cachedCmsContent.cms_home_hero_title || defaultHeroSlides[0].title,
        subtitle: cachedCmsContent.cms_home_hero_subtitle || defaultHeroSlides[0].subtitle
      });
    } else { newSlides.push(defaultHeroSlides[0]); }
    
    // Slide 2
    if (cachedCmsContent.cms_home_hero_bg_2 || cachedCmsContent.cms_home_hero_title_2) {
      newSlides.push({
        image: '/Images/Reception.jfif',
        title: cachedCmsContent.cms_home_hero_title_2 || defaultHeroSlides[1].title,
        subtitle: cachedCmsContent.cms_home_hero_subtitle_2 || defaultHeroSlides[1].subtitle
      });
    } else { newSlides.push(defaultHeroSlides[1]); }
    
    // Slide 3
    if (cachedCmsContent.cms_home_hero_bg_3 || cachedCmsContent.cms_home_hero_title_3) {
      newSlides.push({
        image: '/Images/Pool.jfif',
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
        newSlides.push({
          image: '/Images/front view 1.jfif',
          title: contentMap.cms_home_hero_title || 'Experience True Luxury',
          subtitle: contentMap.cms_home_hero_subtitle || 'Elevate your stay in the heart of the city with our premium hotel.'
        });
        
        // Slide 2
        newSlides.push({
          image: '/Images/Room 1.jfif',
          title: contentMap.cms_home_hero_title_2 || 'Designed for Comfort',
          subtitle: contentMap.cms_home_hero_subtitle_2 || 'Every detail meticulously crafted for your ultimate relaxation.'
        });
        
        // Slide 3
        newSlides.push({
          image: '/Images/Pool.jfif',
          title: contentMap.cms_home_hero_title_3 || 'Your Private Sanctuary',
          subtitle: contentMap.cms_home_hero_subtitle_3 || 'Exclusive amenities and serene environments await.'
        });

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
      <section className="relative min-h-[90vh] flex flex-col lg:flex-row bg-[#09090b] overflow-hidden pt-20 lg:pt-0">
        {/* Left Typography Side */}
        <div className="lg:w-5/12 flex flex-col justify-center px-6 md:px-12 lg:px-16 py-16 lg:py-20 z-20 bg-dark-900/95 backdrop-blur-xl relative">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none" />
          <motion.div
            key={`text-${currentSlide}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10"
          >
            <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-6 flex items-center gap-4">
              <span className="w-12 h-[2px] bg-brand-500"></span> Welcome to Freshland
            </h4>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-white leading-[1.1] tracking-tight mb-8">
              {heroSlides[currentSlide].title.split(' ').map((word, i) => (
                <span key={i} className={i % 2 !== 0 ? "text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-600 italic" : ""}>{word} </span>
              ))}
            </h1>
            <p className="text-lg text-gray-200 mb-12 max-w-md leading-relaxed font-light">
              {heroSlides[currentSlide].subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <Link to="/booking" className="bg-brand-500 text-white px-8 py-4 rounded-full font-medium hover:bg-brand-600 transition-all flex justify-center items-center gap-2 group shadow-[0_0_20px_rgba(104,180,56,0.3)] hover:shadow-[0_0_30px_rgba(104,180,56,0.5)]">
                Reserve Now <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <div className="flex items-center justify-center gap-4 px-4">
                <button onClick={prevSlide} className="p-4 rounded-full border border-dark-700 text-gray-200 hover:text-brand-500 hover:border-brand-500 transition-all bg-dark-800/50">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={nextSlide} className="p-4 rounded-full border border-dark-700 text-gray-200 hover:text-brand-500 hover:border-brand-500 transition-all bg-dark-800/50">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Image Side */}
        <div className="lg:w-7/12 relative h-[50vh] lg:h-auto overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="absolute inset-0 z-0"
            >
              <div className="absolute inset-0 bg-black/20 z-10" />
              {heroSlides[currentSlide].image && (
                <img 
                  src={heroSlides[currentSlide].image} 
                  alt={heroSlides[currentSlide].title}
                  className="w-full h-full object-cover lg:rounded-bl-[6rem] shadow-2xl"
                  loading="eager"
                />
              )}
            </motion.div>
          </AnimatePresence>
          
          {/* Quick Stats Overlay on Image */}
          <div className="absolute bottom-10 right-10 z-20 hidden md:flex gap-4">
            <div className="bg-dark-900/80 backdrop-blur-md border border-dark-700 px-8 py-6 rounded-[2rem]">
              <p className="text-brand-500 text-3xl font-bold mb-1">5★</p>
              <p className="text-gray-200 text-xs uppercase tracking-widest font-semibold">Luxury Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Overview Section - Staggered Editorial Layout */}
      <section className="py-32 bg-dark-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-start gap-20">
            {/* Sticky Text Side */}
            <div className="lg:w-5/12 lg:sticky lg:top-32 z-10">
              <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-6">About Freshland</h4>
              <h2 className="text-5xl md:text-6xl font-serif font-bold mb-8 leading-[1.1]">{cmsContent.cms_home_about_title || 'Redefining the standard of luxury living.'}</h2>
              <div className="space-y-6 text-gray-200 text-lg leading-relaxed font-light">
                <p>
                  {cmsContent.cms_home_about_text_1 || 'Nestled in the most prestigious neighborhood, Freshland offers an unparalleled living experience. Our carefully curated apartments blend contemporary design with ultimate comfort, creating a sanctuary for both business travelers and leisure seekers.'}
                </p>
                <p>
                  {cmsContent.cms_home_about_text_2 || 'Every corner is thoughtfully designed to anticipate your needs, providing a seamless blend of aesthetics and functionality. Step into a world where luxury is standard.'}
                </p>
              </div>
              <Link to="/about" className="inline-flex items-center text-white mt-10 font-medium hover:text-brand-500 transition-colors uppercase tracking-widest text-sm pb-2 border-b border-brand-500 group">
                Discover our story <ArrowRight size={18} className="ml-3 group-hover:translate-x-2 transition-transform" />
              </Link>
            </div>
            
            {/* Overlapping Images Side */}
            <div className="lg:w-7/12 relative mt-16 lg:mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <motion.div 
                  initial={{ y: 50, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="relative md:mt-24 rounded-[3rem] overflow-hidden shadow-2xl"
                >
                  <img src={"/Images/Reception.jfif"} alt="Lounge Area" className="w-full h-[500px] object-cover hover:scale-105 transition-transform duration-1000" />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent" />
                </motion.div>
                
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative rounded-[3rem] overflow-hidden shadow-2xl"
                >
                  <img src={"/Images/Restaurant.jfif"} alt="Restaurant" className="w-full h-[600px] object-cover hover:scale-105 transition-transform duration-1000" />
                </motion.div>
              </div>
              
              {/* Decorative Floating Element */}
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[20%] left-[-10%] bg-dark-800 border border-dark-700 p-8 rounded-[2rem] shadow-2xl z-20 hidden md:block backdrop-blur-xl"
              >
                <p className="text-6xl font-serif text-brand-500 mb-2 italic">10+</p>
                <p className="text-xs uppercase tracking-widest text-gray-300 font-semibold">Years of Excellence</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Apartments Section - Full Width Alternating Layout */}
      <section className="py-32 bg-dark-900 border-t border-dark-800">
        <div className="container mx-auto px-6 mb-24">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8">
            <div className="max-w-2xl">
              <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-4">Our Residences</h4>
              <h2 className="text-5xl md:text-6xl font-serif font-bold leading-tight">Discover Your Perfect Space</h2>
            </div>
            <Link to="/apartments" className="inline-flex items-center text-white font-medium hover:text-brand-500 transition-colors uppercase tracking-widest text-sm pb-2 border-b border-brand-500 group whitespace-nowrap">
              View all apartments <ArrowRight size={18} className="ml-3 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
        </div>
        
        <div className="flex flex-col gap-32">
          {featuredRooms.slice(0, 3).map((room, index) => (
            <div key={room.id} className={`flex flex-col ${index % 2 !== 0 ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-24 container mx-auto px-6 group`}>
              
              {/* Image Reveal */}
              <div className="w-full lg:w-7/12 relative rounded-[3rem] overflow-hidden shadow-2xl aspect-[4/3] lg:aspect-[16/10]">
                {room.image_url ? (
                  <img 
                    src={`/Images/Room ${(index % 5) + 1}.jfif`} 
                    alt={room.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out"
                  />
                ) : (
                  <div className="w-full h-full bg-dark-800 flex items-center justify-center">
                    <span className="text-brand-500 font-serif text-xl tracking-widest uppercase">Luxe Residence</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-700" />
                
                {/* Status Badge */}
                <div className="absolute top-8 left-8 bg-dark-900/90 backdrop-blur-md px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 rounded-full border border-white/10">
                  <span className={`w-2 h-2 rounded-full ${room.status === 'available' ? 'bg-brand-500 animate-pulse' : 'bg-amber-500'}`}></span>
                  <span className={room.status === 'available' ? 'text-brand-400' : 'text-amber-400'}>
                    {room.status === 'available' ? 'Available' : 'Reserved'}
                  </span>
                </div>
              </div>

              {/* Text Info */}
              <div className="w-full lg:w-5/12 flex flex-col justify-center">
                <h3 className="text-4xl lg:text-5xl font-serif font-bold mb-6 group-hover:text-brand-500 transition-colors duration-500">{room.name}</h3>
                
                <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-sans tracking-widest text-gray-200 uppercase font-semibold mb-8">
                  <span>{room.type}</span>
                  <span className="text-brand-500">•</span>
                  <span>{room.capacity} Guests</span>
                  <span className="text-brand-500">•</span>
                  <span>{room.size_sqm} sqm</span>
                </div>
                
                <p className="text-lg text-gray-200 mb-10 leading-relaxed font-light line-clamp-3">
                  {room.amenities ? room.amenities.slice(0, 4).join(' • ') : 'Premium features designed to elevate your stay to the highest standard.'}
                </p>
                
                <div className="flex flex-col sm:flex-row items-center gap-6 pt-8 border-t border-dark-800">
                  <div className="text-3xl font-serif text-white whitespace-nowrap">
                    ₦{Number(room.base_price_ngn).toLocaleString()} <span className="text-sm text-gray-300 font-sans tracking-widest uppercase ml-1">/ night</span>
                  </div>
                  <Link to={`/room/${room.id}`} className="bg-white text-dark-900 w-full sm:w-auto px-8 py-4 rounded-full font-medium hover:bg-brand-500 hover:text-white transition-all text-center">
                    Explore Suite
                  </Link>
                </div>
              </div>

            </div>
          ))}
        </div>
      </section>

      {/* Amenities Section */}
      <section className="py-24 bg-dark-800">
        <div className="container mx-auto px-6 text-center">
          <h4 className="text-brand-500 font-medium tracking-widest uppercase mb-4">Premium Facilities</h4>
          <h2 className="text-4xl md:text-5xl font-bold mb-16">Unmatched Amenities</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Wifi size={32} />, title: 'High-Speed WiFi', desc: 'Stay connected with blazing fast internet access.' },
              { icon: <Shield size={32} />, title: '24/7 Security', desc: 'Your safety is our priority with round-the-clock surveillance.' },
              { icon: <Car size={32} />, title: 'Private Parking', desc: 'Secure and designated parking spaces for your vehicles.' },
              { icon: <Coffee size={32} />, title: 'Gourmet Kitchen', desc: 'Fully equipped modern kitchen for your culinary desires.' },
            ].map((amenity, idx) => (
              <div key={idx} className="bg-dark-900 p-8 border border-dark-700 hover:border-brand-500 transition-colors duration-300 group">
                <div className="text-brand-500 mb-6 flex justify-center group-hover:scale-110 transition-transform duration-300">{amenity.icon}</div>
                <h3 className="text-xl font-semibold mb-4">{amenity.title}</h3>
                <p className="text-gray-200">{amenity.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-16">
            <Link to="/amenities" className="btn-outline">View All Amenities</Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-dark-900 border-t border-dark-800">
        <div className="container mx-auto px-6 text-center">
          <h4 className="text-brand-500 font-medium tracking-widest uppercase mb-4">Guest Testimonials</h4>
          <h2 className="text-4xl md:text-5xl font-bold mb-16">What Our Guests Say</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-dark-800 p-8 border border-dark-700 rounded-xl hover:border-brand-500 transition-colors duration-300 text-left">
              <div className="flex text-brand-500 mb-6">
                <Star className="fill-brand-500" size={20} />
                <Star className="fill-brand-500" size={20} />
                <Star className="fill-brand-500" size={20} />
                <Star className="fill-brand-500" size={20} />
                <Star className="fill-brand-500" size={20} />
              </div>
              <p className="text-gray-300 text-lg mb-8 italic">
                "An absolutely unforgettable experience! The attention to detail, the luxurious amenities, and the exceptional service made our stay at Freshland nothing short of perfect."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border-2 border-brand-500 bg-dark-800 flex items-center justify-center text-xl font-bold text-white">DO</div>
                <div>
                  <h4 className="font-semibold text-white">David O.</h4>
                  <p className="text-gray-300 text-sm">Business Traveler</p>
                </div>
              </div>
            </div>
            
            <div className="bg-dark-800 p-8 border border-dark-700 rounded-xl hover:border-brand-500 transition-colors duration-300 text-left">
              <div className="flex text-brand-500 mb-6">
                <Star className="fill-brand-500" size={20} />
                <Star className="fill-brand-500" size={20} />
                <Star className="fill-brand-500" size={20} />
                <Star className="fill-brand-500" size={20} />
                <Star className="fill-brand-500" size={20} />
              </div>
              <p className="text-gray-300 text-lg mb-8 italic">
                "I was blown away by the comfort and elegance of my suite. It truly felt like a home away from home, but with all the perks of a five-star hotel. Highly recommended!"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border-2 border-brand-500 bg-dark-800 flex items-center justify-center text-xl font-bold text-white">SM</div>
                <div>
                  <h4 className="font-semibold text-white">Sarah M.</h4>
                  <p className="text-gray-300 text-sm">Vacationing Guest</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-dark-950">
          <div className="absolute inset-0 bg-dark-900/90 z-10" />
          {true ? (
            <img src={"/Images/front view 2.jfif"} alt="CTA Background" className="w-full h-full object-cover" />
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

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, Users, Maximize, PlayCircle, CheckCircle, Info, BedDouble, 
  Layers, Calendar, ShieldCheck, Clock, Wifi, Tv, Wind, Waves, Shirt, 
  Coffee, KeyRound, Building, Bath, Sparkles 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getCachedRoom, setCachedRoom } from '../utils/cache';

const getFeatureIcon = (feature) => {
  const f = feature.toLowerCase();
  if (f.includes('wifi') || f.includes('internet')) return <Wifi size={20} />;
  if (f.includes('tv') || f.includes('television') || f.includes('smart tv')) return <Tv size={20} />;
  if (f.includes('air conditioning') || f.includes('ac') || f.includes('climate') || f.includes('cool')) return <Wind size={20} />;
  if (f.includes('pool') || f.includes('swim') || f.includes('waves')) return <Waves size={20} />;
  if (f.includes('laundry') || f.includes('washer') || f.includes('dryer') || f.includes('washing machine') || f.includes('iron') || f.includes('cleaning')) return <Shirt size={20} />;
  if (f.includes('kitchen') || f.includes('kitchenette') || f.includes('cook') || f.includes('fridge') || f.includes('oven') || f.includes('coffee')) return <Coffee size={20} />;
  if (f.includes('lock') || f.includes('key') || f.includes('security') || f.includes('access') || f.includes('safe')) return <KeyRound size={20} />;
  if (f.includes('city') || f.includes('view') || f.includes('balcony') || f.includes('patio')) return <Building size={20} />;
  if (f.includes('ocean') || f.includes('beach') || f.includes('sea')) return <Waves size={20} />;
  if (f.includes('bed') || f.includes('king') || f.includes('queen') || f.includes('double') || f.includes('sleep')) return <BedDouble size={20} />;
  if (f.includes('bath') || f.includes('restroom') || f.includes('shower') || f.includes('tub')) return <Bath size={20} />;
  return <Sparkles size={20} />;
};

const RoomDetails = () => {
  const { id } = useParams();
  
  // Try to load initial data instantly from cache to avoid blocking UI loaders
  const cachedRoom = getCachedRoom(id);
  
  const parseDescription = (roomData) => {
    if (!roomData) return { ext: {}, mainImg: '' };
    let ext = {};
    try {
      ext = JSON.parse(roomData.description || '{}');
      // Handle double-stringified description gracefully
      if (ext && typeof ext.text === 'string' && ext.text.trim().startsWith('{')) {
        try {
          const nested = JSON.parse(ext.text);
          if (nested && typeof nested === 'object') {
            ext = { ...ext, ...nested };
          }
        } catch (e) {}
      }
    } catch (e) {}
    const images = ext.images || [];
    const mainImg = images.length > 0 ? images[0] : roomData.image_url;
    return { ext, mainImg };
  };

  const initial = parseDescription(cachedRoom);

  const [room, setRoom] = useState(cachedRoom || null);
  const [loading, setLoading] = useState(!cachedRoom);
  const [extended, setExtended] = useState(initial.ext);
  const [mainImage, setMainImage] = useState(initial.mainImg);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    fetchRoom();
  }, [id]);

  const fetchRoom = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*').eq('id', id).single();
      if (data) {
        setRoom(data);
        setCachedRoom(id, data);
        
        const { ext, mainImg } = parseDescription(data);
        setExtended(ext);
        
        // Update main image only if not set, or matches standard gallery angles
        setMainImage(prev => {
          if (!prev || ext.images?.includes(prev) || prev === data.image_url) {
            return mainImg;
          }
          return prev;
        });
      }
    } catch (e) {
      console.error("Room Details background load error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen pt-32 text-center text-gray-300">Loading details...</div>;
  if (!room) return <div className="min-h-screen pt-32 text-center text-red-500">Room not found.</div>;

  const images = extended.images && extended.images.length > 0 ? extended.images : [room.image_url];
  const videoUrl = extended.video_url;
  const discount = extended.discount_percent || 0;
  const tax = extended.tax_percent || 7.5;
  const basePrice = Number(room.base_price_ngn);
  const discountedPrice = basePrice - (basePrice * (discount / 100));
  const finalPrice = discountedPrice + (discountedPrice * (tax / 100));

  return (
    <div className="pt-24 min-h-screen bg-dark-900 pb-24">
      <div className="container mx-auto px-6">
        <Link to="/" className="inline-flex items-center text-gray-300 hover:text-brand-500 mb-8 transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Back to Residences
        </Link>

        <div className="bg-dark-800 border border-dark-700 overflow-hidden shadow-sm">
          {/* Main Media Area */}
          <div className="relative h-[60vh] bg-dark-900 flex items-center justify-center">
            {showVideo && videoUrl ? (
              <iframe 
                src={videoUrl.replace('watch?v=', 'embed/')} 
                className="w-full h-full" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            ) : (
              <img src={mainImage} alt={room.name} className="w-full h-full object-cover" />
            )}
            
            {videoUrl && !showVideo && (
              <button 
                onClick={() => setShowVideo(true)}
                className="absolute inset-0 m-auto w-20 h-20 bg-neutral-50/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-brand-500 hover:text-neutral-50 transition-all group"
              >
                <PlayCircle size={40} className="text-neutral-50 group-hover:scale-110 transition-transform" />
              </button>
            )}
            
            {showVideo && (
              <button 
                onClick={() => setShowVideo(false)}
                className="absolute top-4 right-4 bg-neutral-900/50 text-neutral-50 px-4 py-2 text-sm backdrop-blur-md rounded hover:bg-brand-500 transition-colors"
              >
                View Images
              </button>
            )}
          </div>

          {/* Image Gallery */}
          {images.length > 1 && !showVideo && (
            <div className="flex gap-2 p-2 bg-dark-800 overflow-x-auto border-b border-dark-700">
              {images.map((img, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setMainImage(img)}
                  className={`w-32 h-24 flex-shrink-0 relative ${mainImage === img ? 'ring-2 ring-brand-500 ring-offset-2' : 'opacity-70 hover:opacity-100'}`}
                >
                  <img loading="lazy" decoding="async" src={img} alt={`${room.name} angle ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row">
            {/* Details Section */}
            <div className="flex-1 p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-dark-700">
              <div className="mb-2 flex items-center gap-3">
                <span className="uppercase tracking-widest text-xs font-semibold text-brand-500">{room.type}</span>
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded capitalize">{room.status}</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">{room.name}</h1>
              
              <div className="flex flex-wrap gap-6 mb-8 text-sm text-gray-200 border-b border-dark-700 pb-8">
                <div className="flex items-center gap-2"><Users size={18} className="text-gray-200" /> Up to {room.capacity} Guests</div>
                <div className="flex items-center gap-2"><Maximize size={18} className="text-gray-200" /> {room.size_sqm} Square Meters</div>
                <div className="flex items-center gap-2"><Info size={18} className="text-gray-200" /> Room {room.room_number}</div>
              </div>

              <div className="mb-10">
                <h3 className="text-xl font-semibold mb-4">About this residence</h3>
                <p className="text-gray-200 leading-relaxed">
                  {extended.text || "Experience unparalleled comfort in this meticulously designed space. Every detail has been crafted to ensure a seamless blend of luxury and functionality for your perfect stay."}
                </p>
              </div>

              {/* Residence Specifications */}
              <div className="mb-10 border-b border-dark-700 pb-10">
                <h3 className="text-xl font-semibold mb-6">Residence Specifications</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Bed Configuration */}
                  <div className="bg-dark-900 p-4 border border-dark-700 rounded flex items-start gap-3">
                    <BedDouble className="text-brand-500 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <span className="block text-xs text-gray-300 uppercase tracking-wider">Bedding</span>
                      <span className="text-sm font-semibold text-white">
                        {extended.bed_configuration || room.bed_type || '1 King Bed'}
                      </span>
                    </div>
                  </div>

                  {/* Floor Level */}
                  <div className="bg-dark-900 p-4 border border-dark-700 rounded flex items-start gap-3">
                    <Layers className="text-brand-500 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <span className="block text-xs text-gray-300 uppercase tracking-wider">Floor Level</span>
                      <span className="text-sm font-semibold text-white">
                        {room.floor ? `Floor ${room.floor}` : 'Ground Floor'}
                      </span>
                    </div>
                  </div>

                  {/* Stay Duration */}
                  <div className="bg-dark-900 p-4 border border-dark-700 rounded flex items-start gap-3">
                    <Calendar className="text-brand-500 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <span className="block text-xs text-gray-300 uppercase tracking-wider">Stay Duration</span>
                      <span className="text-sm font-semibold text-white">
                        {room.min_stay_days || 1} { (room.min_stay_days || 1) === 1 ? 'Night' : 'Nights' } Min
                      </span>
                    </div>
                  </div>

                  {/* Max Occupancy */}
                  <div className="bg-dark-900 p-4 border border-dark-700 rounded flex items-start gap-3">
                    <Users className="text-brand-500 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <span className="block text-xs text-gray-300 uppercase tracking-wider">Max Guests</span>
                      <span className="text-sm font-semibold text-white">
                        {room.max_occupancy || room.capacity || 2} Guests
                      </span>
                    </div>
                  </div>

                  {/* Pricing Model */}
                  <div className="bg-dark-900 p-4 border border-dark-700 rounded flex items-start gap-3">
                    <Clock className="text-brand-500 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <span className="block text-xs text-gray-300 uppercase tracking-wider">Pricing Model</span>
                      <span className="text-sm font-semibold text-white capitalize">
                        {room.pricing_model ? room.pricing_model.replace('_', ' ') : 'Per Night'}
                      </span>
                    </div>
                  </div>

                  {/* Booking Rules */}
                  <div className="bg-dark-900 p-4 border border-dark-700 rounded flex items-start gap-3">
                    <ShieldCheck className="text-brand-500 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <span className="block text-xs text-gray-300 uppercase tracking-wider">Instant Booking</span>
                      <span className="text-sm font-semibold text-white">
                        Available
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Premium Residence Amenities</h3>
                <p className="text-sm text-gray-200 mb-6">
                  This residence comes equipped with a selection of premium, hand-picked amenities and features designed to elevate your stay.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {room.amenities && room.amenities.length > 0 ? (
                    room.amenities.map((amenity, idx) => (
                      <motion.div 
                        key={idx} 
                        whileHover={{ y: -3, scale: 1.02 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                        className="bg-dark-900 border border-dark-700 hover:border-brand-500/50 hover:bg-dark-900/80 transition-all p-4 rounded-xl flex items-center gap-4 group cursor-default shadow-sm hover:shadow-md"
                      >
                        <div className="p-2.5 rounded-lg bg-brand-500/10 text-brand-500 group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition-all duration-300 flex-shrink-0 flex items-center justify-center">
                          {getFeatureIcon(amenity)}
                        </div>
                        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                          {amenity}
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-sm text-gray-300 italic">
                      Standard premium residence services and utilities included.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing & Booking Card */}
            <div className="w-full lg:w-[400px] p-8 md:p-12 bg-dark-900 flex flex-col justify-center">
              <div className="bg-dark-800 p-6 border border-dark-700 shadow-sm">
                <h3 className="text-lg font-semibold text-white mb-6 border-b border-dark-700 pb-4">Reservation Summary</h3>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-gray-200">
                    <span>Base Rate / Night</span>
                    <span>₦{basePrice.toLocaleString()}</span>
                  </div>
                  
                  {discount > 0 && (
                    <div className="flex justify-between text-brand-500">
                      <span>Special Discount ({discount}%)</span>
                      <span>- ₦{(basePrice * (discount/100)).toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-gray-200">
                    <span>Taxes & Fees ({tax}%)</span>
                    <span>+ ₦{(discountedPrice * (tax/100)).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="border-t border-dark-700 pt-4 mb-8">
                  <div className="flex justify-between items-end">
                    <span className="font-semibold text-white">Total per night</span>
                    <span className="text-3xl font-bold text-white">₦{finalPrice.toLocaleString()}</span>
                  </div>
                </div>

                <Link to={`/booking?room=${room.id}`} className="btn-primary w-full text-center py-4 flex justify-center items-center">
                  Proceed to Booking
                </Link>
                
                <p className="text-center text-xs text-gray-300 mt-4">
                  You won't be charged yet. You can add extra services on the next page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomDetails;

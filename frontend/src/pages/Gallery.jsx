import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const localImages = [
  { id: 1, image_url: '/Images/Pool.jfif', caption: 'Luxury Swimming Pool' },
  { id: 2, image_url: '/Images/Reception.jfif', caption: 'Welcoming Reception' },
  { id: 3, image_url: '/Images/Restaurant.jfif', caption: 'Fine Dining Restaurant' },
  { id: 4, image_url: '/Images/Room 1.jfif', caption: 'Deluxe Suite' },
  { id: 5, image_url: '/Images/Room 2.jfif', caption: 'Premium Room' },
  { id: 6, image_url: '/Images/Room 3.jfif', caption: 'Executive Suite' },
  { id: 7, image_url: '/Images/Room 4.jfif', caption: 'Luxury Apartment' },
  { id: 8, image_url: '/Images/Room 5.jfif', caption: 'Comfortable Bedroom' },
  { id: 9, image_url: '/Images/aireal view.jfif', caption: 'Aerial View of Freshland' },
  { id: 10, image_url: '/Images/front view 1.jfif', caption: 'Hotel Exterior' },
  { id: 11, image_url: '/Images/front view 2.jfif', caption: 'Hotel Entrance' }
];

const Gallery = () => {
  const [images] = useState(localImages);
  const [activeIdx, setActiveIdx] = useState(null);

  const showNext = (e) => {
    e.stopPropagation();
    setActiveIdx((prev) => (prev + 1) % images.length);
  };

  const showPrev = (e) => {
    e.stopPropagation();
    setActiveIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  const closeLightbox = () => {
    setActiveIdx(null);
  };

  return (
    <div className="pt-24 min-h-screen bg-dark-950">
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mb-20">
          <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-4 flex items-center gap-4">
            <span className="w-12 h-[2px] bg-brand-500"></span> Visual Journey
          </h4>
          <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 text-white leading-tight">Our Gallery</h1>
          <p className="text-gray-200 text-lg max-w-2xl font-light leading-relaxed">
            Explore the stunning details and premium spaces of Freshland. Click any image to view a larger magnification.
          </p>
        </div>
        
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8">
          {images.map((img, idx) => (
            <div 
              key={img.id || idx} 
              onClick={() => setActiveIdx(idx)}
              className="relative group overflow-hidden bg-dark-800 cursor-pointer rounded-[2rem] shadow-xl break-inside-avoid border border-dark-800 hover:border-brand-500/30 transition-all duration-500 hover:shadow-brand-500/10"
            >
              <img 
                src={img.image_url} 
                alt={img.caption || 'Freshland Gallery'} 
                className="w-full object-cover transition-transform duration-1000 group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Visual overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8 text-left z-10">
                <div className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center text-white mb-6 group-hover:bg-brand-500 group-hover:border-brand-500 group-hover:text-white transition-all duration-500 shadow-xl backdrop-blur-sm">
                  <Maximize2 size={24} />
                </div>
                {img.caption && (
                  <p className="text-white text-2xl font-serif font-bold drop-shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">{img.caption}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modern Lightbox Modal */}
      <AnimatePresence>
        {activeIdx !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLightbox}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md select-none"
          >
            {/* Close Button */}
            <button 
              onClick={closeLightbox}
              className="absolute top-6 right-6 text-white/80 hover:text-brand-500 transition-colors p-3 bg-white/5 hover:bg-white/10 rounded-full z-50"
              aria-label="Close lightbox"
            >
              <X size={24} />
            </button>

            {/* Navigation Arrows */}
            <button 
              onClick={showPrev}
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-brand-500 bg-white/5 hover:bg-white/10 rounded-full p-4 transition-all z-50 border border-white/10 hover:border-brand-500"
              aria-label="Previous image"
            >
              <ChevronLeft size={28} />
            </button>
            <button 
              onClick={showNext}
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-brand-500 bg-white/5 hover:bg-white/10 rounded-full p-4 transition-all z-50 border border-white/10 hover:border-brand-500"
              aria-label="Next image"
            >
              <ChevronRight size={28} />
            </button>

            {/* Content Container */}
            <div className="relative max-w-[90vw] max-h-[80vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
              <motion.img 
                key={activeIdx}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
                src={images[activeIdx].image_url} 
                alt={images[activeIdx].caption || 'Gallery Image'} 
                className="max-w-full max-h-[75vh] object-contain rounded shadow-2xl border border-dark-700"
              />
              
              {/* Caption */}
              {images[activeIdx].caption && (
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-white mt-4 text-center font-medium text-lg tracking-wide max-w-xl px-4"
                >
                  {images[activeIdx].caption}
                </motion.p>
              )}
              
              {/* Image Counter */}
              <div className="text-brand-500 mt-2 text-sm font-mono font-bold">
                {activeIdx + 1} / {images.length}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;

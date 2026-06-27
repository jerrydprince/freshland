import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { getCachedData, setCachedData } from '../utils/cache';
import { motion, AnimatePresence } from 'framer-motion';

const Gallery = () => {
  const cachedGallery = getCachedData('gallery');
  const [images, setImages] = useState(cachedGallery || []);
  const [loading, setLoading] = useState(images.length === 0);
  const [activeIdx, setActiveIdx] = useState(null);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const { data, error } = await supabase
        .from('cms_gallery')
        .select('*')
        .order('id', { ascending: false });
        
      if (error) throw error;
      if (data) {
        setImages(data);
        setCachedData('gallery', data);
      }
    } catch (e) {
      console.error("Failed to load gallery:", e);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="pt-24 min-h-screen bg-dark-900">
      <div className="container mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center text-white">Our Gallery</h1>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          Explore the stunning details and premium spaces of Sparkles Apartments. Click any image to view a larger magnification.
        </p>
        
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-gold-500" size={48} />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center text-gray-500 py-20">No gallery images available to display at the moment.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((img, idx) => (
              <div 
                key={img.id || idx} 
                onClick={() => setActiveIdx(idx)}
                className="relative group overflow-hidden bg-dark-800 aspect-[4/3] cursor-pointer border border-dark-700 hover:border-gold-500/50 transition-colors"
              >
                <img 
                  src={img.image_url} 
                  alt={img.caption || 'Sparkles Gallery'} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Visual overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center backdrop-blur-[2px] z-10">
                  <div className="w-12 h-12 rounded-full border border-white flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform">
                    <Maximize2 size={20} />
                  </div>
                  <span className="text-white font-medium tracking-wider uppercase text-sm">
                    View Larger
                  </span>
                  {img.caption && (
                    <p className="text-gold-500 text-xs mt-2 font-light line-clamp-1 px-4">{img.caption}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
              className="absolute top-6 right-6 text-white/80 hover:text-gold-500 transition-colors p-3 bg-white/5 hover:bg-white/10 rounded-full z-50"
              aria-label="Close lightbox"
            >
              <X size={24} />
            </button>

            {/* Navigation Arrows */}
            <button 
              onClick={showPrev}
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-gold-500 bg-white/5 hover:bg-white/10 rounded-full p-4 transition-all z-50"
              aria-label="Previous image"
            >
              <ChevronLeft size={28} />
            </button>
            <button 
              onClick={showNext}
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-gold-500 bg-white/5 hover:bg-white/10 rounded-full p-4 transition-all z-50"
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
              <div className="text-gray-400 mt-2 text-xs font-mono">
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

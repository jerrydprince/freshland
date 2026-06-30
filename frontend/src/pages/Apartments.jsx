import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedData, setCachedData } from '../utils/cache';

const Apartments = () => {
  const cachedRooms = getCachedData('rooms');
  const [rooms, setRooms] = useState(cachedRooms || []);
  const [loading, setLoading] = useState(!cachedRooms);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('id, name, type, capacity, size_sqm, base_price_ngn, image_url, status, amenities').order('name');
      if (data) {
        // Group rooms by category/type to prevent overwhelming lists
        const grouped = data.reduce((acc, room) => {
          const type = room.type || 'Standard Room';
          if (!acc[type]) {
            acc[type] = {
              ...room,
              display_name: type,
              total_units: 1,
              available_units: room.status !== 'occupied' ? 1 : 0,
              all_ids: [room.id]
            };
          } else {
            acc[type].total_units += 1;
            if (room.status !== 'occupied') acc[type].available_units += 1;
            acc[type].all_ids.push(room.id);
          }
          return acc;
        }, {});

        const groupedArray = Object.values(grouped).sort((a, b) => b.base_price_ngn - a.base_price_ngn);
        setRooms(groupedArray);
        setCachedData('rooms', groupedArray);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 min-h-screen bg-dark-950 w-full text-white pb-32">
      <div className="container mx-auto px-6">
        <div className="mb-20 pt-10 flex flex-col md:flex-row justify-between items-end gap-8">
          <div className="max-w-2xl">
            <h4 className="text-brand-500 font-sans tracking-[0.2em] uppercase text-xs font-bold mb-4 flex items-center gap-4">
              <span className="w-12 h-[2px] bg-brand-500"></span> Our Portfolio
            </h4>
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-white leading-tight">Room Categories</h1>
          </div>
          <p className="text-gray-200 max-w-md text-lg font-light leading-relaxed">
            Explore our curated collection of premium room categories, designed for ultimate comfort, privacy, and luxury.
          </p>
        </div>

        {loading ? (
          <div className="py-32 text-center text-gray-300 font-sans tracking-widest uppercase">Loading categories...</div>
        ) : (
          <div className="flex flex-col border-t border-dark-800 mt-16">
            {rooms.map((room, idx) => (
              <div key={room.display_name} className="group relative border-b border-dark-800 overflow-hidden">
                {/* Background Image Reveal */}
                <div className="absolute inset-0 z-0 bg-dark-900 overflow-hidden">
                  {room.image_url && (
                    <img loading="lazy" decoding="async" src={`/Images/Room ${(idx % 5) + 1}.jfif`} alt={room.display_name} className="w-full h-full object-cover opacity-0 group-hover:opacity-30 transition-all duration-1000 scale-110 group-hover:scale-100" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-900/90 to-transparent" />
                </div>
                
                {/* Content */}
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center p-8 md:p-16 gap-12 transition-transform duration-500 group-hover:translate-x-4">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap gap-4 items-center mb-6 text-xs font-sans tracking-[0.2em] uppercase font-bold text-gray-300 group-hover:text-brand-500 transition-colors">
                      <span className="text-brand-500 bg-brand-500/10 px-3 py-1 rounded-full">{room.total_units} Total Units</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                      <span>{room.capacity} Guests</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                      <span>{room.size_sqm} SQM</span>
                    </div>
                    <Link to={`/room/${room.id}`}>
                      <h3 className="text-4xl md:text-5xl font-serif font-bold text-white group-hover:text-brand-500 transition-colors duration-500 leading-tight mb-6">{room.display_name}</h3>
                    </Link>
                    <p className="text-gray-200 font-light text-lg line-clamp-2 md:line-clamp-none max-w-2xl group-hover:text-gray-300 transition-colors leading-relaxed">
                      {room.amenities ? room.amenities.join(' • ') : 'Premium features included'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-start md:items-end gap-8 shrink-0">
                      <div className="text-left md:text-right">
                        <span className="block text-xs text-gray-300 uppercase tracking-[0.2em] mb-2 font-bold">Starting from</span>
                        <span className="text-3xl md:text-5xl font-serif font-bold text-white group-hover:text-brand-500 transition-colors">₦{Number(room.base_price_ngn).toLocaleString()}</span>
                        <span className="block text-sm text-gray-300 mt-1 tracking-widest">PER NIGHT</span>
                      </div>
                      <Link to={`/room/${room.id}`} className="flex items-center gap-4 text-brand-500 uppercase tracking-[0.2em] text-xs font-bold group/btn">
                        Explore Category 
                        <span className="w-14 h-14 rounded-full border border-brand-500/30 flex items-center justify-center group-hover/btn:bg-brand-500 group-hover/btn:text-white transition-all duration-300">
                          <ArrowRight size={20} className="group-hover/btn:-rotate-45 transition-transform duration-300" />
                        </span>
                      </Link>
                  </div>
                </div>

                {/* Occupancy Status Badge */}
                {room.available_units === 0 && (
                  <div className="absolute top-8 right-8 z-20 bg-red-500/10 border border-red-500/50 backdrop-blur-md px-4 py-2 text-red-500 text-xs font-bold uppercase tracking-widest rounded-full">
                    Fully Booked
                  </div>
                )}
                {room.available_units > 0 && room.available_units <= 3 && (
                  <div className="absolute top-8 right-8 z-20 bg-amber-500/10 border border-amber-500/50 backdrop-blur-md px-4 py-2 text-amber-500 text-xs font-bold uppercase tracking-widest rounded-full animate-pulse">
                    Only {room.available_units} Left
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Apartments;

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
        setRooms(data);
        setCachedData('rooms', data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-dark-900 w-full text-white pb-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 pt-10">
          <h4 className="text-gold-500 font-medium tracking-widest uppercase mb-4">Our Portfolio</h4>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">All Residences</h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Explore our complete collection of premium apartments, designed for ultimate comfort and luxury.
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading residences...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.map(room => (
              <div key={room.id} className="bg-dark-800 border border-dark-700 group overflow-hidden flex flex-col h-full rounded-lg shadow-lg hover:shadow-gold-500/10 transition-shadow">
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
                  <div className="absolute top-4 right-4 bg-dark-900/90 backdrop-blur-sm px-4 py-2 text-gold-500 font-semibold border border-dark-700 rounded-sm">
                    ₦{Number(room.base_price_ngn).toLocaleString()} <span className="text-sm text-gray-400 font-normal">/ night</span>
                  </div>
                  {room.status === 'occupied' && (
                    <div className="absolute top-4 left-4 bg-red-500/90 backdrop-blur-sm px-3 py-1 text-white text-xs font-bold uppercase tracking-wider rounded-sm">
                      Currently Booked
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <Link to={`/room/${room.id}`}>
                    <h3 className="text-2xl font-semibold mb-2 group-hover:text-gold-500 transition-colors text-white">{room.name}</h3>
                  </Link>
                  <div className="flex gap-4 text-sm text-gray-400 mb-6 pb-6 border-b border-dark-700">
                    <span>{room.type}</span>
                    <span>•</span>
                    <span>Up to {room.capacity} Guests</span>
                    <span>•</span>
                    <span>{room.size_sqm} sqm</span>
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {room.amenities ? room.amenities.slice(0, 3).join(' • ') : 'Premium features included'}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Link to={`/room/${room.id}`} className="btn-outline flex-1 text-center py-2 text-white border-dark-600 hover:bg-dark-700">
                      View Details
                    </Link>
                    <Link to={`/booking?room=${room.id}`} className="btn-primary flex-1 text-center flex justify-center items-center gap-2">
                      Book Dates <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Apartments;

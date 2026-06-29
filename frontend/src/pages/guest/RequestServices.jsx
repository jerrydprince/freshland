import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Calendar, Clock, Plus, Minus, CheckCircle, Package, Coffee, ShieldCheck } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const iconMap = {
  Coffee: <Coffee size={24} />,
  Package: <Package size={24} />
};

const MENU_SEGMENTS = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Drinks', 'Appetizers'];

const parseDescription = (desc) => {
  if (!desc) return { segment: 'Lunch', text: '' };
  const delimiterIndex = desc.indexOf(' | ');
  if (delimiterIndex !== -1) {
    const segment = desc.substring(0, delimiterIndex).trim();
    const text = desc.substring(delimiterIndex + 3).trim();
    if (MENU_SEGMENTS.includes(segment)) {
      return { segment, text };
    }
  }
  return { segment: 'Lunch', text: desc };
};

const RequestServices = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [services, setServices] = useState([]);
  const [stayServices, setStayServices] = useState([]);
  const [mealServices, setMealServices] = useState([]);
  const [activeTab, setActiveTab] = useState('stay'); // 'stay' or 'meal'
  const [activeMealSegment, setActiveMealSegment] = useState('All');
  const [selectedServices, setSelectedServices] = useState([]); // [{ service_id, quantity, date, time }]
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingRequests, setExistingRequests] = useState([]);

  // Real‑time synchronization for bookings and service requests

  // Initial data load when user is available
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);
  useRealtimeSync(['bookings', 'booking_services'], (table, payload) => {
    if (table === 'bookings') {
      fetchData();
    } else if (table === 'booking_services') {
      fetchExistingRequests();
    }
  });

  const fetchExistingRequests = async () => {
    if (!selectedBookingId) return;
    try {
      const { data, error } = await supabase
        .from('booking_services')
        .select('*, services(name, category)')
        .eq('booking_id', selectedBookingId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      if (!error && data) {
        // Ensure newest first even if backend ordering changes
        const sorted = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setExistingRequests(sorted);
      }
    } catch (e) {
      console.error("Error fetching existing requests:", e);
    }
  };

  useEffect(() => {
    if (selectedBookingId) {
      fetchExistingRequests();
    }
  }, [selectedBookingId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch active bookings (confirmed, pending, checked_in)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, rooms(name, room_number)')
        .or(`guest_id.eq.${user.id},guest_email.eq.${user.email}`)
        .in('status', ['confirmed', 'pending', 'checked_in'])
        .order('check_in_date', { ascending: true });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);
      
      if (bookingsData && bookingsData.length > 0) {
        setSelectedBookingId(bookingsData[0].id);
      }

      // 2. Fetch active services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true);

      if (servicesError) throw servicesError;
      const allSrv = servicesData || [];
      setServices(allSrv);
      
      const nonPos = allSrv.filter(s =>
         !['bar', 'restaurant', 'kitchen'].includes(s.internal_notes?.toLowerCase().trim() || '') &&
         !(s.name && s.name.toLowerCase().includes('breakfast'))
       );
       setStayServices(nonPos);

       const meals = allSrv.filter(s =>
         (s.category === 'Food & Beverage' && s.internal_notes?.toLowerCase().trim() === 'restaurant') ||
         (s.name && s.name.toLowerCase().includes('breakfast'))
       );
       setMealServices(meals);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load services data');
    } finally {
      setLoading(false);
    }
  };

  const activeBooking = bookings.find(b => b.id === selectedBookingId);
  const totalNights = activeBooking 
    ? Math.max(1, differenceInDays(new Date(activeBooking.check_out_date), new Date(activeBooking.check_in_date))) 
    : 1;

  // Checkout time gate variables
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const currentTime = format(now, 'HH:mm');
  const isCheckOutDay = activeBooking && activeBooking.check_out_date === todayStr;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const totalMinutesToday = currentHour * 60 + currentMinute;

  // Check if booking has an active/pending late checkout requested
  const hasActiveLateCheckout = existingRequests.some(req => 
    req.services?.name?.toLowerCase()?.includes('late checkout') || 
    req.services?.category?.toLowerCase()?.includes('room add-ons')
  );

  const checkoutHour = hasActiveLateCheckout ? 16 : 12; // 4:00 PM late, 12:00 PM standard
  const minutesCheckout = checkoutHour * 60;
  const minutes11AM = (checkoutHour - 1) * 60; // 11:00 AM standard, 3:00 PM late

  const isChargeSealingActive = isCheckOutDay && totalMinutesToday >= minutes11AM && totalMinutesToday < minutesCheckout;
  const isCheckoutElapsed = isCheckOutDay && totalMinutesToday >= minutesCheckout;

  const toggleService = (service) => {
    if (isCheckoutElapsed) {
      return toast.error("⚠️ Checkout time has elapsed. Service requests are locked.");
    }
    const isSelected = selectedServices.some(s => s.service_id === service.id);
    if (isSelected) {
      setSelectedServices(prev => prev.filter(s => s.service_id !== service.id));
    } else {
      setSelectedServices(prev => [
        ...prev, 
        { 
          service_id: service.id, 
          quantity: 1, 
          date: todayStr, 
          time: currentTime,
          notes: ''
        }
      ]);
    }
  };

  const updateQuantity = (serviceId, increment) => {
    if (isCheckoutElapsed) return;
    setSelectedServices(prev => prev.map(s => {
      if (s.service_id === serviceId) {
        const qty = increment ? s.quantity + 1 : Math.max(1, s.quantity - 1);
        return { ...s, quantity: qty };
      }
      return s;
    }));
  };

  const updateSchedule = (serviceId, field, value) => {
    if (isCheckoutElapsed) return;
    setSelectedServices(prev => prev.map(s => {
      if (s.service_id === serviceId) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const getServicePrice = (service, sData) => {
    let cost = Number(service.base_price_ngn);
    if (cost === 0) return 0; // Deferred / Post-Charged billing

    const isBreakfast = service.name && service.name.toLowerCase().includes('breakfast');
    const isRestaurant = service.internal_notes?.toLowerCase().trim() === 'restaurant';
    
    if (isBreakfast) {
      // Breakfast cost is multiplied by duration and quantity
      cost = cost * totalNights * sData.quantity;
    } else if (isRestaurant) {
      cost = cost * sData.quantity;
    } else {
      if (service.pricing_type === 'per_person') cost *= sData.quantity;
      if (service.pricing_type === 'per_day' || service.pricing_type === 'per_night') cost *= totalNights;
      if (service.pricing_type === 'quantity_based' || service.pricing_type === 'time_based') cost *= sData.quantity;
    }
    return cost;
  };

  const calculateTotal = () => {
    return selectedServices.reduce((total, sData) => {
      const service = services.find(s => s.id === sData.service_id);
      if (service) {
        return total + getServicePrice(service, sData);
      }
      return total;
    }, 0);
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!selectedBookingId) return toast.error('Please select a booking first.');
    if (selectedServices.length === 0) return toast.error('Please select at least one service to request.');

    if (isCheckoutElapsed) {
      return toast.error("⚠️ Checkout time has elapsed. Additional service requests are blocked.");
    }

    // Late Checkout Gating
    const hasLateCheckout = selectedServices.some(sData => {
      const s = services.find(x => x.id === sData.service_id);
      return s && /late\s*check/i.test(s.name || '');
    });

    if (hasLateCheckout && isCheckOutDay) {
      const minutes11_30AM = 11 * 60 + 30; // 690
      const minutes11_45AM = 11 * 60 + 45; // 705
      if (totalMinutesToday < minutes11_30AM || totalMinutesToday > minutes11_45AM) {
        return toast.error("⚠️ Late Check-out requests can only be placed between 11:30 AM and 11:45 AM (15-30 minutes before the 12:00 PM checkout deadline).");
      }
    }

    // Validate scheduling/notes requirements
    for (let sData of selectedServices) {
      const service = services.find(s => s.id === sData.service_id);
      if (service?.scheduling_required && (!sData.date || !sData.time)) {
        return toast.error(`Please select a Date and Time for ${service.name}`);
      }
      if (Number(service?.base_price_ngn) === 0 && !sData.notes?.trim()) {
        return toast.error(`Please enter laundry items / instructions for ${service.name}`);
      }
    }

    setSubmitting(true);
    const toastId = toast.loading('Submitting your service requests...');

    try {
      const insertPayload = selectedServices.map(sData => {
        const service = services.find(s => s.id === sData.service_id);
        const totalPrice = getServicePrice(service, sData);
        let unitPrice = Number(service.base_price_ngn);

        // Breakfast calculations
        const isBreakfast = service.name && service.name.toLowerCase().includes('breakfast');
        if (isBreakfast) {
          unitPrice = unitPrice * totalNights;
        } else {
          if (service.pricing_type === 'per_day' || service.pricing_type === 'per_night') {
            unitPrice = unitPrice * totalNights;
          }
        }

        return {
          booking_id: selectedBookingId,
          service_id: sData.service_id,
          quantity: sData.quantity,
          unit_price_ngn: unitPrice,
          total_price_ngn: totalPrice,
          scheduled_date: sData.date || null,
          scheduled_time: sData.time || null,
          status: 'pending',
          notes: service.internal_notes?.toLowerCase().trim() === 'restaurant'
            ? `restaurant_order: ${sData.notes || 'No special instructions'}`
            : (sData.notes ? `laundry_request: ${sData.notes}` : 'dashboard_request')
        };
      });

      const { error } = await supabase.from('booking_services').insert(insertPayload);
      if (error) throw error;

      toast.success('Services requested successfully! Our team has been notified.', { id: toastId });
      setSelectedServices([]);
      fetchExistingRequests();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to submit request: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmService = async (requestId) => {
    const toastId = toast.loading('Confirming service...');
    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ status: 'confirmed' })
        .eq('id', requestId);

      if (error) throw error;
      toast.success('Service confirmed and routed to department!', { id: toastId });
      fetchExistingRequests();
    } catch (err) {
      console.error(err);
      toast.error('Failed to confirm service: ' + (err.message || 'Error occurred'), { id: toastId });
    }
  };

  if (loading) {
    return <div className="text-gray-200 p-8 text-center bg-dark-800 border border-dark-700 rounded-lg">Loading services and active stays...</div>;
  }

  return (
    <div className="space-y-8 text-white">
      <div>
        <h2 className="text-2xl font-semibold text-white">Request Stay Services</h2>
        <p className="text-gray-200 mt-1">Enhance your luxury stay with our curated amenities and personalized add-ons.</p>
      </div>

      {isChargeSealingActive && (
        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-400 p-4 rounded-xl text-sm font-semibold animate-pulse flex items-start gap-2.5">
          <span className="text-lg">⚠️</span>
          <div>
            <strong>Room Charge Sealing Active</strong>
            <p className="text-xs text-gray-200 mt-0.5">Checkout commencement has begun today. Please finalize any outstanding stay requests immediately.</p>
          </div>
        </div>
      )}

      {isCheckoutElapsed && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-4 rounded-xl text-sm font-semibold flex items-start gap-2.5">
          <span className="text-lg">🛑</span>
          <div>
            <strong>Service Requests Locked</strong>
            <p className="text-xs text-gray-200 mt-0.5">Your checkout time (12:00 PM) has elapsed. Submission of additional room enhancements or laundry requests is now locked.</p>
          </div>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="bg-dark-800 border border-dark-700 p-8 text-center text-gray-200 rounded-lg">
          <p className="mb-4">You do not have any active or upcoming reservations to request services for.</p>
          <a href="/booking" className="btn-primary py-2 px-6 inline-block text-sm">Book a Room</a>
        </div>
      ) : (
        <form onSubmit={handleSubmitRequest} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Services Selection List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Selector Card */}
            <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-200 uppercase tracking-wider mb-2">Select stay reservation</label>
                <select 
                  value={selectedBookingId} 
                  onChange={e => { setSelectedBookingId(e.target.value); setSelectedServices([]); }}
                  className="w-full bg-dark-900 border border-dark-700 text-white rounded p-3 focus:border-gold-500 outline-none cursor-pointer text-sm font-semibold"
                >
                  {bookings.map(b => (
                    <option key={b.id} value={b.id}>
                      Room {b.rooms?.room_number} — {b.rooms?.name} ({b.check_in_date} to {b.check_out_date}) [{b.status.replace('_', ' ').toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-dark-900 p-1.5 rounded-xl border border-dark-700 h-fit self-end">
                <button
                  type="button"
                  onClick={() => { setActiveTab('stay'); }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'stay' ? 'bg-gold-500 text-dark-900' : 'text-gray-200 hover:text-white'}`}
                >
                  Stay Services
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('meal'); }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'meal' ? 'bg-gold-500 text-dark-900' : 'text-gray-200 hover:text-white'}`}
                >
                  Order Meal
                </button>
              </div>
            </div>

            {/* Meal Segment Sub-Tabs */}
            {activeTab === 'meal' && (
              <div className="flex flex-wrap gap-1.5 bg-dark-900/40 p-1.5 rounded-xl border border-dark-700/50 mb-6">
                {['All', ...MENU_SEGMENTS].map(seg => {
                  const count = seg === 'All'
                    ? mealServices.length
                    : mealServices.filter(s => parseDescription(s.description).segment === seg).length;

                  return (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => setActiveMealSegment(seg)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
                        activeMealSegment === seg 
                          ? 'bg-gold-500 text-dark-900 shadow-sm' 
                          : 'text-gray-200 hover:text-white'
                      }`}
                    >
                      <span>{seg}</span>
                      <span className={`px-1.5 py-0.2 text-[9px] rounded-md font-mono ${
                        activeMealSegment === seg ? 'bg-dark-900/10 text-dark-950 font-black' : 'bg-dark-900 border border-dark-700 text-gray-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(activeTab === 'stay' 
                ? stayServices 
                : mealServices.filter(s => {
                    if (activeMealSegment === 'All') return true;
                    return parseDescription(s.description).segment === activeMealSegment;
                  })
              ).map(service => {
                const isSelected = selectedServices.some(s => s.service_id === service.id);
                const sData = selectedServices.find(s => s.service_id === service.id);
                const needsScheduling = service.scheduling_required || /pickup|spa|massage/i.test(service.name);
                const isMeal = service.internal_notes?.toLowerCase().trim() === 'restaurant';
                const { segment, text } = parseDescription(service.description);

                return (
                  <div 
                    key={service.id} 
                    onClick={() => toggleService(service)}
                    className={`p-6 border rounded-xl transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected ? 'border-gold-500 bg-gold-500/5 shadow-lg shadow-gold-500/5' : 'border-dark-700 bg-dark-800 hover:border-dark-600'
                    } ${isCheckoutElapsed ? 'opacity-50 cursor-not-allowed hover:border-dark-700' : ''}`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${
                            isSelected ? 'bg-gold-500 text-dark-900 border-gold-500' : 'bg-dark-900 border-dark-700 text-gold-500'
                          }`}>
                            {iconMap[service.icon_name] || <Package size={24}/>}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-base leading-tight">{service.name}</h4>
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              <span className="text-[10px] text-gold-500 uppercase font-black tracking-wider bg-gold-500/10 px-2 py-0.5 rounded block w-fit">
                                {service.pricing_type.replace(/_/g, ' ')}
                              </span>
                              {isMeal && (
                                <span className="text-[10px] text-amber-500 uppercase font-black tracking-wider bg-amber-500/10 px-2 py-0.5 rounded block w-fit">
                                  {segment}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={`w-6 h-6 border rounded-full flex items-center justify-center ${
                          isSelected ? 'bg-gold-500 border-gold-500 text-dark-900 animate-in zoom-in-50' : 'border-dark-600 bg-dark-900'
                        }`}>
                          {isSelected && <CheckCircle size={14} className="stroke-[3]"/>}
                        </div>
                      </div>
                      <p className="text-xs text-gray-200 mb-4 line-clamp-2">{isMeal ? text : service.description}</p>
                    </div>

                    <div>
                      <div className="font-extrabold text-lg text-white mb-4">
                        {Number(service.base_price_ngn) === 0 ? (
                          <span className="text-xs font-bold text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-1 rounded-md inline-block uppercase tracking-wider">
                            Deferred Billing (Price TBD)
                          </span>
                        ) : (
                          `₦${Number(service.base_price_ngn).toLocaleString()}`
                        )}
                      </div>

                      {isSelected && (
                        <div className="space-y-4 pt-4 border-t border-dark-700/50" onClick={e => e.stopPropagation()}>
                          {/* Quantity inputs */}
                          {(service.pricing_type === 'quantity_based' || service.pricing_type === 'time_based' || service.pricing_type === 'per_person' || isMeal) && (
                            <div className="flex justify-between items-center bg-dark-900 border border-dark-700 p-2 rounded">
                              <span className="text-xs text-gray-200 font-medium">
                                {isMeal ? 'Quantity / Portions:' : 'Estimated Bags / Items:'}
                              </span>
                              <div className="flex items-center gap-3">
                                <button type="button" disabled={isCheckoutElapsed} onClick={() => updateQuantity(service.id, false)} className="w-8 h-8 rounded bg-dark-800 hover:bg-dark-700 flex items-center justify-center text-white"><Minus size={14}/></button>
                                <span className="font-mono font-bold text-sm text-white">{sData?.quantity || 1}</span>
                                <button type="button" disabled={isCheckoutElapsed} onClick={() => updateQuantity(service.id, true)} className="w-8 h-8 rounded bg-dark-800 hover:bg-dark-700 flex items-center justify-center text-white"><Plus size={14}/></button>
                              </div>
                            </div>
                          )}

                          {/* Notes/Instructions input for Laundry/Deferred services */}
                          {Number(service.base_price_ngn) === 0 && (
                            <div className="bg-dark-900 border border-dark-700 p-2 rounded">
                              <label className="block text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-1">Laundry Items / Instructions *</label>
                              <textarea 
                                required
                                disabled={isCheckoutElapsed}
                                value={sData?.notes || ''} 
                                onChange={e => updateSchedule(service.id, 'notes', e.target.value)}
                                placeholder="e.g., 3 Shirts (white), 2 Black Trousers. Wash and iron."
                                className="w-full bg-dark-800 border border-dark-700 text-white rounded p-2 text-xs outline-none focus:border-gold-500 min-h-[70px] resize-none"
                              />
                            </div>
                          )}

                          {/* Notes/Instructions for Meal service */}
                          {isMeal && (
                            <div className="bg-dark-900 border border-dark-700 p-2 rounded">
                              <label className="block text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-1">Special Instructions</label>
                              <textarea 
                                disabled={isCheckoutElapsed}
                                value={sData?.notes || ''} 
                                onChange={e => updateSchedule(service.id, 'notes', e.target.value)}
                                placeholder="e.g., No butter, extra spicy, etc."
                                className="w-full bg-dark-800 border border-dark-700 text-white rounded p-2 text-xs outline-none focus:border-gold-500 min-h-[70px] resize-none"
                              />
                            </div>
                          )}

                          {/* Scheduling controls */}
                          {needsScheduling && (
                            <div className="grid grid-cols-2 gap-2 bg-dark-900 border border-dark-700 p-2 rounded">
                              <div>
                                <label className="block text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-1">Date</label>
                                <input 
                                  type="date" 
                                  required
                                  disabled={isCheckoutElapsed}
                                  value={sData?.date || ''}
                                  onChange={e => updateSchedule(service.id, 'date', e.target.value)}
                                  className="w-full bg-dark-800 border border-dark-700 text-white rounded p-1.5 text-xs outline-none focus:border-gold-500 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-1">Time</label>
                                <input 
                                  type="time" 
                                  required
                                  disabled={isCheckoutElapsed}
                                  value={sData?.time || ''}
                                  onChange={e => updateSchedule(service.id, 'time', e.target.value)}
                                  className="w-full bg-dark-800 border border-dark-700 text-white rounded p-1.5 text-xs outline-none focus:border-gold-500 font-semibold"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Checkout Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg sticky top-24 shadow-md space-y-6">
              <h3 className="text-lg font-bold border-b border-dark-700 pb-4 text-white">Request Summary</h3>

              {selectedServices.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-6">Select services from the list to preview your request totals.</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {selectedServices.map(sData => {
                      const service = services.find(s => s.id === sData.service_id);
                      if (!service) return null;
                      const price = getServicePrice(service, sData);
                      const isDeferred = Number(service.base_price_ngn) === 0;
                      return (
                        <div key={sData.service_id} className="flex justify-between items-start text-xs text-gray-200">
                          <div>
                            <span className="block font-medium text-gray-200">{service.name} {sData.quantity > 1 ? `(x${sData.quantity})` : ''}</span>
                            {sData.date && <span className="block text-[10px] text-gold-500 font-bold">{sData.date} @ {sData.time}</span>}
                            {isDeferred && sData.notes && <span className="block text-[9px] text-gray-300 italic mt-0.5 max-w-[150px] truncate">Items: {sData.notes}</span>}
                          </div>
                          <span className={`font-bold ${isDeferred ? 'text-gold-500' : 'text-white'}`}>
                            {isDeferred ? 'TBD' : `₦${price.toLocaleString()}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-dark-700 font-black text-sm text-white">
                    <span>Est. Services Total:</span>
                    <span className="text-gold-500 text-base">
                      ₦{calculateTotal().toLocaleString()}
                      {selectedServices.some(sData => {
                        const s = services.find(x => x.id === sData.service_id);
                        return s && Number(s.base_price_ngn) === 0;
                      }) && ' + TBD'}
                    </span>
                  </div>

                  <div className="bg-dark-900 border border-dark-700 p-4 rounded text-xs text-gray-200 flex items-start gap-2.5">
                    <ShieldCheck className="text-gold-500 w-5 h-5 flex-shrink-0" />
                    <p>💡 Submitting this form requests hotel staff to schedule and prepare these services. Applicable charges will be added to your final stay invoice.</p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={submitting || isCheckoutElapsed} 
                    className="w-full btn-primary py-3 rounded-lg font-bold text-sm shadow-md transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting...' : 'Submit Services Request'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Existing Requests Section */}
      {selectedBookingId && (
        <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg shadow-md mt-8">
          <h3 className="text-lg font-bold border-b border-dark-700 pb-4 text-white flex items-center gap-2">
            <span>📋</span> Active & Historic Requests
          </h3>

          {existingRequests.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-8">No service requests submitted yet for this stay.</p>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-700 text-xs text-gray-200 font-bold uppercase">
                    <th className="pb-3 pr-4">Service</th>
                    <th className="pb-3 px-4">Schedule</th>
                    <th className="pb-3 px-4">Qty</th>
                    <th className="pb-3 px-4">Total Cost</th>
                    <th className="pb-3 px-4">Status</th>
                    <th className="pb-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50 text-sm text-gray-300">
                  {existingRequests.map(req => {
                    const price = req.total_price_ngn;
                    const isCheckedIn = activeBooking?.status === 'checked_in';
                    const isPending = req.status === 'pending';
                    const canConfirm = isCheckedIn && isPending;

                    return (
                      <tr key={req.id} className="hover:bg-dark-750/30 transition-colors">
                        <td className="py-4 pr-4">
                          <span className="font-semibold text-white block">{req.services?.name || 'Custom Service'}</span>
                          {req.notes && (
                            <span className="text-xs text-gray-300 block max-w-[250px] truncate mt-0.5" title={req.notes}>
                              {req.notes.replace(/^(restaurant_order|laundry_request):\s*/, '')}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs font-mono text-gray-450">
                          {req.scheduled_date ? (
                            <span>{format(new Date(req.scheduled_date), 'yyyy-MM-dd')} @ {req.scheduled_time || 'Anytime'}</span>
                          ) : (
                            <span className="text-gray-600">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-semibold text-center">{req.quantity}</td>
                        <td className="py-4 px-4 font-bold text-white">
                          {price === 0 ? 'TBD' : `₦${price.toLocaleString()}`}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-extrabold border ${
                            req.status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400' :
                            req.status === 'confirmed' ? 'bg-orange-500/10 border-orange-500/25 text-orange-400' :
                            req.status === 'scheduled' ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' :
                            req.status === 'in_progress' ? 'bg-teal-500/10 border-teal-500/25 text-teal-400' :
                            req.status === 'completed' ? 'bg-green-500/10 border-green-500/25 text-green-400' :
                            'bg-gray-500/10 border-gray-500/25 text-gray-200'
                          }`}>
                            {req.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 pl-4 text-right">
                          {canConfirm ? (
                            <button
                              type="button"
                              onClick={() => handleConfirmService(req.id)}
                              className="bg-gold-500 hover:bg-gold-600 text-dark-950 font-bold px-3 py-1.5 rounded text-xs transition-colors shadow-sm active:scale-95"
                            >
                              Confirm Service
                            </button>
                          ) : isPending && !isCheckedIn ? (
                            <span className="text-[10px] text-gray-300 italic">Awaiting Check-in</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestServices;

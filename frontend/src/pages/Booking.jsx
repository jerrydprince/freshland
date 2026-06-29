import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DateRange } from 'react-date-range';
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { Calendar, Users, Coffee, Car, Wind, CheckCircle, Tag, ShieldCheck, Plus, Minus, Clock, FileText, Package, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { usePaystackPayment } from 'react-paystack';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { triggerAutomationRules, sendWelcomeEmail } from '../lib/emailService';
import { useAuth } from '../context/AuthContext';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const secondarySupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const getItemsForSubmenu = (submenu, allServices) => {
  return allServices.filter(s => {
    if (s.category !== 'Food & Beverage' && s.name?.toLowerCase() !== 'breakfast') return false;
    const name = (s.name || '').toLowerCase();
    
    // Check description prefix (e.g. "Breakfast | ...")
    let parsedSegment = null;
    if (s.description && s.description.includes(' | ')) {
      const prefix = s.description.split(' | ')[0].trim().toLowerCase();
      if (['breakfast', 'lunch', 'dinner', 'dessert', 'drinks', 'appetizers'].includes(prefix)) {
        parsedSegment = prefix;
      }
    }

    if (parsedSegment) {
      return parsedSegment === submenu.toLowerCase();
    }

    if (submenu === 'Breakfast') {
      return name.includes('breakfast');
    }
    if (submenu === 'Drinks') {
      return s.internal_notes?.toLowerCase().trim() === 'bar' || 
             name.includes('cocktail') || name.includes('wine') || name.includes('lager') || name.includes('whiskey') || name.includes('champagne') || name.includes('beer') || name.includes('drink');
    }
    if (submenu === 'Dessert') {
      return name.includes('dessert') || name.includes('cake') || name.includes('ice cream') || name.includes('pudding');
    }
    if (submenu === 'Appetizers') {
      return name.includes('appetizer') || name.includes('starter') || name.includes('finger food') || name.includes('wings') || name.includes('roll') || name.includes('samosa');
    }
    
    // Main meals for Lunch and Dinner
    const isMainMeal = !name.includes('breakfast') && 
                       s.internal_notes?.toLowerCase().trim() !== 'bar' && 
                       !name.includes('cocktail') && !name.includes('wine') && !name.includes('lager') && !name.includes('whiskey') && !name.includes('champagne') &&
                       !name.includes('dessert') && !name.includes('cake') && !name.includes('ice cream') && !name.includes('pudding') &&
                       !name.includes('appetizer') && !name.includes('starter') && !name.includes('finger food') && !name.includes('wings') && !name.includes('roll') && !name.includes('samosa');
    
    if (submenu === 'Lunch') {
      return isMainMeal;
    }
    
    return false;
  });
};

const iconMap = {
  Coffee: <Coffee size={20} />,
  Car: <Car size={20} />,
  Wind: <Wind size={20} />,
  Package: <Package size={20} />
};

const BookingEngine = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [dateRange, setDateRange] = useState([
    {
      startDate: new Date(),
      endDate: addDays(new Date(), 2),
      key: 'selection'
    }
  ]);
  const [guests, setGuests] = useState({ adults: 1, children: 0 });
  
  // Real Data State
  const [availableRooms, setAvailableRooms] = useState([]);
  const [services, setServices] = useState([]);
  const [foodServices, setFoodServices] = useState([]);
  const [isMealsDrinksOpen, setIsMealsDrinksOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState('Breakfast');
  const [pricingRules, setPricingRules] = useState([]);
  const [ratePlans, setRatePlans] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedRatePlan, setSelectedRatePlan] = useState(null);
  
  // Format: [{ service_id: 'uuid', quantity: 1, date: '', time: '' }]
  const [selectedServices, setSelectedServices] = useState([]);
  
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Guest Details State
  const { user } = useAuth();
  const [bookingForSomeoneElse, setBookingForSomeoneElse] = useState(false);
  const [arAccount, setArAccount] = useState(null);

  // Hall Booking states
  const [bookingMode, setBookingMode] = useState('room'); // 'room' or 'hall'
  const [hallsList, setHallsList] = useState([]);
  const [hallMealOptions, setHallMealOptions] = useState([]);
  const [availableHalls, setAvailableHalls] = useState([]);
  const [selectedHall, setSelectedHall] = useState(null);
  const [selectedHallMeals, setSelectedHallMeals] = useState([]); // array of meal option ids
  const [hallBookingType, setHallBookingType] = useState('daily');
  const [hallStartTime, setHallStartTime] = useState('08:00');
  const [hallEndTime, setHallEndTime] = useState('18:00');
  const [hallParticipants, setHallParticipants] = useState(10);

  const [guestForm, setGuestForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', specialRequests: '', purpose: 'Leisure', organizationName: ''
  });

  useEffect(() => {
    if (user) {
      setGuestForm(prev => ({
        ...prev,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
      fetchARAccount();
    }
  }, [user]);

  const fetchARAccount = async () => {
    if (!user) return;
    try {
      let activeWallet = null;
      
      // Try fetching from ar_accounts table
      try {
        const { data, error } = await supabase
          .from('ar_accounts')
          .select('*')
          .eq('guest_email', user.email.toLowerCase())
          .maybeSingle();
        if (!error && data) {
          activeWallet = data;
        }
      } catch (dbErr) {
        // Table not present or query failed
      }
      
      if (!activeWallet) {
        try {
          const { data: sysData } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'ar_accounts')
            .maybeSingle();
          if (sysData && sysData.setting_value) {
            const parsed = typeof sysData.setting_value === 'string' ? JSON.parse(sysData.setting_value) : sysData.setting_value;
            const match = (parsed || []).find(acc => acc.guest_email?.toLowerCase() === user.email.toLowerCase());
            if (match) activeWallet = match;
          }
        } catch (sysErr) {
          // Skip
        }
      }
      
      if (!activeWallet) {
        const local = localStorage.getItem('luxe_ar_accounts');
        if (local) {
          const parsed = JSON.parse(local);
          const match = (parsed || []).find(acc => acc.guest_email?.toLowerCase() === user.email.toLowerCase());
          if (match) activeWallet = match;
        }
      }
      
      if (activeWallet) {
        // Only load if status is active (or undefined for legacy wallets)
        if (activeWallet.status === 'active' || !activeWallet.status) {
          setArAccount(activeWallet);
        } else {
          setArAccount(null); // Block usage of inactive or closed wallet
        }
      } else {
        // Fallback to crm_guests
        const { data: crmData } = await supabase
          .from('crm_guests')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();
        if (crmData && crmData.wallet_balance > 0) {
          setArAccount({
            id: crmData.id,
            balance: crmData.wallet_balance,
            guest_name: `${crmData.first_name} ${crmData.last_name}`,
            guest_email: crmData.email,
            status: 'active'
          });
        }
      }
    } catch (e) {
      console.error("Error fetching AR Account:", e);
    }
  };

  const [purposeAdjustments, setPurposeAdjustments] = useState({
    Leisure: { type: 'percentage', value: 0 },
    Business: { type: 'percentage', value: -10 },
    Party: { type: 'percentage', value: 50 },
    Event: { type: 'percentage', value: 20 },
    Medical: { type: 'percentage', value: -15 },
    Other: { type: 'percentage', value: 0 }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedBookingRef, setConfirmedBookingRef] = useState(null);
  const [autoCreatedPassword, setAutoCreatedPassword] = useState(null);
  const [contactInfo, setContactInfo] = useState({
    address: 'No2. Gowon P Haruna Close, Karu, Abuja',
    phone: '08033214684, 08062332639, 08171278657',
    email: 'info@Freshlandhotels.com',
    logo: ''
  });

  const [bookingRules, setBookingRules] = useState({
    payment_rule: 'partial_deposit',
    deposit_percentage: 30,
    cancellation_policy: 'Flexible',
    auto_confirmation: true
  });
  const [paystackPublicKey, setPaystackPublicKey] = useState('');

  // Fetch Services, Plans, Coupons, and System purpose configurations on mount
  useEffect(() => {
    const fetchStaticData = async () => {
      const [servicesRes, plansRes, couponsRes, cmsRes, settingsRes, hallsRes, hallMealsRes] = await Promise.all([
        supabase.from('services').select('*').eq('is_active', true),
        supabase.from('rate_plans').select('*').eq('is_active', true),
        supabase.from('coupons').select('*').eq('is_active', true),
        supabase.from('cms_pages').select('content').eq('slug', 'system_categories').maybeSingle(),
        supabase.from('system_settings').select('setting_key, setting_value').in('setting_key', ['contact_address', 'contact_phone', 'contact_email', 'contact_logo', 'payment_rule', 'deposit_percentage', 'cancellation_policy', 'auto_confirmation', 'paystack_public']),
        supabase.from('halls').select('*').eq('is_active', true),
        supabase.from('hall_meal_options').select('*').eq('is_active', true)
      ]);
      if (hallsRes.data) setHallsList(hallsRes.data);
      if (hallMealsRes.data) setHallMealOptions(hallMealsRes.data);
      if (servicesRes.data) {
        const standard = servicesRes.data.filter(s => 
          s.category !== 'Food & Beverage' && s.name?.toLowerCase() !== 'breakfast' &&
          !['bar', 'restaurant', 'kitchen'].includes(s.internal_notes?.toLowerCase().trim() || '')
        );
        setServices(standard);

        const food = servicesRes.data.filter(s => 
          s.category === 'Food & Beverage' && s.internal_notes?.toLowerCase().trim() === 'restaurant'
        );
        setFoodServices(food);
      }
      if (plansRes.data) {
        setRatePlans(plansRes.data);
        if (plansRes.data.length > 0) setSelectedRatePlan(plansRes.data[0]); 
      }
      if (couponsRes.data) setCoupons(couponsRes.data);
      if (cmsRes?.data?.content?.purpose_adjustments) {
        setPurposeAdjustments(cmsRes.data.content.purpose_adjustments);
      }
      if (settingsRes?.data) {
        const settingsMap = settingsRes.data.reduce((acc, curr) => {
          acc[curr.setting_key] = curr.setting_value;
          return acc;
        }, {});
        setContactInfo(prev => ({
          address: settingsMap.contact_address || prev.address,
          phone: settingsMap.contact_phone || prev.phone,
          email: settingsMap.contact_email || prev.email,
          logo: settingsMap.contact_logo || prev.logo
        }));
        setBookingRules({
          payment_rule: settingsMap.payment_rule || 'partial_deposit',
          deposit_percentage: parseFloat(settingsMap.deposit_percentage) || 30,
          cancellation_policy: settingsMap.cancellation_policy || 'Flexible',
          auto_confirmation: settingsMap.auto_confirmation !== false
        });
        setPaystackPublicKey(settingsMap.paystack_public || '');
      }
    };
    fetchStaticData();
  }, []);

  const fetchAvailableRooms = async () => {
    setLoading(true);
    try {
      const checkInDay = dateRange[0].startDate.getDay();
      const checkOutDay = dateRange[0].endDate.getDay();
      const totalNights = differenceInDays(dateRange[0].endDate, dateRange[0].startDate) || 1;
      
      const checkInDateStr = format(dateRange[0].startDate, 'yyyy-MM-dd');
      const actualEndDate = dateRange[0].startDate.getTime() === dateRange[0].endDate.getTime() 
        ? addDays(dateRange[0].startDate, 1) 
        : dateRange[0].endDate;
      const checkOutDateStr = format(actualEndDate, 'yyyy-MM-dd');

      // Execute all queries in parallel to drastically improve loading speed
      const [roomsRes, rulesRes, overlappingRes, housekeepingRes] = await Promise.all([
        supabase.from('rooms').select('id, room_number, name, type, capacity, size_sqm, base_price_ngn, image_url, status, amenities, min_stay_days, max_stay_days, allowed_check_in_days, allowed_check_out_days'),
        supabase.from('pricing_rules').select('*').eq('is_active', true),
        supabase.rpc('get_booked_room_ids', {
          req_start_date: checkInDateStr,
          req_end_date: checkOutDateStr
        }),
        supabase.from('housekeeping_tasks').select('room_id, status, assigned_date').order('assigned_date', { ascending: false })
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (overlappingRes.error) throw overlappingRes.error;

      const roomsData = roomsRes.data || [];
      const rules = rulesRes.data || [];
      const overlappingBookings = overlappingRes.data || [];
      const housekeepingTasks = housekeepingRes.data || [];

      if (rules) setPricingRules(rules);

      const latestTaskByRoom = {};
      housekeepingTasks.forEach(task => {
        if (!latestTaskByRoom[task.room_id]) {
          latestTaskByRoom[task.room_id] = task.status;
        }
      });

      const bookedRoomIds = new Set(overlappingBookings.map(b => typeof b === 'string' ? b : (b.booked_room_id || b.room_id || b.id || Object.values(b)[0])));

      const filteredRooms = roomsData.map(room => {
        const meetsCapacity = room.capacity >= (guests.adults + guests.children);
        const meetsMinStay = totalNights >= (room.min_stay_days || 1);
        const meetsMaxStay = totalNights <= (room.max_stay_days || 30);
        const allowsCheckIn = !room.allowed_check_in_days || room.allowed_check_in_days.length === 0 || room.allowed_check_in_days.includes(checkInDay);
        const allowsCheckOut = !room.allowed_check_out_days || room.allowed_check_out_days.length === 0 || room.allowed_check_out_days.includes(checkOutDay);
        
        const taskStatus = latestTaskByRoom[room.id];
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const isClean = !taskStatus || taskStatus === 'inspected' || checkInDateStr > todayStr;

        return {
          ...room,
          isClean,
          isBooked: bookedRoomIds.has(room.id) || !isClean,
          passesRules: meetsCapacity && meetsMinStay && meetsMaxStay && allowsCheckIn && allowsCheckOut
        };
      }).filter(room => room.passesRules);
      
      setAvailableRooms(filteredRooms);
      setStep(2);
    } catch (err) {
      console.error("Failed to fetch available rooms:", err);
      toast.error('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };
  
  const totalNights = differenceInDays(dateRange[0].endDate, dateRange[0].startDate) || 1;
  const totalGuests = guests.adults + guests.children;
  const daysUntilCheckIn = differenceInDays(dateRange[0].startDate, startOfDay(new Date()));

  const calculateRoomPriceDetails = (room) => {
    let totalRoomPrice = 0;
    let appliedRules = [];

    const generalRules = pricingRules.filter(r => {
      const matchesRoom = !r.room_id || r.room_id === room.id;
      if (!matchesRoom) return false;
      if (r.type === 'early_bird' && daysUntilCheckIn >= 30) return true;
      if (r.type === 'last_minute' && daysUntilCheckIn <= 3) return true;
      if (r.type === 'long_stay' && totalNights >= 7) return true;
      return false;
    });

    for (let i = 0; i < totalNights; i++) {
      let currentDate = addDays(dateRange[0].startDate, i);
      let dateString = format(currentDate, 'yyyy-MM-dd');
      let nightPrice = Number(room.base_price_ngn);

      if (room.pricing_model === 'per_guest') {
        nightPrice = nightPrice * totalGuests;
      } else if (room.pricing_model === 'per_occupancy') {
        const baseGuests = room.base_guests || 2;
        if (totalGuests > baseGuests) {
          nightPrice += nightPrice * 0.15 * (totalGuests - baseGuests);
        }
      }

      const applicableRules = pricingRules.filter(r => {
        const matchesRoom = !r.room_id || r.room_id === room.id;
        return (r.type === 'seasonal' || r.type === 'holiday' || r.type === 'weekend') && dateString >= r.start_date && dateString <= r.end_date && matchesRoom;
      });

      const allActiveRules = [...generalRules, ...applicableRules];

      allActiveRules.forEach(rule => {
        nightPrice += nightPrice * (Number(rule.adjustment_percentage) / 100);
        if (!appliedRules.find(ar => ar.id === rule.id)) appliedRules.push(rule);
      });
      totalRoomPrice += nightPrice;
    }

    if (selectedRatePlan) {
      totalRoomPrice += totalRoomPrice * (Number(selectedRatePlan.price_adjustment_percentage) / 100);
    }

    // Purpose of Stay Pricing Adjustment
    const adjustment = purposeAdjustments[guestForm.purpose];
    if (adjustment) {
      if (typeof adjustment === 'object' && adjustment !== null) {
        if (adjustment.type === 'percentage') {
          totalRoomPrice *= (1 + (Number(adjustment.value) || 0) / 100);
        } else if (adjustment.type === 'amount') {
          totalRoomPrice += (Number(adjustment.value) || 0);
        }
      } else {
        // Legacy numeric percentage fallback
        totalRoomPrice *= (1 + (Number(adjustment) || 0) / 100);
      }
    }

    return { totalRoomPrice, appliedRules };
  };

  const getServicePrice = (service, quantity = 1) => {
    let cost = Number(service.base_price_ngn);
    const isBreakfast = service.name && service.name.toLowerCase().includes('breakfast');
    if (isBreakfast) {
      // Breakfast cost is multiplied by duration (totalNights) and guests
      cost = cost * totalNights * totalGuests;
    } else {
      if(service.pricing_type === 'per_person') cost *= totalGuests;
      if(service.pricing_type === 'per_day') cost *= totalNights;
      if(service.pricing_type === 'per_night') cost *= totalNights;
      if(service.pricing_type === 'quantity_based' || service.pricing_type === 'time_based') cost *= quantity;
      if(service.category === 'Food & Beverage' && service.pricing_type === 'fixed') cost *= quantity;
    }
    return cost;
  };

  const calculateTotal = () => {
    if (bookingMode === 'hall') {
      if (!selectedHall) return 0;
      let days = 1;
      let hours = 10;

      if (hallBookingType === 'daily') {
        days = Math.max(1, differenceInDays(dateRange[0].endDate, dateRange[0].startDate)) || 1;
      } else {
        const [sh, sm] = hallStartTime.split(':').map(Number);
        const [eh, em] = hallEndTime.split(':').map(Number);
        hours = Math.max(1, (eh + em/60) - (sh + sm/60));
      }

      const hallPrice = hallBookingType === 'daily' 
        ? Number(selectedHall.base_price_ngn) * days 
        : Number(selectedHall.hourly_price_ngn) * hours;

      let mealsPrice = 0;
      selectedHallMeals.forEach(mealId => {
        const option = hallMealOptions.find(o => o.id === mealId);
        if (option) {
          mealsPrice += Number(option.price_per_participant_ngn) * Number(hallParticipants) * days;
        }
      });

      const subtotal = hallPrice + mealsPrice;
      const vat = subtotal * 0.075;
      return subtotal + vat;
    }

    let roomPrice = 0;
    if (selectedRoom) {
      roomPrice = calculateRoomPriceDetails(selectedRoom).totalRoomPrice;
    }
    
    let discountAmount = 0;
    if (appliedCoupon && roomPrice > 0) {
      if (appliedCoupon.discount_type === 'percentage') {
        discountAmount = roomPrice * (Number(appliedCoupon.discount_value) / 100);
      } else {
        discountAmount = Number(appliedCoupon.discount_value);
      }
      discountAmount = Math.max(0, Math.min(roomPrice, discountAmount));
    }

    let servicesPrice = 0;
    const allAvailableServices = [...services, ...foodServices];
    selectedServices.forEach(sData => {
      const service = allAvailableServices.find(s => s.id === sData.service_id);
      if(service) {
        servicesPrice += getServicePrice(service, sData.quantity);
      }
    });

    const subtotal = Math.max(0, (roomPrice - discountAmount) + servicesPrice);
    const vat = subtotal * 0.075;
    return subtotal + vat;
  };

  const toggleService = (service) => {
    const existing = selectedServices.find(s => s.service_id === service.id);
    if(existing) {
      setSelectedServices(selectedServices.filter(s => s.service_id !== service.id));
    } else {
      setSelectedServices([...selectedServices, { service_id: service.id, quantity: 1, date: '', time: '' }]);
    }
  };

  const updateServiceProp = (id, prop, value) => {
    setSelectedServices(selectedServices.map(s => s.service_id === id ? { ...s, [prop]: value } : s));
  };

  const applyCoupon = () => {
    if (!couponCode) return;
    const found = coupons.find(c => c.code === couponCode.toUpperCase());
    if (found) {
      const now = format(new Date(), 'yyyy-MM-dd');
      if (now >= found.valid_from && now <= found.valid_until) {
        if (found.usage_limit && found.times_used >= found.usage_limit) {
          toast.error('Coupon has reached its usage limit');
          return;
        }
        setAppliedCoupon(found);
        toast.success('Coupon applied successfully!');
      } else {
        toast.error('Coupon is expired or not yet valid');
      }
    } else {
      toast.error('Invalid coupon code');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const [paymentMethod, setPaymentMethod] = useState('pay_on_arrival');

  useEffect(() => {
    if (bookingRules.payment_rule === 'full_amount' || bookingRules.payment_rule === 'partial_deposit') {
      setPaymentMethod('pay_online');
    } else {
      setPaymentMethod('pay_on_arrival');
    }
  }, [bookingRules.payment_rule]);

  const payOnlineAmount = React.useMemo(() => {
    const total = calculateTotal();
    if (bookingMode === 'hall') {
      return total;
    }
    if (bookingRules.payment_rule === 'partial_deposit') {
      return parseFloat((total * (bookingRules.deposit_percentage / 100)).toFixed(2));
    }
    return total;
  }, [calculateTotal(), bookingMode, bookingRules.payment_rule, bookingRules.deposit_percentage]);

  const [bookingRef, setBookingRef] = useState(null);
  const [shouldTriggerPaystack, setShouldTriggerPaystack] = useState(false);
  const [isVerifyingRedirect, setIsVerifyingRedirect] = useState(false);


  const pendingBookingRef = useRef(null);
  const [bookingErrorMsg, setBookingErrorMsg] = useState(null);

  const handleBookingPaymentSuccess = async (reference) => {
    setIsProcessing(true);
    setBookingErrorMsg(null);
    const toastId = toast.loading('Finalizing your payment...');
    try {
      const pRef = pendingBookingRef.current || bookingRef;
      if (!pRef) {
        toast.dismiss(toastId);
        setBookingErrorMsg("Booking reference was lost. Please contact support.");
        return;
      }

      const isPartial = bookingRules.payment_rule === 'partial_deposit';
      const statusPayment = isPartial ? 'partial' : 'paid';

      // Update the existing pending booking
      const { error: bookingError } = await supabase.from('bookings').update({
        status: 'pending',
        payment_status: statusPayment,
        amount_paid_ngn: payOnlineAmount,
      }).eq('booking_reference', pRef);

      if (bookingError) console.error("Update booking error:", bookingError);

      // Get the full booking record to create a payment record and trigger notifications
      const { data: bookingData } = await supabase.from('bookings').select('*, profiles(*)').eq('booking_reference', pRef).single();
      
      if (bookingData) {
        const transRef = typeof reference === 'string' ? reference : (reference?.reference || reference?.transaction || 'UNKNOWN');
        const { error: paymentError } = await supabase.from('payments').insert([{
          booking_id: bookingData.id,
          amount: payOnlineAmount,
          method: 'paystack',
          transaction_ref: transRef,
          status: 'completed'
        }]);
        if (paymentError) console.error("Payment insert error:", paymentError);

        // Synchronize auto-generated Invoice status & prepayment amount
        const { error: invoiceError } = await supabase.from('invoices').update({
          amount_paid: payOnlineAmount,
          status: statusPayment
        }).eq('booking_id', bookingData.id);
        if (invoiceError) console.error("Invoice sync error:", invoiceError);
        
        // Dispatch automation alerts in real time
        triggerAutomationRules('booking_created', bookingData);
        triggerAutomationRules('payment_received', {
          ...bookingData,
          payment_amount: payOnlineAmount,
          payment_method: 'paystack',
          payment_ref: transRef
        });
        triggerAutomationRules('invoice_issued', bookingData);
      }

      toast.success(`Booking Confirmed! Ref: ${pRef}`, { id: toastId });
      navigate(`/payment-success?type=booking&ref=${pRef}&amount=${payOnlineAmount}${autoCreatedPassword ? `&password=${autoCreatedPassword}` : ''}`);
    } catch (error) {
      console.error('Booking update error:', error);
      const msg = `Payment succeeded but finalizing had an issue: ${error?.message || JSON.stringify(error)}`;
      setBookingErrorMsg(msg);
      toast.error(msg, { id: toastId, duration: 10000 });
      navigate(`/payment-success?type=booking&ref=${pendingBookingRef.current || 'UNKNOWN'}&amount=${payOnlineAmount}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const onSuccess = (reference) => {
    if (bookingMode === 'hall') {
      handleHallBookingPaymentSuccess(reference);
    } else {
      handleBookingPaymentSuccess(reference);
    }
  };

  const onClose = () => {
    toast.error('Payment cancelled.');
    setIsProcessing(false);
  };

  const initializePayment = usePaystackPayment({});

  useEffect(() => {
    if (shouldTriggerPaystack && bookingRef) {
      setShouldTriggerPaystack(false);
      initializePayment({
        config: {
          reference: bookingRef,
          email: guestForm.email || 'guest@example.com',
          amount: Math.round(payOnlineAmount * 100), // Amount is in kobo
          publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || paystackPublicKey || '',
          currency: 'NGN',
          callback_url: window.location.origin + '/booking'
        },
        onSuccess,
        onClose
      });
    }
  }, [shouldTriggerPaystack, bookingRef, guestForm.email, payOnlineAmount, paystackPublicKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paystackRef = params.get('reference') || params.get('trxref');
    if (paystackRef && (paystackRef.startsWith('WEB-') || paystackRef.startsWith('HALL-'))) {
      handleRedirectCallback(paystackRef);
    }
  }, []);

  const handleRedirectCallback = async (refCode) => {
    setIsVerifyingRedirect(true);
    const toastId = toast.loading(`Verifying transaction: ${refCode}...`);
    try {
      // 1. First, check if the booking is already confirmed in the database
      const { data: existingBooking, error: checkErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_reference', refCode)
        .maybeSingle();

      if (checkErr) throw checkErr;
      
      if (!existingBooking) {
        toast.error("Booking record not found.", { id: toastId });
        setIsVerifyingRedirect(false);
        return;
      }

      if (existingBooking.payment_status === 'paid' || existingBooking.payment_status === 'partial') {
        toast.success("Payment verified!", { id: toastId });
        navigate(`/payment-success?type=booking&ref=${refCode}&amount=${existingBooking.amount_paid_ngn}`);
        return;
      }

      // 2. Call our secure backend verify endpoint to check with Paystack
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const verifyRes = await fetch(`${API_BASE}/payments/verify/${encodeURIComponent(refCode)}`);
      if (!verifyRes.ok) {
        throw new Error(`Server verification endpoint returned status ${verifyRes.status}`);
      }

      const verifyData = await verifyRes.json();
      
      if (verifyData?.status === true && (verifyData?.data?.status === 'success' || verifyData?.data?.status === 'reversed')) {
        const amountPaidKobo = verifyData.data.amount;
        const amountPaidNgn = amountPaidKobo / 100;

        const isPartial = bookingRules.payment_rule === 'partial_deposit';
        const statusPayment = isPartial ? 'partial' : 'paid';

        // A. Update booking details
        const { error: bookingUpdateErr } = await supabase
          .from('bookings')
          .update({
            status: 'pending',
            payment_status: statusPayment,
            amount_paid_ngn: amountPaidNgn,
          })
          .eq('booking_reference', refCode);

        if (bookingUpdateErr) throw bookingUpdateErr;

        // B. Insert payment record
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            booking_id: existingBooking.id,
            amount: amountPaidNgn,
            method: 'paystack',
            transaction_ref: refCode,
            status: 'completed'
          }]);
        if (paymentError) console.error("Payment insert error:", paymentError);

        // C. Update invoice status
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            amount_paid: amountPaidNgn,
            status: statusPayment
          })
          .eq('booking_id', existingBooking.id);
        if (invoiceError) console.error("Invoice sync error:", invoiceError);

        // D. Trigger automation alerts
        try {
          const { data: updatedBooking } = await supabase
            .from('bookings')
            .select('*, profiles(*)')
            .eq('booking_reference', refCode)
            .single();
          if (updatedBooking) {
            triggerAutomationRules('booking_created', updatedBooking);
            triggerAutomationRules('payment_received', {
              ...updatedBooking,
              payment_amount: amountPaidNgn,
              payment_method: 'paystack',
              payment_ref: refCode
            });
            triggerAutomationRules('invoice_issued', updatedBooking);
          }
        } catch (autoErr) {
          console.warn("Failed to dispatch automation logs on redirect callback:", autoErr);
        }

        toast.success(`Booking Confirmed! Ref: ${refCode}`, { id: toastId });
        navigate(`/payment-success?type=booking&ref=${refCode}&amount=${amountPaidNgn}`);
      } else {
        toast.error(`Transaction verification failed. Status: ${verifyData?.data?.status || 'unknown'}`, { id: toastId, duration: 8000 });
      }
    } catch (err) {
      console.error("Error finalizing redirect payment:", err);
      toast.error(`Error verifying payment: ${err.message}`, { id: toastId, duration: 8000 });
    } finally {
      setIsVerifyingRedirect(false);
    }
  };


  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!guestForm.firstName || !guestForm.lastName || !guestForm.email || !guestForm.phone) {
      return toast.error('Please fill in all required guest details.');
    }
    
    // Validate required scheduled services
    for (let sData of selectedServices) {
      const service = services.find(s => s.id === sData.service_id);
      if (service?.scheduling_required && (!sData.date || !sData.time)) {
        return toast.error(`Please select a Date and Time for ${service.name}`);
      }
    }

    if (paymentMethod === 'pay_online' && !import.meta.env.VITE_PAYSTACK_PUBLIC_KEY && !paystackPublicKey) {
      return toast.error('Payment gateway is not configured.');
    }

    setIsProcessing(true);
    const toastId = toast.loading('Initializing booking...');

    try {
      const checkInDateStr = format(dateRange[0].startDate, 'yyyy-MM-dd');
      const actualEndDate = dateRange[0].startDate.getTime() === dateRange[0].endDate.getTime() 
        ? addDays(dateRange[0].startDate, 1) 
        : dateRange[0].endDate;
      const checkOutDateStr = format(actualEndDate, 'yyyy-MM-dd');

      // 0. Final double-booking check
      const { data: overlappingBookings, error: rpcError } = await supabase.rpc('get_booked_room_ids', {
        req_start_date: checkInDateStr,
        req_end_date: checkOutDateStr
      });
      
      if (!rpcError) {
        const bookedRoomIds = new Set((overlappingBookings || []).map(b => typeof b === 'string' ? b : (b.booked_room_id || b.room_id || b.id || Object.values(b)[0])));
        if (bookedRoomIds.has(selectedRoom.id)) {
          toast.dismiss(toastId);
          setIsProcessing(false);
          return toast.error("Sorry, this room has just been booked for those dates. Please go back and select another room.");
        }
      }

      let resolvedGuestId = null;
      let generatedPass = null;

      try {
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', guestForm.email.toLowerCase())
          .maybeSingle();

        if (existingProf) {
          resolvedGuestId = existingProf.id;
        } else {
          // Provision guest account in background
          const lastNameClean = (guestForm?.lastName || '').replace(/\s+/g, '') || 'Guest';
          generatedPass = `Luxe${lastNameClean}${Math.floor(100 + Math.random() * 900)}!`;
          const { data: signUpData } = await secondarySupabase.auth.signUp({
            email: guestForm.email.toLowerCase(),
            password: generatedPass,
            options: {
              data: {
                first_name: guestForm.firstName,
                last_name: guestForm.lastName,
                phone: guestForm.phone,
                role: 'guest'
              }
            }
          });
          if (signUpData?.user) {
            resolvedGuestId = signUpData.user.id;
            setAutoCreatedPassword(generatedPass);
            
            // Trigger welcome email with details
            try {
              await sendWelcomeEmail({
                email: guestForm.email.toLowerCase(),
                firstName: guestForm.firstName,
                lastName: guestForm.lastName,
                password: generatedPass
              });
            } catch (emailErr) {
              console.warn("Failed to send welcome email:", emailErr);
            }
            
            // Confirm their email automatically
            try {
              await supabase.rpc('admin_confirm_user_email', { target_user_id: resolvedGuestId });
            } catch (confErr) {
              console.warn("Failed to confirm email via RPC:", confErr);
            }
          }
        }
      } catch (authErr) {
        console.error("Silent guest signup failed:", authErr);
      }

      // Synchronize/Link CRM Guest
      let crmGuestId = null;
      try {
        const { data: existingCRM } = await supabase
          .from('crm_guests')
          .select('id')
          .eq('email', guestForm.email.toLowerCase())
          .maybeSingle();

        if (existingCRM) {
          crmGuestId = existingCRM.id;
          if (resolvedGuestId) {
            await supabase.from('crm_guests').update({ profile_id: resolvedGuestId }).eq('id', crmGuestId);
          }
        } else {
          const { data: newCRM } = await supabase
            .from('crm_guests')
            .insert([{
              first_name: guestForm.firstName,
              last_name: guestForm.lastName,
              email: guestForm.email.toLowerCase(),
              phone: guestForm.phone,
              profile_id: resolvedGuestId,
              nationality: 'Nigeria',
              segment: 'standard',
              vip_status: false,
              loyalty_points: 10,
              wallet_balance: 0
            }])
            .select()
            .single();
          if (newCRM) {
            crmGuestId = newCRM.id;
          }
        }
      } catch (crmErr) {
        console.error("CRM guest sync failed:", crmErr);
      }

      const roomPriceDetails = calculateRoomPriceDetails(selectedRoom);
      let calculatedDiscount = 0;
      if (appliedCoupon) {
        if (appliedCoupon.discount_type === 'percentage') {
          calculatedDiscount = roomPriceDetails.totalRoomPrice * (Number(appliedCoupon.discount_value) / 100);
        } else {
          calculatedDiscount = Number(appliedCoupon.discount_value);
        }
        calculatedDiscount = Math.max(0, Math.min(roomPriceDetails.totalRoomPrice, calculatedDiscount));
      }

      let insertedBooking;
      if (pendingBookingRef.current) {
        // Update the existing pending booking instead of inserting a duplicate
        const { data, error: bookingError } = await supabase
          .from('bookings')
          .update({
            guest_id: resolvedGuestId,
            crm_guest_id: crmGuestId,
            guest_name: `${guestForm.firstName} ${guestForm.lastName}`,
            guest_email: guestForm.email,
            guest_phone: guestForm.phone,
            room_id: selectedRoom.id,
            check_in_date: checkInDateStr,
            check_out_date: checkOutDateStr,
            total_room_price_ngn: roomPriceDetails.totalRoomPrice,
            total_amount_ngn: calculateTotal(),
            total_extras_price_ngn: calculateTotal() - (roomPriceDetails.totalRoomPrice - calculatedDiscount),
            discount_amount_ngn: calculatedDiscount,
            special_requests: guestForm.specialRequests || ''
          })
          .eq('booking_reference', pendingBookingRef.current)
          .select()
          .single();

        if (bookingError) throw bookingError;
        insertedBooking = data;
        setBookingRef(pendingBookingRef.current);
      } else {
        const tempRef = `WEB-${(new Date()).getTime().toString().slice(-6)}`;
        const { data, error: bookingError } = await supabase.from('bookings').insert([{
          booking_reference: tempRef,
          guest_id: resolvedGuestId,
          crm_guest_id: crmGuestId,
          guest_name: `${guestForm.firstName} ${guestForm.lastName}`,
          guest_email: guestForm.email,
          guest_phone: guestForm.phone,
          room_id: selectedRoom.id,
          check_in_date: checkInDateStr,
          check_out_date: checkOutDateStr,
          booking_source: 'online',
          status: 'pending',
          total_room_price_ngn: roomPriceDetails.totalRoomPrice,
          total_amount_ngn: calculateTotal(),
          total_extras_price_ngn: calculateTotal() - (roomPriceDetails.totalRoomPrice - calculatedDiscount),
          discount_amount_ngn: calculatedDiscount,
          amount_paid_ngn: 0,
          payment_status: 'unpaid',
          special_requests: guestForm.specialRequests || ''
        }]).select().single();

        if (bookingError) throw bookingError;
        insertedBooking = data;
        pendingBookingRef.current = tempRef;
        setBookingRef(tempRef);
      }

      // 2. Insert any selected services immediately, securely linked to the booking ID
      if (insertedBooking) {
        // Clear any previously inserted services for this booking attempt to prevent duplicates on retry
        await supabase.from('booking_services').delete().eq('booking_id', insertedBooking.id);

        if (selectedServices.length > 0) {
          const allAvailableServices = [...services, ...foodServices];
          const insertPayload = selectedServices.map(sData => {
            const service = allAvailableServices.find(s => s.id === sData.service_id);
            let unitPrice = Number(service.base_price_ngn);
            const isBreakfast = service.name && service.name.toLowerCase().includes('breakfast');
            
            if (isBreakfast) {
              unitPrice = unitPrice * totalGuests * totalNights;
            } else {
              if(service.pricing_type === 'per_person') unitPrice *= totalGuests;
              if(service.pricing_type === 'per_day') unitPrice *= totalNights;
              if(service.pricing_type === 'per_night') unitPrice *= totalNights;
            }

            return {
              booking_id: insertedBooking.id,
              service_id: sData.service_id,
              quantity: sData.quantity,
              unit_price_ngn: unitPrice,
              total_price_ngn: getServicePrice(service, sData.quantity),
              scheduled_date: sData.date || null,
              scheduled_time: sData.time || null,
              status: 'pending'
            };
          });
          const { error: insertServicesError } = await supabase.from('booking_services').insert(insertPayload);
          if (insertServicesError) throw insertServicesError;
        }
      }

      toast.dismiss(toastId);

      // 3. Handle Payment Routing
      if (paymentMethod === 'pay_online') {
        setShouldTriggerPaystack(true);
      } else if (paymentMethod === 'pay_ar_deposit' || paymentMethod === 'pay_ar_full') {
        // Direct AR wallet deduction & checkout flow
        const paidAmount = paymentMethod === 'pay_ar_deposit' ? payOnlineAmount : calculateTotal();
        const statusPayment = paymentMethod === 'pay_ar_full' ? 'paid' : 'partial';

        // A. Update booking details directly
        const { error: bookingUpdateErr } = await supabase
          .from('bookings')
          .update({
            amount_paid_ngn: paidAmount,
            payment_status: statusPayment,
            status: 'confirmed'
          })
          .eq('id', insertedBooking.id);

        if (bookingUpdateErr) throw bookingUpdateErr;

        // B. Insert payment ledger entry
        const transRef = `AR-BK-${Date.now()}`;
        const { error: paymentInsertErr } = await supabase
          .from('payments')
          .insert([{
            booking_id: insertedBooking.id,
            amount: paidAmount,
            method: 'bank_transfer',
            transaction_ref: transRef,
            status: 'completed',
            notes: `Paid from Guest AR Prepayment Wallet (${paymentMethod === 'pay_ar_full' ? 'Full Payment' : '30% Confirmation Deposit'}) for guest: ${guestForm.firstName} ${guestForm.lastName} (${guestForm.email || 'N/A'})`
          }]);

        if (paymentInsertErr) throw paymentInsertErr;

        // Update Invoice status & prepayment amount for AR wallet payments
        const { error: invoiceUpdateErr } = await supabase
          .from('invoices')
          .update({
            amount_paid: paidAmount,
            status: statusPayment
          })
          .eq('booking_id', insertedBooking.id);
        
        if (invoiceUpdateErr) console.warn("Failed to update invoice in AR flow:", invoiceUpdateErr);

        // C. Deduct balance from ar_accounts
        const newBalance = Number(arAccount.balance) - paidAmount;
        const { error: arUpdateErr } = await supabase
          .from('ar_accounts')
          .update({ balance: newBalance })
          .eq('guest_email', user.email.toLowerCase());

        if (arUpdateErr) console.warn("Failed to deduct from ar_accounts table:", arUpdateErr);

        // D. Deduct balance from crm_guests
        const { data: crmGuest } = await supabase
          .from('crm_guests')
          .select('wallet_balance')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();

        if (crmGuest) {
          const newCrmBalance = Number(crmGuest.wallet_balance || 0) - paidAmount;
          await supabase
            .from('crm_guests')
            .update({ wallet_balance: newCrmBalance })
            .eq('email', user.email.toLowerCase());
        }

        // E. Render success details & trigger alerts
        toast.success(`Booking Confirmed via AR Wallet! Ref: ${insertedBooking.booking_reference}`);
        setConfirmedBookingRef(insertedBooking.booking_reference);
        setStep(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsProcessing(false);

        // Refresh AR balance locally
        fetchARAccount();

        // Fetch full booking data with profile details for automations
        supabase.from('bookings')
          .select('*, profiles(*)')
          .eq('id', insertedBooking.id)
          .single()
          .then(({ data }) => {
            if (data) triggerAutomationRules('booking_created', data);
          });
      } else {
        toast.success(`Booking Confirmed! Ref: ${insertedBooking.booking_reference}`);
        setConfirmedBookingRef(insertedBooking.booking_reference);
        setStep(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsProcessing(false);

        // Fetch full booking data with profile details for automations
        supabase.from('bookings')
          .select('*, profiles(*)')
          .eq('id', insertedBooking.id)
          .single()
          .then(({ data }) => {
            if (data) triggerAutomationRules('booking_created', data);
          });
      }

    } catch (error) {
      console.error('Pre-booking error:', error);
      toast.error(`Could not initialize booking: ${error.message || JSON.stringify(error)}`, { id: toastId, duration: 8000 });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderPrintReceipt = () => {
    if (!selectedRoom) return null;
    const roomPriceDetails = calculateRoomPriceDetails(selectedRoom);
    
    return (
      <div className="hidden print:block print-container print-a4 bg-white text-black absolute inset-0 z-50 p-8 min-h-screen text-left">
        {/* Receipt Header */}
        <div className="flex justify-between items-start border-b pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 text-black">PAYMENT RECEIPT</h1>
            <p className="text-gray-600 text-xs">Ref: {confirmedBookingRef || 'N/A'}</p>
          </div>
          <div className="text-right">
            {contactInfo.logo && (
              <img src={contactInfo.logo} alt="Freshland Logo" className="max-h-12 object-contain ml-auto mb-2" />
            )}
            <h2 className="text-lg font-black tracking-widest text-black">Freshland</h2>
            <p className="text-xs text-gray-600">{contactInfo.address}</p>
            <p className="text-xs text-gray-600">{contactInfo.phone}</p>
            <p className="text-xs text-gray-600">{contactInfo.email}</p>
          </div>
        </div>

        {/* Guest Details */}
        <div className="flex justify-between mb-8 text-sm text-left">
          <div>
            <p className="text-gray-300 font-bold uppercase text-[10px] mb-1">Guest Details:</p>
            <p className="font-bold text-black text-base">{guestForm.firstName} {guestForm.lastName}</p>
            <p className="text-gray-600">{guestForm.email}</p>
            <p className="text-gray-600">{guestForm.phone}</p>
          </div>
          <div className="text-right">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-left">
              <span className="text-gray-300 font-bold">Check-In:</span>
              <span className="font-medium text-black">{format(dateRange[0].startDate, 'MMM dd, yyyy')}</span>
              <span className="text-gray-300 font-bold">Check-Out:</span>
              <span className="font-medium text-black">{format(dateRange[0].endDate, 'MMM dd, yyyy')}</span>
              <span className="text-gray-300 font-bold">Transaction Date:</span>
              <span className="font-medium text-black">{format(new Date(), 'MMM dd, yyyy, HH:mm')}</span>
              <span className="text-gray-300 font-bold">Purpose:</span>
              <span className="font-medium text-black">{guestForm.purpose || 'Leisure'}</span>
              <span className="text-gray-300 font-bold">Status:</span>
              <span className="font-bold uppercase text-green-600">{paymentMethod === 'pay_online' ? 'PAID / CONFIRMED' : 'CONFIRMED (ARRIVAL PAYMENT)'}</span>
            </div>
          </div>
        </div>

        {/* Details Table */}
        <table className="w-full mb-8 text-xs border-collapse text-left">
          <thead>
            <tr className="bg-gray-100 border-y border-gray-200">
              <th className="py-2.5 px-4 text-left font-bold text-gray-600">Description</th>
              <th className="py-2.5 px-4 text-center font-bold text-gray-600">Payment Status</th>
              <th className="py-2.5 px-4 text-right font-bold text-gray-600">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(() => {
              const roomPrice = roomPriceDetails.totalRoomPrice;
              let discountVal = 0;
              if (appliedCoupon) {
                if (appliedCoupon.discount_type === 'percentage') {
                  discountVal = roomPrice * (Number(appliedCoupon.discount_value) / 100);
                } else {
                  discountVal = Number(appliedCoupon.discount_value);
                }
                discountVal = Math.max(0, Math.min(roomPrice, discountVal));
              }
              const roomBase = Math.max(0, roomPrice - discountVal);
              const roomTax = roomBase * 0.075;
              const roomTotalWithTax = roomBase + roomTax;

              const grandTotal = calculateTotal();
              const amountPaid = paymentMethod === 'pay_online' ? grandTotal : (paymentMethod === 'pay_ar_deposit' ? (grandTotal * (bookingRules.deposit_percentage / 100)) : 0);
              let remainingPaid = amountPaid;

              // Pay room first
              let roomPaymentStatus = 'unpaid';
              if (remainingPaid >= roomTotalWithTax) {
                roomPaymentStatus = 'paid';
                remainingPaid -= roomTotalWithTax;
              } else if (remainingPaid > 0) {
                roomPaymentStatus = 'partial';
                remainingPaid = 0;
              }

              const renderStatusBadge = (status) => {
                const normalized = (status || 'unpaid').toLowerCase();
                let colorClasses = '';
                let label = normalized;
                if (normalized === 'paid') {
                  colorClasses = 'bg-green-100 text-green-800 border-green-200';
                  label = 'Paid';
                } else if (normalized === 'partial') {
                  colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-250';
                  label = 'Partial';
                } else {
                  colorClasses = 'bg-red-100 text-red-800 border-red-200';
                  label = 'Unpaid';
                }
                return (
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${colorClasses}`}>
                    {label}
                  </span>
                );
              };

              const allAvailableServices = [...services, ...foodServices];
              const servicesWithStatus = selectedServices.map(sData => {
                const service = allAvailableServices.find(s => s.id === sData.service_id);
                if (!service) return null;

                const isTaxable = service.tax_inclusive !== false;
                let uPrice = Number(service.base_price_ngn);
                const isBreakfast = service.name && service.name.toLowerCase().includes('breakfast');
                if (isBreakfast) {
                  uPrice = uPrice * totalGuests * totalNights;
                } else {
                  if(service.pricing_type === 'per_person') uPrice *= totalGuests;
                  if(service.pricing_type === 'per_day') uPrice *= totalNights;
                  if(service.pricing_type === 'per_night') uPrice *= totalNights;
                }

                const sBasePrice = getServicePrice(service, sData.quantity);
                const sTax = isTaxable ? sBasePrice * 0.075 : 0;
                const sTotal = sBasePrice + sTax;

                let servicePaymentStatus = 'unpaid';
                if (remainingPaid >= sTotal) {
                  servicePaymentStatus = 'paid';
                  remainingPaid -= sTotal;
                } else if (remainingPaid > 0) {
                  servicePaymentStatus = 'partial';
                  remainingPaid = 0;
                }

                return {
                  service,
                  sData,
                  calculatedStatus: servicePaymentStatus,
                  sBasePrice,
                  sTax,
                  sTotal,
                  uPrice,
                  isTaxable
                };
              }).filter(Boolean);

              return (
                <>
                  <tr>
                    <td className="py-3 px-4">
                      <p className="font-bold text-black">{selectedRoom.name} ({selectedRoom.type})</p>
                      <p className="text-gray-300 text-[10px] mt-0.5">Accommodation Charges (Rent + Tax)</p>
                      <p className="text-[9px] text-gray-200">
                            Rate: ₦{roomPrice.toLocaleString()} {discountVal > 0 && `| Discount: -₦${discountVal.toLocaleString()}`} | Taxable Base: ₦{roomBase.toLocaleString()} | VAT (7.5%): ₦{roomTax.toLocaleString()}
                          </p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {renderStatusBadge(roomPaymentStatus)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-black">
                      ₦{roomTotalWithTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {servicesWithStatus.map(({ service, sData, calculatedStatus, sBasePrice, sTax, sTotal, uPrice, isTaxable }) => {
                    return (
                      <tr key={sData.service_id}>
                        <td className="py-3 px-4">
                          <p className="font-bold text-black">{service.name}</p>
                          <p className="text-gray-300 text-[10px] mt-0.5">
                            Unit Price: ₦{uPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Quantity: {sData.quantity}
                          </p>
                          <p className="text-[9px] text-gray-200">
                            Base: ₦{sBasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {isTaxable ? `| VAT (7.5%): ₦${sTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '(VAT Exempt)'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {renderStatusBadge(calculatedStatus)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-black">
                          ₦{sTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })()}
          </tbody>
        </table>

        {/* Totals Summary */}
        {(() => {
          const grandTotal = calculateTotal();
          const amountPaid = paymentMethod === 'pay_online' ? grandTotal : (paymentMethod === 'pay_ar_deposit' ? (grandTotal * (bookingRules.deposit_percentage / 100)) : 0);
          const balance = Math.max(0, grandTotal - amountPaid);
          
          const roomPrice = roomPriceDetails.totalRoomPrice;
          let discountVal = 0;
          if (appliedCoupon) {
            if (appliedCoupon.discount_type === 'percentage') {
              discountVal = roomPrice * (Number(appliedCoupon.discount_value) / 100);
            } else {
              discountVal = Number(appliedCoupon.discount_value);
            }
            discountVal = Math.max(0, Math.min(roomPrice, discountVal));
          }

          return (
            <div className="flex justify-end text-xs">
              <div className="w-64 space-y-2 border-t pt-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₦{(grandTotal + discountVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between text-yellow-600 font-bold">
                    <span>Room Discount</span>
                    <span>-₦{discountVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm border-t pt-2 text-black">
                  <span>Total Due</span>
                  <span>₦{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-green-600 pt-1">
                  <span>Amount Paid</span>
                  <span>₦{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-red-600 pt-1 border-t border-gray-100">
                  <span>Balance</span>
                  <span>₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="mt-16 text-center text-[10px] text-gray-200 border-t pt-4">
          <p>Thank you for choosing Freshland. Have a wonderful stay!</p>
        </div>
      </div>
    );
  };

  const bookingSummary = useMemo(() => {
    if (bookingMode !== 'hall' || !selectedHall) {
      return { hallPrice: 0, mealsPrice: 0, subtotal: 0, tax: 0, total: 0, days: 1, hours: 10 };
    }

    let days = 1;
    let hours = 10;

    if (hallBookingType === 'daily') {
      days = Math.max(1, differenceInDays(dateRange[0].endDate, dateRange[0].startDate) + 1) || 1;
    } else {
      const [sh, sm] = hallStartTime.split(':').map(Number);
      const [eh, em] = hallEndTime.split(':').map(Number);
      hours = Math.max(1, (eh + em/60) - (sh + sm/60));
    }

    const hallPrice = hallBookingType === 'daily' 
      ? Number(selectedHall.base_price_ngn) * days 
      : Number(selectedHall.hourly_price_ngn) * hours;

    let mealsPrice = 0;
    selectedHallMeals.forEach(mealId => {
      const option = hallMealOptions.find(o => o.id === mealId);
      if (option) {
        mealsPrice += Number(option.price_per_participant_ngn) * Number(hallParticipants) * days;
      }
    });

    const subtotal = hallPrice + mealsPrice;
    const tax = subtotal * 0.075;
    const total = subtotal + tax;

    return { hallPrice, mealsPrice, subtotal, tax, total, days, hours };
  }, [bookingMode, selectedHall, dateRange, hallBookingType, hallStartTime, hallEndTime, selectedHallMeals, hallMealOptions, hallParticipants]);

  const fetchAvailableHalls = async () => {
    setLoading(true);
    try {
      const checkInDateStr = format(dateRange[0].startDate, 'yyyy-MM-dd');
      const checkOutDateStr = hallBookingType === 'daily' 
        ? format(dateRange[0].endDate, 'yyyy-MM-dd') 
        : checkInDateStr;

      const [hallsRes, bookedRes] = await Promise.all([
        supabase.from('halls').select('*').eq('is_active', true),
        supabase.from('hall_bookings').select('hall_id, start_time, end_time').eq('status', 'confirmed')
      ]);

      if (hallsRes.error) throw hallsRes.error;
      if (bookedRes.error) throw bookedRes.error;

      const allHalls = hallsRes.data || [];
      const bookedList = bookedRes.data || [];

      const newStart = new Date(`${checkInDateStr}T${hallBookingType === 'daily' ? '00:00' : hallStartTime}:00`);
      const newEnd = new Date(`${checkOutDateStr}T${hallBookingType === 'daily' ? '23:59' : hallEndTime}:00`);

      const available = allHalls.filter(hall => {
        if (hall.capacity < hallParticipants) return false;
        
        const conflicts = bookedList.filter(b => b.hall_id === hall.id);
        const hasOverlap = conflicts.some(c => {
          const cStart = new Date(c.start_time);
          const cEnd = new Date(c.end_time);
          return newStart < cEnd && newEnd > cStart;
        });

        return !hasOverlap;
      });

      setAvailableHalls(available);
      setStep(2);
    } catch (err) {
      console.error(err);
      toast.error("Failed to check halls availability");
    } finally {
      setLoading(false);
    }
  };

  const handleHallBookingPaymentSuccess = async (reference) => {
    setIsProcessing(true);
    setBookingErrorMsg(null);
    const toastId = toast.loading('Finalizing your payment...');
    try {
      const pRef = pendingBookingRef.current || bookingRef;
      if (!pRef) {
        toast.dismiss(toastId);
        setBookingErrorMsg("Booking reference was lost. Please contact support.");
        return;
      }

      const { data: hallBooking, error: bookingError } = await supabase
        .from('hall_bookings')
        .update({
          payment_status: 'paid',
          amount_paid_ngn: payOnlineAmount,
          status: 'confirmed'
        })
        .eq('booking_reference', pRef)
        .select()
        .single();

      if (bookingError) throw bookingError;

      const transRef = typeof reference === 'string' ? reference : (reference?.reference || reference?.transaction || 'UNKNOWN');
      const { error: paymentError } = await supabase.from('payments').insert([{
        hall_booking_id: hallBooking.id,
        amount: payOnlineAmount,
        method: 'paystack',
        transaction_ref: transRef,
        status: 'completed',
        notes: `Online Hall Booking Payment for Ref: ${pRef}`
      }]);
      if (paymentError) console.error("Payment insert error:", paymentError);

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          amount_paid: payOnlineAmount,
          status: 'paid'
        })
        .eq('hall_booking_id', hallBooking.id);
      if (invoiceError) console.error("Invoice sync error:", invoiceError);

      // Create Detailed Scheduled Kitchen Catering Items (for each selected meal & each day)
      if (selectedHallMeals.length > 0 && hallBooking) {
        const mealFeeds = [];
        const days = bookingSummary.days;
        
        for (let i = 0; i < days; i++) {
          const servingDate = format(addDays(dateRange[0].startDate, i), 'yyyy-MM-dd');
          
          selectedHallMeals.forEach(mealId => {
            const option = hallMealOptions.find(o => o.id === mealId);
            if (option) {
              mealFeeds.push({
                hall_booking_id: hallBooking.id,
                meal_option_id: option.id,
                course_type: option.course_type,
                serving_date: servingDate,
                price_per_participant_ngn: option.price_per_participant_ngn,
                number_of_participants: Number(hallParticipants),
                total_price_ngn: option.price_per_participant_ngn * Number(hallParticipants),
                status: 'pending'
              });
            }
          });
        }

        const { error: feedErr } = await supabase.from('hall_booking_meals').insert(mealFeeds);
        if (feedErr) console.error("Catering schedules setup error:", feedErr);
      }

      toast.success(`Booking Confirmed! Ref: ${pRef}`, { id: toastId });
      navigate(`/payment-success?type=hall_booking&ref=${pRef}&amount=${payOnlineAmount}`);
    } catch (error) {
      console.error('Hall Booking update error:', error);
      const msg = `Payment succeeded but finalizing had an issue: ${error?.message || JSON.stringify(error)}`;
      setBookingErrorMsg(msg);
      toast.error(msg, { id: toastId, duration: 10000 });
      navigate(`/payment-success?type=hall_booking&ref=${pendingBookingRef.current || 'UNKNOWN'}&amount=${payOnlineAmount}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHallCheckout = async (e) => {
    e.preventDefault();
    if (!guestForm.firstName || !guestForm.lastName || !guestForm.email || !guestForm.phone) {
      return toast.error('Please fill in all required guest details.');
    }

    if (paymentMethod === 'pay_online' && !import.meta.env.VITE_PAYSTACK_PUBLIC_KEY && !paystackPublicKey) {
      return toast.error('Payment gateway is not configured.');
    }

    setIsProcessing(true);
    const toastId = toast.loading('Initializing hall booking...');

    try {
      const checkInDateStr = format(dateRange[0].startDate, 'yyyy-MM-dd');
      const checkOutDateStr = hallBookingType === 'daily' 
        ? format(dateRange[0].endDate, 'yyyy-MM-dd') 
        : checkInDateStr;

      const newStart = new Date(`${checkInDateStr}T${hallBookingType === 'daily' ? '00:00' : hallStartTime}:00`);
      const newEnd = new Date(`${checkOutDateStr}T${hallBookingType === 'daily' ? '23:59' : hallEndTime}:00`);

      // Enforce 48-hour advance booking window for online bookings
      const hoursUntilStart = (newStart.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilStart < 48) {
        toast.dismiss(toastId);
        setIsProcessing(false);
        return toast.error("Hall bookings must be made at least 48 hours in advance. For last-minute bookings, please contact us directly.");
      }

      const { data: conflicts, error: confErr } = await supabase
        .from('hall_bookings')
        .select('id, start_time, end_time')
        .eq('hall_id', selectedHall.id)
        .in('status', ['confirmed', 'checked_in']); // Only confirmed (fully paid) or in-use blocks the slot

      if (confErr) throw confErr;

      const hasOverlap = conflicts.some(c => {
        const cStart = new Date(c.start_time);
        const cEnd = new Date(c.end_time);
        return newStart < cEnd && newEnd > cStart;
      });

      if (hasOverlap) {
        toast.dismiss(toastId);
        setIsProcessing(false);
        return toast.error("Sorry, this hall has just been booked for those dates. Please go back and select another hall.");
      }

      let resolvedGuestId = null;
      let generatedPass = null;

      try {
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', guestForm.email.toLowerCase())
          .maybeSingle();

        if (existingProf) {
          resolvedGuestId = existingProf.id;
        } else {
          const lastNameClean = (guestForm?.lastName || '').replace(/\s+/g, '') || 'Guest';
          generatedPass = `Luxe${lastNameClean}${Math.floor(100 + Math.random() * 900)}!`;
          const { data: signUpData } = await secondarySupabase.auth.signUp({
            email: guestForm.email.toLowerCase(),
            password: generatedPass,
            options: {
              data: {
                first_name: guestForm.firstName,
                last_name: guestForm.lastName,
                phone: guestForm.phone,
                role: 'guest'
              }
            }
          });
          if (signUpData?.user) {
            resolvedGuestId = signUpData.user.id;
            setAutoCreatedPassword(generatedPass);
            try {
              await sendWelcomeEmail({
                email: guestForm.email.toLowerCase(),
                firstName: guestForm.firstName,
                lastName: guestForm.lastName,
                password: generatedPass
              });
            } catch (e) {}
            try {
              await supabase.rpc('admin_confirm_user_email', { target_user_id: resolvedGuestId });
            } catch (e) {}
          }
        }
      } catch (e) {}

      let crmGuestId = null;
      try {
        const { data: existingCRM } = await supabase
          .from('crm_guests')
          .select('id')
          .eq('email', guestForm.email.toLowerCase())
          .maybeSingle();
        if (existingCRM) {
          crmGuestId = existingCRM.id;
          if (resolvedGuestId) {
            await supabase.from('crm_guests').update({ profile_id: resolvedGuestId }).eq('id', crmGuestId);
          }
        } else {
          const { data: newCRM } = await supabase
            .from('crm_guests')
            .insert([{
              first_name: guestForm.firstName,
              last_name: guestForm.lastName,
              email: guestForm.email.toLowerCase(),
              phone: guestForm.phone,
              profile_id: resolvedGuestId,
              nationality: 'Nigeria',
              segment: 'standard',
              vip_status: false,
              loyalty_points: 10,
              wallet_balance: 0
            }])
            .select().single();
          if (newCRM) crmGuestId = newCRM.id;
        }
      } catch (e) {}

      const ref = `HALL-WEB-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const totalAmount = calculateTotal();
      
      const bookingPayload = {
        booking_reference: ref,
        guest_id: resolvedGuestId,
        guest_name: `${guestForm.firstName} ${guestForm.lastName}`,
        guest_email: guestForm.email,
        guest_phone: guestForm.phone,
        organization_name: guestForm.organizationName || null,
        hall_id: selectedHall.id,
        booking_date: checkInDateStr,
        booking_type: hallBookingType,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        num_days: bookingSummary.days,
        num_hours: hallBookingType === 'hourly' ? bookingSummary.hours : null,
        number_of_participants: Number(hallParticipants),
        status: 'pending',
        booking_source: 'online',
        total_hall_price_ngn: bookingSummary.hallPrice,
        total_meals_price_ngn: bookingSummary.mealsPrice,
        total_amount_ngn: totalAmount,
        amount_paid_ngn: 0,
        payment_status: 'unpaid',
        special_requests: guestForm.specialRequests || null
      };

      const { data: newBooking, error: bookingError } = await supabase
        .from('hall_bookings')
        .insert([bookingPayload])
        .select()
        .single();

      if (bookingError) throw bookingError;

      pendingBookingRef.current = ref;
      setBookingRef(ref);

      toast.dismiss(toastId);

      if (paymentMethod === 'pay_online') {
        setShouldTriggerPaystack(true);
      } else {
        if (selectedHallMeals.length > 0) {
          const mealFeeds = [];
          for (let i = 0; i < bookingSummary.days; i++) {
            const servingDate = format(addDays(dateRange[0].startDate, i), 'yyyy-MM-dd');
            selectedHallMeals.forEach(mealId => {
              const option = hallMealOptions.find(o => o.id === mealId);
              if (option) {
                mealFeeds.push({
                  hall_booking_id: newBooking.id,
                  meal_option_id: option.id,
                  course_type: option.course_type,
                  serving_date: servingDate,
                  price_per_participant_ngn: option.price_per_participant_ngn,
                  number_of_participants: Number(hallParticipants),
                  total_price_ngn: option.price_per_participant_ngn * Number(hallParticipants),
                  status: 'pending'
                });
              }
            });
          }
          await supabase.from('hall_booking_meals').insert(mealFeeds);
        }

        toast.success(`Booking Confirmed! Ref: ${ref}`);
        navigate(`/payment-success?type=hall_booking&ref=${ref}&amount=0${generatedPass ? `&password=${generatedPass}` : ''}`);
      }

    } catch (err) {
      console.error(err);
      toast.error("Failed to initialize booking: " + err.message, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepIndicator = () => {
    const labels = bookingMode === 'hall'
      ? ['Search Hall', 'Choose Hall', 'Meals & Catering', 'Details & Pay']
      : ['Search Room', 'Choose Room', 'Guest Details', 'Services & Pay'];
    return (
      <div className="flex justify-between mb-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-dark-700 -z-10 -translate-y-1/2"></div>
        {labels.map((label, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${step > idx + 1 ? 'bg-gold-500 text-dark-900' : step === idx + 1 ? 'bg-dark-900 border-2 border-gold-500 text-gold-500' : 'bg-dark-800 text-gray-300 border border-dark-700'}`}>
              {step > idx + 1 ? <CheckCircle size={20} /> : idx + 1}
            </div>
            <span className={`text-sm ${step === idx + 1 ? 'text-gold-500 font-medium' : 'text-gray-300'}`}>{label}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderStepIndicatorOriginalPlaceholder = () => (
    <div className="flex justify-between mb-12 relative">
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-dark-700 -z-10 -translate-y-1/2"></div>
      {['Search Room', 'Choose Room', 'Guest Details', 'Additional Services'].map((label, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${step > idx + 1 ? 'bg-gold-500 text-dark-900' : step === idx + 1 ? 'bg-dark-900 border-2 border-gold-500 text-gold-500' : 'bg-dark-800 text-gray-300 border border-dark-700'}`}>
            {step > idx + 1 ? <CheckCircle size={20} /> : idx + 1}
          </div>
          <span className={`text-sm ${step === idx + 1 ? 'text-gold-500 font-medium' : 'text-gray-300'}`}>{label}</span>
        </div>
      ))}
    </div>
  );

  if (isVerifyingRedirect) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500 mb-4"></div>
        <p className="text-gray-200 text-sm">Verifying transaction and confirming your booking...</p>
      </div>
    );
  }

  return (
    <div className="pt-24 min-h-screen bg-dark-900 pb-20">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-12 text-center">Complete Your Reservation</h1>
        
        <div className="max-w-6xl mx-auto">
          {renderStepIndicator()}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Main Content Area */}
            <div className="lg:col-span-2">
              
              {/* STEP 1: Search */}
              {step === 1 && (
                <div className="bg-dark-800 p-8 border border-dark-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                  {/* Booking Mode Selector */}
                  <div className="flex bg-dark-900/60 p-1.5 rounded-2xl border border-dark-700/60 mb-8 shadow-inner">
                    <button 
                      type="button"
                      onClick={() => setBookingMode('room')}
                      className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all ${bookingMode === 'room' ? 'bg-gradient-to-tr from-gold-600 to-amber-500 text-dark-950 font-black shadow-md' : 'text-gray-200 hover:text-white'}`}
                    >
                      Luxury Apartments & Suites
                    </button>
                    <button 
                      type="button"
                      onClick={() => setBookingMode('hall')}
                      className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all ${bookingMode === 'hall' ? 'bg-gradient-to-tr from-gold-600 to-amber-500 text-dark-950 font-black shadow-md' : 'text-gray-200 hover:text-white'}`}
                    >
                      Event Halls & Catering
                    </button>
                  </div>

                  <h3 className="text-2xl font-medium mb-8 flex items-center">
                    <Calendar className="mr-3 text-gold-500" /> 
                    {bookingMode === 'hall' ? 'Select Event Date & Details' : 'Select Dates & Guests'}
                  </h3>

                  <div className="mb-8 overflow-x-auto">
                    <DateRange
                      editableDateInputs={true}
                      onChange={item => setDateRange([item.selection])}
                      moveRangeOnFirstSelection={false}
                      ranges={dateRange}
                      minDate={new Date()}
                      rangeColors={['#F59E0B']}
                      className="bg-dark-900 border border-dark-700 p-4 rounded-lg w-full"
                    />
                  </div>

                  {bookingMode === 'room' ? (
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div>
                        <label className="block text-sm text-gray-200 mb-2">Adults</label>
                        <select value={guests.adults} onChange={(e) => setGuests({...guests, adults: parseInt(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 text-white p-3">
                          {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-200 mb-2">Children</label>
                        <select value={guests.children} onChange={(e) => setGuests({...guests, children: parseInt(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 text-white p-3">
                          {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 mb-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm text-gray-200 mb-2">Rental Pricing Scheme</label>
                          <select 
                            value={hallBookingType} 
                            onChange={(e) => setHallBookingType(e.target.value)} 
                            className="w-full bg-dark-900 border border-dark-700 text-white p-3.5 cursor-pointer outline-none focus:border-gold-500"
                          >
                            <option value="daily">Daily Rental</option>
                            <option value="hourly">Hourly Rental</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-200 mb-2">Expected Participants (Pax)</label>
                          <input 
                            type="number" 
                            min="1"
                            value={hallParticipants} 
                            onChange={(e) => setHallParticipants(Math.max(1, parseInt(e.target.value) || 1))} 
                            className="w-full bg-dark-900 border border-dark-700 text-white p-3 outline-none focus:border-gold-500"
                          />
                        </div>
                      </div>

                      {hallBookingType === 'hourly' && (
                        <div className="grid grid-cols-2 gap-6 pt-2">
                          <div>
                            <label className="block text-xs text-gray-200 mb-1">Start Time</label>
                            <input 
                              type="time" 
                              value={hallStartTime} 
                              onChange={(e) => setHallStartTime(e.target.value)} 
                              className="w-full bg-dark-900 border border-dark-700 text-white p-3.5 outline-none focus:border-gold-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-200 mb-1">End Time</label>
                            <input 
                              type="time" 
                              value={hallEndTime} 
                              onChange={(e) => setHallEndTime(e.target.value)} 
                              className="w-full bg-dark-900 border border-dark-700 text-white p-3.5 outline-none focus:border-gold-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button 
                    onClick={bookingMode === 'hall' ? fetchAvailableHalls : fetchAvailableRooms} 
                    disabled={loading} 
                    className="btn-primary w-full py-4 text-lg"
                  >
                    {loading ? 'Searching...' : 'Check Availability'}
                  </button>
                </div>
              )}

              {/* STEP 2: Select Room or Hall */}
              {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  {bookingMode === 'room' ? (
                    <>
                      <h3 className="text-2xl font-medium mb-6">Available Suites for Your Dates</h3>
                      {availableRooms.length === 0 ? (
                        <div className="bg-dark-800 border border-dark-700 p-8 text-center text-gray-200">
                          No rooms available for the selected dates and capacity. Please adjust your search.
                        </div>
                      ) : (
                        availableRooms.map(room => (
                          <div key={room.id} className={`bg-dark-800 border transition-all duration-300 flex flex-col md:flex-row ${selectedRoom?.id === room.id ? 'border-gold-500 shadow-lg shadow-gold-500/10' : 'border-dark-700 hover:border-gray-500'}`}>
                            <img src={room.image_url} alt={room.name} className="w-full md:w-1/3 h-48 md:h-auto object-cover" />
                            <div className="p-6 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="text-xl font-medium text-white">{room.name}</h4>
                                  <span className="text-brand-500 font-bold text-lg">₦{(calculateRoomPriceDetails(room).totalRoomPrice / totalNights).toLocaleString()}<span className="text-sm font-normal text-gray-200">/avg night</span></span>
                                </div>
                                <div className="flex space-x-4 text-sm text-gray-200 mb-4">
                                  <span className="flex items-center"><Users size={16} className="mr-1"/> Up to {room.capacity}</span>
                                  <span>{room.size_sqm} sqm</span>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {room.amenities.map((am, i) => (
                                    <span key={i} className="text-xs border border-dark-700 px-2 py-1 rounded bg-dark-900 text-gray-300">{am}</span>
                                  ))}
                                </div>
                              </div>
                              {room.isBooked ? (
                                <button disabled className="w-full py-3 font-medium transition-colors bg-dark-700 text-gray-300 border border-dark-600 cursor-not-allowed">
                                  {!room.isClean ? 'Awaiting Housekeeping Inspection' : 'Unavailable for Selected Dates'}
                                </button>
                              ) : (
                                <button onClick={() => { setSelectedRoom(room); setStep(3); }} className={`w-full py-3 font-medium transition-colors ${selectedRoom?.id === room.id ? 'bg-gold-500 !text-white' : 'border border-gold-500 text-gold-500 hover:bg-gold-500 hover:!text-white'}`}>
                                  {selectedRoom?.id === room.id ? 'Selected' : 'Select Room'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-medium mb-6">Available Event Halls for Your Dates</h3>
                      {availableHalls.length === 0 ? (
                        <div className="bg-dark-800 border border-dark-700 p-8 text-center text-gray-200">
                          No event halls available for the selected dates, time, and participant capacity.
                        </div>
                      ) : (
                        availableHalls.map(hall => (
                          <div key={hall.id} className={`bg-dark-800 border transition-all duration-300 flex flex-col md:flex-row ${selectedHall?.id === hall.id ? 'border-gold-500 shadow-lg shadow-gold-500/10' : 'border-dark-700 hover:border-gray-500'}`}>
                            <div className="p-6 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="text-xl font-bold text-white">{hall.name}</h4>
                                  <span className="text-gold-500 font-extrabold text-lg">
                                    {hallBookingType === 'daily' 
                                      ? `₦${Number(hall.base_price_ngn).toLocaleString()}/day`
                                      : `₦${Number(hall.hourly_price_ngn).toLocaleString()}/hour`
                                    }
                                  </span>
                                </div>
                                <p className="text-gray-200 text-sm mt-1 mb-4 leading-relaxed">{hall.description || 'Spacious event hall for all occasions.'}</p>
                                <div className="flex space-x-6 text-sm text-gray-200 mb-4">
                                  <span className="flex items-center"><Users size={16} className="mr-1.5 text-gold-500"/> Capacity: Up to {hall.capacity} guests</span>
                                  <span>Size: {hall.size_sqm} sqm</span>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {hall.amenities?.map((am, i) => (
                                    <span key={i} className="text-xs border border-dark-700 px-2 py-1 rounded bg-dark-900 text-gray-300 font-medium">{am}</span>
                                  ))}
                                </div>
                              </div>
                              <button onClick={() => { setSelectedHall(hall); setStep(3); }} className={`w-full py-3 font-semibold transition-all ${selectedHall?.id === hall.id ? 'bg-gold-500 !text-white' : 'border border-gold-500 text-gold-500 hover:bg-gold-500 hover:!text-white'}`}>
                                {selectedHall?.id === hall.id ? 'Selected' : 'Select Hall'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                  <button onClick={() => setStep(1)} className="text-gray-200 hover:text-white text-sm mt-4 block">← Back to Search</button>
                </div>
              )}

              {/* STEP 3: Guest Details or Catering Packages */}
              {step === 3 && (
                <div className="bg-dark-800 p-8 border border-dark-700 animate-in fade-in slide-in-from-bottom-4">
                  {bookingMode === 'room' ? (
                    <>
                      <h3 className="text-2xl font-medium mb-6">Guest Details</h3>
                      
                      {/* Rate Plans Selection added to Step 3 */}
                      <div className="mb-10 pb-10 border-b border-dark-700">
                        <h4 className="text-lg font-medium mb-4 text-gray-300">Select a Rate Plan</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {ratePlans.map(plan => (
                            <div key={plan.id} onClick={() => setSelectedRatePlan(plan)} className={`p-4 border cursor-pointer transition-colors relative ${selectedRatePlan?.id === plan.id ? 'border-gold-500 bg-gold-500/5' : 'border-dark-700 hover:border-gray-500'}`}>
                              {selectedRatePlan?.id === plan.id && <div className="absolute top-4 right-4 text-gold-500"><CheckCircle size={20}/></div>}
                              <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                                {plan.type === 'non_refundable' ? <Tag size={16} className="text-red-400"/> : <ShieldCheck size={16} className="text-green-400"/>}
                                {plan.name}
                              </h4>
                              <p className="text-xs text-brand-400 font-medium mt-2">{plan.cancellation_policy}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {user && (
                        <div className="mb-6 p-4 bg-dark-900/60 border border-dark-700 rounded-xl flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="bookForSomeoneElse" 
                            checked={bookingForSomeoneElse} 
                            onChange={e => {
                              setBookingForSomeoneElse(e.target.checked);
                              if (!e.target.checked) {
                                setGuestForm(prev => ({
                                  ...prev,
                                  firstName: user.first_name || '',
                                  lastName: user.last_name || '',
                                  email: user.email || '',
                                  phone: user.phone || ''
                                }));
                              } else {
                                setGuestForm(prev => ({
                                  ...prev,
                                  firstName: '',
                                  lastName: '',
                                  email: '',
                                  phone: ''
                                }));
                              }
                            }}
                            className="w-5 h-5 accent-gold-500 rounded cursor-pointer"
                          />
                          <label htmlFor="bookForSomeoneElse" className="text-sm font-bold text-gray-300 cursor-pointer">
                            I am booking for someone else
                          </label>
                        </div>
                      )}

                      <form className="space-y-6">
                        {user && !bookingForSomeoneElse ? (
                          <div className="bg-dark-900/40 p-6 rounded-2xl border border-dark-700 space-y-4 mb-6 text-left">
                            <h4 className="text-xs font-bold text-gold-500 uppercase tracking-widest">Booking Guest Profile</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="block text-gray-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Name</span>
                                <span className="font-bold text-white text-base">{user.first_name} {user.last_name}</span>
                              </div>
                              <div>
                                <span className="block text-gray-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Role / Access</span>
                                <span className="font-bold text-gold-500 text-base capitalize">{user.role?.replace(/_/g, ' ') || 'Guest'}</span>
                              </div>
                              <div>
                                <span className="block text-gray-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Email Address</span>
                                <span className="font-mono text-white text-base">{user.email}</span>
                              </div>
                              <div>
                                <span className="block text-gray-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Phone Number</span>
                                <span className="font-mono text-white text-base">{user.phone || 'Not Provided'}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <label className="block text-sm text-gray-200 mb-2">First Name *</label>
                                <input type="text" value={guestForm.firstName} onChange={e => setGuestForm({...guestForm, firstName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" required/>
                              </div>
                              <div>
                                <label className="block text-sm text-gray-200 mb-2">Last Name *</label>
                                <input type="text" value={guestForm.lastName} onChange={e => setGuestForm({...guestForm, lastName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" required/>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-200 mb-2">Email Address *</label>
                              <input type="email" value={guestForm.email} onChange={e => setGuestForm({...guestForm, email: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" required/>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-200 mb-2">Phone Number *</label>
                              <input type="tel" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" required/>
                            </div>
                          </>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm text-gray-200 mb-2">Special Requests (Optional)</label>
                            <textarea rows="3" value={guestForm.specialRequests} onChange={e => setGuestForm({...guestForm, specialRequests: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none"></textarea>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-200 mb-2">Purpose of Stay *</label>
                            <select value={guestForm.purpose || 'Leisure'} onChange={e => setGuestForm({...guestForm, purpose: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3.5 focus:border-gold-500 outline-none cursor-pointer">
                              {Object.keys(purposeAdjustments).map(purpose => {
                                const valObj = purposeAdjustments[purpose];
                                let label = purpose;
                                if (valObj && typeof valObj === 'object') {
                                  if (valObj.type === 'percentage') {
                                    const sign = valObj.value >= 0 ? '+' : '';
                                    label = `${purpose} (${sign}${valObj.value}%)`;
                                  } else {
                                    const sign = valObj.value >= 0 ? '+' : '-';
                                    label = `${purpose} (${sign}₦${Math.abs(valObj.value).toLocaleString()})`;
                                  }
                                } else if (valObj !== undefined) {
                                  const sign = valObj >= 0 ? '+' : '';
                                  label = `${purpose} (${sign}${valObj}%)`;
                                }
                                return (
                                  <option key={purpose} value={purpose}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                            <p className="text-xs text-gray-200 mt-2">
                              💡 Note: Purpose of stay dynamically recalculates room pricing details.
                            </p>
                          </div>
                        </div>
                      </form>
                      <div className="flex justify-between items-center mt-8 pt-6 border-t border-dark-700">
                        <button onClick={() => setStep(2)} className="text-gray-200 hover:text-white">← Back to Rooms</button>
                        <button onClick={() => {
                          if (!guestForm.firstName || !guestForm.lastName || !guestForm.email || !guestForm.phone) {
                            return toast.error("Please fill all required guest fields before continuing.");
                          }
                          setStep(4);
                        }} className="btn-primary px-8 py-3">Continue to Services</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-medium mb-2">Meals & Catering Packages</h3>
                      <p className="text-gray-200 mb-8">Select separate culinary combinations to be served daily for the event participants.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {hallMealOptions.map(option => {
                          const isSelected = selectedHallMeals.includes(option.id);
                          return (
                            <div 
                              key={option.id} 
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedHallMeals(selectedHallMeals.filter(id => id !== option.id));
                                } else {
                                  setSelectedHallMeals([...selectedHallMeals, option.id]);
                                }
                              }} 
                              className={`p-6 border rounded-xl cursor-pointer transition-all ${isSelected ? 'border-gold-500 bg-gold-500/5' : 'border-dark-700 bg-dark-900/40 hover:border-gray-500'}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-bold text-white text-lg">{option.name}</h4>
                                  <p className="text-xs text-gold-500 uppercase tracking-wider font-semibold mt-0.5">{option.course_type}</p>
                                </div>
                                <div className={`w-6 h-6 border rounded-full flex items-center justify-center ${isSelected ? 'bg-gold-500 border-gold-500 text-dark-900' : 'border-dark-600 bg-dark-900'}`}>
                                  {isSelected && <CheckCircle size={14}/>}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 my-3">
                                {option.combination_items?.map((item, idx) => (
                                  <span key={idx} className="text-xs bg-dark-900 border border-dark-700 px-2 py-0.5 rounded text-gray-300">{item}</span>
                                ))}
                              </div>
                              <div className="font-bold text-base text-white">
                                ₦{Number(option.price_per_participant_ngn).toLocaleString()} <span className="text-xs text-gray-200 font-normal">per participant / day</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-between items-center mt-8 pt-6 border-t border-dark-700">
                        <button onClick={() => setStep(2)} className="text-gray-200 hover:text-white">← Back to Halls</button>
                        <button onClick={() => setStep(4)} className="btn-primary px-8 py-3">Continue to Details</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 4: Services & Checkout */}
              {step === 4 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                  
                  {bookingErrorMsg && (
                    <div className="bg-red-500 text-white p-6 rounded-lg font-bold text-lg mb-6 shadow-xl border-2 border-red-700">
                      🚨 URGENT ERROR: {bookingErrorMsg}
                      <p className="text-sm font-normal mt-2">Please report this error to the system administrator. Your payment was successful but the database could not be updated.</p>
                    </div>
                  )}

                  {bookingMode === 'hall' && (
                    <div className="bg-dark-800 p-8 border border-dark-700">
                      <h3 className="text-2xl font-medium mb-6">Guest & Organization Details</h3>
                      
                      {user && (
                        <div className="mb-6 p-4 bg-dark-900/60 border border-dark-700 rounded-xl flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="bookForSomeoneElse" 
                            checked={bookingForSomeoneElse} 
                            onChange={e => {
                              setBookingForSomeoneElse(e.target.checked);
                              if (!e.target.checked) {
                                setGuestForm(prev => ({
                                  ...prev,
                                  firstName: user.first_name || '',
                                  lastName: user.last_name || '',
                                  email: user.email || '',
                                  phone: user.phone || ''
                                }));
                              } else {
                                setGuestForm(prev => ({
                                  ...prev,
                                  firstName: '',
                                  lastName: '',
                                  email: '',
                                  phone: '',
                                  organizationName: ''
                                }));
                              }
                            }}
                            className="w-5 h-5 accent-gold-500 rounded cursor-pointer"
                          />
                          <label htmlFor="bookForSomeoneElse" className="text-sm font-bold text-gray-300 cursor-pointer">
                            I am booking for an organization / someone else
                          </label>
                        </div>
                      )}

                      <form className="space-y-6">
                        {user && !bookingForSomeoneElse ? (
                          <div className="bg-dark-900/40 p-6 rounded-2xl border border-dark-700 space-y-4 mb-6 text-left">
                            <h4 className="text-xs font-bold text-gold-500 uppercase tracking-widest">Booking Guest Profile</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="block text-gray-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Name</span>
                                <span className="font-bold text-white text-base">{user.first_name} {user.last_name}</span>
                              </div>
                              <div>
                                <span className="block text-gray-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Role / Access</span>
                                <span className="font-bold text-gold-500 text-base capitalize">{user.role?.replace(/_/g, ' ') || 'Guest'}</span>
                              </div>
                              <div>
                                <span className="block text-gray-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Email Address</span>
                                <span className="font-mono text-white text-base">{user.email}</span>
                              </div>
                              <div>
                                <span className="block text-gray-300 text-[10px] uppercase font-bold tracking-widest mb-0.5">Phone Number</span>
                                <span className="font-mono text-white text-base">{user.phone || 'Not Provided'}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <label className="block text-sm text-gray-200 mb-2">First Name *</label>
                                <input type="text" value={guestForm.firstName} onChange={e => setGuestForm({...guestForm, firstName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" required/>
                              </div>
                              <div>
                                <label className="block text-sm text-gray-200 mb-2">Last Name *</label>
                                <input type="text" value={guestForm.lastName} onChange={e => setGuestForm({...guestForm, lastName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" required/>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-200 mb-2">Email Address *</label>
                              <input type="email" value={guestForm.email} onChange={e => setGuestForm({...guestForm, email: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" required/>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-200 mb-2">Phone Number *</label>
                              <input type="tel" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" required/>
                            </div>
                          </>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm text-gray-200 mb-2">Organization / Company Name (Optional)</label>
                            <input type="text" value={guestForm.organizationName} onChange={e => setGuestForm({...guestForm, organizationName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" placeholder="e.g. Acme Corp" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-200 mb-2">Special Event Requirements (Optional)</label>
                            <textarea rows="2" value={guestForm.specialRequests} onChange={e => setGuestForm({...guestForm, specialRequests: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none" placeholder="e.g. Stage setup, extra mic..."></textarea>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {bookingMode === 'room' && (
                    <div className="bg-dark-800 p-8 border border-dark-700">
                      <h3 className="text-2xl font-medium mb-2">Enhance Your Stay</h3>
                      <p className="text-gray-200 mb-8">Select optional services to make your stay unforgettable.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {services.map(service => {
                          const isSelected = selectedServices.some(s => s.service_id === service.id);
                          const sData = selectedServices.find(s => s.service_id === service.id);
                          
                          return (
                            <div key={service.id} className={`p-6 border rounded-xl transition-all cursor-pointer ${isSelected ? 'border-gold-500 bg-gold-500/5' : 'border-dark-700 bg-dark-800 hover:border-gray-500'}`} onClick={(e) => {
                              if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'svg' && e.target.tagName !== 'path') {
                                toggleService(service);
                              }
                            }}>
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 border rounded-lg flex items-center justify-center ${isSelected ? 'bg-gold-500 text-dark-900 border-gold-500' : 'bg-dark-900 border-dark-700 text-brand-500'}`}>
                                    {iconMap[service.icon_name] || <Package size={20}/>}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-white text-lg">{service.name}</h4>
                                    <p className="text-xs text-brand-400 uppercase tracking-wide">{service.pricing_type ? service.pricing_type.replace(/_/g, ' ') : 'Per Request'}</p>
                                  </div>
                                </div>
                                <div className={`w-6 h-6 border rounded-full flex items-center justify-center ${isSelected ? 'bg-gold-500 border-gold-500 text-dark-900' : 'border-dark-600 bg-dark-900'}`}>
                                  {isSelected && <CheckCircle size={14}/>}
                                </div>
                              </div>
                              <p className="text-sm text-gray-200 mb-4 line-clamp-2">{service.description}</p>
                              <div className="font-bold text-lg text-white mb-4">₦{Number(service.base_price_ngn).toLocaleString()}</div>

                              {isSelected && (
                                <div className="space-y-3 pt-4 border-t border-dark-700" onClick={e => e.stopPropagation()}>
                                  {service.quantity_selector && (
                                    <div className="flex items-center justify-between bg-dark-900 p-3 rounded-lg border border-dark-700">
                                      <span className="text-sm text-gray-200">Quantity</span>
                                      <div className="flex items-center gap-4">
                                        <button type="button" onClick={() => updateServiceProp(service.id, 'quantity', Math.max(1, sData.quantity - 1))} className="p-1 hover:text-brand-500 transition-colors"><Minus size={16}/></button>
                                        <span className="font-medium w-4 text-center">{sData.quantity}</span>
                                        <button type="button" onClick={() => updateServiceProp(service.id, 'quantity', sData.quantity + 1)} className="p-1 hover:text-brand-500 transition-colors"><Plus size={16}/></button>
                                      </div>
                                    </div>
                                  )}
                                  {service.scheduling_required && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="flex flex-col">
                                        <label className="text-xs text-gray-300 mb-1">Date</label>
                                        <input type="date" value={sData.date} min={format(dateRange[0].startDate, 'yyyy-MM-dd')} max={format(dateRange[0].endDate, 'yyyy-MM-dd')} onChange={(e) => updateServiceProp(service.id, 'date', e.target.value)} className="bg-dark-900 border border-dark-700 rounded p-2 text-sm text-white focus:border-brand-500 outline-none" />
                                      </div>
                                      <div className="flex flex-col">
                                        <label className="text-xs text-gray-300 mb-1">Time</label>
                                        <input type="time" value={sData.time} onChange={(e) => updateServiceProp(service.id, 'time', e.target.value)} className="bg-dark-900 border border-dark-700 rounded p-2 text-sm text-white focus:border-brand-500 outline-none" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Meals & Drinks Group Card */}
                        <div className={`p-6 border rounded-xl transition-all md:col-span-2 ${isMealsDrinksOpen ? 'border-gold-500 bg-gold-500/5' : 'border-dark-700 bg-dark-800 hover:border-gray-500'}`}>
                          <div className="flex justify-between items-start mb-4 cursor-pointer" onClick={() => setIsMealsDrinksOpen(!isMealsDrinksOpen)}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 border rounded-lg flex items-center justify-center ${isMealsDrinksOpen ? 'bg-gold-500 text-dark-900 border-gold-500' : 'bg-dark-900 border-dark-700 text-brand-500'}`}>
                                <Coffee size={20} />
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-lg">Meals & Drinks</h4>
                                <p className="text-xs text-brand-400 uppercase tracking-wide">Select meals, dessert, or drinks</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold bg-gold-500/10 text-gold-500 px-3 py-1.5 rounded border border-gold-500/20">
                              {isMealsDrinksOpen ? 'Hide Menu' : 'Show Menu'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-200 mb-4">Choose from our curated culinary options, including standard breakfast, hot main courses, fresh desserts, and premium bar drinks.</p>
                          
                          {isMealsDrinksOpen && (
                            <div className="mt-6 pt-6 border-t border-dark-700 space-y-6">
                              {/* Submenu Tabs */}
                              <div className="flex border-b border-dark-700 pb-3 overflow-x-auto gap-2 scrollbar-thin">
                                {['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Appetizers', 'Drinks'].map(tab => {
                                  const count = getItemsForSubmenu(tab, foodServices).length;
                                  return (
                                    <button
                                      key={tab}
                                      type="button"
                                      onClick={() => setActiveSubmenu(tab)}
                                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${activeSubmenu === tab ? 'bg-gold-500 text-dark-900' : 'bg-dark-900 text-gray-200 hover:text-white'}`}
                                    >
                                      {tab} ({count})
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Submenu Items Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-350">
                                {getItemsForSubmenu(activeSubmenu, foodServices).length === 0 ? (
                                  <p className="text-sm text-gray-300 italic col-span-2">No items available in this category</p>
                                ) : (
                                  getItemsForSubmenu(activeSubmenu, foodServices).map(item => {
                                    const isSelected = selectedServices.some(s => s.service_id === item.id);
                                    const sData = selectedServices.find(s => s.service_id === item.id);
                                    return (
                                      <div 
                                        key={item.id}
                                        onClick={() => toggleService(item)}
                                        className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col justify-between ${isSelected ? 'border-gold-500 bg-gold-500/5' : 'border-dark-700 hover:border-gray-500 bg-dark-900/40'}`}
                                      >
                                        <div>
                                          <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2.5">
                                              <div className={`w-5 h-5 border rounded-full flex items-center justify-center ${isSelected ? 'bg-gold-500 border-gold-500 text-dark-900' : 'border-dark-600 bg-dark-900'}`}>
                                                {isSelected && <CheckCircle size={12}/>}
                                              </div>
                                              <h5 className="font-bold text-white text-sm">{item.name}</h5>
                                            </div>
                                            <span className="text-sm font-bold text-white">₦{Number(item.base_price_ngn).toLocaleString()}</span>
                                          </div>
                                          {item.description && (
                                            <p className="text-xs text-gray-200 mb-3 ml-7 line-clamp-2">
                                              {item.description.includes(' | ') ? item.description.split(' | ').slice(1).join(' | ') : item.description}
                                            </p>
                                          )}
                                        </div>
                                        
                                        {isSelected && (
                                          <div className="flex items-center justify-between bg-dark-900 p-2.5 rounded-lg border border-dark-800 ml-7" onClick={e => e.stopPropagation()}>
                                            <span className="text-xs text-gray-200 font-medium">Quantity</span>
                                            <div className="flex items-center gap-3">
                                              <button type="button" onClick={() => updateServiceProp(item.id, 'quantity', Math.max(1, sData.quantity - 1))} className="p-1 hover:text-brand-500 transition-colors"><Minus size={14}/></button>
                                              <span className="text-xs font-semibold w-4 text-center">{sData.quantity}</span>
                                              <button type="button" onClick={() => updateServiceProp(item.id, 'quantity', sData.quantity + 1)} className="p-1 hover:text-brand-500 transition-colors"><Plus size={14}/></button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-dark-800 p-8 border border-dark-700">
                    <h3 className="text-2xl font-medium mb-6">Complete Checkout</h3>
                    
                    {bookingMode === 'room' && (
                      <div className="mb-8">
                        <h4 className="font-medium text-lg mb-4">Have a Promo Code?</h4>
                        <div className="flex gap-2">
                          <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} disabled={!!appliedCoupon} className="flex-1 bg-dark-900 border border-dark-700 text-white p-3 focus:border-gold-500 outline-none uppercase" placeholder="Enter code" />
                          {!appliedCoupon ? (
                            <button type="button" onClick={applyCoupon} className="bg-dark-700 hover:bg-dark-600 text-white px-6 font-medium transition-colors">Apply</button>
                          ) : (
                            <button type="button" onClick={removeCoupon} className="bg-red-500/20 text-red-500 hover:bg-red-500/30 px-6 font-medium transition-colors">Remove</button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 border-t border-dark-700 pt-6 animate-in fade-in duration-200">
                      <h3 className="text-xl font-medium mb-4 text-white">Payment Options</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-colors ${paymentMethod === 'pay_online' ? 'border-gold-500 bg-gold-500/10' : 'border-dark-700 hover:border-gray-500'}`}>
                          <input type="radio" name="paymentMethod" value="pay_online" checked={paymentMethod === 'pay_online'} onChange={() => setPaymentMethod('pay_online')} className="accent-gold-500 w-4 h-4"/>
                          <div>
                            <p className="font-bold text-white">
                              {bookingMode === 'room' && bookingRules.payment_rule === 'partial_deposit' 
                                ? `Pay Confirmation Deposit (${bookingRules.deposit_percentage}%) via Paystack` 
                                : 'Pay Online Now (Paystack)'}
                            </p>
                            <p className="text-xs text-gray-200">
                              {bookingMode === 'room' && bookingRules.payment_rule === 'partial_deposit'
                                ? `Pay ₦${payOnlineAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} confirmation deposit via Paystack`
                                : 'Secure card payment via Paystack'}
                            </p>
                          </div>
                        </label>

                        {((bookingMode === 'room' && bookingRules.payment_rule !== 'full_amount' && bookingRules.payment_rule !== 'partial_deposit') || bookingMode === 'hall') && (
                          <label className={`p-4 border rounded-xl cursor-pointer flex items-center gap-3 transition-colors ${paymentMethod === 'pay_on_arrival' ? 'border-gold-500 bg-gold-500/10' : 'border-dark-700 hover:border-gray-500'}`}>
                            <input type="radio" name="paymentMethod" value="pay_on_arrival" checked={paymentMethod === 'pay_on_arrival'} onChange={() => setPaymentMethod('pay_on_arrival')} className="accent-gold-500 w-4 h-4"/>
                            <div>
                              <p className="font-bold text-white">Pay on Arrival</p>
                              <p className="text-xs text-gray-200">Pay at the front office on check-in</p>
                            </div>
                          </label>
                        )}

                        {arAccount && (
                          <>
                            {bookingMode === 'room' && (
                              <>
                                {/* Option 1: 30% Deposit from AR account */}
                                {(() => {
                                  const hasSufficient = arAccount.balance >= payOnlineAmount;
                                  return (
                                    <label className={`p-4 border rounded-xl flex items-center gap-3 transition-colors ${
                                      !hasSufficient 
                                        ? 'opacity-40 cursor-not-allowed border-dark-750 bg-dark-950/20' 
                                        : paymentMethod === 'pay_ar_deposit' 
                                          ? 'border-gold-500 bg-gold-500/10 cursor-pointer' 
                                          : 'border-dark-700 hover:border-gray-500 cursor-pointer'
                                    }`}>
                                      <input 
                                        type="radio" 
                                        name="paymentMethod" 
                                        value="pay_ar_deposit" 
                                        disabled={!hasSufficient}
                                        checked={paymentMethod === 'pay_ar_deposit'} 
                                        onChange={() => setPaymentMethod('pay_ar_deposit')} 
                                        className="accent-gold-500 w-4 h-4"
                                      />
                                      <div>
                                        <p className="font-bold text-white">Pay 30% Deposit from AR Wallet</p>
                                        <p className="text-xs text-gray-200">
                                          Deduct ₦{payOnlineAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} from wallet (Bal: ₦{Number(arAccount.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                                        </p>
                                        {!hasSufficient && <span className="text-[10px] text-red-500 font-bold block mt-1">⚠️ Insufficient Wallet Balance</span>}
                                      </div>
                                    </label>
                                  );
                                })()}
                              </>
                            )}

                            {/* Option 2: Pay in Full from AR account */}
                            {(() => {
                              const hasSufficient = arAccount.balance >= calculateTotal();
                              return (
                                <label className={`p-4 border rounded-xl flex items-center gap-3 transition-colors ${
                                  !hasSufficient 
                                    ? 'opacity-40 cursor-not-allowed border-dark-750 bg-dark-950/20' 
                                    : paymentMethod === 'pay_ar_full' 
                                      ? 'border-gold-500 bg-gold-500/10 cursor-pointer' 
                                      : 'border-dark-700 hover:border-gray-500 cursor-pointer'
                                }`}>
                                  <input 
                                    type="radio" 
                                    name="paymentMethod" 
                                    value="pay_ar_full" 
                                    disabled={!hasSufficient}
                                    checked={paymentMethod === 'pay_ar_full'} 
                                    onChange={() => setPaymentMethod('pay_ar_full')} 
                                    className="accent-gold-500 w-4 h-4"
                                  />
                                  <div>
                                    <p className="font-bold text-white">Pay in Full from AR Wallet</p>
                                    <p className="text-xs text-gray-200">
                                      Deduct ₦{calculateTotal().toLocaleString(undefined, { maximumFractionDigits: 0 })} from wallet (Bal: ₦{Number(arAccount.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                                    </p>
                                    {!hasSufficient && <span className="text-[10px] text-red-500 font-bold block mt-1">⚠️ Insufficient Wallet Balance</span>}
                                  </div>
                                </label>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-dark-700">
                      <button onClick={() => setStep(3)} className="text-gray-200 hover:text-white">← Back to {bookingMode === 'room' ? 'Details' : 'Catering'}</button>
                      <button onClick={bookingMode === 'hall' ? handleHallCheckout : handleCheckout} disabled={isProcessing} className="btn-primary py-4 px-12 text-lg disabled:opacity-50">
                        {isProcessing ? 'Processing...' : paymentMethod === 'pay_online' ? 'Pay Securely' : ['pay_ar_deposit', 'pay_ar_full'].includes(paymentMethod) ? 'Pay from AR Wallet' : 'Complete Booking'}
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* STEP 5: Success Page */}
              {step === 5 && (
                <div className="bg-dark-800 p-12 border border-dark-700 animate-in zoom-in-95 fade-in duration-300 text-center rounded-xl shadow-2xl">
                  <div className="w-24 h-24 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-gold-500/30">
                    <CheckCircle className="text-gold-500 w-12 h-12" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">Booking Confirmed!</h2>
                  <p className="text-gray-200 text-lg mb-8">Thank you, {guestForm.firstName}. Your reservation is complete.</p>
                  
                  {autoCreatedPassword && (
                    <div className="bg-gold-500/5 border border-gold-500/20 rounded-lg p-6 max-w-md mx-auto mb-8 text-left animate-in slide-in-from-bottom-2">
                      <h4 className="font-bold text-gold-500 mb-2 flex items-center gap-2">🔑 Guest Account Created Automatically!</h4>
                      <p className="text-xs text-gray-200 mb-4">We have registered a guest login using your booking details. Use these credentials to sign in to your Guest Dashboard:</p>
                      <div className="space-y-2 font-mono text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Username/Email:</span>
                          <span className="text-white font-bold">{guestForm.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Temporary Password:</span>
                          <span className="text-white font-bold">{autoCreatedPassword}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-300 mt-4 italic">💡 Note: For security, you can change your password anytime inside your profile settings.</p>
                    </div>
                  )}
                  
                  <div className="bg-dark-900 border border-dark-700 rounded-lg p-6 max-w-md mx-auto mb-8 text-left">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-dark-700">
                      <span className="text-gray-200">Booking Reference</span>
                      <span className="font-bold text-white text-lg tracking-wider">{confirmedBookingRef}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-200">Check-in</span>
                      <span className="font-medium text-white">{format(dateRange[0].startDate, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-200">Check-out</span>
                      <span className="font-medium text-white">{format(dateRange[0].endDate, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-dark-700">
                      <span className="text-gray-200">Total Paid</span>
                      <span className="font-bold text-gold-500">₦{calculateTotal().toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-8 max-w-lg mx-auto">
                    We've sent a confirmation email with your booking details. If you have any questions, please contact our support team.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center print:hidden">
                    <button 
                      onClick={() => window.print()} 
                      className="bg-gold-500 hover:bg-gold-600 text-dark-900 font-bold py-3 px-8 text-base flex items-center justify-center gap-2 rounded transition-colors"
                    >
                      <Printer size={18} /> Print Payment Receipt
                    </button>
                    <button 
                      onClick={() => {
                        setStep(1);
                        setGuestForm({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '', purpose: 'Leisure' });
                        setSelectedRoom(null);
                        setSelectedServices([]);
                        setAppliedCoupon(null);
                        setCouponCode('');
                        setConfirmedBookingRef(null);
                      }} 
                      className="border border-dark-600 hover:bg-dark-700 text-white font-medium py-3 px-8 text-base rounded transition-colors"
                    >
                      Book Another Room
                    </button>
                  </div>

                  {renderPrintReceipt()}
                </div>
              )}
            </div>

            {/* Sidebar Summary */}
            <div className={`lg:col-span-1 ${step === 5 ? 'hidden' : 'block'}`}>
              <div className="bg-dark-800 p-6 border border-dark-700 sticky top-24 rounded-xl shadow-lg">
                <h3 className="text-xl font-medium mb-6 border-b border-dark-700 pb-4">Reservation Summary</h3>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-200 mb-1">Check-in</p>
                  <p className="font-medium">{format(dateRange[0].startDate, 'MMM dd, yyyy')}</p>
                </div>
                <div className="mb-6">
                  <p className="text-sm text-gray-200 mb-1">Check-out</p>
                  <p className="font-medium">{format(dateRange[0].endDate, 'MMM dd, yyyy')}</p>
                </div>
                <div className="mb-6 flex justify-between border-b border-dark-700 pb-6">
                  <div>
                    <p className="text-sm text-gray-200 mb-1">Duration</p>
                    <p className="font-medium">
                      {bookingMode === 'hall'
                        ? hallBookingType === 'daily'
                          ? `${bookingSummary.days} ${bookingSummary.days === 1 ? 'Day' : 'Days'}`
                          : `${bookingSummary.hours} ${bookingSummary.hours === 1 ? 'Hour' : 'Hours'}`
                        : `${totalNights} Nights`
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-200 mb-1">{bookingMode === 'hall' ? 'Participants' : 'Guests'}</p>
                    <p className="font-medium">
                      {bookingMode === 'hall'
                        ? `${hallParticipants} Guests`
                        : `${totalGuests} Persons`
                      }
                    </p>
                  </div>
                </div>

                {bookingMode === 'room' && selectedRoom && (
                  <div className="mb-4">
                    <p className="text-brand-500 font-medium mb-2">{selectedRoom.name}</p>
                    <div className="flex justify-between text-sm text-gray-200 mb-1">
                      <span>Base Pricing ({selectedRoom.pricing_model ? selectedRoom.pricing_model.replace('_', ' ') : 'Per Night'})</span>
                    </div>
                    <div className="flex justify-between font-medium text-white mb-2">
                      <span>Room Total</span>
                      <span>₦{calculateRoomPriceDetails(selectedRoom).totalRoomPrice.toLocaleString()}</span>
                    </div>

                    {selectedRatePlan && selectedRatePlan.price_adjustment_percentage !== 0 && (
                      <div className="flex justify-between text-sm text-brand-400 mb-2">
                        <span>{selectedRatePlan.name}</span>
                        <span>{selectedRatePlan.price_adjustment_percentage > 0 ? '+' : ''}{selectedRatePlan.price_adjustment_percentage}%</span>
                      </div>
                    )}

                    {calculateRoomPriceDetails(selectedRoom).appliedRules.length > 0 && (
                      <div className="mt-2 text-xs text-brand-600 bg-brand-50/10 p-2 rounded border border-brand-500/20">
                        <p className="font-semibold mb-1">Rules Applied:</p>
                        {calculateRoomPriceDetails(selectedRoom).appliedRules.map((rule, idx) => (
                          <p key={idx}>• {rule.name} ({rule.adjustment_percentage}%)</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {bookingMode === 'hall' && selectedHall && (
                  <div className="mb-4">
                    <p className="text-gold-500 font-bold mb-2">{selectedHall.name}</p>
                    <div className="flex justify-between text-sm text-gray-200 mb-1">
                      <span>Hall Rental ({hallBookingType === 'daily' ? 'Daily' : 'Hourly'})</span>
                    </div>
                    <div className="flex justify-between font-medium text-white mb-2">
                      <span>Hall Total</span>
                      <span>₦{bookingSummary.hallPrice.toLocaleString()}</span>
                    </div>

                    {selectedHallMeals.length > 0 && (
                      <div className="mt-3 border-t border-dark-700 pt-3">
                        <p className="text-sm font-semibold text-gray-300 mb-2">Catering Packages:</p>
                        <div className="space-y-2">
                          {selectedHallMeals.map(mealId => {
                            const option = hallMealOptions.find(o => o.id === mealId);
                            if (!option) return null;
                            const optionCost = Number(option.price_per_participant_ngn) * Number(hallParticipants) * bookingSummary.days;
                            return (
                              <div key={mealId} className="flex justify-between text-xs text-gray-200">
                                <span>{option.name} (₦{Number(option.price_per_participant_ngn).toLocaleString()} x {hallParticipants} pax)</span>
                                <span>₦{optionCost.toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {bookingMode === 'room' && selectedServices.length > 0 && (
                  <div className="mb-6 border-t border-dark-700 pt-4">
                    <p className="text-sm font-medium mb-3 text-white">Services & Add-ons:</p>
                    <div className="space-y-3">
                       {(() => {
                        const allAvailableServices = [...services, ...foodServices];
                        return selectedServices.map(sData => {
                          const service = allAvailableServices.find(e => e.id === sData.service_id);
                          if (!service) return null;
                          const cost = getServicePrice(service, sData.quantity);
                          return (
                            <div key={sData.service_id} className="flex justify-between text-sm text-gray-200 items-start">
                              <div>
                                <span className="block text-gray-300">{service.name} {sData.quantity > 1 ? `(x${sData.quantity})` : ''}</span>
                                {sData.date && <span className="block text-xs text-brand-500">{sData.date} {sData.time}</span>}
                              </div>
                              <span className="font-medium">₦{cost.toLocaleString()}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {bookingMode === 'room' && appliedCoupon && (
                  <div className="mb-6 border-t border-dark-700 pt-4 flex justify-between text-green-400 font-medium">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>-{appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}%` : `₦${appliedCoupon.discount_value.toLocaleString()}`}</span>
                  </div>
                )}

                <div className="border-t border-dark-700 pt-4 mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-200">Taxes & Fees</span>
                    <span className="text-gray-300">Included</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-white">Grand Total</span>
                    <span className="text-xl font-bold text-gray-300">₦{calculateTotal().toLocaleString()}</span>
                  </div>
                  
                  {bookingMode === 'room' && bookingRules.payment_rule === 'partial_deposit' && (
                    <div className="mt-4 pt-4 border-t border-dashed border-dark-700 space-y-2 animate-in fade-in duration-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gold-400 font-bold">Required Confirmation Deposit ({bookingRules.deposit_percentage}%)</span>
                        <span className="text-lg font-black text-gold-500">
                          ₦{(calculateTotal() * (bookingRules.deposit_percentage / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-200 font-medium">
                        <span>Balance Due on Arrival</span>
                        <span className="font-mono">
                          ₦{(calculateTotal() * (1 - bookingRules.deposit_percentage / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 bg-dark-900/60 p-4 border border-dark-700/50 rounded-2xl text-xs space-y-2 text-gray-200 animate-in fade-in duration-300">
                  <strong className="text-white block font-semibold uppercase tracking-wider text-[10px]">Cancellation & Guarantee Policy</strong>
                  {bookingRules.cancellation_policy === 'Flexible' && (
                    <p>✓ **Flexible cancellation policy**: You can cancel free of charge until 24 hours prior to your scheduled check-in date. Cancellations within 24 hours are non-refundable.</p>
                  )}
                  {bookingRules.cancellation_policy === 'Moderate' && (
                    <p>✓ **Moderate cancellation policy**: Free cancellation is guaranteed up to 5 days before your check-in date. Late cancellations forfeit the reservation deposit.</p>
                  )}
                  {bookingRules.cancellation_policy === 'Strict' && (
                    <p>⚠ **Strict cancellation policy**: Reservations are non-refundable after 48 hours from booking. Late cancellations forfeit 100% of the calculated stay total.</p>
                  )}
                  {bookingRules.cancellation_policy === 'Non-Refundable' && (
                    <p>⚠ **Non-Refundable reservation**: Booking cannot be modified, cancelled, or refunded under any circumstances once processed.</p>
                  )}
                  <span className="block text-[10px] text-gray-300 font-semibold border-t border-dark-800 pt-2 mt-2">
                    Secured by Luxe Guarantee and automated 256-bit bank encryption.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingEngine;

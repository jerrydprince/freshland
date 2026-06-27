import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Plus, X, Package, CheckSquare, Square, Coffee } from 'lucide-react';
import { addDays, format, differenceInDays } from 'date-fns';
import { triggerAutomationRules } from '../../lib/emailService';

const getItemsForSubmenu = (submenu, allServices) => {
  return allServices.filter(s => {
    if (s.category !== 'Food & Beverage' && s.name?.toLowerCase() !== 'breakfast') return false;
    const name = (s.name || '').toLowerCase();
    
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

const ManualBookingModal = ({ isOpen, onClose, onSuccess, preselectedRoomId }) => {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [services, setServices] = useState([]);
  const [foodServices, setFoodServices] = useState([]);
  const [isMealsDrinksOpen, setIsMealsDrinksOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState('Breakfast');
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  
  // Group Booking States
  const [groupAccounts, setGroupAccounts] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [billToGroup, setBillToGroup] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', type: 'Company', contactName: '', contactEmail: '', contactPhone: '', credit_limit: 1000000.00 });

  // CRM Guests States for Rebooking
  const [crmGuests, setCrmGuests] = useState([]);
  const [arAccounts, setArAccounts] = useState([]);
  const [selectedCrmGuest, setSelectedCrmGuest] = useState(null);
  const [crmSearchQuery, setCrmSearchQuery] = useState('');

  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percentage'
  const [discountValue, setDiscountValue] = useState(0);
  const [purposeAdjustments, setPurposeAdjustments] = useState({
    Leisure: { type: 'percentage', value: 0 },
    Business: { type: 'percentage', value: -10 },
    Party: { type: 'percentage', value: 50 },
    Event: { type: 'percentage', value: 20 },
    Medical: { type: 'percentage', value: -15 },
    Other: { type: 'percentage', value: 0 }
  });

  const [newBooking, setNewBooking] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    roomId: '',
    bookingSource: 'walk_in',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash', // default method
    totalAmount: 0,
    baseRoomPrice: 0, // Keep track of base to help auto-calculate
    purpose: 'Leisure',
    specialRequests: ''
  });

  const [amountPaid, setAmountPaid] = useState(0);
  const [isCustomAmountPaid, setIsCustomAmountPaid] = useState(false);
  const [roomCostWithVat, setRoomCostWithVat] = useState(0);
  const [servicesCostWithVat, setServicesCostWithVat] = useState(0);

  useEffect(() => {
    if (newBooking.paymentStatus === 'paid') {
      setAmountPaid(newBooking.totalAmount);
      setIsCustomAmountPaid(false);
    } else if (newBooking.paymentStatus === 'unpaid') {
      setAmountPaid(0);
      setIsCustomAmountPaid(false);
    } else if (newBooking.paymentStatus === 'partial') {
      if (!isCustomAmountPaid) {
        setAmountPaid(Number((newBooking.totalAmount / 2).toFixed(2)));
      }
    }
  }, [newBooking.totalAmount, newBooking.paymentStatus, isCustomAmountPaid]);

  const handleAmountPaidChange = (e) => {
    const val = parseFloat(e.target.value) || 0;
    setAmountPaid(val);
    setIsCustomAmountPaid(true);
  };

  useEffect(() => {
    if (isOpen) {
      fetchServices();
      fetchPurposeAdjustments();
      fetchGroupAccounts();
      fetchCrmGuests();
      fetchARAccounts();
      if (preselectedRoomId) {
        setNewBooking(prev => ({ ...prev, roomId: preselectedRoomId }));
      }
    }
  }, [isOpen, preselectedRoomId]);

  const fetchARAccounts = async () => {
    try {
      const { data, error } = await supabase.from('ar_accounts').select('*');
      if (error) throw error;
      setArAccounts(data || []);
    } catch (e) {
      try {
        const { data: sysData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'ar_accounts').maybeSingle();
        if (sysData && sysData.setting_value) {
          const parsed = typeof sysData.setting_value === 'string' ? JSON.parse(sysData.setting_value) : sysData.setting_value;
          setArAccounts(parsed || []);
        } else {
          const local = localStorage.getItem('luxe_ar_accounts');
          setArAccounts(local ? JSON.parse(local) : []);
        }
      } catch (err) {
        setArAccounts([]);
      }
    }
  };

  const fetchCrmGuests = async () => {
    try {
      const { data } = await supabase.from('crm_guests').select('*').order('first_name');
      if (data) setCrmGuests(data);
    } catch (err) {
      console.warn("Failed to fetch CRM guests:", err);
    }
  };

  const handleCrmGuestSelect = (e) => {
    const guestId = e.target.value;
    if (!guestId) {
      handleClearSelectedCrmGuest();
      return;
    }
    const guest = crmGuests.find(g => g.id === guestId);
    if (guest) {
      setSelectedCrmGuest(guest);
      setNewBooking(prev => ({
        ...prev,
        firstName: guest.first_name || '',
        lastName: guest.last_name || '',
        email: guest.email || '',
        phone: guest.phone || ''
      }));
      toast.success(`Loaded CRM Guest: ${guest.first_name} ${guest.last_name}`);
    }
  };

  const handleClearSelectedCrmGuest = () => {
    setSelectedCrmGuest(null);
    setCrmSearchQuery('');
    setNewBooking(prev => ({
      ...prev,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      paymentMethod: 'cash'
    }));
  };

  const filteredCrmGuests = crmGuests.filter(g => {
    const fullName = `${g.first_name || ''} ${g.last_name || ''}`.toLowerCase();
    const email = (g.email || '').toLowerCase();
    const query = crmSearchQuery.toLowerCase().trim();
    return fullName.includes(query) || email.includes(query);
  });

  const fetchGroupAccounts = async () => {
    try {
      const { data } = await supabase.from('group_accounts').select('*').order('name');
      if (data) {
        let closedIds = [];
        let deactivatedIds = [];
        
        // Fetch closed group accounts
        try {
          const { data: settingsData } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'closed_group_accounts')
            .maybeSingle();
          if (settingsData && settingsData.setting_value) {
            closedIds = settingsData.setting_value;
          } else {
            const local = localStorage.getItem('closed_group_accounts');
            if (local) closedIds = JSON.parse(local);
          }
        } catch (err) {
          console.warn("Failed to fetch closed groups for billing block:", err);
          const local = localStorage.getItem('closed_group_accounts');
          if (local) closedIds = JSON.parse(local);
        }

        // Fetch deactivated group accounts
        try {
          const { data: settingsData } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'deactivated_group_accounts')
            .maybeSingle();
          if (settingsData && settingsData.setting_value) {
            deactivatedIds = settingsData.setting_value;
          } else {
            const local = localStorage.getItem('deactivated_group_accounts');
            if (local) deactivatedIds = JSON.parse(local);
          }
        } catch (err) {
          console.warn("Failed to fetch deactivated groups for billing block:", err);
          const local = localStorage.getItem('deactivated_group_accounts');
          if (local) deactivatedIds = JSON.parse(local);
        }
        
        const filteredGroups = data.filter(g => !closedIds.includes(g.id) && !deactivatedIds.includes(g.id));
        setGroupAccounts(filteredGroups);
      }
    } catch (err) {
      console.warn("Failed to fetch group accounts:", err);
    }
  };

  const handleQuickRegisterGroup = async () => {
    if (!newGroup.name.trim()) return toast.error("Group name is required");
    try {
      const { data, error } = await supabase
        .from('group_accounts')
        .insert([{
          name: newGroup.name.trim(),
          group_type: newGroup.type,
          contact_name: newGroup.contactName.trim(),
          contact_email: newGroup.contactEmail.toLowerCase().trim(),
          contact_phone: newGroup.contactPhone.trim(),
          credit_limit: Number(newGroup.credit_limit) || 1000000.00,
          outstanding_balance: 0.00
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      toast.success(`Group "${newGroup.name}" registered successfully!`);
      
      // Refresh list and select
      await fetchGroupAccounts();
      if (data) {
        setSelectedGroupId(data.id);
      }
      
      // Reset state and close
      setNewGroup({ name: '', type: 'Company', contactName: '', contactEmail: '', contactPhone: '', credit_limit: 1000000.00 });
      setIsAddingGroup(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to register group");
    }
  };

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    if (data) {
      const standard = data.filter(s => 
        s.category !== 'Food & Beverage' && s.name?.toLowerCase() !== 'breakfast' &&
        !['bar', 'restaurant', 'kitchen'].includes(s.internal_notes?.toLowerCase().trim() || '')
      );
      setServices(standard);

      const food = data.filter(s => 
        s.category === 'Food & Beverage' && s.internal_notes?.toLowerCase().trim() === 'restaurant'
      );
      setFoodServices(food);
    }
  };

  const fetchPurposeAdjustments = async () => {
    const { data } = await supabase.from('cms_pages').select('content').eq('slug', 'system_categories').maybeSingle();
    if (data?.content?.purpose_adjustments) {
      setPurposeAdjustments(data.content.purpose_adjustments);
    }
  };

  useEffect(() => {
    if (isOpen && newBooking.checkIn && newBooking.checkOut) {
      checkAvailability();
    }
  }, [newBooking.checkIn, newBooking.checkOut, isOpen]);

  const checkAvailability = async () => {
    const { data: rooms } = await supabase.from('rooms').select('id, name, room_number, base_price_ngn');
    if (!rooms) return setAvailableRooms([]);

    const { data: bookedRooms, error: queryError } = await supabase.rpc('get_booked_room_ids', {
      req_start_date: newBooking.checkIn,
      req_end_date: newBooking.checkOut
    });
      
    if (queryError) console.error('Availability check error:', queryError);

    // Fetch housekeeping tasks to verify cleanliness status
    const { data: tasks } = await supabase
      .from('housekeeping_tasks')
      .select('room_id, status, assigned_date')
      .order('assigned_date', { ascending: false });

    const latestTaskByRoom = {};
    if (tasks) {
      tasks.forEach(task => {
        if (!latestTaskByRoom[task.room_id]) {
          latestTaskByRoom[task.room_id] = task.status;
        }
      });
    }

    const bookedRoomIds = new Set((bookedRooms || []).map(b => typeof b === 'string' ? b : (b.booked_room_id || b.room_id || b.id || Object.values(b)[0])));
    
    // A room is only available if it is clean (latest status is 'inspected' or no tasks logged yet, or booking is in the future)
    const actuallyAvailable = rooms.filter(r => {
      const isBooked = bookedRoomIds.has(r.id);
      const taskStatus = latestTaskByRoom[r.id];
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const isClean = !taskStatus || taskStatus === 'inspected' || newBooking.checkIn > todayStr;
      return !isBooked && isClean;
    });

    setAvailableRooms(actuallyAvailable);

    if (newBooking.roomId && !actuallyAvailable.some(r => r.id === newBooking.roomId)) {
      setNewBooking(prev => ({ ...prev, roomId: '', baseRoomPrice: 0 }));
    }
  };

  // Auto-calculate prices when room, dates, purpose or services change
  useEffect(() => {
    if(!newBooking.roomId) return;
    
    const room = availableRooms.find(r => r.id === newBooking.roomId);
    if(room) {
      const start = new Date(newBooking.checkIn);
      const end = new Date(newBooking.checkOut);
      const nights = Math.max(1, differenceInDays(end, start));

      // Purpose of Stay Pricing Adjustment
      const adjustment = purposeAdjustments[newBooking.purpose];
      let roomTotal = Number(room.base_price_ngn) * nights;
      if (adjustment) {
        if (typeof adjustment === 'object' && adjustment !== null) {
          if (adjustment.type === 'percentage') {
            roomTotal *= (1 + (Number(adjustment.value) || 0) / 100);
          } else if (adjustment.type === 'amount') {
            roomTotal += (Number(adjustment.value) || 0);
          }
        } else {
          // Legacy numeric percentage fallback
          roomTotal *= (1 + (Number(adjustment) || 0) / 100);
        }
      }
      
      let servicesTotal = 0;
      const allAvailableServices = [...services, ...foodServices];
      selectedServices.forEach(sData => {
        const s = allAvailableServices.find(x => x.id === sData.service_id);
        if(s) {
          let cost = Number(s.base_price_ngn);
          const isBreakfast = s.name && s.name.toLowerCase().includes('breakfast');
          if (isBreakfast) {
            cost = cost * nights * sData.quantity;
          } else {
            if(s.pricing_type === 'per_person') cost *= sData.quantity;
            if(s.pricing_type === 'per_day' || s.pricing_type === 'per_night') cost *= nights;
            if(s.pricing_type === 'quantity_based' || s.pricing_type === 'time_based') cost *= sData.quantity;
            if(s.category === 'Food & Beverage' && s.pricing_type === 'fixed') cost *= sData.quantity;
          }
          servicesTotal += cost;
        }
      });
      
      let calculatedDiscount = 0;
      if (discountType === 'percentage') {
        calculatedDiscount = roomTotal * (Number(discountValue) / 100);
      } else {
        calculatedDiscount = Number(discountValue);
      }
      calculatedDiscount = Math.max(0, Math.min(roomTotal, calculatedDiscount));
      
      const subtotal = Math.max(0, (roomTotal - calculatedDiscount) + servicesTotal);
      const taxRate = 7.5;
      const vatAmount = subtotal * (taxRate / 100);
      const finalAmount = subtotal + vatAmount;
      
      const roomTotalNet = Math.max(0, roomTotal - calculatedDiscount);
      const roomVat = roomTotalNet * (taxRate / 100);
      const servicesVat = servicesTotal * (taxRate / 100);

      setRoomCostWithVat(roomTotalNet + roomVat);
      setServicesCostWithVat(servicesTotal + servicesVat);
      
      setNewBooking(prev => ({ 
        ...prev, 
        baseRoomPrice: roomTotal,
        totalAmount: finalAmount 
      }));
    }
  }, [newBooking.roomId, newBooking.checkIn, newBooking.checkOut, newBooking.purpose, selectedServices, availableRooms, services, foodServices, discountType, discountValue, purposeAdjustments]);

  const toggleService = (serviceId) => {
    const exists = selectedServices.find(s => s.service_id === serviceId);
    if(exists) {
      setSelectedServices(selectedServices.filter(s => s.service_id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, { service_id: serviceId, quantity: 1, date: newBooking.checkIn, time: '12:00' }]);
    }
  };

  const updateServiceQuantity = (e, serviceId, qty) => {
    e.stopPropagation();
    const val = parseInt(qty);
    if (val < 1 || isNaN(val)) return;
    setSelectedServices(selectedServices.map(s => s.service_id === serviceId ? { ...s, quantity: val } : s));
  };

  const updateServiceSchedule = (e, serviceId, field, val) => {
    e.stopPropagation();
    setSelectedServices(selectedServices.map(s => s.service_id === serviceId ? { ...s, [field]: val } : s));
  };

  const handleManualBooking = async (e) => {
    e.preventDefault();
    if (!newBooking.roomId) return toast.error("Please select a room");
    setLoading(true);

    try {
      // 0. Final double-booking check before inserting
      const { data: overlappingBookings, error: rpcError } = await supabase.rpc('get_booked_room_ids', {
        req_start_date: newBooking.checkIn,
        req_end_date: newBooking.checkOut
      });
      
      if (!rpcError && overlappingBookings) {
        const bookedRoomIds = new Set(overlappingBookings.map(b => typeof b === 'string' ? b : (b.booked_room_id || b.room_id || b.id || Object.values(b)[0])));
        if (bookedRoomIds.has(newBooking.roomId)) {
          setLoading(false);
          return toast.error("Double Booking Alert! This room has just been booked by another guest or staff member for these dates. Please re-check availability.");
        }
      }

      // 0b. AR Prepayment Wallet balance and status check
      const amountPaidVal = billToGroup ? 0 : (newBooking.paymentStatus === 'unpaid' ? 0 : amountPaid);

      if (!billToGroup && newBooking.paymentStatus === 'partial') {
        if (amountPaidVal <= 0) {
          setLoading(false);
          return toast.error("For partial payments, the amount paid must be greater than 0.");
        }
        if (amountPaidVal >= newBooking.totalAmount) {
          setLoading(false);
          return toast.error("For partial payments, the amount paid must be less than the total amount. Otherwise, choose Fully Paid.");
        }
      }

      if (!billToGroup && newBooking.paymentMethod === 'ar_wallet') {
        if (!selectedCrmGuest) {
          setLoading(false);
          return toast.error("Please select a registered CRM guest to use AR Prepayment Wallet.");
        }
        const walletBal = Number(selectedCrmGuest.wallet_balance || 0);
        if (walletBal < amountPaidVal) {
          setLoading(false);
          return toast.error(`Insufficient AR wallet balance! Required: ₦${amountPaidVal.toLocaleString()} (Available: ₦${walletBal.toLocaleString()})`);
        }
        const walletMatch = arAccounts.find(acc => acc.guest_id === selectedCrmGuest.id);
        if (walletMatch && walletMatch.status && walletMatch.status !== 'active') {
          setLoading(false);
          return toast.error(`Cannot charge payment: AR Prepayment Wallet is ${walletMatch.status}!`);
        }
      }

      // Calculate final actual subtotal from base room price and configured services
      const start = new Date(newBooking.checkIn);
      const end = new Date(newBooking.checkOut);
      const nights = Math.max(1, differenceInDays(end, start));

      const allAvailableServices = [...services, ...foodServices];
      const servicesSubtotal = selectedServices.reduce((total, sData) => {
        const s = allAvailableServices.find(x => x.id === sData.service_id);
        if (s) {
          let cost = Number(s.base_price_ngn);
          const isBreakfast = s.name && s.name.toLowerCase().includes('breakfast');
          if (isBreakfast) {
            cost = cost * nights * sData.quantity;
          } else {
            if(s.pricing_type === 'per_person') cost *= sData.quantity;
            if(s.pricing_type === 'per_day' || s.pricing_type === 'per_night') cost *= nights;
            if(s.pricing_type === 'quantity_based' || s.pricing_type === 'time_based') cost *= sData.quantity;
            if(s.category === 'Food & Beverage' && s.pricing_type === 'fixed') cost *= sData.quantity;
          }
          return total + cost;
        }
        return total;
      }, 0);

      let savedDiscountAmount = 0;
      if (discountType === 'percentage') {
        savedDiscountAmount = newBooking.baseRoomPrice * (Number(discountValue) / 100);
      } else {
        savedDiscountAmount = Number(discountValue);
      }
      savedDiscountAmount = Math.max(0, Math.min(newBooking.baseRoomPrice, savedDiscountAmount));

      // 1. Create Booking
      const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert([{
        guest_id: selectedCrmGuest ? selectedCrmGuest.profile_id : null,
        crm_guest_id: selectedCrmGuest ? selectedCrmGuest.id : null,
        guest_name: `${newBooking.firstName} ${newBooking.lastName}`.trim(),
        guest_email: newBooking.email.toLowerCase(),
        guest_phone: newBooking.phone,
        room_id: newBooking.roomId,
        check_in_date: newBooking.checkIn,
        check_out_date: newBooking.checkOut,
        total_room_price_ngn: newBooking.baseRoomPrice,
        total_extras_price_ngn: servicesSubtotal,
        total_amount_ngn: newBooking.totalAmount,
        amount_paid_ngn: amountPaidVal,
        status: (newBooking.paymentMethod === 'ar_wallet' && !billToGroup) ? 'confirmed' : 'pending',
        booking_source: billToGroup ? 'group' : newBooking.bookingSource,
        payment_status: billToGroup ? 'unpaid' : newBooking.paymentStatus,
        special_requests: newBooking.purpose 
          ? `[Purpose: ${newBooking.purpose}] ${newBooking.specialRequests || ''}`.trim()
          : (newBooking.specialRequests || 'Manual Booking via Admin Portal'),
        booking_reference: 'MAN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        discount_amount_ngn: savedDiscountAmount,
        group_account_id: selectedGroupId || null,
        bill_to_group: billToGroup
      }]).select().single();

      if (bookingError) throw bookingError;

      // 1b. Log Payment transaction inflow if paid/partial
      if (amountPaidVal > 0 && bookingData) {
        const { error: paymentError } = await supabase.from('payments').insert([{
          booking_id: bookingData.id,
          amount: amountPaidVal,
          method: newBooking.paymentMethod === 'ar_wallet' ? 'cash' : newBooking.paymentMethod,
          status: 'completed',
          notes: newBooking.paymentMethod === 'ar_wallet'
            ? `Manual booking payment recorded at reception via AR Prepayment Wallet`
            : `Manual booking payment recorded at reception via ${newBooking.paymentMethod.toUpperCase()}`,
          transaction_ref: `MAN-PAY-${newBooking.paymentMethod.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`
        }]);
        if (paymentError) {
          console.error('Failed to register payment inflow:', paymentError);
          toast.error("Booking created, but failed to log payment to ledger. Please check payment status manually.");
        }

        // Deduct from CRM guest's wallet if method is 'ar_wallet'!
        if (newBooking.paymentMethod === 'ar_wallet' && selectedCrmGuest) {
          const newWalletBalance = Number(selectedCrmGuest.wallet_balance) - amountPaidVal;
          const { error: walletError } = await supabase
            .from('crm_guests')
            .update({ wallet_balance: newWalletBalance })
            .eq('id', selectedCrmGuest.id);
          
          if (walletError) {
            console.error('Failed to deduct from AR Prepayment Wallet:', walletError);
            toast.error("Booking created, but failed to deduct balance from CRM Prepayment Wallet. Please check balance manually.");
          } else {
            toast.success(`Deducted ₦${amountPaidVal.toLocaleString()} from guest's AR Prepayment Wallet (New Balance: ₦${newWalletBalance.toLocaleString()})`);
          }
        }
      }

      // 2. Attach Services if any
      if(selectedServices.length > 0 && bookingData) {
        const allAvailableServices = [...services, ...foodServices];
        const insertPayload = selectedServices.map(sData => {
          const service = allAvailableServices.find(s => s.id === sData.service_id);
          const isBreakfast = service.name && service.name.toLowerCase().includes('breakfast');
          let unitCost = Number(service.base_price_ngn);
          if (isBreakfast) {
            unitCost = unitCost * nights;
          } else {
            if(service.pricing_type === 'per_day' || service.pricing_type === 'per_night') unitCost *= nights;
          }
          
          let totalPrice = (service.pricing_type === 'quantity_based' || service.pricing_type === 'time_based' || service.pricing_type === 'per_person' || isBreakfast) 
            ? unitCost * sData.quantity 
            : unitCost;

          if (service.category === 'Food & Beverage' && service.pricing_type === 'fixed') {
            totalPrice = unitCost * sData.quantity;
          }

          return {
            booking_id: bookingData.id,
            service_id: sData.service_id,
            quantity: sData.quantity,
            unit_price_ngn: unitCost,
            total_price_ngn: totalPrice,
            scheduled_date: sData.date || null,
            scheduled_time: sData.time || null,
            status: 'pending'
          };
        });
        await supabase.from('booking_services').insert(insertPayload);
      }

      toast.success('Manual booking created successfully');
      
      // Trigger dynamic automation alerts in real time
      if (bookingData) {
        triggerAutomationRules('booking_created', bookingData);
      }
      
      setNewBooking({
        firstName: '', lastName: '', email: '', phone: '',
        checkIn: format(new Date(), 'yyyy-MM-dd'),
        checkOut: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        roomId: '', bookingSource: 'walk_in', paymentStatus: 'unpaid', paymentMethod: 'cash', totalAmount: 0, baseRoomPrice: 0,
        purpose: 'Leisure', specialRequests: ''
      });
      setSelectedServices([]);
      setDiscountType('amount');
      setDiscountValue(0);
      setSelectedGroupId('');
      setBillToGroup(false);
      setIsAddingGroup(false);
      setSelectedCrmGuest(null);
      setCrmSearchQuery('');
      
      onSuccess();
      onClose();

    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to create manual booking');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-4xl shadow-2xl relative rounded-xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Plus className="text-brand-500"/> Create Manual Booking</h2>
        
        <form onSubmit={handleManualBooking} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4">
              <h3 className="font-semibold text-white">Stay Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Check-in</label>
                  <input required type="date" value={newBooking.checkIn} onChange={e => setNewBooking({...newBooking, checkIn: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Check-out</label>
                  <input required type="date" value={newBooking.checkOut} onChange={e => setNewBooking({...newBooking, checkOut: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Select Room</label>
                  <select required value={newBooking.roomId} onChange={e => setNewBooking({...newBooking, roomId: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                    <option value="">-- Choose available room --</option>
                    {availableRooms.map(r => <option key={r.id} value={r.id}>{r.room_number} - {r.name} (₦{Number(r.base_price_ngn).toLocaleString()}/night)</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4">
              <h3 className="font-semibold text-white flex justify-between items-center">
                <span>Guest Information</span>
                {selectedCrmGuest && (
                  <span className="text-xs bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded font-bold">
                    ✓ Linked CRM Guest
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 border-b border-dark-700/50 pb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-400">Rebook CRM Guest (Optional)</label>
                    {selectedCrmGuest && (
                      <button 
                        type="button" 
                        onClick={handleClearSelectedCrmGuest}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold transition-colors uppercase tracking-wider"
                      >
                        [ Clear / Reset ]
                      </button>
                    )}
                  </div>
                  
                  {/* Premium CRM search text box */}
                  <div className="relative mb-2">
                    <input 
                      type="text"
                      placeholder="🔍 Search CRM guest by name or email..."
                      value={crmSearchQuery}
                      onChange={e => setCrmSearchQuery(e.target.value)}
                      className="w-full bg-dark-800 border border-dark-700 rounded p-2 pl-3 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500 transition-colors font-semibold"
                    />
                    {crmSearchQuery && (
                      <button 
                        type="button"
                        onClick={() => setCrmSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select 
                    value={selectedCrmGuest ? selectedCrmGuest.id : ''} 
                    onChange={handleCrmGuestSelect} 
                    className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors cursor-pointer text-xs font-bold"
                  >
                    <option value="">
                      {filteredCrmGuests.length === 0 
                        ? '-- No matching guests found --' 
                        : `-- Choose from ${filteredCrmGuests.length} matching guests --`}
                    </option>
                    {filteredCrmGuests.map(g => (
                      <option key={g.id} value={g.id}>
                        {`${g.first_name || ''} ${g.last_name || ''}`.trim() || 'Unnamed Guest'} ({g.email || 'No email'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">First Name</label>
                  <input required type="text" value={newBooking.firstName} onChange={e => setNewBooking({...newBooking, firstName: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="John" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Last Name</label>
                  <input required type="text" value={newBooking.lastName} onChange={e => setNewBooking({...newBooking, lastName: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="Doe" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                  <input required type="email" value={newBooking.email} onChange={e => setNewBooking({...newBooking, email: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="john@example.com" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Phone Number</label>
                  <input required type="tel" value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="+234..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Purpose of Stay</label>
                  <select required value={newBooking.purpose || 'Leisure'} onChange={e => setNewBooking({...newBooking, purpose: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors cursor-pointer">
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
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Special Requests (Optional)</label>
                  <textarea rows="2" value={newBooking.specialRequests || ''} onChange={e => setNewBooking({...newBooking, specialRequests: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors resize-none" placeholder="e.g. late check-in, dietary requirements..." />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              <h3 className="font-semibold text-white flex items-center gap-2"><Package size={16}/> Add-on Services</h3>
              {services.length === 0 && foodServices.length === 0 ? <p className="text-sm text-gray-500">No services available</p> : (
                <div className="space-y-3">
                  {services.map(service => {
                    const isSelected = selectedServices.some(s => s.service_id === service.id);
                    const needsScheduling = /pickup|spa|massage/i.test(service.name);
                    const sData = selectedServices.find(s => s.service_id === service.id);
                    return (
                      <div key={service.id} onClick={() => toggleService(service.id)} className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'border-brand-500 bg-brand-500/10' : 'border-dark-700 hover:border-gray-500'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isSelected ? <CheckSquare size={18} className="text-brand-500"/> : <Square size={18} className="text-gray-500"/>}
                            <div>
                              <p className="font-medium text-white text-sm">{service.name}</p>
                              <p className="text-xs text-gray-400">{service.pricing_type.replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                              {isSelected && (service.pricing_type === 'quantity_based' || service.pricing_type === 'time_based' || service.pricing_type === 'per_person') && (
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <label className="text-xs text-gray-400">
                                    {service.pricing_type === 'per_person' ? 'Persons:' : 'Qty:'}
                                  </label>
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={sData?.quantity || 1}
                                    onChange={(e) => updateServiceQuantity(e, service.id, e.target.value)}
                                    className="w-16 bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white outline-none focus:border-brand-500 text-sm"
                                  />
                                </div>
                              )}
                              <span className="text-sm font-bold">₦{Number(service.base_price_ngn).toLocaleString()}</span>
                            </div>
                        </div>
                        
                        {isSelected && needsScheduling && (
                          <div className="mt-3 pt-3 border-t border-dark-700/50 flex flex-wrap items-center gap-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-400">Date:</label>
                              <input 
                                type="date" 
                                value={sData?.date || newBooking.checkIn}
                                onChange={(e) => updateServiceSchedule(e, service.id, 'date', e.target.value)}
                                className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white outline-none focus:border-brand-500 text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-400">Time:</label>
                              <input 
                                type="time" 
                                value={sData?.time || '12:00'}
                                onChange={(e) => updateServiceSchedule(e, service.id, 'time', e.target.value)}
                                className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white outline-none focus:border-brand-500 text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Meals / Drinks Accordion */}
                  <div className="border border-dark-700 rounded-lg overflow-hidden mt-4">
                    <div 
                      onClick={() => setIsMealsDrinksOpen(!isMealsDrinksOpen)}
                      className={`flex items-center justify-between p-3 cursor-pointer bg-dark-900 hover:bg-dark-800 transition-colors border-b ${isMealsDrinksOpen ? 'border-dark-700 font-bold' : 'border-transparent'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Coffee size={18} className="text-brand-500" />
                        <div>
                          <p className="font-medium text-white text-sm">Meals / Drinks</p>
                          <p className="text-xs text-gray-400 font-normal">Select meals, dessert, or drinks</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold bg-brand-500/10 text-brand-400 px-2.5 py-1 rounded">
                        {isMealsDrinksOpen ? 'Hide Menu' : 'Show Menu'}
                      </span>
                    </div>

                    {isMealsDrinksOpen && (
                      <div className="p-3 bg-dark-950 space-y-4">
                        {/* Submenu Tabs */}
                        <div className="flex border-b border-dark-700 pb-2 overflow-x-auto gap-2 scrollbar-thin">
                          {['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Appetizers', 'Drinks'].map(tab => {
                            const count = getItemsForSubmenu(tab, foodServices).length;
                            return (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveSubmenu(tab)}
                                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors whitespace-nowrap ${activeSubmenu === tab ? 'bg-brand-500 text-dark-900' : 'bg-dark-900 text-gray-400 hover:text-white'}`}
                              >
                                {tab} ({count})
                              </button>
                            );
                          })}
                        </div>

                        {/* Submenu Items */}
                        <div className="space-y-3 pt-1">
                          {getItemsForSubmenu(activeSubmenu, foodServices).length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No items available in this category</p>
                          ) : (
                            getItemsForSubmenu(activeSubmenu, foodServices).map(item => {
                              const isSelected = selectedServices.some(s => s.service_id === item.id);
                              const sData = selectedServices.find(s => s.service_id === item.id);
                              return (
                                <div 
                                  key={item.id}
                                  onClick={() => toggleService(item.id)}
                                  className={`flex flex-col p-2.5 border rounded cursor-pointer transition-colors ${isSelected ? 'border-brand-500 bg-brand-500/5' : 'border-dark-800 hover:border-dark-700 bg-dark-900/40'}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                      {isSelected ? <CheckSquare size={16} className="text-brand-500"/> : <Square size={16} className="text-gray-500"/>}
                                      <div>
                                        <p className="font-medium text-white text-xs">{item.name}</p>
                                        {item.description && (
                                          <p className="text-[10px] text-gray-400 line-clamp-1">
                                            {item.description.includes(' | ') ? item.description.split(' | ').slice(1).join(' | ') : item.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                      {isSelected && (
                                        <div className="flex items-center gap-1.5">
                                          <label className="text-[10px] text-gray-400">Qty:</label>
                                          <input 
                                            type="number" 
                                            min="1" 
                                            value={sData?.quantity || 1}
                                            onChange={(e) => updateServiceQuantity(e, item.id, e.target.value)}
                                            className="w-12 bg-dark-950 border border-dark-800 rounded px-1.5 py-0.5 text-white outline-none focus:border-brand-500 text-xs text-center"
                                          />
                                        </div>
                                      )}
                                      <span className="text-xs font-bold">₦{Number(item.base_price_ngn).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4">
              <h3 className="font-semibold text-white">Payment & Finalization</h3>
              <div className="grid grid-cols-2 gap-4">
                
                {/* Corporate / Group Booking Toggle */}
                <div className="col-span-2 border-b border-dark-700/50 pb-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 font-medium text-white cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={billToGroup} 
                        onChange={e => {
                          setBillToGroup(e.target.checked);
                          if (e.target.checked) {
                            setNewBooking(prev => ({ ...prev, paymentStatus: 'unpaid' }));
                          }
                        }} 
                        className="w-4 h-4 rounded border-dark-700 text-brand-500 focus:ring-brand-500 bg-dark-800" 
                      />
                      <span>🏢 Billed to Corporate / Group Account?</span>
                    </label>
                    {billToGroup && (
                      <button 
                        type="button" 
                        onClick={() => setIsAddingGroup(!isAddingGroup)} 
                        className="text-xs text-brand-400 hover:text-brand-300 font-bold transition-colors"
                      >
                        {isAddingGroup ? 'Cancel' : '+ Register New Group'}
                      </button>
                    )}
                  </div>

                  {billToGroup && !isAddingGroup && (
                    <div className="mt-3 space-y-2 animate-in fade-in duration-200">
                      <label className="block text-xs font-semibold text-gray-400">Select Corporate/Group Account *</label>
                      <select 
                        required={billToGroup}
                        value={selectedGroupId} 
                        onChange={e => setSelectedGroupId(e.target.value)} 
                        className="w-full bg-dark-805 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors"
                      >
                        <option value="">-- Choose Corporate Group --</option>
                        {groupAccounts.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.group_type}) - Balance: ₦{Number(g.outstanding_balance).toLocaleString()} / Limit: ₦{Number(g.credit_limit).toLocaleString()}
                          </option>
                        ))}
                      </select>
                      
                      {/* Credit limit warning alert */}
                      {(() => {
                        const selectedGroup = groupAccounts.find(g => g.id === selectedGroupId);
                        if (selectedGroup) {
                          const totalIfBooked = Number(selectedGroup.outstanding_balance) + newBooking.totalAmount;
                          const exceeds = totalIfBooked > Number(selectedGroup.credit_limit);
                          if (exceeds) {
                            return (
                              <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-2.5 rounded text-xs font-semibold animate-pulse mt-2">
                                ⚠️ Outstanding balance + booking total (₦{totalIfBooked.toLocaleString()}) exceeds the group credit limit (₦{Number(selectedGroup.credit_limit).toLocaleString()})!
                              </div>
                            );
                          } else {
                            return (
                              <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-2 rounded text-xs mt-2">
                                ✓ Available Credit: ₦{(Number(selectedGroup.credit_limit) - Number(selectedGroup.outstanding_balance)).toLocaleString()} (Booking approved under limit)
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {billToGroup && isAddingGroup && (
                    <div className="mt-3 bg-dark-950 border border-dark-700 p-3 rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Quick Register Corporate Account</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="Company/Church/Agency Name" 
                            value={newGroup.name}
                            onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                            className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-xs text-white outline-none focus:border-brand-500"
                          />
                        </div>
                        <div>
                          <select 
                            value={newGroup.type}
                            onChange={e => setNewGroup({ ...newGroup, type: e.target.value })}
                            className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-xs text-white outline-none focus:border-brand-500"
                          >
                            <option value="Company">Company</option>
                            <option value="Government Agency">Government Agency</option>
                            <option value="Church">Church</option>
                            <option value="Group">Group</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <input 
                            type="number" 
                            placeholder="Credit Limit (₦)" 
                            value={newGroup.credit_limit || ''}
                            onChange={e => setNewGroup({ ...newGroup, credit_limit: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-xs text-white outline-none focus:border-brand-500"
                          />
                        </div>
                        <div>
                          <input 
                            type="text" 
                            placeholder="Contact Person" 
                            value={newGroup.contactName}
                            onChange={e => setNewGroup({ ...newGroup, contactName: e.target.value })}
                            className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-xs text-white outline-none focus:border-brand-500"
                          />
                        </div>
                        <div>
                          <input 
                            type="text" 
                            placeholder="Contact Phone" 
                            value={newGroup.contactPhone}
                            onChange={e => setNewGroup({ ...newGroup, contactPhone: e.target.value })}
                            className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-xs text-white outline-none focus:border-brand-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="email" 
                            placeholder="Contact Email" 
                            value={newGroup.contactEmail}
                            onChange={e => setNewGroup({ ...newGroup, contactEmail: e.target.value })}
                            className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-xs text-white outline-none focus:border-brand-500"
                          />
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleQuickRegisterGroup}
                        className="w-full bg-brand-500 hover:bg-brand-600 text-dark-900 font-bold py-1.5 px-3 rounded text-xs transition-colors"
                      >
                        Create & Select Group
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Booking Source</label>
                  <select required value={newBooking.bookingSource} onChange={e => setNewBooking({...newBooking, bookingSource: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                    <option value="walk_in">Walk-in</option>
                    <option value="phone">Phone Booking</option>
                    <option value="manual">Manual Entry</option>
                  </select>
                </div>
                {!billToGroup ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Payment Status</label>
                      <select required value={newBooking.paymentStatus} onChange={e => setNewBooking({...newBooking, paymentStatus: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors cursor-pointer">
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partially Paid</option>
                        <option value="paid">Fully Paid</option>
                      </select>
                    </div>
                    {newBooking.paymentStatus !== 'unpaid' && (
                      <>
                        <div className="col-span-1 animate-in fade-in duration-300">
                          <label className="block text-sm font-medium text-gray-400 mb-1">Payment Method / Type</label>
                          <select required value={newBooking.paymentMethod} onChange={e => setNewBooking({...newBooking, paymentMethod: e.target.value})} className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors cursor-pointer">
                            <option value="cash">Cash</option>
                            <option value="bank_transfer">Transfer (Bank)</option>
                            <option value="pos">POS Terminal</option>
                            <option value="stripe">Card (Credit/Debit Card)</option>
                            {selectedCrmGuest && Number(selectedCrmGuest.wallet_balance) > 0 && (() => {
                              const match = arAccounts.find(acc => acc.guest_id === selectedCrmGuest.id);
                              const isActive = !match || match.status === 'active' || !match.status;
                              return isActive ? (
                                <option value="ar_wallet">
                                  💼 AR Prepayment Wallet (Available: ₦{Number(selectedCrmGuest.wallet_balance).toLocaleString()})
                                </option>
                              ) : null;
                            })()}
                          </select>
                        </div>
                        <div className="col-span-1 animate-in fade-in duration-300">
                          <label className="block text-sm font-medium text-gray-400 mb-1">Amount Paid (₦)</label>
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            max={newBooking.totalAmount}
                            disabled={newBooking.paymentStatus === 'paid'}
                            value={amountPaid}
                            onChange={handleAmountPaidChange}
                            className="w-full bg-dark-800 border border-dark-700 rounded p-2.5 text-white outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                          />
                        </div>

                        {/* AR Prepayment Wallet dynamic balance notice checks */}
                        {newBooking.paymentMethod === 'ar_wallet' && selectedCrmGuest && (
                          <div className="col-span-2 mt-2">
                            {(() => {
                              const walletBal = Number(selectedCrmGuest.wallet_balance || 0);
                              const isInsufficient = walletBal < amountPaid;
                              
                              if (isInsufficient) {
                                return (
                                  <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-2.5 rounded text-xs font-semibold animate-pulse">
                                    ⚠️ Insufficient AR wallet balance! Required: ₦{amountPaid.toLocaleString()} (Available: ₦{walletBal.toLocaleString()}). Please select another payment method or deposit funds.
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-2.5 rounded text-xs">
                                    ✓ Sufficient Prepayment Balance! Remaining after booking: ₦{(walletBal - amountPaid).toLocaleString()}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="bg-brand-500/5 border border-brand-500/20 p-2.5 rounded text-xs text-brand-400 font-semibold flex items-center justify-center text-center self-end h-[46px]">
                    ℹ️ Billing routed to Group Account Ledger.
                  </div>
                )}
                <div className="col-span-2 border-t border-dark-700/50 pt-3">
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Apply Manual Discount</label>
                  <div className="flex gap-2">
                    <div className="flex border border-dark-700 rounded overflow-hidden">
                      <button 
                        type="button" 
                        onClick={() => setDiscountType('amount')} 
                        className={`px-3 py-1.5 text-xs font-bold transition-colors ${discountType === 'amount' ? 'bg-brand-500 text-dark-900' : 'bg-dark-800 text-gray-400 hover:text-white'}`}
                      >
                        ₦
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setDiscountType('percentage')} 
                        className={`px-3 py-1.5 text-xs font-bold transition-colors ${discountType === 'percentage' ? 'bg-brand-500 text-dark-900' : 'bg-dark-800 text-gray-400 hover:text-white'}`}
                      >
                        %
                      </button>
                    </div>
                    <input 
                      type="number" 
                      min="0" 
                      value={discountValue || ''} 
                      onChange={e => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))} 
                      className="flex-1 bg-dark-800 border border-dark-700 rounded px-3 py-1.5 text-white outline-none focus:border-brand-500 transition-colors text-sm" 
                      placeholder={discountType === 'amount' ? "Discount Amount in ₦" : "Discount Percentage %"}
                    />
                  </div>
                </div>
                <div className="col-span-2 border-t border-dark-700/50 pt-3">
                  <label className="block text-sm font-medium text-brand-400 mb-1">Final Amount (₦)</label>
                  <input required type="number" step="any" min="0" value={newBooking.totalAmount} onChange={e => setNewBooking({...newBooking, totalAmount: parseFloat(e.target.value) || 0})} className="w-full bg-dark-800 border border-brand-500 rounded p-2.5 text-white outline-none focus:border-brand-500 transition-colors font-bold text-lg" />
                  <p className="text-xs text-gray-500 mt-1">
                    Calculated as Room Cost (₦{roomCostWithVat.toLocaleString()} including 7.5% VAT)
                    {selectedServices.length > 0 && ` + Services (₦${servicesCostWithVat.toLocaleString()} including 7.5% VAT)`}
                    {discountValue > 0 && ` [Discount of ${discountType === 'amount' ? `₦${discountValue.toLocaleString()}` : `${discountValue}%`} applied to room rate]`}
                    {newBooking.purpose !== 'Leisure' && newBooking.purpose !== 'Other' && ` [Purpose of stay (${newBooking.purpose}) adjusts base pricing]`}
                  </p>
                </div>
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full btn-primary py-4 text-lg">
              {loading ? 'Creating Reservation...' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualBookingModal;

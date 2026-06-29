import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import toast from 'react-hot-toast';
import { LogIn, LogOut, Key, UserCheck, Calendar as CalendarIcon, Search, Plus, X, ShieldCheck, PenTool, Users, FileText, ArrowRightLeft, LayoutGrid, Wrench, Sparkles, CheckCircle, AlertTriangle, Clock, Check, Phone, ChevronLeft, ChevronRight, Filter, Package, Archive, Wallet, CalendarDays, SearchCheck, ShoppingBag, Coins, CreditCard, ArrowUpRight, ChefHat } from 'lucide-react';
import StoreRequisitionModal from '../../components/admin/StoreRequisitionModal';
import { format, addDays, differenceInDays } from 'date-fns';
import ManualBookingModal from '../../components/admin/ManualBookingModal';
import RoomTransferModal from '../../components/admin/RoomTransferModal';
import { useAuth } from '../../context/AuthContext';
import AdminReservations from './Reservations';
import LostFound from './LostFound';
import { triggerAutomationRules } from '../../lib/emailService';
import AdminBilling from './Billing';
import AdminHalls from './AdminHalls';


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

const calculateSingleServicePrice = (service, quantity, booking) => {
  if (!service || !booking) return 0;
  const totalNights = Math.max(1, differenceInDays(
    new Date(booking.check_out_date),
    new Date(booking.check_in_date)
  )) || 1;
  
  let cost = Number(service.base_price_ngn);
  const isBreakfast = service.name && service.name.toLowerCase().includes('breakfast');
  const isRestaurant = service.internal_notes?.toLowerCase().trim() === 'restaurant';
  
  if (isBreakfast) {
    cost = cost * totalNights * quantity;
  } else if (isRestaurant) {
    cost = cost * quantity;
  } else {
    if (service.pricing_type === 'per_person') cost *= quantity;
    if (service.pricing_type === 'per_day' || service.pricing_type === 'per_night') cost *= totalNights;
    if (service.pricing_type === 'quantity_based' || service.pricing_type === 'time_based') cost *= quantity;
  }
  return cost;
};

// --- Reusable Signature Pad Component ---
const SignaturePad = ({ onSave, onClear }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
    onSave(canvasRef.current.toDataURL());
  };

  const clearCanvas = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSave(null);
    if(onClear) onClear();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#eab308'; // brand-500 color
    }
  }, []);

  return (
    <div className="border border-dark-600 rounded bg-dark-900 relative">
      <canvas 
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full h-[150px] cursor-crosshair rounded touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={(e) => {
          const rect = canvasRef.current.getBoundingClientRect();
          const touch = e.touches[0];
          startDrawing({ nativeEvent: { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top }});
        }}
        onTouchMove={(e) => {
          const rect = canvasRef.current.getBoundingClientRect();
          const touch = e.touches[0];
          draw({ nativeEvent: { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top }});
        }}
        onTouchEnd={stopDrawing}
      />
      <button onClick={clearCanvas} className="absolute bottom-2 right-2 text-xs bg-dark-700 hover:bg-dark-600 text-white px-2 py-1 rounded transition-colors">Clear</button>
    </div>
  );
};


const AdminFrontDesk = () => {
  const { profile, hasAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [arrivals, setArrivals] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [inHouse, setInHouse] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [stats, setStats] = useState({ totalRooms: 0, occupiedRooms: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview'); // overview, matrix, calendar
  const [serviceRequests, setServiceRequests] = useState([]);

  // Booking Calendar States
  const [calendarStartDate, setCalendarStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2); // default window starting 2 days ago
    return d;
  });
  const [calendarEndDate, setCalendarEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 13); // 16 days window total
    return d;
  });
  const [calendarBookings, setCalendarBookings] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarRoomTypeFilter, setCalendarRoomTypeFilter] = useState('all');
  const [calendarStatusFilter, setCalendarStatusFilter] = useState('all');
  const [selectedCalendarBooking, setSelectedCalendarBooking] = useState(null);
  
  // No-Show Sweep States
  const [noShowBookings, setNoShowBookings] = useState([]);
  const [isNoShowSweepOpen, setIsNoShowSweepOpen] = useState(false);
  const [isSweepingNoShows, setIsSweepingNoShows] = useState(false);

  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isRequisitionOpen, setIsRequisitionOpen] = useState(false);
  const [transferBooking, setTransferBooking] = useState(null);

  // Group Accounts States
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', group_type: 'Company', contact_name: '', contact_email: '', contact_phone: '', credit_limit: 1000000.00 });

  // Activate Guest Wallet States
  const [isActivateWalletOpen, setIsActivateWalletOpen] = useState(false);
  const [walletGuests, setWalletGuests] = useState([]);
  const [walletARAccounts, setWalletARAccounts] = useState([]);
  const [walletForm, setWalletForm] = useState({ guest_id: '', initial_balance: '' });
  const [isLoadingWalletGuests, setIsLoadingWalletGuests] = useState(false);
  const [isActivatingWallet, setIsActivatingWallet] = useState(false);
  const [walletSearchQuery, setWalletSearchQuery] = useState('');

  // Add Funds States
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [addFundsMethod, setAddFundsMethod] = useState('cash');
  const [addFundsRef, setAddFundsRef] = useState('');
  const [isProcessingAddFunds, setIsProcessingAddFunds] = useState(false);

  // Room Grid Matrix States
  const [allRooms, setAllRooms] = useState([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState([]);
  const [matrixFilter, setMatrixFilter] = useState('all'); // all, occupied, clean, dirty, maintenance
  const [activeInspection, setActiveInspection] = useState(null);
  const [checklist, setChecklist] = useState({ bed: false, bathroom: false, trash: false, floors: false, restock: false });
  const [preselectedRoomId, setPreselectedRoomId] = useState(null);

  // Advanced Modals & Check-in / Visitor states
  const [activeCheckIn, setActiveCheckIn] = useState(null); // stores booking obj
  const [activeCheckOut, setActiveCheckOut] = useState(null);
  const [activeNoShowModal, setActiveNoShowModal] = useState(null);
  const [checkoutSettleMode, setCheckoutSettleMode] = useState('ar_wallet');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('ar');
  const [checkoutARProfile, setCheckoutARProfile] = useState(null);
  const [pendingCheckoutPayments, setPendingCheckoutPayments] = useState([]);
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [unpaidServices, setUnpaidServices] = useState([]);
  const [loadingUnpaidServices, setLoadingUnpaidServices] = useState(false);
  const [activeVisitorRegistration, setActiveVisitorRegistration] = useState(null);
  const [lateCheckoutBookings, setLateCheckoutBookings] = useState([]);
  const [rebookCheckIn, setRebookCheckIn] = useState('');
  const [rebookCheckOut, setRebookCheckOut] = useState('');
  const [rebookRoomId, setRebookRoomId] = useState('');
  const [rebookRoomsList, setRebookRoomsList] = useState([]);
  const [loadingRebookRooms, setLoadingRebookRooms] = useState(false);
  const [rebookProcessing, setRebookProcessing] = useState(false);

  const fetchRebookAvailability = async (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return;
    setLoadingRebookRooms(true);
    try {
      const { data: rooms } = await supabase.from('rooms').select('id, name, room_number, base_price_ngn');
      if (!rooms) return setRebookRoomsList([]);

      const { data: bookedRooms, error: queryError } = await supabase.rpc('get_booked_room_ids', {
        req_start_date: checkIn,
        req_end_date: checkOut
      });
        
      if (queryError) console.error('Availability check error:', queryError);

      const bookedRoomIds = new Set((bookedRooms || []).map(b => typeof b === 'string' ? b : (b.booked_room_id || b.room_id || b.id || Object.values(b)[0])));
      
      const actuallyAvailable = rooms.filter(r => !bookedRoomIds.has(r.id));
      setRebookRoomsList(actuallyAvailable);
    } catch (err) {
      console.error('Rebooking check failed:', err);
    } finally {
      setLoadingRebookRooms(false);
    }
  };

  useEffect(() => {
    if (activeNoShowModal) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      setRebookCheckIn(todayStr);
      setRebookCheckOut(tomorrowStr);
      setRebookRoomId(activeNoShowModal.room_id || '');
    } else {
      setRebookCheckIn('');
      setRebookCheckOut('');
      setRebookRoomId('');
      setRebookRoomsList([]);
    }
  }, [activeNoShowModal]);

  useEffect(() => {
    if (activeNoShowModal && rebookCheckIn && rebookCheckOut) {
      fetchRebookAvailability(rebookCheckIn, rebookCheckOut);
    }
  }, [rebookCheckIn, rebookCheckOut, activeNoShowModal]);

  // Add Addon Service to Stayed Guest state
  const [activeAddServiceBooking, setActiveAddServiceBooking] = useState(null);
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [serviceDate, setServiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [serviceTime, setServiceTime] = useState('12:00');
  const [serviceNotes, setServiceNotes] = useState('');
  const [isAddingService, setIsAddingService] = useState(false);

  const [foodMenuServices, setFoodMenuServices] = useState([]);
  const [selectedFoodServiceId, setSelectedFoodServiceId] = useState('');
  const [selectedServicesList, setSelectedServicesList] = useState([]);
  const [bulkSelections, setBulkSelections] = useState({});
  const [isMealsSelected, setIsMealsSelected] = useState(false);
  const [kitchenMenuTab, setKitchenMenuTab] = useState('Breakfast');

  const handleToggleBulkCheck = (service, isChecked) => {
    if (service.id === 'meals-virtual') {
      setIsMealsSelected(isChecked);
      if (!isChecked) {
        // Remove all restaurant/F&B services from bulkSelections
        setBulkSelections(prev => {
          const copy = { ...prev };
          Object.keys(copy).forEach(key => {
            if (copy[key].service?.internal_notes?.toLowerCase().trim() === 'restaurant') {
              delete copy[key];
            }
          });
          return copy;
        });
      }
      return;
    }

    setBulkSelections(prev => {
      if (!isChecked) {
        const copy = { ...prev };
        delete copy[service.id];
        return copy;
      }
      return {
        ...prev,
        [service.id]: {
          checked: true,
          quantity: 1,
          date: format(new Date(), 'yyyy-MM-dd'),
          time: '12:00',
          notes: '',
          service
        }
      };
    });
  };

  const handleUpdateBulkField = (serviceId, field, value) => {
    setBulkSelections(prev => {
      if (!prev[serviceId]) return prev;
      return {
        ...prev,
        [serviceId]: {
          ...prev[serviceId],
          [field]: value
        }
      };
    });
  };

  const handleAddBulkToCart = () => {
    const newCartItems = [];
    Object.entries(bulkSelections).forEach(([serviceId, data]) => {
      if (!data.checked) return;
      const { service, quantity, date, time, notes } = data;
      
      const exists = selectedServicesList.some(item => item.service_id === service.id);
      if (exists) {
        toast.error(`"${service.name}" is already in your request list.`);
        return;
      }
      
      const totalPrice = calculateSingleServicePrice(service, quantity, activeAddServiceBooking);
      const isRestaurant = service.internal_notes?.toLowerCase().trim() === 'restaurant';
      
      newCartItems.push({
        id: Math.random().toString(36).substring(2, 9),
        service_id: service.id,
        name: service.name,
        quantity: quantity,
        unit_price_ngn: Number(service.base_price_ngn),
        total_price_ngn: totalPrice,
        scheduled_date: service.scheduling_required ? date : null,
        scheduled_time: service.scheduling_required ? time : null,
        is_restaurant: isRestaurant,
        notes: notes.trim()
      });
    });
    
    if (newCartItems.length > 0) {
      setSelectedServicesList([...selectedServicesList, ...newCartItems]);
      setBulkSelections({});
      setIsMealsSelected(false);
      toast.success(`✓ Added ${newCartItems.length} items to order list.`);
    }
  };

  const selectedService = useMemo(() => {
    if (selectedServiceId === 'meals-virtual') {
      return foodMenuServices.find(s => s.id === selectedFoodServiceId);
    }
    return availableServices.find(s => s.id === selectedServiceId);
  }, [availableServices, foodMenuServices, selectedServiceId, selectedFoodServiceId]);

  const groupedFoodItems = useMemo(() => {
    const groups = {};
    foodMenuServices.forEach(item => {
      const { segment } = parseDescription(item.description);
      if (!groups[segment]) groups[segment] = [];
      groups[segment].push(item);
    });
    return groups;
  }, [foodMenuServices]);

  const filteredWalletGuests = useMemo(() => {
    if (!walletSearchQuery) return walletGuests;
    const query = walletSearchQuery.toLowerCase().trim();
    return walletGuests.filter(g => {
      const fullName = `${g.first_name || ''} ${g.last_name || ''}`.toLowerCase();
      const email = (g.email || '').toLowerCase();
      const phone = (g.phone || '').toLowerCase();
      return fullName.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [walletGuests, walletSearchQuery]);

  const calculatedServicePrice = useMemo(() => {
    return calculateSingleServicePrice(selectedService, serviceQuantity, activeAddServiceBooking);
  }, [selectedService, activeAddServiceBooking, serviceQuantity]);
  
  const [inHouseSearchQuery, setInHouseSearchQuery] = useState('');

  const renderCheckoutBadge = (booking) => {
    if (!booking) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    if (booking.check_out_date !== today || booking.status !== 'checked_in') return null;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const totalMinutes = currentHour * 60 + currentMinute;
    const minutes11AM = 11 * 60;
    const minutes12PM = 12 * 60;
    const minutes4PM = 16 * 60;
    
    // Find active late checkout for this booking
    const activeLC = lateCheckoutBookings.find(lc => lc.booking_id === booking.id);
    
    if (activeLC) {
      const isApproved = ['scheduled', 'completed', 'in_progress'].includes(activeLC.status);
      if (totalMinutes >= minutes4PM) {
        return (
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse whitespace-nowrap">
            Late Checkout Overdue
          </span>
        );
      } else {
        return (
          <span className={`${isApproved ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'} text-[10px] font-bold px-2 py-0.5 rounded animate-pulse whitespace-nowrap`}>
            {isApproved ? 'Late Checkout (4:00 PM)' : 'Late Checkout Pending'}
          </span>
        );
      }
    } else {
      if (totalMinutes >= minutes12PM) {
        return (
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse whitespace-nowrap">
            Checkout Overdue
          </span>
        );
      } else if (totalMinutes >= minutes11AM) {
        return (
          <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse whitespace-nowrap">
            Checkout Commenced
          </span>
        );
      }
    }
    return null;
  };

  const filteredInHouse = useMemo(() => {
    if (!inHouseSearchQuery) return inHouse;
    return inHouse.filter(booking => {
      const guestName = (booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : booking.guest_name || '').toLowerCase();
      const roomNumber = (booking.rooms?.room_number || '').toLowerCase();
      const ref = (booking.booking_reference || '').toLowerCase();
      
      return guestName.includes(inHouseSearchQuery.toLowerCase()) || 
             roomNumber.includes(inHouseSearchQuery.toLowerCase()) ||
             ref.includes(inHouseSearchQuery.toLowerCase());
    });
  }, [inHouse, inHouseSearchQuery]);

  // Check-In Wizard State
  const [checkInStep, setCheckInStep] = useState(1);
  const [idVerified, setIdVerified] = useState(false);
  const [keyIssued, setKeyIssued] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  
  // Visitor State
  const [visitorName, setVisitorName] = useState('');
  const [visitorId, setVisitorId] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorPurpose, setVisitorPurpose] = useState('');
  
  // Visitor Registry States
  const [visitorsData, setVisitorsData] = useState([]);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [visitorSearchQuery, setVisitorSearchQuery] = useState('');
  const [visitorFilterStatus, setVisitorFilterStatus] = useState('all'); // all, active, checked_out

  // Close of Day states
  const [departmentalClosures, setDepartmentalClosures] = useState([]);
  const [isCloseOfDayModalOpen, setIsCloseOfDayModalOpen] = useState(false);
  const [closeOfDayReport, setCloseOfDayReport] = useState(null);
  const [isCompilingCloseOfDay, setIsCompilingCloseOfDay] = useState(false);

  useEffect(() => {
    fetchFrontDeskData();
    fetchClosures();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchClosures = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'departmental_closures')
        .maybeSingle();
      if (data && data.setting_value) {
        setDepartmentalClosures(typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value);
      }
    } catch (err) {
      console.warn("Failed to fetch closures in Front Desk:", err);
    }
  };

  const handleCompileCloseOfDayFrontDesk = async () => {
    setIsCompilingCloseOfDay(true);
    const toastId = toast.loading("Compiling today's Front Office transactions...");
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // 1. Fetch payments for today
      const { data: payments, error: payErr } = await supabase.from('payments').select('*');
      if (payErr) throw payErr;

      // Filter Front Office payments (Booking Revenue)
      const frontOfficeTxns = (payments || []).filter(p => {
        const dStr = format(new Date(p.processed_at || p.created_at), 'yyyy-MM-dd');
        if (dStr !== todayStr) return false;
        
        const isLaundry = p.transaction_ref?.startsWith('LDY-POS-') || p.notes?.toLowerCase().includes('laundry');
        const isPOS = p.transaction_ref?.startsWith('POS-') || p.notes?.toLowerCase().includes('pos walk-in') || p.transaction_ref?.startsWith('REST-') || p.notes?.toLowerCase().includes('restaurant direct payment');
        
        return !isLaundry && !isPOS;
      }).map(p => ({
        time: format(new Date(p.processed_at || p.created_at), 'HH:mm'),
        ref: p.transaction_ref || 'N/A',
        description: p.notes || 'Front Desk Booking Payment',
        amount: Number(p.amount),
        method: p.method
      }));

      const totalRev = frontOfficeTxns.reduce((sum, t) => sum + t.amount, 0);

      setCloseOfDayReport({
        business_date: todayStr,
        txns: frontOfficeTxns,
        total_revenue: totalRev,
        total_count: frontOfficeTxns.length
      });

      toast.dismiss(toastId);
      setIsCloseOfDayModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to compile Close of Day metrics: " + err.message, { id: toastId });
    } finally {
      setIsCompilingCloseOfDay(false);
    }
  };

  const handleConfirmCloseOfDayFrontDesk = async () => {
    if (!closeOfDayReport) return;
    const toastId = toast.loading("Closing day and saving reports...");
    try {
      const todayStr = closeOfDayReport.business_date;

      const closureRecord = {
        department: 'front_office',
        business_date: todayStr,
        staff_id: profile?.id || 'unknown',
        staff_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        revenue: closeOfDayReport.total_revenue,
        transactions_count: closeOfDayReport.total_count,
        closed_at: new Date().toISOString()
      };

      let currentClosures = [];
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'departmental_closures').maybeSingle();
        if (data && data.setting_value) {
          currentClosures = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        }
      } catch {}

      const updatedClosures = [...currentClosures, closureRecord];

      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_closures',
        setting_value: updatedClosures
      }, { onConflict: 'setting_key' });

      // Save detailed reports
      const reportRecord = {
        id: `dept_close_front_office_${todayStr}`,
        department: 'front_office',
        business_date: todayStr,
        staff_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        closed_at: new Date().toISOString(),
        total_revenue: closeOfDayReport.total_revenue,
        transactions_count: closeOfDayReport.total_count,
        details: {},
        transactions: [
          ...closeOfDayReport.txns.map(t => ({ ...t, type: 'Booking Revenue' }))
        ]
      };

      let currentReports = [];
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'departmental_close_reports').maybeSingle();
        if (data && data.setting_value) {
          currentReports = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        }
      } catch {}

      const updatedReports = [reportRecord, ...currentReports];

      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_close_reports',
        setting_value: updatedReports
      }, { onConflict: 'setting_key' });

      await supabase.from('system_logs').insert({
        user_id: profile?.id,
        log_type: 'activity',
        action: `Closed departmental ledger for FRONT OFFICE on date ${todayStr}. Revenue: ₦${closeOfDayReport.total_revenue.toLocaleString()}`,
        module: 'Accounting'
      });

      toast.success("✓ Front Office close of day completed successfully!", { id: toastId });
      setIsCloseOfDayModalOpen(false);
      setDepartmentalClosures(updatedClosures);
    } catch (err) {
      console.error(err);
      toast.error("Failed to close business day: " + err.message, { id: toastId });
    }
  };

  const handleReopenFrontOffice = async () => {
    const allowedRoles = ['super_admin', 'admin', 'hotel_manager', 'hotel_owner'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      return toast.error("You do not have authorization to reopen departmental ledgers. Contact an Administrator or Manager.");
    }

    if (!window.confirm("Are you sure you want to RE-OPEN the Front Office ledger for today? This will clear the closure record and allow new transactions to be posted.")) {
      return;
    }

    const toastId = toast.loading("Reopening Front Office ledger...");
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // 1. Fetch current closures
      let currentClosures = [];
      const { data: closuresData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'departmental_closures')
        .maybeSingle();
      if (closuresData && closuresData.setting_value) {
        currentClosures = typeof closuresData.setting_value === 'string' ? JSON.parse(closuresData.setting_value) : closuresData.setting_value;
      }

      // 2. Fetch current reports
      let currentReports = [];
      const { data: reportsData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'departmental_close_reports')
        .maybeSingle();
      if (reportsData && reportsData.setting_value) {
        currentReports = typeof reportsData.setting_value === 'string' ? JSON.parse(reportsData.setting_value) : reportsData.setting_value;
      }

      const updatedClosures = currentClosures.filter(c => !(c.department === 'front_office' && c.business_date === todayStr));
      const updatedReports = currentReports.filter(r => !(r.department === 'front_office' && r.business_date === todayStr));

      // 3. Save closures
      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_closures',
        setting_value: updatedClosures
      }, { onConflict: 'setting_key' });

      // 4. Save reports
      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_close_reports',
        setting_value: updatedReports
      }, { onConflict: 'setting_key' });

      // 5. Audit log
      await supabase.from('system_logs').insert({
        user_id: profile?.id,
        log_type: 'activity',
        action: `Front Office ledger reopened for date ${todayStr} by ${profile.first_name} ${profile.last_name}`,
        module: 'Accounting'
      });

      setDepartmentalClosures(updatedClosures);
      toast.success("Front Office ledger reopened successfully!", { id: toastId });
    } catch (err) {
      console.error("Failed to reopen Front Office ledger:", err);
      toast.error(`Failed to reopen ledger: ${err.message}`, { id: toastId });
    }
  };


  // Real-time Postgres changes channel subscription using custom sync hook
  useRealtimeSync(['bookings', 'rooms', 'housekeeping_tasks', 'booking_services', 'system_settings', 'payments', 'invoices', 'refund_settlements', 'halls', 'hall_bookings', 'hall_meal_options', 'hall_booking_meals'], (table) => {
    fetchFrontDeskData(false);
    if (table === 'system_settings') {
      fetchClosures();
    } else if (table === 'bookings') {
      if (activeTab === 'calendar') fetchCalendarData();
      if (activeTab === 'visitors') fetchVisitors();
    } else if (table === 'rooms') {
      if (activeTab === 'calendar') fetchCalendarData();
    }
  });

  useEffect(() => {
    if (activeTab === 'visitors') {
      fetchVisitors();
    }
  }, [activeTab]);

  // Quick Housekeeping Actions
  const handleQuickUpdateHousekeeping = async (taskId, newStatus) => {
    try {
      const payload = { status: newStatus };
      if (newStatus === 'inspected') payload.completed_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('housekeeping_tasks')
        .update(payload)
        .eq('id', taskId);

      if (error) throw error;
      toast.success(`Cleaning task marked as ${newStatus.replace('_', ' ')}`);
      fetchFrontDeskData(false);
    } catch (err) {
      toast.error('Failed to update housekeeping status');
      console.error(err);
    }
  };

  const handleQuickCreateHousekeeping = async (roomId) => {
    try {
      const { error } = await supabase.from('housekeeping_tasks').insert([{
        room_id: roomId,
        task_type: 'daily_refresh',
        status: 'pending',
        assigned_date: format(new Date(), 'yyyy-MM-dd'),
        notes: 'Quick cleaning request from Front Desk Grid'
      }]);

      if (error) throw error;
      toast.success('Cleaning task scheduled successfully');
      fetchFrontDeskData();
    } catch (err) {
      toast.error('Failed to schedule cleaning task');
      console.error(err);
    }
  };

  const handleStartInspection = (taskId) => {
    setActiveInspection(taskId);
    setChecklist({ bed: false, bathroom: false, trash: false, floors: false, restock: false });
  };

  const handleSubmitInspection = async () => {
    if(!checklist.bed || !checklist.bathroom || !checklist.trash || !checklist.floors || !checklist.restock) {
      return toast.error("All checklist items must be verified before approving inspection.");
    }

    try {
      const { error } = await supabase.from('housekeeping_tasks').update({
        status: 'inspected',
        completed_at: new Date().toISOString(),
        inspection_checklist: checklist
      }).eq('id', activeInspection);

      if (error) throw error;
      toast.success('Room marked as Inspected and Ready!');
      setActiveInspection(null);
      setChecklist({ bed: false, bathroom: false, trash: false, floors: false, restock: false });
      fetchFrontDeskData();
    } catch (err) {
      toast.error('Failed to approve inspection');
      console.error(err);
    }
  };

  const handleRejectInspection = async () => {
    try {
      const { error } = await supabase.from('housekeeping_tasks').update({
        status: 'failed',
        notes: 'Inspection Failed - Please clean again.'
      }).eq('id', activeInspection);

      if (error) throw error;
      toast.error('Room marked as Not Approved. Sent back to Housekeeping.');
      setActiveInspection(null);
      setChecklist({ bed: false, bathroom: false, trash: false, floors: false, restock: false });
      fetchFrontDeskData();
    } catch (err) {
      toast.error('Failed to reject inspection');
      console.error(err);
    }
  };

  const fetchFrontDeskData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const threeDaysAgo = format(addDays(new Date(), -3), 'yyyy-MM-dd');

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const [
          roomsRes,
          hTasksRes,
          mTicketsRes,
          arrivalsRes,
          inHouseRes,
          sRequestsRes,
          noShowsRes,
          lateCheckoutsRes
        ] = await Promise.all([
          // 1. Rooms
          supabase.from('rooms').select('id, room_number, name, type, status').order('room_number'),
          // 2. Housekeeping Tasks (active or recent only)
          supabase.from('housekeeping_tasks')
            .select('*, profiles(first_name, last_name)')
            .or(`status.neq.inspected,assigned_date.gte.${threeDaysAgo}`)
            .order('assigned_date', { ascending: false }),
          // 3. Unresolved Maintenance Tickets
          supabase.from('maintenance_tickets').select('*').neq('status', 'resolved'),
          // 4. Bookings checking in today
          supabase.from('bookings')
            .select('*, profiles(first_name, last_name, phone, vip_status), rooms(room_number, name)')
            .eq('check_in_date', today)
            .in('status', ['confirmed', 'pending']),
          // 5. Bookings checked in currently
          supabase.from('bookings')
            .select('*, profiles(first_name, last_name, phone, vip_status), rooms(room_number, name)')
            .eq('status', 'checked_in'),
          // 6. Pending Guest Service Requests
          supabase.from('booking_services')
            .select('*, bookings(status, booking_reference, check_in_date, check_out_date, guest_id, guest_name, crm_guest_id, guest_email, rooms(room_number), profiles(first_name, last_name, phone)), services(name, icon_name, category)')
            .eq('status', 'pending')
            .eq('notes', 'dashboard_request'),
          // 7. Expired arrivals for No-Show Sweep
          supabase.from('bookings')
            .select('*, profiles(first_name, last_name, phone, vip_status), rooms(room_number, name)')
            .lt('check_in_date', today)
            .in('status', ['confirmed', 'pending']),
          // 8. Late checkout service requests (not cancelled)
          supabase.from('booking_services')
            .select('booking_id, status, services(name, category)')
            .neq('status', 'cancelled')
        ]);

        if (roomsRes.error) console.error("Rooms fetch error:", roomsRes.error);
        if (hTasksRes.error) console.error("Housekeeping fetch error:", hTasksRes.error);
        if (mTicketsRes.error) console.error("Maintenance fetch error:", mTicketsRes.error);
        if (arrivalsRes.error) console.error("Arrivals fetch error:", arrivalsRes.error);
        if (inHouseRes.error) console.error("In-house fetch error:", inHouseRes.error);
        if (sRequestsRes.error) console.error("Service Requests fetch error:", sRequestsRes.error);
        if (noShowsRes.error) console.error("No-Shows fetch error:", noShowsRes.error);
        if (lateCheckoutsRes?.error) console.error("Late Checkouts fetch error:", lateCheckoutsRes.error);

        // If essential queries fail due to database wake-up delay, trigger retry
        if (arrivalsRes.error || inHouseRes.error || roomsRes.error) {
          throw new Error("Critical database queries returned errors. The database might be sleeping.");
        }

        const rooms = roomsRes.data || [];
        const hTasks = hTasksRes.data || [];
        const mTickets = mTicketsRes.data || [];
        const bookings = [...(arrivalsRes.data || []), ...(inHouseRes.data || [])];
        const sRequests = (sRequestsRes.data || []).filter(req => req.bookings?.status !== 'cancelled');

        const arrivalsToday = bookings.filter(b => b.check_in_date === today && (b.status === 'confirmed' || b.status === 'pending'));
        const departuresToday = bookings.filter(b => b.check_out_date === today && b.status === 'checked_in');
        const currentlyInHouse = bookings.filter(b => b.status === 'checked_in');

        // Set states
        const totalRooms = rooms.length;
        const occupiedRooms = rooms.filter(r => r.status === 'occupied' || currentlyInHouse.some(b => b.room_id === r.id)).length;
        setStats({ totalRooms, occupiedRooms });
        setAvailableRooms(rooms.filter(r => r.status === 'available' && !currentlyInHouse.some(b => b.room_id === r.id)));
        setAllRooms(rooms);
        setHousekeepingTasks(hTasks);
        setMaintenanceTickets(mTickets);
        setServiceRequests(sRequests);
        setNoShowBookings(noShowsRes.data || []);
        
        const lateCheckouts = (lateCheckoutsRes?.data || []).filter(item => 
          item.services?.name?.toLowerCase()?.includes('late checkout') ||
          item.services?.category?.toLowerCase()?.includes('room add-ons')
        );
        setLateCheckoutBookings(lateCheckouts);

        setArrivals(arrivalsToday);
        setDepartures(departuresToday);
        setInHouse(currentlyInHouse);

        success = true;
      } catch (error) {
        console.warn(`Database connection attempt failed. Retrying... (${retries} attempts left)`, error);
        retries--;
        if (retries > 0) {
          // Wait 3 seconds to let the Supabase instance finish waking up
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          toast.error('Failed to load front desk data. Please refresh page.');
          console.error(error);
        }
      }
    }

    setLoading(false);
  };

  const fetchCalendarData = async () => {
    setCalendarLoading(true);
    try {
      const startStr = format(calendarStartDate, 'yyyy-MM-dd');
      const endStr = format(calendarEndDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(first_name, last_name, phone, vip_status), rooms(room_number, name, type)')
        .lt('check_in_date', endStr)
        .gt('check_out_date', startStr)
        .neq('status', 'cancelled');
        
      if (error) throw error;
      
      const activeBookings = data || [];
      
      setCalendarBookings(activeBookings);
    } catch (err) {
      console.error("Error fetching calendar bookings:", err);
      toast.error('Failed to load calendar bookings');
    } finally {
      setCalendarLoading(false);
    }
  };
  const handleAddGroupAccount = async (e) => {
    e.preventDefault();
    if (!newGroupForm.name.trim()) return toast.error("Group name is required");
    const toastId = toast.loading('Creating group account...');
    try {
      const { error } = await supabase.from('group_accounts').insert([{
        name: newGroupForm.name.trim(),
        group_type: newGroupForm.group_type,
        contact_name: newGroupForm.contact_name.trim(),
        contact_email: newGroupForm.contact_email.toLowerCase().trim(),
        contact_phone: newGroupForm.contact_phone.trim(),
        credit_limit: Number(newGroupForm.credit_limit) || 1000000.00,
        outstanding_balance: 0.00
      }]);

      if (error) throw error;

      toast.success(`Group "${newGroupForm.name}" created successfully!`, { id: toastId });
      setIsAddGroupOpen(false);
      setNewGroupForm({ name: '', group_type: 'Company', contact_name: '', contact_email: '', contact_phone: '', credit_limit: 1000000.00 });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to create group account', { id: toastId });
    }
  };

  const fetchWalletGuests = async () => {
    setIsLoadingWalletGuests(true);
    try {
      const guestsRes = await supabase.from('crm_guests').select('*').order('first_name');
      if (guestsRes.error) throw guestsRes.error;
      setWalletGuests(guestsRes.data || []);
      
      try {
        const { data, error } = await supabase.from('ar_accounts').select('*');
        if (error) throw error;
        setWalletARAccounts(data || []);
      } catch (arErr) {
        try {
          const { data: sysData } = await supabase.from('system_settings').select('*').eq('setting_key', 'ar_accounts').maybeSingle();
          if (sysData && sysData.setting_value) {
            const parsed = typeof sysData.setting_value === 'string' ? JSON.parse(sysData.setting_value) : sysData.setting_value;
            setWalletARAccounts(parsed || []);
          } else {
            const local = localStorage.getItem('luxe_ar_accounts');
            setWalletARAccounts(local ? JSON.parse(local) : []);
          }
        } catch (err) {
          setWalletARAccounts([]);
        }
      }
    } catch (err) {
      console.error("Failed to load guests for wallet activation:", err);
      toast.error("Failed to load guest list");
    } finally {
      setIsLoadingWalletGuests(false);
    }
  };

  const handleActivateGuestWallet = async (e) => {
    e.preventDefault();
    if (!walletForm.guest_id) return toast.error("Please select a guest");
    
    const matchedGuest = walletGuests.find(g => g.id === walletForm.guest_id);
    if (!matchedGuest) return toast.error("Guest not found");

    setIsActivatingWallet(true);
    const toastId = toast.loading(`Activating prepayment wallet for ${matchedGuest.first_name}...`);
    try {
      const initBal = Number(walletForm.initial_balance) || 0;
      
      // 1. Update wallet_balance in crm_guests
      const { error: guestErr } = await supabase
        .from('crm_guests')
        .update({ wallet_balance: initBal })
        .eq('id', matchedGuest.id);
      if (guestErr) throw guestErr;

      // 2. Insert into ar_accounts (with fallback)
      const newWallet = {
        id: 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        guest_id: matchedGuest.id,
        guest_name: `${matchedGuest.first_name || ''} ${matchedGuest.last_name || ''}`.trim() || matchedGuest.guest_name || 'Unnamed Guest',
        guest_email: matchedGuest.email || 'N/A',
        balance: initBal,
        status: 'active',
        created_at: new Date().toISOString()
      };

      try {
        const { error: arErr } = await supabase
          .from('ar_accounts')
          .insert([newWallet]);
        if (arErr) throw arErr;
      } catch (arErr) {
        console.warn("ar_accounts insert fallback, table missing:", arErr.message);
        const updatedAR = [...walletARAccounts, newWallet];
        try {
          await supabase.from('system_settings').upsert({
            setting_key: 'ar_accounts',
            setting_value: updatedAR
          }, { onConflict: 'setting_key' });
        } catch (sysErr) {
          console.warn("Failed to update system_settings on activation:", sysErr);
        }
        localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
      }

      // 3. Log Payment entry if initial balance is > 0
      if (initBal > 0) {
        const { error: payErr } = await supabase
          .from('payments')
          .insert([{
            booking_id: null,
            amount: initBal,
            currency: 'NGN',
            method: 'cash',
            status: 'completed',
            is_refund: false,
            transaction_ref: `AR-DEP-CASH-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`,
            notes: `Initial AR Wallet Prepayment Deposit logged for guest: ${matchedGuest.first_name} ${matchedGuest.last_name}`
          }]);
        if (payErr) console.warn("Failed to log initial deposit payment:", payErr.message);
      }

      toast.success(`AR Prepayment Wallet successfully activated for ${matchedGuest.first_name}!`, { id: toastId });
      setIsActivateWalletOpen(false);
      setWalletForm({ guest_id: '', initial_balance: '' });
      fetchFrontDeskData(false);
    } catch (err) {
      console.error(err);
      toast.error(`Activation failed: ${err.message}`, { id: toastId });
    } finally {
      setIsActivatingWallet(false);
    }
  };

  const handleDeactivateGuestWallet = async (guestId) => {
    if (!window.confirm("Are you sure you want to deactivate this guest's AR prepayment wallet? This will archive their prepayment ledger and disable wallet checkout.")) return;
    const toastId = toast.loading('Deactivating guest AR wallet...');
    try {
      const { error: crmErr } = await supabase.from('crm_guests').update({ wallet_balance: null }).eq('id', guestId);
      if (crmErr) throw crmErr;
      
      try {
        const { error: arErr } = await supabase.from('ar_accounts').delete().eq('guest_id', guestId);
        if (arErr) throw arErr;
      } catch (arErr) {
        console.warn("ar_accounts delete fallback, table missing:", arErr.message);
        const updatedAR = walletARAccounts.filter(acc => acc.guest_id !== guestId);
        try {
          await supabase.from('system_settings').upsert({
            setting_key: 'ar_accounts',
            setting_value: updatedAR
          }, { onConflict: 'setting_key' });
        } catch (sysErr) {
          console.warn("Failed to update system_settings on deactivation:", sysErr);
        }
        localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
      }

      toast.success(`AR Prepayment Wallet successfully deactivated!`, { id: toastId });
      fetchWalletGuests();
      fetchFrontDeskData(false);
    } catch (err) {
      console.error(err);
      toast.error(`Deactivation failed: ${err.message}`, { id: toastId });
    }
  };

  const handleAddFunds = async (e) => {
    e.preventDefault();
    if (!walletForm.guest_id) return toast.error("No guest selected");
    const matchedGuest = walletGuests.find(g => g.id === walletForm.guest_id);
    if (!matchedGuest) return toast.error("Guest not found");
    const amount = Number(addFundsAmount);
    if (amount <= 0) return toast.error("Please enter a valid amount");

    setIsProcessingAddFunds(true);
    const toastId = toast.loading(`Adding ₦${amount.toLocaleString()} to ${matchedGuest.first_name}'s wallet...`);
    try {
      const currentBalance = Number(matchedGuest.wallet_balance || 0);
      const newBalance = currentBalance + amount;
      
      // 1. Update wallet_balance in crm_guests
      const { error: crmErr } = await supabase.from('crm_guests').update({ wallet_balance: newBalance }).eq('id', matchedGuest.id);
      if (crmErr) throw crmErr;

      // 2. Insert into ar_accounts (with fallback)
      const arAcc = walletARAccounts.find(acc => acc.guest_id === matchedGuest.id);
      const targetWallet = {
        id: arAcc ? arAcc.id : ('ar_' + Math.random().toString(36).substring(2, 9).toUpperCase()),
        guest_id: matchedGuest.id,
        guest_name: `${matchedGuest.first_name || ''} ${matchedGuest.last_name || ''}`.trim() || matchedGuest.guest_name || 'Unnamed Guest',
        guest_email: matchedGuest.email || 'N/A',
        balance: newBalance,
        status: 'active',
        created_at: arAcc ? arAcc.created_at : new Date().toISOString()
      };

      let updatedAR;
      if (arAcc) {
        updatedAR = walletARAccounts.map(acc => 
          acc.guest_id === matchedGuest.id ? targetWallet : acc
        );
      } else {
        updatedAR = [...walletARAccounts, targetWallet];
      }

      try {
        const { error: arErr } = await supabase.from('ar_accounts').upsert([targetWallet]);
        if (arErr) throw arErr;
      } catch (arErr) {
        console.warn("ar_accounts update/insert fallback, table missing:", arErr.message);
        try {
          await supabase.from('system_settings').upsert({
            setting_key: 'ar_accounts',
            setting_value: updatedAR
          }, { onConflict: 'setting_key' });
        } catch (sysErr) {
          console.warn("Failed to update system_settings on deposit:", sysErr);
        }
        localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
      }

      // 3. Insert payment ledger entry
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: null,
          amount: amount,
          currency: 'NGN',
          method: addFundsMethod,
          status: 'completed',
          is_refund: false,
          transaction_ref: `AR-DEP-${addFundsMethod.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`,
          notes: `AR Prepayment Wallet Deposit logged via Front Office (Method: ${addFundsMethod.toUpperCase()}, Ref: ${addFundsRef || 'N/A'}) for guest: ${matchedGuest.first_name} ${matchedGuest.last_name} (${matchedGuest.email || 'N/A'})`
        }]);
      if (payErr) console.warn("Failed to log prepayment deposit to payments table:", payErr.message);

      toast.success(`₦${amount.toLocaleString()} successfully added to ${matchedGuest.first_name}'s wallet!`, { id: toastId });
      
      // Reset and close
      setIsAddFundsOpen(false);
      setAddFundsAmount('');
      setAddFundsRef('');
      
      // Refresh data
      await fetchWalletGuests();
      fetchFrontDeskData(false);
    } catch (err) {
      console.error(err);
      toast.error(`Deposit failed: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessingAddFunds(false);
    }
  };

  useEffect(() => {
    if (isActivateWalletOpen) {
      fetchWalletGuests();
      setWalletSearchQuery('');
    }
  }, [isActivateWalletOpen]);

  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendarData();
    }
  }, [activeTab, calendarStartDate, calendarEndDate]);

  useEffect(() => {
    const fetchCheckoutDetails = async () => {
      if (!activeCheckOut) {
        setUnpaidServices([]);
        setPendingCheckoutPayments([]);
        setCheckoutARProfile(null);
        setCheckoutPaymentMethod('ar');
        return;
      }
      setLoadingUnpaidServices(true);
      try {
        const { data: servicesData, error: servicesErr } = await supabase
          .from('booking_services')
          .select('*, services(name, tax_inclusive)')
          .eq('booking_id', activeCheckOut.id)
          .eq('payment_status', 'unpaid')
          .eq('status', 'completed');
        if (servicesErr) throw servicesErr;
        setUnpaidServices(servicesData || []);

        const { data: paymentsData, error: paymentsErr } = await supabase
          .from('payments')
          .select('*')
          .eq('booking_id', activeCheckOut.id)
          .eq('status', 'pending');
        if (paymentsErr) throw paymentsErr;
        setPendingCheckoutPayments(paymentsData || []);

        const crmGuestId = activeCheckOut.crm_guest_id;
        const guestEmail = activeCheckOut.guest_email || activeCheckOut.profiles?.email;
        if (crmGuestId || guestEmail) {
          let profile = null;
          if (crmGuestId) {
            const { data: crmData } = await supabase.from('crm_guests').select('*').eq('id', crmGuestId).maybeSingle();
            profile = crmData;
          } else if (guestEmail) {
            const { data: crmData } = await supabase.from('crm_guests').select('*').eq('email', guestEmail.toLowerCase()).maybeSingle();
            profile = crmData;
          }
          setCheckoutARProfile(profile);
        } else {
          setCheckoutARProfile(null);
        }
      } catch (err) {
        console.error("Failed to load checkout details:", err);
      } finally {
        setLoadingUnpaidServices(false);
      }
    };

    fetchCheckoutDetails();
  }, [activeCheckOut]);

  const handleExecuteNoShowSweep = async () => {
    if (noShowBookings.length === 0) return;
    setIsSweepingNoShows(true);
    const toastId = toast.loading("Executing Night Audit: sweeping No-Show reservations...");
    
    try {
      const bookingIds = noShowBookings.map(b => b.id);
      const roomIds = noShowBookings.map(b => b.room_id).filter(Boolean);
      
      // 1. Batch update bookings to 'no_show'
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({ status: 'no_show' })
        .in('id', bookingIds);
        
      if (bookingErr) throw bookingErr;
      
      // 2. Batch release rooms to 'available' if they are assigned
      if (roomIds.length > 0) {
        const { error: roomErr } = await supabase
          .from('rooms')
          .update({ status: 'available' })
          .in('id', roomIds);
          
        if (roomErr) throw roomErr;
      }
      
      toast.success(`✓ Reclaimed ${noShowBookings.length} rooms! Sweep completed successfully.`, { id: toastId });
      setIsNoShowSweepOpen(false);
      fetchFrontDeskData(false);
    } catch (err) {
      console.error(err);
      toast.error(`Sweep failed: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setIsSweepingNoShows(false);
    }
  };

  const getDaysArray = (start, end) => {
    const arr = [];
    const dt = new Date(start);
    while (dt <= end) {
      arr.push(format(new Date(dt), 'yyyy-MM-dd'));
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  };

  const getBookingStyle = (booking, days) => {
    const checkInStr = booking.check_in_date;
    const checkOutStr = booking.check_out_date;
    
    if (checkOutStr < days[0] || checkInStr > days[days.length - 1]) {
      return { display: 'none' };
    }
    
    let leftIndex = days.indexOf(checkInStr);
    if (leftIndex === -1) leftIndex = 0;
    
    let rightIndex = days.indexOf(checkOutStr);
    if (rightIndex === -1) rightIndex = days.length;
    
    const duration = rightIndex - leftIndex;
    const colWidth = 90; // Day column width in px
    
    const left = leftIndex * colWidth;
    const width = Math.max(1, duration) * colWidth;
    
    return {
      left: `${left + 6}px`,
      width: `${width - 12}px`,
      position: 'absolute',
      height: '38px',
      top: '8px',
      zIndex: 10
    };
  };

  const handleStartCheckIn = (booking) => {
    if (booking.status !== 'confirmed') {
      toast.error('Cannot check in guest. Booking must be confirmed first.');
      return;
    }
    setActiveCheckIn(booking);
    setCheckInStep(1);
  };

  const handleFinalizeCheckIn = async () => {
    if (!idVerified || !keyIssued || !signatureData) {
      return toast.error("Please complete all verification steps including signature.");
    }

    try {
      // Update Booking
      await supabase.from('bookings').update({ 
        status: 'checked_in',
        id_verified: idVerified,
        key_issued: keyIssued,
        has_signed: true,
        signature_data: signatureData
      }).eq('id', activeCheckIn.id);
      
      // Update Room
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', activeCheckIn.room_id);
      
      toast.success('Check-in completed successfully');

      // Trigger check-in automation
      try {
        const { data: fullBooking } = await supabase
          .from('bookings')
          .select('*, profiles(*), rooms(*)')
          .eq('id', activeCheckIn.id)
          .single();
        if (fullBooking) {
          triggerAutomationRules('check_in', fullBooking);
        }
      } catch (autoErr) {
        console.warn("Check-in automation trigger failed:", autoErr);
      }
      
      // Reset
      setActiveCheckIn(null);
      setCheckInStep(1);
      setIdVerified(false);
      setKeyIssued(false);
      setSignatureData(null);
      fetchFrontDeskData();
    } catch (err) {
      toast.error('Failed to complete check-in');
    }
  };

  const handleCancelArrivalBooking = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this expected arrival booking?")) return;
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      toast.success('Booking cancelled successfully');

      // Trigger cancellation automation
      try {
        const { data: fullBooking } = await supabase
          .from('bookings')
          .select('*, profiles(*), rooms(*)')
          .eq('id', id)
          .single();
        if (fullBooking) {
          triggerAutomationRules('booking_cancelled', fullBooking);
        }
      } catch (autoErr) {
        console.warn("Cancellation automation trigger failed:", autoErr);
      }

      fetchFrontDeskData(false);
    } catch (err) {
      toast.error('Failed to cancel booking: ' + err.message);
    }
  };

  const awardLoyaltyPoints = async (booking, actualNights, newTotal) => {
    try {
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'loyalty_settings')
        .maybeSingle();
      
      const settings = (settingsData && settingsData.setting_value) 
        ? (typeof settingsData.setting_value === 'string' ? JSON.parse(settingsData.setting_value) : settingsData.setting_value)
        : {
            points_per_night: 10,
            points_per_booking: 50,
            points_per_spend_amount: 5,
            spend_unit_amount: 10000,
            redemption_rate: 100,
            min_points_to_redeem: 50,
            frequent_tier_threshold: 200,
            vip_tier_threshold: 500
          };

      const guestEmail = booking.guest_email || booking.profiles?.email || 'N/A';
      if (!guestEmail || guestEmail === 'N/A') {
        console.warn("Cannot award loyalty points: Guest email is missing.");
        return;
      }

      let { data: guest } = await supabase
        .from('crm_guests')
        .select('*')
        .eq('email', guestEmail)
        .maybeSingle();

      if (!guest) {
        const newGuestId = 'g_' + Math.random().toString(36).substring(2, 9).toUpperCase();
        const first = booking.profiles?.first_name || booking.guest_name?.split(' ')[0] || 'Guest';
        const last = booking.profiles?.last_name || booking.guest_name?.split(' ').slice(1).join(' ') || 'Profile';
        
        const { data: newGuest, error: createErr } = await supabase
          .from('crm_guests')
          .insert([{
            id: newGuestId,
            first_name: first,
            last_name: last,
            email: guestEmail,
            phone: booking.guest_phone || booking.profiles?.phone || '',
            wallet_balance: null,
            loyalty_points: 0,
            segment: 'standard'
          }])
          .select()
          .single();
        if (createErr) throw createErr;
        guest = newGuest;
      }

      const spendPoints = Math.floor(Number(newTotal) / settings.spend_unit_amount) * settings.points_per_spend_amount;
      const nightPoints = Number(actualNights) * settings.points_per_night;
      const pointsEarned = settings.points_per_booking + nightPoints + spendPoints;

      if (pointsEarned <= 0) return;

      const currentPoints = guest.loyalty_points || 0;
      const newPoints = currentPoints + pointsEarned;

      let newSegment = guest.segment || 'standard';
      if (newPoints >= settings.vip_tier_threshold) {
        newSegment = 'vip';
      } else if (newPoints >= settings.frequent_tier_threshold) {
        newSegment = 'frequent';
      }

      const updatePayload = {
        loyalty_points: newPoints,
        segment: newSegment
      };
      if (newSegment === 'vip') {
        updatePayload.vip_status = true;
      }

      const { error: updateErr } = await supabase
        .from('crm_guests')
        .update(updatePayload)
        .eq('id', guest.id);

      if (updateErr) throw updateErr;

      if (!booking.crm_guest_id) {
        await supabase
          .from('bookings')
          .update({ crm_guest_id: guest.id })
          .eq('id', booking.id);
      }

      toast.success(`🎉 Guest earned ${pointsEarned} loyalty points! Total: ${newPoints} pts. Tier: ${newSegment.toUpperCase()}`, { duration: 6000 });
    } catch (err) {
      console.warn("Failed to award loyalty points:", err);
    }
  };

  const handleMarkAsNoShowOnly = async (booking) => {
    setRebookProcessing(true);
    const toastId = toast.loading(`Marking ${booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : booking.guest_name} as No-Show...`);
    try {
      // 1. Update booking status
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({ status: 'no_show' })
        .eq('id', booking.id);
      if (bookingErr) throw bookingErr;

      // 2. Release room
      if (booking.room_id) {
        const { error: roomErr } = await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('id', booking.room_id);
        if (roomErr) throw roomErr;
      }

      toast.success('Reservation status updated to No-Show & room released.', { id: toastId });
      setActiveNoShowModal(null);
      fetchFrontDeskData(false);
    } catch (err) {
      console.error(err);
      toast.error(`Operation failed: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setRebookProcessing(false);
    }
  };

  const handleConfirmRebooking = async (e) => {
    e.preventDefault();
    if (!rebookRoomId) {
      toast.error('Please select an available room.');
      return;
    }
    setRebookProcessing(true);
    const toastId = toast.loading('Processing guest rebooking...');
    try {
      const selectedRoom = rebookRoomsList.find(r => r.id === rebookRoomId);
      if (!selectedRoom) throw new Error('Selected room is invalid or unavailable.');

      const nights = Math.max(1, differenceInDays(new Date(rebookCheckOut), new Date(rebookCheckIn)));
      const newRoomPrice = Number(selectedRoom.base_price_ngn) * nights;
      const newTotalAmount = newRoomPrice + (activeNoShowModal.total_extras_price_ngn || 0);

      // Preserve payment but update date, status, room, and recalculated price.
      const amountPaid = Number(activeNoShowModal.amount_paid_ngn || 0);
      const newPaymentStatus = amountPaid >= newTotalAmount ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');

      // 1. Release original room
      if (activeNoShowModal.room_id) {
        const { error: oldRoomErr } = await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('id', activeNoShowModal.room_id);
        if (oldRoomErr) throw oldRoomErr;
      }

      // 2. Update booking details
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({
          check_in_date: rebookCheckIn,
          check_out_date: rebookCheckOut,
          room_id: rebookRoomId,
          total_room_price_ngn: newRoomPrice,
          total_amount_ngn: newTotalAmount,
          payment_status: newPaymentStatus,
          status: 'confirmed'
        })
        .eq('id', activeNoShowModal.id);
      if (updateErr) throw updateErr;

      // 3. Log ₦0 payment in stay ledger with notes = 'Rebook'
      const { error: paymentErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: activeNoShowModal.id,
          amount: 0,
          currency: 'NGN',
          method: 'rebook',
          status: 'completed',
          is_refund: false,
          transaction_ref: `REBOOK-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`,
          notes: 'Rebook'
        }]);
      if (paymentErr) console.warn("Failed to log rebooking payment ledger entry:", paymentErr);

      toast.success('Guest successfully rebooked for the new dates!', { id: toastId });
      setActiveNoShowModal(null);
      fetchFrontDeskData(false);
    } catch (err) {
      console.error(err);
      toast.error(`Rebooking failed: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setRebookProcessing(false);
    }
  };

  const handleFinalizeCheckOutEarly = async (unusedNightsValue, overpaidAmount) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const finalCheckOutDate = activeCheckOut.check_out_date > todayStr ? todayStr : activeCheckOut.check_out_date;
    const toastId = toast.loading("Processing checkout and understay ledger sync...");

    try {
      if (overpaidAmount > 0) {
        if (checkoutSettleMode === 'ar_wallet') {
          // --- Settle to AR Prepayment Wallet ---
          const guestEmail = activeCheckOut.guest_email || activeCheckOut.profiles?.email || 'N/A';
          
          // 1. Check if crm_guests record exists for the guest
          let matchedGuest = null;
          if (guestEmail && guestEmail !== 'N/A') {
            const { data: matchedData } = await supabase
              .from('crm_guests')
              .select('*')
              .eq('email', guestEmail)
              .maybeSingle();
            matchedGuest = matchedData;
          }

          if (!matchedGuest) {
            // Create guest CRM profile & active prepayment wallet automatically!
            const newGuestId = 'g_' + Math.random().toString(36).substring(2, 9).toUpperCase();
            const first = activeCheckOut.profiles?.first_name || activeCheckOut.guest_name.split(' ')[0] || 'Guest';
            const last = activeCheckOut.profiles?.last_name || activeCheckOut.guest_name.split(' ').slice(1).join(' ') || 'Profile';
            
            const { data: insertedGuest, error: crmErr } = await supabase
              .from('crm_guests')
              .insert([{
                id: newGuestId,
                first_name: first,
                last_name: last,
                email: guestEmail !== 'N/A' ? guestEmail : `guest_${Date.now()}@luxe.com`,
                phone: activeCheckOut.guest_phone || activeCheckOut.profiles?.phone || '',
                wallet_balance: overpaidAmount,
                segment: 'standard'
              }])
              .select()
              .single();
            
            if (crmErr) throw crmErr;
            matchedGuest = insertedGuest;

            // Activate in ar_accounts list table
            try {
              await supabase.from('ar_accounts').insert([{
                id: 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
                guest_id: matchedGuest.id,
                guest_name: `${matchedGuest.first_name} ${matchedGuest.last_name}`,
                guest_email: matchedGuest.email,
                balance: overpaidAmount,
                status: 'active',
                created_at: new Date().toISOString()
              }]);
            } catch (e) {
              console.warn("Auto ar_accounts activation error:", e.message);
            }
          } else {
            // Update existing guest CRM wallet balance
            const currentBal = Number(matchedGuest.wallet_balance || 0);
            const { error: crmUpdateErr } = await supabase
              .from('crm_guests')
              .update({ wallet_balance: currentBal + overpaidAmount })
              .eq('id', matchedGuest.id);
            
            if (crmUpdateErr) throw crmUpdateErr;

            // Make sure they are activated in ar_accounts table
            try {
              const { data: existsAR } = await supabase.from('ar_accounts').select('id').eq('guest_id', matchedGuest.id).maybeSingle();
              if (!existsAR) {
                await supabase.from('ar_accounts').insert([{
                  id: 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
                  guest_id: matchedGuest.id,
                  guest_name: `${matchedGuest.first_name} ${matchedGuest.last_name}`,
                  guest_email: matchedGuest.email,
                  balance: currentBal + overpaidAmount,
                  status: 'active',
                  created_at: new Date().toISOString()
                }]);
              } else {
                await supabase.from('ar_accounts').update({ balance: currentBal + overpaidAmount }).eq('guest_id', matchedGuest.id);
              }
            } catch (e) {
              console.warn("Existing ar_accounts synchronization error:", e.message);
            }
          }

          // 2. Log transfer payment transaction
          await supabase.from('payments').insert([{
            booking_id: activeCheckOut.id,
            amount: overpaidAmount,
            method: 'bank_transfer',
            status: 'completed',
            notes: `Auto-refunded early understay checkout to Guest AR Prepayment Wallet | Ref: ${activeCheckOut.booking_reference} for guest: ${matchedGuest.first_name} ${matchedGuest.last_name} (${matchedGuest.email || 'N/A'})`,
            transaction_ref: `AR-TRF-${Date.now()}`
          }]);
          
          toast.success(`₦${overpaidAmount.toLocaleString()} early checkout credit successfully transferred to Guest AR Wallet!`);
        } else {
          // --- Settle to Cash Refund ---
          // Log manual cash refund payout
          await supabase.from('payments').insert([{
            booking_id: activeCheckOut.id,
            amount: overpaidAmount,
            method: 'cash',
            status: 'completed',
            is_refund: true,
            notes: `Cash Refund payout for early checkout unused nights credit | Ref: ${activeCheckOut.booking_reference}`,
            transaction_ref: `CSH-RFD-${Date.now()}`
          }]);

          toast.success(`₦${overpaidAmount.toLocaleString()} early checkout cash refund payout successfully logged!`);
        }
      }

      // Update booking stay totals & paid amount to reflect actual stayed nights!
      const scheduledNights = Math.max(1, differenceInDays(new Date(activeCheckOut.check_out_date), new Date(activeCheckOut.check_in_date))) || 1;
      const actualNights = Math.max(1, differenceInDays(new Date(finalCheckOutDate), new Date(activeCheckOut.check_in_date))) || 1;
      const dailyRoomRate = Number(activeCheckOut.total_room_price_ngn || 0) / scheduledNights;
      const actualRoomPrice = dailyRoomRate * actualNights;
      const originalTotal = Number(activeCheckOut.total_amount_ngn || 0);
      const newTotal = originalTotal - unusedNightsValue;
      const newPaid = Number(activeCheckOut.amount_paid_ngn || 0) - overpaidAmount;

      // Award loyalty points
      await awardLoyaltyPoints(activeCheckOut, actualNights, newTotal);

      await supabase.from('bookings').update({ 
        status: 'checked_out',
        check_out_date: finalCheckOutDate,
        total_room_price_ngn: actualRoomPrice,
        total_amount_ngn: newTotal,
        amount_paid_ngn: newPaid,
        payment_status: 'paid'
      }).eq('id', activeCheckOut.id);

      // Mark all booking services under this booking as paid on checkout
      await supabase
        .from('booking_services')
        .update({ payment_status: 'paid' })
        .eq('booking_id', activeCheckOut.id);

      // Release Room
      await supabase.from('rooms').update({ status: 'available' }).eq('id', activeCheckOut.room_id);
      
      // Auto-schedule housekeeping task
      await supabase.from('housekeeping_tasks').insert([{
        room_id: activeCheckOut.room_id,
        task_type: 'checkout_cleaning',
        status: 'pending',
        assigned_date: format(new Date(), 'yyyy-MM-dd'),
        notes: `Auto-generated upon checkout of booking ${activeCheckOut.booking_reference}`
      }]);

      // Trigger alerts
      triggerAutomationRules('checkout', activeCheckOut);

      toast.success('Check-out finalized & stay ledger balanced perfectly!', { id: toastId });
      setActiveCheckOut(null);
      fetchFrontDeskData();
    } catch (err) {
      console.error(err);
      toast.error(`Checkout settlement failed: ${err.message}`, { id: toastId });
    }
  };

  const handleRegisterVisitor = async (e) => {
    e.preventDefault();
    if(!visitorName || !visitorId || !visitorPhone) return toast.error("Name, Phone, and ID are required.");
    
    try {
      const existingVisitors = activeVisitorRegistration.registered_visitors || [];
      const newVisitor = { 
        id: 'vis_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        name: visitorName, 
        phone: visitorPhone,
        id_number: visitorId, 
        purpose: visitorPurpose || 'Social Visit',
        check_in_time: new Date().toISOString(), 
        check_out_time: null,
        status: 'active' 
      };
      
      await supabase.from('bookings').update({
        registered_visitors: [...existingVisitors, newVisitor]
      }).eq('id', activeVisitorRegistration.id);

      toast.success(`Visitor ${visitorName} signed in for Room ${activeVisitorRegistration.rooms?.room_number}`);
      setActiveVisitorRegistration(null);
      setVisitorName('');
      setVisitorId('');
      setVisitorPhone('');
      setVisitorPurpose('');
      fetchFrontDeskData();
      if (activeTab === 'visitors') fetchVisitors();
    } catch (err) {
      toast.error('Failed to register visitor');
    }
  };

  const handleSignOutVisitor = async (booking, visitorUniqueId) => {
    try {
      const updatedVisitors = (booking.registered_visitors || []).map(v => {
        if (v.id === visitorUniqueId || (!v.id && v.id_number === visitorUniqueId)) {
          return {
            ...v,
            status: 'checked_out',
            check_out_time: new Date().toISOString()
          };
        }
        return v;
      });

      const { error } = await supabase
        .from('bookings')
        .update({ registered_visitors: updatedVisitors })
        .eq('id', booking.id);

      if (error) throw error;
      toast.success(`Visitor signed out successfully`);
      fetchFrontDeskData();
      if (activeTab === 'visitors') fetchVisitors();
    } catch (err) {
      console.error("Error signing out visitor:", err);
      toast.error("Failed to sign out visitor");
    }
  };

  const fetchVisitors = async () => {
    setLoadingVisitors(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(first_name, last_name, phone, vip_status), rooms(room_number, name)')
        .not('registered_visitors', 'is', null);
        
      if (error) throw error;
      
      const flatList = [];
      (data || []).forEach(booking => {
        if (Array.isArray(booking.registered_visitors)) {
          booking.registered_visitors.forEach(visitor => {
            flatList.push({
              ...visitor,
              booking,
            });
          });
        }
      });
      
      flatList.sort((a, b) => new Date(b.check_in_time || b.time_in) - new Date(a.check_in_time || a.time_in));
      
      setVisitorsData(flatList);
    } catch (err) {
      console.error("Error fetching visitor registry logs:", err);
      toast.error("Failed to load visitor logs");
    } finally {
      setLoadingVisitors(false);
    }
  };

  const handleOpenAddService = async (booking) => {
    setActiveAddServiceBooking(booking);
    setServiceQuantity(1);
    setServiceDate(format(new Date(), 'yyyy-MM-dd'));
    setServiceTime('12:00');
    setSelectedServiceId('');
    setServiceNotes('');
    setSelectedServicesList([]);
    setBulkSelections({});
    setIsMealsSelected(false);
    setKitchenMenuTab('Breakfast');
    
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true);
        
      if (error) throw error;
      
      // Filter out POS and restaurant items from standard catalog selection, and explicitly exclude breakfast
      const standard = (data || []).filter(s => 
        !['bar', 'restaurant', 'kitchen'].includes(s.internal_notes?.toLowerCase().trim() || '') &&
        !s.name?.toLowerCase().includes('breakfast')
      );
      const foodItems = (data || []).filter(s => 
        s.internal_notes?.toLowerCase().trim() === 'restaurant'
      );
      
      // Add virtual Meals grouping item if food items exist
      const withVirtual = [...standard];
      if (foodItems.length > 0) {
        withVirtual.push({
          id: 'meals-virtual',
          name: 'Meals',
          pricing_type: 'fixed',
          base_price_ngn: 0,
          internal_notes: 'virtual',
          scheduling_required: false
        });
      }
      
      setAvailableServices(withVirtual);
      setFoodMenuServices(foodItems);
      
      if (withVirtual.length > 0) {
        setSelectedServiceId(withVirtual[0].id);
      }
      if (foodItems.length > 0) {
        setSelectedFoodServiceId(foodItems[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load add-on services');
    }
  };

  const handleAddServiceToList = () => {
    if (!selectedServiceId) return toast.error('Please select a service.');
    const service = selectedService;
    if (!service) return toast.error('Selected service not found.');
    
    // Check if service already added to list
    const exists = selectedServicesList.some(item => item.service_id === service.id);
    if (exists) {
      return toast.error(`"${service.name}" is already in your request list.`);
    }

    const totalNights = Math.max(1, differenceInDays(
      new Date(activeAddServiceBooking.check_out_date),
      new Date(activeAddServiceBooking.check_in_date)
    )) || 1;
    
    let unitPrice = Number(service.base_price_ngn);
    let totalPrice = calculatedServicePrice;
    
    const isRestaurant = service.internal_notes?.toLowerCase().trim() === 'restaurant';
    
    const cartItem = {
      id: Math.random().toString(36).substring(2, 9),
      service_id: service.id,
      name: service.name,
      quantity: serviceQuantity,
      unit_price_ngn: unitPrice,
      total_price_ngn: totalPrice,
      scheduled_date: service.scheduling_required ? serviceDate : null,
      scheduled_time: service.scheduling_required ? serviceTime : null,
      is_restaurant: isRestaurant,
      notes: serviceNotes.trim()
    };
    
    setSelectedServicesList([...selectedServicesList, cartItem]);
    toast.success(`✓ "${service.name}" added to request list.`);
    
    // Reset inputs
    setServiceNotes('');
    setServiceQuantity(1);
  };

  const handleAddServiceSubmit = async (e) => {
    e.preventDefault();
    if (selectedServicesList.length === 0) {
      return toast.error('Please add at least one service to the request list.');
    }
    
    setIsAddingService(true);
    const toastId = toast.loading(`Charging ${selectedServicesList.length} stay enhancements to room folio...`);
    
    try {
      const payloads = selectedServicesList.map(item => ({
        booking_id: activeAddServiceBooking.id,
        service_id: item.service_id,
        quantity: item.quantity,
        unit_price_ngn: item.unit_price_ngn,
        total_price_ngn: item.total_price_ngn,
        scheduled_date: item.scheduled_date,
        scheduled_time: item.scheduled_time,
        status: item.is_restaurant ? 'confirmed' : 'scheduled',
        notes: item.is_restaurant
          ? `restaurant_order: ${item.notes || 'Ordered by Front Desk'}`
          : (item.notes ? `front_desk_request: ${item.notes}` : 'front_desk_request'),
        payment_status: 'unpaid'
      }));
      
      const { error } = await supabase.from('booking_services').insert(payloads);
      if (error) throw error;
      
      toast.success(`✓ ${selectedServicesList.length} services successfully added to stay folio!`, { id: toastId });
      setActiveAddServiceBooking(null);
      setSelectedServicesList([]);
      fetchFrontDeskData(false);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to add services: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setIsAddingService(false);
    }
  };

  const handleUpdateServiceStatus = async (requestId, newStatus) => {
    const toastId = toast.loading('Updating service request...');
    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;
      toast.success(`Service request successfully marked as ${newStatus}!`, { id: toastId });
      fetchFrontDeskData(false);
    } catch (err) {
      toast.error('Failed to update service request status', { id: toastId });
      console.error(err);
    }
  };

  const handleNotifyFinance = async (requestId) => {
    const toastId = toast.loading('Notifying finance department...');
    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ 
          notified_finance: true,
          payment_status: 'awaiting_confirmation'
        })
        .eq('id', requestId);

      if (error) throw error;
      toast.success('Finance team has been successfully notified to confirm payment!', { id: toastId });
      fetchFrontDeskData(false);
    } catch (err) {
      toast.error('Failed to notify finance', { id: toastId });
      console.error(err);
    }
  };

  const handleARServiceDeduction = async (req) => {
    const toastId = toast.loading('Processing AR wallet deduction for stay enhancement...');
    try {
      const amount = Number(req.total_price_ngn);
      const crmGuestId = req.bookings?.crm_guest_id;
      const guestEmail = req.bookings?.guest_email || req.bookings?.profiles?.email;

      if (!crmGuestId && !guestEmail) {
        toast.error("Cannot resolve CRM guest account. AR deduction failed.", { id: toastId });
        return;
      }

      let guestProfile = null;
      if (crmGuestId) {
        const { data } = await supabase.from('crm_guests').select('*').eq('id', crmGuestId).maybeSingle();
        guestProfile = data;
      } else if (guestEmail) {
        const { data } = await supabase.from('crm_guests').select('*').eq('email', guestEmail.toLowerCase()).maybeSingle();
        guestProfile = data;
      }

      if (!guestProfile) {
        toast.error("CRM Guest Profile not found. Cannot deduct from AR Wallet.", { id: toastId });
        return;
      }

      const currentWalletBalance = Number(guestProfile.wallet_balance || 0);
      if (currentWalletBalance < amount) {
        toast.error(`Insufficient AR wallet balance. Available: ₦${currentWalletBalance.toLocaleString()}`, { id: toastId });
        return;
      }

      // 1. Deduct balance from crm_guests
      const newWalletBalance = currentWalletBalance - amount;
      const { error: walletErr } = await supabase
        .from('crm_guests')
        .update({ wallet_balance: newWalletBalance })
        .eq('id', guestProfile.id);

      if (walletErr) throw walletErr;

      // 2. Synchronize ar_accounts
      let arAccountsList = [];
      try {
        const { data } = await supabase.from('ar_accounts').select('*');
        if (data) arAccountsList = data;
      } catch {}

      const existingAr = arAccountsList.find(a => a.guest_id === guestProfile.id);
      const updatedArRecord = {
        id: existingAr ? existingAr.id : `ar_` + Math.random().toString(36).substring(2, 9).toUpperCase(),
        guest_id: guestProfile.id,
        guest_name: `${guestProfile.first_name || ''} ${guestProfile.last_name || ''}`.trim() || guestProfile.guest_name || 'Unnamed Guest',
        guest_email: guestProfile.email || 'N/A',
        balance: newWalletBalance,
        status: 'active',
        created_at: existingAr ? existingAr.created_at : new Date().toISOString()
      };

      try {
        await supabase.from('ar_accounts').upsert([updatedArRecord]);
      } catch (err) {
        console.warn("ar_accounts upsert fallback in frontdesk service billing", err);
      }

      // 3. Increment booking paid amount in bookings table
      const { data: bookingData, error: bookErr } = await supabase
        .from('bookings')
        .select('amount_paid_ngn')
        .eq('id', req.booking_id)
        .single();

      if (bookErr) throw bookErr;
      const currentPaid = Number(bookingData.amount_paid_ngn || 0);
      const newPaid = currentPaid + amount;

      const { error: bUpdateErr } = await supabase
        .from('bookings')
        .update({ amount_paid_ngn: newPaid })
        .eq('id', req.booking_id);

      if (bUpdateErr) throw bUpdateErr;

      // 4. Log payment record (method: 'cash' and notes containing 'AR Prepayment Wallet')
      const txnRef = `AR-BK-FD-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: req.booking_id,
          amount: amount,
          method: 'cash',
          status: 'completed',
          notes: `Paid from Guest AR Prepayment Wallet for stay enhancement: ${req.services?.name || 'Enhancement'} (Ref: ${req.id}) for guest: ${guestProfile.first_name} ${guestProfile.last_name} (${guestProfile.email || 'N/A'})`,
          transaction_ref: txnRef
        }]);

      if (payErr) throw payErr;

      // 5. Update service status to 'scheduled' and payment_status to 'paid'
      const { error: servErr } = await supabase
        .from('booking_services')
        .update({ 
          status: 'scheduled',
          payment_status: 'paid'
        })
        .eq('id', req.id);

      if (servErr) throw servErr;

      toast.success(`✓ Deducted ₦${amount.toLocaleString()} from AR Wallet & enhancement approved!`, { id: toastId });
      fetchFrontDeskData(false);
    } catch (err) {
      toast.error(`AR deduction failed: ${err.message || 'Error occurred'}`, { id: toastId });
      console.error(err);
    }
  };

  const handleSettleFolioViaAR = async () => {
    if (!activeCheckOut) return;
    const unpaidServicesTotal = (unpaidServices || []).reduce((sum, s) => {
      const isTaxable = s.services?.tax_inclusive !== false;
      const basePrice = Number(s.total_price_ngn || 0);
      const tax = isTaxable ? basePrice * 0.075 : 0;
      return sum + basePrice + tax;
    }, 0);
    if (unpaidServicesTotal <= 0) return;

    const toastId = toast.loading(`Settle ₦${unpaidServicesTotal.toLocaleString()} folio extras via AR Wallet...`);
    try {
      const crmGuestId = activeCheckOut.crm_guest_id;
      const guestEmail = activeCheckOut.guest_email || activeCheckOut.profiles?.email;

      if (!crmGuestId && !guestEmail) {
        toast.error("Cannot resolve CRM guest account. Settle failed.", { id: toastId });
        return;
      }

      let guestProfile = null;
      if (crmGuestId) {
        const { data } = await supabase.from('crm_guests').select('*').eq('id', crmGuestId).maybeSingle();
        guestProfile = data;
      } else if (guestEmail) {
        const { data } = await supabase.from('crm_guests').select('*').eq('email', guestEmail.toLowerCase()).maybeSingle();
        guestProfile = data;
      }

      if (!guestProfile) {
        toast.error("CRM Guest Profile not found. Cannot charge to AR Wallet.", { id: toastId });
        return;
      }

      const currentWalletBalance = Number(guestProfile.wallet_balance || 0);
      if (currentWalletBalance < unpaidServicesTotal) {
        toast.error(`Insufficient AR wallet balance. Available: ₦${currentWalletBalance.toLocaleString()}`, { id: toastId });
        return;
      }

      // 1. Deduct balance from crm_guests
      const newWalletBalance = currentWalletBalance - unpaidServicesTotal;
      const { error: walletErr } = await supabase
        .from('crm_guests')
        .update({ wallet_balance: newWalletBalance })
        .eq('id', guestProfile.id);

      if (walletErr) throw walletErr;

      // 2. Synchronize ar_accounts
      let arAccountsList = [];
      try {
        const { data } = await supabase.from('ar_accounts').select('*');
        if (data) arAccountsList = data;
      } catch {}

      const existingAr = arAccountsList.find(a => a.guest_id === guestProfile.id);
      const updatedArRecord = {
        id: existingAr ? existingAr.id : `ar_` + Math.random().toString(36).substring(2, 9).toUpperCase(),
        guest_id: guestProfile.id,
        guest_name: `${guestProfile.first_name || ''} ${guestProfile.last_name || ''}`.trim() || guestProfile.guest_name || 'Unnamed Guest',
        guest_email: guestProfile.email || 'N/A',
        balance: newWalletBalance,
        status: 'active',
        created_at: existingAr ? existingAr.created_at : new Date().toISOString()
      };

      try {
        await supabase.from('ar_accounts').upsert([updatedArRecord]);
      } catch (err) {
        console.warn("ar_accounts upsert fallback in checkout folio settlement", err);
      }

      // 3. Increment booking paid amount in bookings table
      const { data: bookingData, error: bookErr } = await supabase
        .from('bookings')
        .select('amount_paid_ngn')
        .eq('id', activeCheckOut.id)
        .single();

      if (bookErr) throw bookErr;
      const currentPaid = Number(bookingData.amount_paid_ngn || 0);
      const newPaid = currentPaid + unpaidServicesTotal;

      const { error: bUpdateErr } = await supabase
        .from('bookings')
        .update({ amount_paid_ngn: newPaid })
        .eq('id', activeCheckOut.id);

      if (bUpdateErr) throw bUpdateErr;

      // 4. Log payment record (method: 'cash' and notes containing 'AR Prepayment Wallet')
      const txnRef = `AR-BK-FD-CO-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const srvNames = (unpaidServices || []).map(s => s.services?.name || 'Extra').join(', ');
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: activeCheckOut.id,
          amount: unpaidServicesTotal,
          method: 'cash',
          status: 'completed',
          notes: `Paid from Guest AR Prepayment Wallet for checkout folio extras: ${srvNames} | Ref: ${activeCheckOut.booking_reference} for guest: ${guestProfile.first_name} ${guestProfile.last_name} (${guestProfile.email || 'N/A'})`,
          transaction_ref: txnRef
        }]);

      if (payErr) throw payErr;

      // 5. Update all these unpaid completed services to paid
      const serviceIds = (unpaidServices || []).map(s => s.id);
      const { error: servErr } = await supabase
        .from('booking_services')
        .update({ payment_status: 'paid' })
        .in('id', serviceIds);

      if (servErr) throw servErr;

      toast.success(`✓ Successfully settled ₦${unpaidServicesTotal.toLocaleString()} via AR Prepayment Wallet!`, { id: toastId });
      
      // Update local state to reflect paid status
      setUnpaidServices([]);
      fetchFrontDeskData(false);
    } catch (err) {
      toast.error(`Failed to settle folio extras: ${err.message || 'Error occurred'}`, { id: toastId });
      console.error(err);
    }
  };

  const handleSettleARAndCheckout = async (amountToDeduct, unusedNightsValue) => {
    if (!activeCheckOut || !checkoutARProfile) return;
    setCheckoutProcessing(true);
    const toastId = toast.loading(`Settle ₦${amountToDeduct.toLocaleString()} outstanding folio via AR Wallet...`);
    try {
      const currentWalletBalance = Number(checkoutARProfile.wallet_balance || 0);
      if (currentWalletBalance < amountToDeduct) {
        throw new Error(`Insufficient AR Wallet balance. Available: ₦${currentWalletBalance.toLocaleString()}`);
      }

      // 1. Deduct balance from crm_guests
      const newWalletBalance = currentWalletBalance - amountToDeduct;
      const { error: walletErr } = await supabase
        .from('crm_guests')
        .update({ wallet_balance: newWalletBalance })
        .eq('id', checkoutARProfile.id);

      if (walletErr) throw walletErr;

      // 2. Synchronize ar_accounts
      try {
        const { data: existsAR } = await supabase.from('ar_accounts').select('id').eq('guest_id', checkoutARProfile.id).maybeSingle();
        if (!existsAR) {
          await supabase.from('ar_accounts').insert([{
            id: 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            guest_id: checkoutARProfile.id,
            guest_name: `${checkoutARProfile.first_name || ''} ${checkoutARProfile.last_name || ''}`.trim() || 'Unnamed Guest',
            guest_email: checkoutARProfile.email || 'N/A',
            balance: newWalletBalance,
            status: 'active',
            created_at: new Date().toISOString()
          }]);
        } else {
          await supabase.from('ar_accounts').update({ balance: newWalletBalance }).eq('guest_id', checkoutARProfile.id);
        }
      } catch (arErr) {
        console.warn("AR Account sync error:", arErr.message);
      }

      // 3. Log a completed payment in payments table
      const txnRef = `AR-BK-FD-CO-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: activeCheckOut.id,
          amount: amountToDeduct,
          method: 'cash',
          status: 'completed',
          notes: `Checkout outstanding balance settled via AR Wallet | Ref: ${activeCheckOut.booking_reference} for guest: ${checkoutARProfile.first_name} ${checkoutARProfile.last_name} (${checkoutARProfile.email || 'N/A'})`,
          transaction_ref: txnRef
        }]);

      if (payErr) throw payErr;

      // 4. Update booking paid amount
      const currentPaid = Number(activeCheckOut.amount_paid_ngn || 0);
      const newPaid = currentPaid + amountToDeduct;

      const { error: bookingUpdateErr } = await supabase
        .from('bookings')
        .update({ amount_paid_ngn: newPaid })
        .eq('id', activeCheckOut.id);

      if (bookingUpdateErr) throw bookingUpdateErr;

      // 5. Finalize the checkout! Update check_out_date, status, rooms, housekeeping
      const scheduledNights = Math.max(1, differenceInDays(new Date(activeCheckOut.check_out_date), new Date(activeCheckOut.check_in_date))) || 1;
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const finalCheckOutDate = activeCheckOut.check_out_date > todayStr ? todayStr : activeCheckOut.check_out_date;
      const actualNights = Math.max(1, differenceInDays(new Date(finalCheckOutDate), new Date(activeCheckOut.check_in_date))) || 1;
      const dailyRoomRate = Number(activeCheckOut.total_room_price_ngn || 0) / scheduledNights;
      const actualRoomPrice = dailyRoomRate * actualNights;
      const originalTotal = Number(activeCheckOut.total_amount_ngn || 0);
      const newTotal = originalTotal - unusedNightsValue;
      
      // Award loyalty points
      await awardLoyaltyPoints(activeCheckOut, actualNights, newTotal);

      const { error: finalCheckoutErr } = await supabase.from('bookings').update({ 
        status: 'checked_out',
        check_out_date: finalCheckOutDate,
        total_room_price_ngn: actualRoomPrice,
        total_amount_ngn: newTotal,
        amount_paid_ngn: newPaid,
        payment_status: 'paid'
      }).eq('id', activeCheckOut.id);

      if (finalCheckoutErr) throw finalCheckoutErr;

      // Mark all booking services under this booking as paid on checkout
      await supabase
        .from('booking_services')
        .update({ payment_status: 'paid' })
        .eq('booking_id', activeCheckOut.id);

      // Release Room
      await supabase.from('rooms').update({ status: 'available' }).eq('id', activeCheckOut.room_id);
      
      // Auto-schedule housekeeping task
      await supabase.from('housekeeping_tasks').insert([{
        room_id: activeCheckOut.room_id,
        task_type: 'checkout_cleaning',
        status: 'pending',
        assigned_date: format(new Date(), 'yyyy-MM-dd'),
        notes: `Auto-generated upon checkout of booking ${activeCheckOut.booking_reference}`
      }]);

      // Trigger alerts
      triggerAutomationRules('checkout', activeCheckOut);

      toast.success('✓ Outstanding balance settled via AR & Guest Checked out successfully!', { id: toastId });
      setActiveCheckOut(null);
      fetchFrontDeskData();
    } catch (err) {
      toast.error(`Checkout settlement failed: ${err.message}`, { id: toastId });
      console.error(err);
    } finally {
      setCheckoutProcessing(false);
    }
  };

  const handleLogPendingCheckoutPayment = async (amountToPay) => {
    if (!activeCheckOut) return;
    setCheckoutProcessing(true);
    const toastId = toast.loading(`Logging pending payment of ₦${amountToPay.toLocaleString()}...`);
    try {
      const txnRef = `PEND-CO-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: activeCheckOut.id,
          amount: amountToPay,
          method: checkoutPaymentMethod,
          status: 'pending',
          notes: `Checkout payment awaiting finance confirmation | Ref: ${activeCheckOut.booking_reference}`,
          transaction_ref: txnRef
        }]);

      if (payErr) throw payErr;

      toast.success('✓ Payment logged! Awaiting Finance confirmation to complete checkout.', { id: toastId });
      
      // Reload pending checkout payments list to block checkout instantly
      const { data: pData } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', activeCheckOut.id)
        .eq('status', 'pending');
      setPendingCheckoutPayments(pData || []);
    } catch (err) {
      toast.error(`Failed to log payment: ${err.message}`, { id: toastId });
      console.error(err);
    } finally {
      setCheckoutProcessing(false);
    }
  };

  const todayStr = format(currentTime || new Date(), 'yyyy-MM-dd');
  const isFrontOfficeClosed = departmentalClosures.some(c => c.department === 'front_office' && c.business_date === todayStr);

  const occupancyRate = stats.totalRooms === 0 ? 0 : Math.round((stats.occupiedRooms / stats.totalRooms) * 100);

  return (
    <div className="space-y-6 pb-20">
      {isFrontOfficeClosed && (
        <div className="bg-red-500/10 border-2 border-red-500/35 text-red-200 p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg shadow-red-500/5">
          <div className="flex items-center gap-4">
            <AlertTriangle size={24} className="text-red-500 animate-bounce flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-extrabold text-sm uppercase tracking-wider text-white">Front Office Ledger Closed for Today</h4>
              <p className="text-xs text-red-300/95 mt-0.5 font-medium">
                All front office operations including suite bookings, stay transfers, guest check-ins/check-outs, and guest wallet operations are locked. Contact a super admin, admin or hotel manager to re-open the daily ledger.
              </p>
            </div>
          </div>
          {profile && ['super_admin', 'admin', 'hotel_manager', 'hotel_owner'].includes(profile.role) && (
            <button 
              onClick={handleReopenFrontOffice}
              className="bg-red-600 hover:bg-red-500 text-white font-extrabold px-4 py-2 rounded-lg text-xs transition-all duration-200 shadow-md flex-shrink-0 active:scale-95 cursor-pointer"
            >
              Reopen Ledger
            </button>
          )}
        </div>
      )}
      {/* Header Panel */}
      <div className="bg-dark-800 border border-dark-700 p-6 shadow-sm flex flex-col md:flex-row justify-between items-center rounded-lg">
        <div>
          <h1 className="text-2xl font-bold text-white">Front Desk & Reception</h1>
          <p className="text-gray-200 flex items-center gap-2 mt-1">
            <CalendarIcon size={16} />
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-4">
          {hasAccess('Store Keeping - Log Requisitions') && (
            <button onClick={() => setIsRequisitionOpen(true)} className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white py-2 px-4 flex items-center gap-2 mr-2 rounded text-sm font-bold transition-all shadow">
              <Archive size={16}/> Store Requisition
            </button>
          )}
          <button 
            onClick={() => {
              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
              setIsActivateWalletOpen(true);
            }} 
            disabled={isFrontOfficeClosed}
            className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white py-2 px-4 flex items-center gap-2 mr-2 rounded text-sm font-bold transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Wallet size={16}/>
            <span>Activate Guest Wallet</span>
          </button>
          <button 
            onClick={() => {
              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
              setIsAddGroupOpen(true);
            }} 
            disabled={isFrontOfficeClosed}
            className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white py-2 px-4 flex items-center gap-2 mr-2 rounded text-sm font-bold transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Users size={16}/>
            <span>New Group Account</span>
          </button>
          <button 
            onClick={() => {
              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
              setIsNoShowSweepOpen(true);
            }}
            disabled={isFrontOfficeClosed}
            className={`relative py-2 px-4 flex items-center gap-2 mr-2 rounded text-sm font-bold transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed ${
              noShowBookings.length > 0
                ? 'bg-amber-500/10 hover:bg-amber-500 border border-amber-500/30 text-amber-400 hover:text-dark-900'
                : 'bg-dark-700 hover:bg-dark-600 border border-dark-600 text-gray-300'
            }`}
            title={`${noShowBookings.length} expired arrival(s) detected`}
          >
            <ShieldCheck size={16} />
            <span>Sweep No-Shows</span>
            {noShowBookings.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444] animate-pulse"></span>
            )}
          </button>
          {(() => {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const closure = departmentalClosures.find(c => c.department === 'front_office' && c.business_date === todayStr);
            return closure ? (
              <div className="bg-green-500/10 text-green-400 border border-green-500/25 px-4 py-2 rounded text-xs font-bold flex items-center gap-2 mr-2">
                <CheckCircle size={14} className="text-green-500" />
                <span>Closed today by {closure.staff_name}</span>
              </div>
            ) : (
              <button 
                onClick={handleCompileCloseOfDayFrontDesk}
                disabled={isCompilingCloseOfDay}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-dark-950 px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer mr-2"
              >
                <Clock size={14} />
                <span>Close of Day</span>
              </button>
            );
          })()}
          <button 
            onClick={() => {
              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
              setIsNewBookingModalOpen(true);
            }} 
            disabled={isFrontOfficeClosed}
            className="btn-primary py-2 px-4 flex items-center gap-2 mr-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={18}/> New Booking
          </button>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-sm text-gray-300 uppercase tracking-widest">Local Time</p>
          </div>
          <div className="h-12 w-px bg-dark-700 hidden md:block"></div>
          <div className="text-right">
            <p className="text-3xl font-bold text-brand-500">{occupancyRate}%</p>
            <p className="text-sm text-gray-300 uppercase tracking-widest">Occupancy</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-dark-700 overflow-x-auto">
        <button onClick={() => setActiveTab('overview')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
          <Search size={18} /> Front Desk Overview
        </button>
        <button onClick={() => setActiveTab('matrix')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'matrix' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
          <LayoutGrid size={18} /> Room Status Grid
        </button>
        <button onClick={() => setActiveTab('calendar')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'calendar' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
          <CalendarIcon size={18} /> Booking Calendar
        </button>
        <button onClick={() => setActiveTab('visitors')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'visitors' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
          <Users size={18} /> Visitor Registry Logs
        </button>
        {hasAccess('Reservations') && (
          <button onClick={() => setActiveTab('reservations')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'reservations' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
            <CalendarDays size={18} /> Suite Bookings (Reservations)
          </button>
        )}
        {hasAccess('Lost & Found') && (
          <button onClick={() => setActiveTab('lostfound')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'lostfound' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
            <SearchCheck size={18} /> Lost & Found Items
          </button>
        )}
        {hasAccess('Finance & Billing') && (
          <button onClick={() => setActiveTab('billing')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'billing' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
            <FileText size={18} /> Folios & Billing
          </button>
        )}
        {hasAccess('Halls & Catering') && (
          <button onClick={() => setActiveTab('halls')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'halls' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
            <Sparkles size={18} /> Halls & Catering
          </button>
        )}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-800 border border-dark-700 p-5 shadow-sm border-l-4 border-l-brand-500 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-200 font-medium">Arrivals Today</p>
              <h3 className="text-3xl font-bold text-white mt-1">{arrivals.length}</h3>
            </div>
            <div className="p-2 bg-brand-500/10 text-brand-500 rounded"><LogIn size={20} /></div>
          </div>
        </div>
        <div className="bg-dark-800 border border-dark-700 p-5 shadow-sm border-l-4 border-l-gray-400 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-200 font-medium">Departures Today</p>
              <h3 className="text-3xl font-bold text-white mt-1">{departures.length}</h3>
            </div>
            <div className="p-2 bg-dark-700 text-gray-300 rounded"><LogOut size={20} /></div>
          </div>
        </div>
        <div className="bg-dark-800 border border-dark-700 p-5 shadow-sm border-l-4 border-l-blue-500 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-200 font-medium">In-House Guests</p>
              <h3 className="text-3xl font-bold text-white mt-1">{inHouse.length}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded"><UserCheck size={20} /></div>
          </div>
        </div>
        <div className="bg-dark-800 border border-dark-700 p-5 shadow-sm border-l-4 border-l-green-500 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-200 font-medium">Available Rooms</p>
              <h3 className="text-3xl font-bold text-white mt-1">{stats.totalRooms - stats.occupiedRooms}</h3>
            </div>
            <div className="p-2 bg-green-500/10 text-green-500 rounded"><Key size={20} /></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-300">Syncing with reservation engine...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN: Activity */}
          <div className="space-y-6">
            
            {/* Arrivals */}
            <div className="bg-dark-800 border border-dark-700 shadow-sm rounded-lg overflow-hidden">
              <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <LogIn size={18} className="text-brand-500"/> Expected Arrivals
                </h3>
                <span className="bg-brand-500/20 text-brand-400 text-xs px-2 py-1 rounded-full font-medium">{arrivals.length} Pending</span>
              </div>
              <div className="divide-y divide-dark-700 max-h-[400px] overflow-y-auto">
                {arrivals.length === 0 ? (
                  <div className="p-8 text-center text-gray-300">No more arrivals expected today.</div>
                ) : (
                  arrivals.map(booking => (
                    <div key={booking.id} className="p-4 hover:bg-dark-700 transition-colors flex justify-between items-center group">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : booking.guest_name}</p>
                          {booking.profiles?.vip_status && <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">VIP</span>}
                        </div>
                        <p className="text-sm text-gray-200">Room {booking.rooms?.room_number} • {booking.rooms?.name}</p>
                        <p className="text-xs text-gray-300 mt-1">Ref: {booking.booking_reference}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                            handleCancelArrivalBooking(booking.id);
                          }}
                          disabled={isFrontOfficeClosed}
                          className="py-1.5 px-3 text-xs rounded font-bold bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                            handleStartCheckIn(booking);
                          }}
                          disabled={booking.status !== 'confirmed' || isFrontOfficeClosed}
                          className={`py-1.5 px-4 text-sm rounded font-bold transition-all ${
                            isFrontOfficeClosed ? 'bg-dark-700 text-gray-300 cursor-not-allowed border border-dark-600' :
                            booking.status === 'confirmed' ? 'btn-primary' : 'bg-dark-700 text-gray-300 cursor-not-allowed border border-dark-600'
                          }`}
                          title={isFrontOfficeClosed ? 'Front Office is closed' : booking.status !== 'confirmed' ? 'Booking must be confirmed before check-in' : ''}
                        >
                          Start Check-In
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Departures */}
            <div className="bg-dark-800 border border-dark-700 shadow-sm rounded-lg overflow-hidden">
              <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <LogOut size={18} className="text-gray-200"/> Expected Departures
                </h3>
                <span className="bg-dark-700 text-gray-300 text-xs px-2 py-1 rounded-full font-medium">{departures.length} Pending</span>
              </div>
              <div className="divide-y divide-dark-700 max-h-[400px] overflow-y-auto">
                {departures.length === 0 ? (
                  <div className="p-8 text-center text-gray-300">No departures scheduled for today.</div>
                ) : (
                  departures.map(booking => (
                    <div key={booking.id} className="p-4 hover:bg-dark-700 transition-colors flex justify-between items-center group">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-white">{booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : booking.guest_name}</p>
                          {renderCheckoutBadge(booking)}
                        </div>
                        <p className="text-sm text-gray-200">Room {booking.rooms?.room_number}</p>
                        <p className={`text-xs mt-1 ${booking.payment_status === 'paid' ? 'text-green-500' : 'text-red-400'}`}>
                          Balance: {booking.payment_status === 'paid' ? 'Settled' : 'Pending'}
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                          setActiveCheckOut(booking);
                        }}
                        disabled={isFrontOfficeClosed}
                        className="bg-dark-600 text-white hover:bg-dark-500 py-1.5 px-4 text-sm rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {booking.payment_status === 'paid' ? 'Mark as Checked Out' : 'Process Check-Out'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: In-House & Service Requests */}
          <div className="space-y-6 flex flex-col">
            
            {/* In-House Guests */}
            <div className="bg-dark-800 border border-dark-700 shadow-sm rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <UserCheck size={18} className="text-blue-500"/> In-House Guests
                </h3>
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full font-medium">{inHouse.length} Active</span>
              </div>
              
              {/* Search Bar */}
              <div className="p-3 bg-dark-900/40 border-b border-dark-700 flex items-center gap-2">
                <Search size={14} className="text-gray-300 ml-2" />
                <input 
                  type="text" 
                  placeholder="Search in-house guests by name, room # or ref..." 
                  value={inHouseSearchQuery}
                  onChange={e => setInHouseSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 outline-none border-none py-1"
                />
                {inHouseSearchQuery && (
                  <button onClick={() => setInHouseSearchQuery('')} className="text-gray-300 hover:text-white mr-2 text-xs">Clear</button>
                )}
              </div>

              <div className="divide-y divide-dark-700 overflow-y-auto max-h-[400px]">
                {filteredInHouse.length === 0 ? (
                  <div className="p-12 text-center text-gray-300 flex flex-col items-center">
                    <Key size={48} className="mb-4 text-dark-700" />
                    <p>{inHouseSearchQuery ? "No matching guests found." : "No guests currently in-house."}</p>
                  </div>
                ) : (
                  filteredInHouse.map(booking => (
                    <div key={booking.id} className="p-4 hover:bg-dark-700 transition-colors flex flex-col">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="min-w-[40px] h-10 px-2.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs whitespace-nowrap flex-shrink-0">
                            {booking.rooms?.room_number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-white">{booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : booking.guest_name}</p>
                              {renderCheckoutBadge(booking)}
                            </div>
                            <p className="text-xs text-gray-200 mt-0.5">Check-out: {new Date(booking.check_out_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button 
                            onClick={() => {
                              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                              setTransferBooking(booking);
                            }} 
                            disabled={isFrontOfficeClosed}
                            className="text-amber-500 hover:text-amber-400 text-sm font-medium transition-colors border border-amber-500/50 px-3 py-1 rounded flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArrowRightLeft size={14} /> Transfer Room
                          </button>
                          <button 
                            onClick={() => {
                              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                              handleOpenAddService(booking);
                            }} 
                            disabled={isFrontOfficeClosed}
                            className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors border border-purple-500/50 px-3 py-1 rounded flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Package size={14} /> Add Service
                          </button>
                          <button 
                            onClick={() => {
                              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                              setActiveVisitorRegistration(booking);
                            }} 
                            disabled={isFrontOfficeClosed}
                            className="text-brand-500 hover:text-brand-400 text-sm font-medium transition-colors border border-brand-500/50 px-3 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Add Visitor
                          </button>
                          <button 
                            onClick={() => {
                              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                              setActiveCheckOut(booking);
                            }} 
                            disabled={isFrontOfficeClosed}
                            className="text-gray-200 hover:text-white text-sm font-medium transition-colors border border-dark-600 hover:border-gray-500 px-3 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {booking.payment_status === 'paid' ? 'Mark as Checked Out' : 'Check Out'}
                          </button>
                        </div>
                      </div>
                      {/* Display Visitors if any */}
                      {booking.registered_visitors && booking.registered_visitors.filter(v => v.status === 'active').length > 0 && (
                        <div className="mt-3 bg-dark-900 border border-dark-700/80 rounded-lg p-3.5 space-y-3">
                          <p className="text-xs text-gray-200 font-extrabold uppercase tracking-wider flex items-center gap-1.5 border-b border-dark-700/60 pb-1.5">
                            <Users size={14} className="text-brand-500" />
                            <span>Active Stay Visitors ({booking.registered_visitors.filter(v => v.status === 'active').length})</span>
                          </p>
                          <div className="space-y-2">
                            {booking.registered_visitors.filter(v => v.status === 'active').map((v, i) => (
                              <div key={i} className="flex justify-between items-center text-xs bg-dark-950/60 p-2.5 rounded-lg border border-dark-800 flex-wrap gap-2 hover:border-dark-700 transition-colors">
                                <div className="space-y-1">
                                  <span className="text-white font-bold text-sm block">{v.name}</span>
                                  <span className="text-gray-200 block text-[11px]">
                                    📞 {v.phone || 'No phone'} • ID: {v.id_number || 'N/A'}
                                  </span>
                                  {v.purpose && (
                                    <span className="text-[10px] text-brand-500/80 font-medium block italic">Purpose: {v.purpose}</span>
                                  )}
                                  <span className="text-[10px] text-gray-300 block">
                                    Entered: {v.check_in_time ? format(new Date(v.check_in_time), 'hh:mm a') : 'N/A'}
                                  </span>
                                </div>
                                <button 
                                  onClick={() => handleSignOutVisitor(booking, v.id || v.id_number)}
                                  className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 text-xs font-bold rounded-md border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer shadow-sm active:scale-95"
                                >
                                  Sign Out
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pending Stay Enhancements & Service Requests */}
            <div className="bg-dark-800 border border-dark-700 shadow-sm rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Package size={18} className="text-amber-500"/> Pending Stay Enhancements
                </h3>
                <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded-full font-medium">{serviceRequests.length} Pending</span>
              </div>
              <div className="divide-y divide-dark-700 overflow-y-auto max-h-[400px]">
                {serviceRequests.length === 0 ? (
                  <div className="p-8 text-center text-gray-300">No pending guest service requests.</div>
                ) : (
                  serviceRequests.map(req => {
                    const guestName = req.bookings?.profiles 
                      ? `${req.bookings.profiles.first_name} ${req.bookings.profiles.last_name}` 
                      : (req.bookings?.guest_name || 'Unknown Guest');
                    const roomNo = req.bookings?.rooms?.room_number || 'N/A';
                    return (
                      <div key={req.id} className="p-4 hover:bg-dark-700 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{req.services?.name || 'Extra Service'}</span>
                            <span className="bg-dark-900 border border-dark-700 text-gray-200 text-[10px] px-2 py-0.5 rounded-full capitalize">{req.services?.category}</span>
                          </div>
                          <p className="text-xs text-gray-200 mt-1">
                            Guest: <span className="font-medium text-white">{guestName}</span> (Room {roomNo})
                          </p>
                          <p className="text-[10px] text-gray-300 mt-1">
                            Qty: <span className="text-gray-300 font-bold">{req.quantity}</span> • Total Price: <span className="text-brand-500 font-bold">₦{Number(req.total_price_ngn).toLocaleString()}</span>
                          </p>
              {req.scheduled_date && (
                            <p className="text-[10px] text-amber-500 font-bold mt-1">
                              📅 Scheduled: {req.scheduled_date} @ {req.scheduled_time?.slice(0, 5)}
                            </p>
                          )}
                          
                          {/* Payment status badge */}
                          <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                            {req.payment_status === 'paid' ? (
                              <span className="bg-green-500/10 text-green-500 border border-green-500/20 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                                Payment: Confirmed (Paid)
                              </span>
                            ) : req.payment_status === 'awaiting_confirmation' ? (
                              <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded animate-pulse">
                                Payment: Awaiting Finance Confirmation
                              </span>
                            ) : (
                              <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                                Payment: Unpaid / Pending Billing
                              </span>
                            )}
                            
                            {req.bookings?.status === 'checked_in' && req.payment_status !== 'paid' && (
                              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                                Post-Checkin Privilege: Pay at Checkout
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 self-end md:self-auto items-center">
                          {/* Checked-in guests can enjoy services immediately without making payments */}
                          {(req.payment_status === 'paid' || req.bookings?.status === 'checked_in') ? (
                            <button 
                              onClick={() => handleUpdateServiceStatus(req.id, 'scheduled')}
                              className="bg-green-500 hover:bg-green-600 text-dark-950 font-bold text-xs py-1.5 px-3 rounded shadow transition-all"
                            >
                              Approve Stay Enhancement {req.bookings?.status === 'checked_in' && req.payment_status !== 'paid' && "(On Account)"}
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleNotifyFinance(req.id)}
                              disabled={req.payment_status === 'awaiting_confirmation'}
                              className={`text-xs py-1.5 px-3 rounded shadow transition-all font-bold ${
                                req.payment_status === 'awaiting_confirmation'
                                  ? 'bg-dark-900 text-gray-300 cursor-not-allowed border border-dark-700'
                                  : 'bg-amber-500 hover:bg-amber-600 text-dark-950'
                              }`}
                            >
                              {req.payment_status === 'awaiting_confirmation' ? 'Notified Finance (Waiting...)' : 'Notify Finance to Verify'}
                            </button>
                          )}
                          
                          {req.payment_status !== 'paid' && (
                            <button 
                              onClick={() => handleARServiceDeduction(req)}
                              className="bg-purple-650 hover:bg-purple-700 text-white font-bold text-xs py-1.5 px-3 rounded shadow transition-all"
                            >
                              AR Deduction
                            </button>
                          )}

                          {/* Decline is always allowed */}
                          <button 
                            onClick={() => handleUpdateServiceStatus(req.id, 'cancelled')}
                            className="bg-dark-700 hover:bg-red-500/20 hover:text-red-400 text-xs py-1.5 px-3 rounded border border-dark-600 transition-all text-gray-200 font-medium"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      )}
      </div>
      )}

      {activeTab === 'matrix' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          {/* Matrix Filter Bar */}
          <div className="bg-dark-800/50 backdrop-blur border border-dark-700/80 p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All Rooms', count: allRooms.length, color: 'bg-gray-400', activeBg: 'bg-dark-700 text-white border-dark-600' },
                { 
                  id: 'occupied', 
                  label: 'Occupied', 
                  count: allRooms.filter(r => r.status === 'occupied' || inHouse.some(b => b.room_id === r.id)).length, 
                  color: 'bg-blue-500', 
                  activeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                },
                { 
                  id: 'clean', 
                  label: 'Vacant - Clean', 
                  count: allRooms.filter(r => {
                    const isOccupied = r.status === 'occupied' || inHouse.some(b => b.room_id === r.id);
                    const task = housekeepingTasks.find(t => t.room_id === r.id);
                    const taskStatus = task ? task.status : 'inspected';
                    const maint = maintenanceTickets.some(t => t.room_id === r.id);
                    return !isOccupied && taskStatus === 'inspected' && !maint;
                  }).length, 
                  color: 'bg-green-500', 
                  activeBg: 'bg-green-500/10 text-green-400 border-green-500/30' 
                },
                { 
                  id: 'dirty', 
                  label: 'Vacant - Dirty', 
                  count: allRooms.filter(r => {
                    const isOccupied = r.status === 'occupied' || inHouse.some(b => b.room_id === r.id);
                    const task = housekeepingTasks.find(t => t.room_id === r.id);
                    const taskStatus = task ? task.status : 'inspected';
                    const maint = maintenanceTickets.some(t => t.room_id === r.id);
                    return !isOccupied && ['pending', 'failed', 'cleaning', 'cleaned'].includes(taskStatus) && !maint;
                  }).length, 
                  color: 'bg-amber-500', 
                  activeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                },
                { 
                  id: 'maintenance', 
                  label: 'Maintenance', 
                  count: allRooms.filter(r => maintenanceTickets.some(t => t.room_id === r.id)).length, 
                  color: 'bg-red-500', 
                  activeBg: 'bg-red-500/10 text-red-400 border-red-500/30' 
                }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setMatrixFilter(filter.id)}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all duration-200 flex items-center gap-2 ${matrixFilter === filter.id ? filter.activeBg : 'bg-dark-900/50 border-dark-700 text-gray-200 hover:text-white hover:bg-dark-850'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${filter.color} ${filter.id === 'maintenance' && maintenanceTickets.length > 0 ? 'animate-pulse' : ''}`}></span>
                  {filter.label}
                  <span className="bg-dark-950/80 px-2 py-0.5 rounded text-[10px] text-gray-300 font-mono font-bold border border-dark-700">{filter.count}</span>
                </button>
              ))}
            </div>
            <div className="text-[11px] text-gray-300 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
              Live Grid System
            </div>
          </div>

          {/* Matrix Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {allRooms.filter(room => {
              const activeBooking = inHouse.find(b => b.room_id === room.id);
              const latestTask = housekeepingTasks.find(t => t.room_id === room.id);
              const maintTicket = maintenanceTickets.find(t => t.room_id === room.id);
              const isOccupied = room.status === 'occupied' || activeBooking;
              
              const taskStatus = latestTask ? latestTask.status : 'inspected';
              const isClean = taskStatus === 'inspected';
              const isDirty = ['pending', 'failed', 'cleaning', 'cleaned'].includes(taskStatus);

              if (matrixFilter === 'all') return true;
              if (matrixFilter === 'occupied') return isOccupied;
              if (matrixFilter === 'clean') return !isOccupied && isClean && !maintTicket;
              if (matrixFilter === 'dirty') return !isOccupied && isDirty && !maintTicket;
              if (matrixFilter === 'maintenance') return !!maintTicket;
              return true;
            }).map(room => {
              const activeBooking = inHouse.find(b => b.room_id === room.id);
              const latestTask = housekeepingTasks.find(t => t.room_id === room.id);
              const maintTicket = maintenanceTickets.find(t => t.room_id === room.id);
              const isOccupied = room.status === 'occupied' || activeBooking;
              
              const taskStatus = latestTask ? latestTask.status : 'inspected';
              
              let cardStyle = "border-dark-700 hover:border-dark-600 shadow-[0_4px_15px_rgba(0,0,0,0.2)]";
              
              if (maintTicket) {
                cardStyle = "border-red-500/30 hover:border-red-500/60 shadow-[0_4px_20px_-4px_rgba(239,68,68,0.15)]";
              } else if (isOccupied) {
                cardStyle = "border-blue-500/25 hover:border-blue-500/50 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.12)]";
              } else if (taskStatus === 'inspected') {
                cardStyle = "border-green-500/25 hover:border-green-500/50 shadow-[0_4px_20px_-4px_rgba(34,197,94,0.12)]";
              } else if (taskStatus === 'pending' || taskStatus === 'failed') {
                cardStyle = "border-amber-500/25 hover:border-amber-500/50 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.12)]";
              } else if (taskStatus === 'cleaning') {
                cardStyle = "border-purple-500/25 hover:border-purple-500/50 shadow-[0_4px_20px_-4px_rgba(168,85,247,0.12)]";
              } else if (taskStatus === 'cleaned') {
                cardStyle = "border-yellow-500/25 hover:border-yellow-500/50 shadow-[0_4px_20px_-4px_rgba(234,179,8,0.12)]";
              }
              
              return (
                <div 
                  key={room.id} 
                  className={`relative bg-dark-800/40 backdrop-blur-md border rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between overflow-hidden group ${cardStyle}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-2xl font-black text-white tracking-tight">{room.room_number}</span>
                        <p className="text-xs text-gray-200 font-medium mt-0.5">{room.name} • {room.type}</p>
                      </div>
                      
                      {maintTicket ? (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                          <Wrench size={10} /> Maintenance
                        </span>
                      ) : isOccupied ? (
                        (() => {
                          const badge = renderCheckoutBadge(activeBooking);
                          if (badge) return badge;
                          return (
                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              Occupied
                            </span>
                          );
                        })()
                      ) : taskStatus === 'inspected' ? (
                        <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={10} /> Vacant - Ready
                        </span>
                      ) : taskStatus === 'pending' || taskStatus === 'failed' ? (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle size={10} /> Vacant - Dirty
                        </span>
                      ) : taskStatus === 'cleaning' ? (
                        <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                          <Clock size={10} className="animate-spin" style={{ animationDuration: '3s' }} /> Cleaning
                        </span>
                      ) : taskStatus === 'cleaned' ? (
                        <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle size={10} /> Cleaned
                        </span>
                      ) : (
                        <span className="bg-dark-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Vacant
                        </span>
                      )}
                    </div>
                    
                    <div className="h-px bg-dark-700/50 my-3"></div>
                    
                    <div className="space-y-2 mb-4">
                      {maintTicket ? (
                        <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold uppercase tracking-wider">
                            <AlertTriangle size={12} />
                            <span>{maintTicket.priority || 'Standard'} Priority</span>
                          </div>
                          <p className="text-xs text-gray-300 line-clamp-2">{maintTicket.description}</p>
                        </div>
                      ) : isOccupied ? (
                        activeBooking ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-white truncate max-w-[130px]">
                                {activeBooking.profiles ? `${activeBooking.profiles.first_name} ${activeBooking.profiles.last_name}` : activeBooking.guest_name}
                              </span>
                              {activeBooking.profiles?.vip_status && (
                                <span className="bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 text-[8px] px-1.5 py-0.5 rounded-full font-extrabold tracking-widest uppercase animate-pulse">
                                  VIP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-200">
                              <span className="font-mono text-[10px]">Ref: {activeBooking.booking_reference}</span>
                              <span>Out: {format(new Date(activeBooking.check_out_date), 'MMM dd')}</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-gray-200 bg-dark-900/50 px-2 py-1 rounded border border-dark-700/30">
                              <Phone size={11} className="text-brand-500/80" />
                              <span className="font-medium text-gray-300 select-all">{activeBooking.profiles?.phone || activeBooking.guest_phone || 'No Phone Details'}</span>
                            </div>
                            
                            {activeBooking.registered_visitors && activeBooking.registered_visitors.filter(v => v.status === 'active').length > 0 && (
                              <div className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
                                <Users size={10} />
                                <span>{activeBooking.registered_visitors.filter(v => v.status === 'active').length} Active Visitor(s)</span>
                              </div>
                            )}
                            
                            {activeBooking.payment_status !== 'paid' && (
                              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-1.5 text-[10px] text-yellow-500 flex items-center gap-1 font-semibold">
                                <AlertTriangle size={10} />
                                <span>Pending: ₦{((activeBooking.total_amount_ngn || 0) - (activeBooking.amount_paid_ngn || 0)).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-200 italic">Occupied (Syncing...)</p>
                        )
                      ) : (
                        <div className="space-y-1.5 text-xs">
                          {taskStatus === 'inspected' ? (
                            <div className="text-gray-200 flex flex-col gap-1 py-1">
                              <p className="text-xs text-green-400/90 font-semibold flex items-center gap-1">
                                <Check size={14} className="text-green-500" />
                                <span>Certified Clean & Ready</span>
                              </p>
                            </div>
                          ) : (
                            <div className="bg-dark-900/40 rounded p-2 space-y-1 text-[11px] border border-dark-700/30">
                              {latestTask ? (
                                <>
                                  <div className="flex justify-between text-gray-200">
                                    <span>Task: <strong className="text-gray-300">{latestTask.task_type?.replace('_', ' ').toUpperCase()}</strong></span>
                                  </div>
                                  {latestTask.profiles && (
                                    <p className="text-gray-200">Staff: <span className="text-gray-300">{latestTask.profiles.first_name} {latestTask.profiles.last_name}</span></p>
                                  )}
                                </>
                              ) : (
                                <p className="text-gray-300 italic">No task active.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-2">
                    {maintTicket ? (
                      <button 
                        disabled 
                        className="w-full bg-dark-900/60 text-red-500/40 border border-dark-700/50 text-xs py-2 px-3 rounded-lg font-bold cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Wrench size={13} /> Room Out of Order
                      </button>
                    ) : isOccupied ? (
                      activeBooking ? (
                        <div className="flex gap-2">
                          <button 
                            disabled={isFrontOfficeClosed}
                            onClick={() => {
                              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                              setTransferBooking(activeBooking);
                            }} 
                            className="flex-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-dark-900 border border-amber-500/20 text-xs py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArrowRightLeft size={12} /> Transfer
                          </button>
                          <button 
                            disabled={isFrontOfficeClosed}
                            onClick={() => {
                              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                              setActiveVisitorRegistration(activeBooking);
                            }} 
                            className="flex-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 text-xs py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Users size={12} /> Visitor
                          </button>
                          <button 
                            disabled={isFrontOfficeClosed}
                            onClick={() => {
                              if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                              setActiveCheckOut(activeBooking);
                            }} 
                            className="flex-1 bg-dark-700 hover:bg-red-500/20 hover:text-red-400 border border-dark-600 text-xs py-1.5 px-1 rounded-lg font-bold transition-all text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Out
                          </button>
                        </div>
                      ) : null
                    ) : (
                      (() => {
                        const canInspect = hasAccess('Housekeeping - Inspect & Approve Clean Rooms');
                        const canAssign = hasAccess('Housekeeping - Assign Tasks to Staff');
                        const isHousekeeper = profile?.role === 'housekeeping';

                        if (taskStatus === 'inspected') {
                          return (
                            <button 
                              disabled={isFrontOfficeClosed}
                              onClick={() => {
                                if (isFrontOfficeClosed) {
                                  toast.error("Front Office operations are locked due to daily ledger closure.");
                                  return;
                                }
                                setPreselectedRoomId(room.id);
                                setIsNewBookingModalOpen(true);
                              }}
                              className="w-full bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-dark-900 border border-green-500/20 text-xs py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Key size={13} /> Book Room
                            </button>
                          );
                        }

                        if (taskStatus === 'pending' || taskStatus === 'failed') {
                          if (canAssign || isHousekeeper) {
                            return (
                              <button 
                                onClick={() => {
                                  if (latestTask) handleQuickUpdateHousekeeping(latestTask.id, 'cleaning');
                                  else handleQuickCreateHousekeeping(room.id);
                                }}
                                className="w-full bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-dark-900 border border-amber-500/20 text-xs py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Clock size={13} /> Start Cleaning
                              </button>
                            );
                          } else {
                            return (
                              <div className="w-full py-2.5 bg-dark-900/60 border border-dark-750 text-amber-500/80 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-default">
                                <Clock size={13} className="animate-pulse animate-duration-1000" /> Awaiting Cleaning Assignment
                              </div>
                            );
                          }
                        }

                        if (taskStatus === 'cleaning') {
                          if (canAssign || isHousekeeper) {
                            return (
                              <button 
                                onClick={() => handleQuickUpdateHousekeeping(latestTask.id, 'cleaned')}
                                className="w-full bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/20 text-xs py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 animate-pulse"
                              >
                                <CheckCircle size={13} /> Mark Cleaned
                              </button>
                            );
                          } else {
                            return (
                              <div className="w-full py-2.5 bg-dark-900/60 border border-dark-750 text-purple-400 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-default">
                                <Clock size={13} className="animate-spin" style={{ animationDuration: '3s' }} /> Housekeeper Cleaning...
                              </div>
                            );
                          }
                        }

                        if (taskStatus === 'cleaned') {
                          if (canInspect) {
                            return (
                              <button 
                                onClick={() => handleStartInspection(latestTask.id)}
                                className="w-full bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-dark-900 border border-yellow-500/30 text-xs py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle size={13} /> Inspect & Ready
                              </button>
                            );
                          } else {
                            return (
                              <div className="w-full py-2.5 bg-dark-900/60 border border-dark-750 text-yellow-500 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-default">
                                <Clock size={13} className="animate-pulse animate-duration-1000" /> Awaiting Manager Inspection
                              </div>
                            );
                          }
                        }

                        return (
                          <button 
                            onClick={() => handleQuickCreateHousekeeping(room.id)}
                            className="w-full bg-dark-700 text-gray-300 hover:bg-dark-600 border border-dark-600 text-xs py-2 px-3 rounded-lg font-bold transition-all"
                          >
                            Request Clean
                          </button>
                        );
                      })()
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Booking Calendar Timeline View --- */}
      {activeTab === 'calendar' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Controls & Filter Panel */}
          <div className="bg-dark-900/40 backdrop-blur-md border border-dark-700/60 p-5 rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-brand-500/[0.03] blur-3xl pointer-events-none"></div>
            <div className="flex flex-col xl:flex-row gap-6 justify-between items-stretch xl:items-center relative z-10">
              
              {/* Left Side: Filter Dropdowns */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 bg-dark-950/40 px-3 py-1.5 rounded-lg border border-dark-800">
                  <Filter size={16} className="text-brand-500 animate-pulse" />
                  <span className="text-xs uppercase font-extrabold tracking-wider text-brand-500">Calendar Filters</span>
                </div>
                
                {/* Accommodation Type Filter */}
                <div className="relative">
                  <select 
                    value={calendarRoomTypeFilter} 
                    onChange={(e) => setCalendarRoomTypeFilter(e.target.value)}
                    className="bg-dark-950 border border-dark-700/80 text-white text-sm pl-4 pr-10 py-2 rounded-lg outline-none focus:border-brand-500/80 cursor-pointer appearance-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                  >
                    <option value="all">All Accommodations</option>
                    {[...new Set(allRooms.map(r => r.type))].map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-200">
                    <ChevronRight size={14} className="rotate-90" />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <select 
                    value={calendarStatusFilter} 
                    onChange={(e) => setCalendarStatusFilter(e.target.value)}
                    className="bg-dark-950 border border-dark-700/80 text-white text-sm pl-4 pr-10 py-2 rounded-lg outline-none focus:border-brand-500/80 cursor-pointer appearance-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                  >
                    <option value="all">All Booking Statuses</option>
                    <option value="confirmed">Booked (Confirmed)</option>
                    <option value="pending">Pending</option>
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-200">
                    <ChevronRight size={14} className="rotate-90" />
                  </div>
                </div>
              </div>

              {/* Middle: Custom Date Bounds */}
              <div className="flex flex-wrap gap-3 items-center bg-dark-900/60 p-2.5 rounded-xl border border-dark-700/50">
                <span className="text-xs uppercase font-extrabold tracking-wider text-gray-200 px-2 flex items-center gap-1.5">
                  <CalendarIcon size={13} className="text-brand-500" />
                  Period:
                </span>
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={format(calendarStartDate, 'yyyy-MM-dd')}
                    onChange={(e) => e.target.value && setCalendarStartDate(new Date(e.target.value))}
                    className="bg-dark-950 border border-dark-800 text-white text-xs px-3 py-1.5 rounded-lg outline-none focus:border-brand-500 transition-all font-mono font-semibold"
                  />
                  <span className="text-gray-600 text-xs font-semibold">to</span>
                  <input 
                    type="date" 
                    value={format(calendarEndDate, 'yyyy-MM-dd')}
                    onChange={(e) => e.target.value && setCalendarEndDate(new Date(e.target.value))}
                    className="bg-dark-950 border border-dark-800 text-white text-xs px-3 py-1.5 rounded-lg outline-none focus:border-brand-500 transition-all font-mono font-semibold"
                  />
                </div>
                
                <div className="flex gap-1.5">
                  <button 
                    onClick={fetchCalendarData} 
                    className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-extrabold px-4 py-1.5 rounded-lg text-xs transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(234,179,8,0.25)] flex items-center gap-1"
                  >
                    <Search size={12} /> Show
                  </button>
                  
                  <button 
                    onClick={() => {
                      const todayStart = new Date();
                      todayStart.setDate(todayStart.getDate() - 2);
                      setCalendarStartDate(todayStart);
                      
                      const todayEnd = new Date();
                      todayEnd.setDate(todayEnd.getDate() + 13);
                      setCalendarEndDate(todayEnd);
                      toast.success("Timeline centered around today!");
                    }}
                    className="bg-dark-950 hover:bg-dark-800 text-brand-500 hover:text-brand-400 border border-brand-500/20 hover:border-brand-500/40 font-bold px-3 py-1.5 rounded-lg text-xs transition-all duration-200 active:scale-95 flex items-center gap-1"
                    title="Snap back to current date range"
                  >
                    <Clock size={12} /> Today
                  </button>
                </div>
              </div>

              {/* Right Side: Status Legend */}
              <div className="flex flex-wrap gap-2 items-center self-start xl:self-auto bg-dark-950/20 p-2 rounded-lg border border-dark-800/40">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/5 border border-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#22c55e] animate-pulse"></span>
                  Booked
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-500/5 border border-yellow-500/10 text-yellow-400 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_6px_#eab308] animate-pulse"></span>
                  Pending
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/5 border border-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7] animate-pulse"></span>
                  Checked In
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-500/5 border border-gray-500/10 text-gray-200 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shadow-[0_0_6px_#9ca3af] animate-pulse"></span>
                  Checked Out
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/5 border border-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_#ef4444] animate-pulse"></span>
                  Blocked
                </div>
              </div>

            </div>
          </div>

          {/* Timeline Grid Container */}
          <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden shadow-sm flex flex-col min-h-[500px]">
            {calendarLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300 py-32 space-y-4">
                <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm">Syncing calendar engine...</p>
              </div>
            ) : (
              (() => {
                const days = getDaysArray(calendarStartDate, calendarEndDate);
                const colWidth = 90; // width of day column
                const totalTimelineWidth = days.length * colWidth;

                // Group rooms by category type
                const roomsGroupedByType = allRooms
                  .filter(r => calendarRoomTypeFilter === 'all' || r.type === calendarRoomTypeFilter)
                  .reduce((acc, room) => {
                    if (!acc[room.type]) acc[room.type] = [];
                    acc[room.type].push(room);
                    return acc;
                  }, {});

                return (
                  <div className="flex overflow-x-auto custom-scrollbar select-none relative w-full flex-1">
                    
                    {/* Fixed Left Sidebar: Accommodation List */}
                    <div className="w-[280px] min-w-[280px] bg-dark-900 border-r border-dark-700 flex-shrink-0 z-20 sticky left-0 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                      {/* Left Header */}
                      <div className="h-[76px] bg-dark-950 border-b border-dark-700 p-4 flex items-center justify-start">
                        <span className="text-xs uppercase font-bold tracking-wider text-gray-200">Accommodation</span>
                      </div>
                      
                      {/* Left Groups & Rooms */}
                      <div className="divide-y divide-dark-800">
                        {Object.entries(roomsGroupedByType).map(([type, roomsList]) => (
                          <div key={type} className="flex flex-col">
                            {/* Group Label */}
                            <div className="bg-dark-950/70 border-b border-dark-800 h-[40px] px-4 flex items-center justify-start text-[11px] font-bold text-brand-500 uppercase tracking-widest truncate">
                              {type}
                            </div>
                            {/* Rooms List */}
                            {roomsList.map(room => (
                              <div key={room.id} className="h-[54px] px-4 border-b border-dark-800/40 flex flex-col justify-center items-start hover:bg-dark-800/40 transition-colors">
                                <span className="font-bold text-white text-sm flex items-center gap-1.5">
                                  <Key size={13} className="text-brand-500" />
                                  {room.room_number}
                                </span>
                                <span className="text-xs text-gray-200 truncate max-w-full mt-0.5">{room.name || room.type}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {Object.keys(roomsGroupedByType).length === 0 && (
                          <div className="p-8 text-center text-gray-600 text-xs italic">No matching rooms found.</div>
                        )}
                      </div>
                    </div>

                    {/* Scrollable Right Area: Day Columns Timeline */}
                    <div className="flex-grow flex flex-col min-w-0 z-10" style={{ width: `${totalTimelineWidth}px`, minWidth: `${totalTimelineWidth}px`, flexShrink: 0 }}>
                      
                      {/* Timeline Header Row (Dates) */}
                      <div className="h-[76px] bg-dark-950 border-b border-dark-700 flex-shrink-0 flex sticky top-0 z-20">
                        {days.map((dayStr) => {
                          const dateObj = new Date(dayStr + 'T00:00:00');
                          const isTodayStr = format(new Date(), 'yyyy-MM-dd') === dayStr;
                          
                          return (
                            <div 
                              key={dayStr} 
                              style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}
                              className={`flex-shrink-0 flex flex-col items-center justify-center p-2 relative transition-all duration-200 border-r border-dark-700/40 ${
                                isTodayStr 
                                  ? 'bg-gradient-to-b from-brand-500/15 to-brand-500/0 text-brand-500 font-bold' 
                                  : 'hover:bg-dark-900/40'
                              }`}
                            >
                              {isTodayStr && (
                                <div className="absolute inset-x-1.5 top-1.5 bottom-1.5 border border-brand-500/40 rounded-lg pointer-events-none shadow-[inset_0_0_8px_rgba(234,179,8,0.1),0_0_10px_rgba(234,179,8,0.15)] bg-brand-500/[0.02]"></div>
                              )}
                              <span className={`text-[9px] uppercase font-black tracking-widest leading-none ${isTodayStr ? 'text-brand-500' : 'text-gray-300'}`}>
                                {format(dateObj, 'eee')}
                              </span>
                              <span className={`text-xl font-extrabold tracking-tighter leading-none mt-1 ${isTodayStr ? 'text-brand-400 font-black' : 'text-white'}`}>
                                {format(dateObj, 'd')}
                              </span>
                              <span className={`text-[9px] uppercase font-bold mt-1 leading-none ${isTodayStr ? 'text-brand-500/80' : 'text-gray-200'}`}>
                                {format(dateObj, 'MMM')}
                              </span>
                              {isTodayStr && (
                                <span className="absolute bottom-0 inset-x-0 h-[3px] bg-brand-500 shadow-[0_-2px_10px_#eab308]"></span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Timeline Body Rows */}
                      <div className="flex flex-col divide-y divide-dark-800 select-none flex-grow">
                        {Object.entries(roomsGroupedByType).map(([type, roomsList]) => (
                          <div key={type} className="flex flex-col">
                            {/* Group Segment Header Background placeholder */}
                            <div className="bg-dark-950/20 border-b border-dark-800 h-[40px] flex items-center flex-shrink-0 relative">
                              {days.map((dayStr) => (
                                <div key={dayStr} style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }} className="border-r border-dark-800/40 h-full flex-shrink-0"></div>
                              ))}
                            </div>
                            
                            {/* Rooms Horizontal Timeline Rows */}
                            {roomsList.map(room => {
                              // Filter bookings for this room that should display on the calendar
                              const roomBookings = calendarBookings.filter(b => 
                                b.room_id === room.id && 
                                (calendarStatusFilter === 'all' || b.status === calendarStatusFilter)
                              );

                              return (
                                <div 
                                  key={room.id} 
                                  className="h-[54px] relative flex border-b border-dark-800/20 hover:bg-dark-800/20 transition-colors flex-shrink-0"
                                >
                                  {/* Grid background lines */}
                                  {days.map((dayStr) => {
                                    const isTodayStr = format(new Date(), 'yyyy-MM-dd') === dayStr;
                                    return (
                                      <div 
                                        key={dayStr} 
                                        style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}
                                        className={`border-r border-dark-700/20 h-full flex-shrink-0 relative ${
                                          isTodayStr ? 'bg-gradient-to-b from-brand-500/[0.02] to-transparent shadow-[inset_0_0_8px_rgba(234,179,8,0.01)]' : ''
                                        }`}
                                      >
                                        {isTodayStr && (
                                          <span className="absolute top-0 bottom-0 left-0 w-[1px] bg-brand-500/10 pointer-events-none"></span>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* Booking Timeline Bars absolutely positioned on top */}
                                  {roomBookings.map(booking => {
                                    const barStyle = getBookingStyle(booking, days);
                                    const guestName = booking.profiles 
                                      ? `${booking.profiles.first_name} ${booking.profiles.last_name}` 
                                      : booking.guest_name;
                                      
                                    // Custom premium colors & icons based on reservation status
                                    let statusColorClass = 'bg-gradient-to-r from-green-500/15 to-green-500/5 border-green-500/30 border-l-[5px] border-l-green-500 text-green-400 hover:from-green-500/25 hover:to-green-500/10 shadow-[0_4px_12px_rgba(34,197,94,0.08)]';
                                    let StatusIcon = CheckCircle;
                                    
                                    if (booking.status === 'pending') {
                                      statusColorClass = 'bg-gradient-to-r from-yellow-500/15 to-yellow-500/5 border-yellow-500/30 border-l-[5px] border-l-yellow-500 text-yellow-400 hover:from-yellow-500/25 hover:to-yellow-500/10 shadow-[0_4px_12px_rgba(234,179,8,0.08)]';
                                      StatusIcon = Clock;
                                    } else if (booking.status === 'checked_in') {
                                      statusColorClass = 'bg-gradient-to-r from-purple-500/15 to-purple-500/5 border-purple-500/30 border-l-[5px] border-l-purple-500 text-purple-400 hover:from-purple-500/25 hover:to-purple-500/10 shadow-[0_4px_12px_rgba(168,85,247,0.08)]';
                                      StatusIcon = UserCheck;
                                    } else if (booking.status === 'checked_out') {
                                      statusColorClass = 'bg-gradient-to-r from-gray-500/15 to-gray-500/5 border-gray-500/30 border-l-[5px] border-l-gray-400 text-gray-300 hover:from-gray-500/25 hover:to-gray-500/10 shadow-[0_4px_12px_rgba(156,163,175,0.05)]';
                                      StatusIcon = LogOut;
                                    } else if (booking.status === 'no_show') {
                                      statusColorClass = 'bg-gradient-to-r from-orange-500/15 to-orange-500/5 border-orange-500/30 border-l-[5px] border-l-orange-500 text-orange-400 hover:from-orange-500/25 hover:to-orange-500/10 shadow-[0_4px_12px_rgba(249,115,22,0.08)]';
                                      StatusIcon = AlertTriangle;
                                    } else if (room.status === 'maintenance' || booking.status === 'maintenance') {
                                      statusColorClass = 'bg-gradient-to-r from-red-500/15 to-red-500/5 border-red-500/30 border-l-[5px] border-l-red-500 text-red-400 hover:from-red-500/25 hover:to-red-500/10 shadow-[0_4px_12px_rgba(239,68,68,0.08)]';
                                      StatusIcon = Wrench;
                                    }

                                    return (
                                      <div 
                                        key={booking.id}
                                        style={barStyle}
                                        onClick={() => setSelectedCalendarBooking(booking)}
                                        className={`rounded-lg border px-3 py-1 flex flex-col justify-center backdrop-blur-sm cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-[1px] hover:shadow-[0_6px_16px_rgba(0,0,0,0.6)] ${statusColorClass}`}
                                      >
                                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                                          <span className="text-[9px] font-mono font-bold tracking-wider leading-none truncate max-w-full opacity-90 flex items-center gap-1">
                                            <StatusIcon size={9} className="opacity-80" />
                                            {booking.booking_reference || 'MANUAL'}
                                          </span>
                                          {booking.profiles?.vip_status && (
                                            <span className="bg-yellow-500/30 text-yellow-300 text-[8px] font-black tracking-widest uppercase px-1 rounded-sm leading-none flex-shrink-0 animate-pulse border border-yellow-500/20">VIP</span>
                                          )}
                                        </div>
                                        <p className="text-[11px] font-extrabold leading-tight truncate max-w-full mt-0.5 tracking-tight text-white/90">
                                          {guestName}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {activeTab === 'visitors' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          {/* Search, filters, stats panel */}
          <div className="bg-dark-800 border border-dark-700/80 p-5 shadow-sm rounded-lg flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-3 w-full md:w-auto flex-grow max-w-md bg-dark-900 border border-dark-700 rounded-lg px-3 py-2">
              <Search size={16} className="text-gray-300" />
              <input 
                type="text" 
                placeholder="Search visitors by name, ID number, room number, or guest..."
                value={visitorSearchQuery}
                onChange={e => setVisitorSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-white placeholder-gray-500 outline-none"
              />
              {visitorSearchQuery && (
                <button onClick={() => setVisitorSearchQuery('')} className="text-xs text-gray-300 hover:text-white">Clear</button>
              )}
            </div>
            
            <div className="flex gap-2 w-full md:w-auto justify-end">
              {[
                { id: 'all', label: 'All Entries' },
                { id: 'active', label: 'Active Inside' },
                { id: 'checked_out', label: 'Signed Out' }
              ].map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setVisitorFilterStatus(opt.id)}
                  className={`px-4 py-2 rounded text-xs font-bold transition-all border ${
                    visitorFilterStatus === opt.id 
                      ? 'bg-brand-500/10 text-brand-400 border-brand-500/30' 
                      : 'bg-dark-900 border-dark-750 text-gray-200 hover:text-white hover:bg-dark-850'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visitor logs listing */}
          <div className="bg-dark-800 border border-dark-700 rounded-lg shadow-sm overflow-hidden">
            {loadingVisitors ? (
              <div className="p-16 text-center text-gray-300 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs">Accessing visitor ledger database...</p>
              </div>
            ) : (() => {
              const getVisitDuration = (checkIn, checkOut) => {
                if (!checkIn) return 'N/A';
                const start = new Date(checkIn);
                const end = checkOut ? new Date(checkOut) : new Date();
                const diffMs = end - start;
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
                const diffHours = Math.floor(diffMins / 60);
                const remainingMins = diffMins % 60;
                return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ${remainingMins} min${remainingMins !== 1 ? 's' : ''}`;
              };

              const filteredVisitors = visitorsData.filter(v => {
                // Filter by status
                if (visitorFilterStatus !== 'all' && v.status !== visitorFilterStatus) return false;
                
                // Filter by query
                if (!visitorSearchQuery) return true;
                const query = visitorSearchQuery.toLowerCase();
                const name = (v.name || '').toLowerCase();
                const idNum = (v.id_number || '').toLowerCase();
                const purpose = (v.purpose || '').toLowerCase();
                const guestName = (v.booking?.guest_name || (v.booking?.profiles ? `${v.booking.profiles.first_name} ${v.booking.profiles.last_name}` : '')).toLowerCase();
                const roomNo = (v.booking?.rooms?.room_number || '').toLowerCase();
                
                return name.includes(query) || idNum.includes(query) || purpose.includes(query) || guestName.includes(query) || roomNo.includes(query);
              });

              if (filteredVisitors.length === 0) {
                return (
                  <div className="p-16 text-center text-gray-300 flex flex-col items-center justify-center gap-3">
                    <Users size={48} className="text-dark-600 mb-2" />
                    <p className="font-bold text-white text-sm">No visitor logs found</p>
                    <p className="text-xs text-gray-200">Try modifying your search or registry filters.</p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-dark-900 border-b border-dark-700 text-xs font-bold text-gray-200 uppercase tracking-wider">
                        <th className="p-4">Visitor Profile</th>
                        <th className="p-4">Target Room & Guest</th>
                        <th className="p-4">Entry / check-in</th>
                        <th className="p-4">Departure / check-out</th>
                        <th className="p-4 text-center">Visit Duration</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700/50 text-xs">
                      {filteredVisitors.map((v, idx) => {
                        const guest = v.booking?.profiles ? `${v.booking.profiles.first_name} ${v.booking.profiles.last_name}` : v.booking?.guest_name || 'N/A';
                        return (
                          <tr key={idx} className="hover:bg-dark-750 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded bg-dark-900/80 border border-dark-750 text-brand-500 font-bold">
                                  <Users size={16} />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="font-bold text-white text-sm block font-semibold">{v.name}</span>
                                  <span className="text-gray-200 block text-[11px]">📞 {v.phone || 'No phone'} • ID: {v.id_number || 'N/A'}</span>
                                  {v.purpose && (
                                    <span className="text-[10px] text-brand-500/80 font-medium italic block">Purpose: {v.purpose}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="space-y-0.5">
                                <span className="font-bold text-white block">Room {v.booking?.rooms?.room_number || 'N/A'}</span>
                                <span className="text-[11px] text-gray-200 block">Guest: {guest}</span>
                                <span className="text-[10px] text-gray-300 block">Ref: {v.booking?.booking_reference}</span>
                              </div>
                            </td>
                            <td className="p-4 text-gray-300">
                              <div className="space-y-0.5">
                                <span>{v.check_in_time ? format(new Date(v.check_in_time), 'MMM dd, yyyy') : 'N/A'}</span>
                                <span className="text-[10px] text-gray-300 block font-mono">{v.check_in_time ? format(new Date(v.check_in_time), 'hh:mm a') : ''}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {v.check_out_time ? (
                                <div className="space-y-0.5 text-gray-300">
                                  <span>{format(new Date(v.check_out_time), 'MMM dd, yyyy')}</span>
                                  <span className="text-[10px] text-gray-300 block font-mono">{format(new Date(v.check_out_time), 'hh:mm a')}</span>
                                </div>
                              ) : (
                                <span className="text-gray-300 italic">Still checked in</span>
                              )}
                            </td>
                            <td className="p-4 text-center font-mono font-semibold text-gray-300">
                              {getVisitDuration(v.check_in_time || v.time_in, v.check_out_time)}
                            </td>
                            <td className="p-4 text-center">
                              {v.status === 'active' ? (
                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#3b82f6]"></span>
                                  Inside Stay
                                </span>
                              ) : (
                                <span className="bg-gray-500/10 text-gray-200 border border-gray-500/20 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  Signed Out
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {v.status === 'active' && (
                                <button 
                                  onClick={() => handleSignOutVisitor(v.booking, v.id || v.id_number)}
                                  className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 text-xs font-bold rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer shadow active:scale-95"
                                >
                                  Sign Out
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === 'reservations' && hasAccess('Reservations') && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AdminReservations onUpdate={() => fetchFrontDeskData(false)} isFrontOfficeClosed={isFrontOfficeClosed} />
        </div>
      )}

      {activeTab === 'lostfound' && hasAccess('Lost & Found') && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <LostFound />
        </div>
      )}

      {activeTab === 'billing' && hasAccess('Finance & Billing') && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AdminBilling isFrontOfficeClosed={isFrontOfficeClosed} />
        </div>
      )}

      {activeTab === 'halls' && hasAccess('Halls & Catering') && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AdminHalls isFrontOfficeClosed={isFrontOfficeClosed} />
        </div>
      )}

      {/* --- Booking Calendar Details Modal --- */}
      {selectedCalendarBooking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col">
            
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex flex-col">
                <span>Reservation Details</span>
                <span className="text-xs text-gray-200 font-normal mt-0.5">Ref: {selectedCalendarBooking.booking_reference || 'Manual Booking'}</span>
              </h2>
              <button onClick={() => setSelectedCalendarBooking(null)} className="text-gray-200 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5 text-sm">
              {/* Guest Profile Section */}
              <div className="space-y-2">
                <p className="text-xs uppercase font-bold tracking-wider text-gray-300">Guest Information</p>
                <div className="bg-dark-900/60 border border-dark-700/60 p-3.5 rounded-lg">
                  <p className="font-bold text-white text-base flex items-center gap-1.5">
                    {selectedCalendarBooking.profiles ? `${selectedCalendarBooking.profiles.first_name} ${selectedCalendarBooking.profiles.last_name}` : selectedCalendarBooking.guest_name}
                    {selectedCalendarBooking.profiles?.vip_status && (
                      <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-sm uppercase">VIP</span>
                    )}
                  </p>
                  {selectedCalendarBooking.guest_email && <p className="text-xs text-gray-200 mt-1.5">{selectedCalendarBooking.guest_email}</p>}
                  {selectedCalendarBooking.guest_phone && <p className="text-xs text-gray-200 mt-0.5">{selectedCalendarBooking.guest_phone}</p>}
                </div>
              </div>

              {/* Stay Section */}
              <div className="space-y-2">
                <p className="text-xs uppercase font-bold tracking-wider text-gray-300">Stay Information</p>
                <div className="bg-dark-900/60 border border-dark-700/60 p-3.5 rounded-lg grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-200">Assigned Unit</span>
                    <p className="font-bold text-brand-500 text-lg mt-0.5">Room {selectedCalendarBooking.rooms?.room_number}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-200">Nights</span>
                    <p className="font-bold text-white text-lg mt-0.5">
                      {Math.max(1, differenceInDays(new Date(selectedCalendarBooking.check_out_date), new Date(selectedCalendarBooking.check_in_date)))}
                    </p>
                  </div>
                  <div className="col-span-2 border-t border-dark-750 pt-3 grid grid-cols-2 gap-3">
                    <div className="bg-dark-950/60 p-3 rounded-lg border border-dark-800 flex flex-col justify-center">
                      <span className="text-[9px] uppercase font-extrabold tracking-widest text-brand-500 leading-none">Check-In Date</span>
                      <p className="font-mono font-bold text-white text-sm mt-2 leading-none">{format(new Date(selectedCalendarBooking.check_in_date + 'T00:00:00'), 'EEE, MMM dd, yyyy')}</p>
                    </div>
                    <div className="bg-dark-950/60 p-3 rounded-lg border border-dark-800 flex flex-col justify-center">
                      <span className="text-[9px] uppercase font-extrabold tracking-widest text-brand-500 leading-none">Check-Out Date</span>
                      <p className="font-mono font-bold text-white text-sm mt-2 leading-none">{format(new Date(selectedCalendarBooking.check_out_date + 'T00:00:00'), 'EEE, MMM dd, yyyy')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing / Source Status Section */}
              <div className="space-y-2">
                <p className="text-xs uppercase font-bold tracking-wider text-gray-300">Reservation Status</p>
                <div className="bg-dark-900/60 border border-dark-700/60 p-3.5 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="text-xs text-gray-200 block">Status:</span>
                    <span className={`inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded mt-1 ${
                      selectedCalendarBooking.status === 'confirmed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      selectedCalendarBooking.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      selectedCalendarBooking.status === 'checked_in' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      selectedCalendarBooking.status === 'no_show' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {selectedCalendarBooking.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-200 block">Payment:</span>
                    <span className={`inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded mt-1 ${
                      selectedCalendarBooking.payment_status === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {selectedCalendarBooking.payment_status?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions mapping directly to check-in/check-out wizards */}
              <div className="pt-2 border-t border-dark-700 flex flex-col gap-2">
                {isFrontOfficeClosed && (
                  <div className="text-red-400 text-xs font-semibold flex items-center gap-1.5 mb-2 bg-red-500/10 p-2.5 rounded-lg border border-red-500/25 animate-pulse">
                    <AlertTriangle size={14} className="text-red-500" />
                    <span>Operations locked due to daily ledger closure.</span>
                  </div>
                )}
                {selectedCalendarBooking.status === 'confirmed' && (
                  <button 
                    disabled={isFrontOfficeClosed}
                    onClick={() => {
                      if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                      handleStartCheckIn(selectedCalendarBooking);
                      setSelectedCalendarBooking(null);
                    }}
                    className="w-full btn-primary py-3 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Start Check-In Workflow
                  </button>
                )}
                {selectedCalendarBooking.status === 'checked_in' && (
                  <button 
                    disabled={isFrontOfficeClosed}
                    onClick={() => {
                      if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                      setActiveCheckOut(selectedCalendarBooking);
                      setSelectedCalendarBooking(null);
                    }}
                    className="w-full bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold py-3 text-sm transition-all rounded shadow-[0_2px_8px_rgba(234,179,8,0.25)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {selectedCalendarBooking.payment_status === 'paid' ? 'Mark as Checked Out' : 'Process Check-Out Workflow'}
                  </button>
                )}
                {selectedCalendarBooking.status === 'checked_in' && (
                  <>
                    <button 
                      disabled={isFrontOfficeClosed}
                      onClick={() => {
                        if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                        handleOpenAddService(selectedCalendarBooking);
                        setSelectedCalendarBooking(null);
                      }}
                      className="w-full bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white font-medium py-2.5 rounded border border-purple-500/20 transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Package size={13} /> Add Stay Enhancement (Folio)
                    </button>
                    <button 
                      disabled={isFrontOfficeClosed}
                      onClick={() => {
                        if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                        setActiveVisitorRegistration(selectedCalendarBooking);
                        setSelectedCalendarBooking(null);
                      }}
                      className="w-full bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white font-medium py-2.5 rounded border border-blue-500/20 transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Users size={13} /> Register Guest Visitor
                    </button>
                  </>
                )}
                {(selectedCalendarBooking.status === 'confirmed' || selectedCalendarBooking.status === 'pending') && (
                  <button 
                    disabled={isFrontOfficeClosed}
                    onClick={() => {
                      if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                      setActiveNoShowModal(selectedCalendarBooking);
                      setSelectedCalendarBooking(null);
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 rounded border border-orange-600/30 transition-all text-xs flex items-center justify-center gap-1.5 shadow-[0_2px_6px_rgba(249,115,22,0.15)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <AlertTriangle size={13} /> Mark as No-Show / Rebook
                  </button>
                )}
                {selectedCalendarBooking.status === 'no_show' && (
                  <button 
                    disabled={isFrontOfficeClosed}
                    onClick={() => {
                      if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                      setActiveNoShowModal(selectedCalendarBooking);
                      setSelectedCalendarBooking(null);
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 rounded border border-orange-600/30 transition-all text-xs flex items-center justify-center gap-1.5 shadow-[0_2px_6px_rgba(249,115,22,0.15)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <AlertTriangle size={13} /> Rebook No-Show Guest
                  </button>
                )}
                <button 
                  disabled={isFrontOfficeClosed}
                  onClick={() => {
                    if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                    setTransferBooking(selectedCalendarBooking);
                    setSelectedCalendarBooking(null);
                  }}
                  className="w-full bg-dark-700 hover:bg-dark-600 text-white font-medium py-2.5 rounded border border-dark-600 transition-colors text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowRightLeft size={13} /> Request Room Transfer
                </button>
                <button 
                  onClick={() => setSelectedCalendarBooking(null)}
                  className="w-full bg-dark-950 text-gray-200 hover:text-white font-medium py-2.5 rounded hover:bg-dark-900 transition-colors text-xs"
                >
                  Close Details
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- Check-In Modal Workflow --- */}
      {activeCheckIn && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-2xl rounded-xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col">
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <LogIn className="text-brand-500"/> Formal Check-In
              </h2>
              <button onClick={() => setActiveCheckIn(null)} className="text-gray-200 hover:text-white"><X size={24}/></button>
            </div>
            
            <div className="p-6">
              {/* Stepper */}
              <div className="flex justify-between mb-8 relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-dark-700 -z-10 -translate-y-1/2"></div>
                {['Reservation', 'Verification', 'Signature'].map((step, i) => (
                  <div key={step} className="flex flex-col items-center gap-2 bg-dark-800 px-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${checkInStep >= i+1 ? 'bg-brand-500 text-dark-900' : 'bg-dark-700 text-gray-300'}`}>
                      {i + 1}
                    </div>
                    <span className={`text-xs ${checkInStep >= i+1 ? 'text-white' : 'text-gray-300'}`}>{step}</span>
                  </div>
                ))}
              </div>

              {/* Step 1: Reservation */}
              {checkInStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-dark-900 border border-dark-700 rounded p-4">
                    <p className="text-sm text-gray-200 mb-1">Guest Name</p>
                    <p className="text-lg font-bold text-white mb-4">{activeCheckIn.profiles ? `${activeCheckIn.profiles.first_name} ${activeCheckIn.profiles.last_name}` : activeCheckIn.guest_name}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-200">Assigned Room</p>
                        <p className="text-brand-500 font-bold text-lg">{activeCheckIn.rooms?.room_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-200">Payment Status</p>
                        <p className={`font-semibold ${
                          activeCheckIn.payment_status === 'paid' ? 'text-green-400' : 
                          activeCheckIn.payment_status === 'partial' ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {activeCheckIn.payment_status.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {activeCheckIn.payment_status === 'unpaid' && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded text-sm">
                      ⚠️ Balance is not settled. Ensure full or deposit payment is collected before issuing keys.
                    </div>
                  )}
                  {activeCheckIn.payment_status === 'partial' && (
                    <div className="bg-amber-500/15 border border-amber-500/35 text-amber-400 p-4 rounded text-sm">
                      💡 Partial payment received. Guest is cleared for check-in. Note the outstanding balance for checkout collection.
                    </div>
                  )}
                  <button onClick={() => setCheckInStep(2)} className="w-full btn-primary py-3">Proceed to Verification</button>
                </div>
              )}

              {/* Step 2: Verification */}
              {checkInStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-dark-900 border border-dark-700 rounded p-5 space-y-4">
                    <label className="flex items-center gap-4 p-4 border border-dark-700 rounded cursor-pointer hover:bg-dark-800 transition-colors">
                      <input type="checkbox" checked={idVerified} onChange={e => setIdVerified(e.target.checked)} className="w-6 h-6 accent-brand-500" />
                      <div>
                        <p className="font-bold text-white flex items-center gap-2"><ShieldCheck size={18} className="text-brand-500"/> Physical ID Verified</p>
                        <p className="text-xs text-gray-200">I have reviewed a valid government-issued ID matching the reservation.</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-4 p-4 border border-dark-700 rounded cursor-pointer hover:bg-dark-800 transition-colors">
                      <input type="checkbox" checked={keyIssued} onChange={e => setKeyIssued(e.target.checked)} className="w-6 h-6 accent-brand-500" />
                      <div>
                        <p className="font-bold text-white flex items-center gap-2"><Key size={18} className="text-brand-500"/> Room Keys Issued</p>
                        <p className="text-xs text-gray-200">Physical or digital keys have been successfully provisioned for Room {activeCheckIn.rooms?.room_number}.</p>
                      </div>
                    </label>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <button onClick={() => setCheckInStep(1)} className="bg-dark-700 text-white px-6 py-3 rounded">Back</button>
                    <button onClick={() => setCheckInStep(3)} disabled={!idVerified || !keyIssued} className={`flex-1 py-3 rounded font-bold transition-all ${idVerified && keyIssued ? 'bg-brand-500 text-dark-900 hover:bg-brand-400' : 'bg-dark-700 text-gray-300 cursor-not-allowed'}`}>
                      Capture Signature
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Signature (Agreement to Terms & Conditions) */}
              {checkInStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-dark-900 border border-dark-700 rounded p-5">
                    <p className="text-white font-medium mb-2 flex items-center gap-2"><ShieldCheck size={18} className="text-brand-500"/> Terms & Conditions of Stay</p>
                    <p className="text-xs text-gray-200 mb-3">Please review the house rules and stay policy below with the guest:</p>
                    
                    <div className="h-40 overflow-y-auto bg-dark-950 border border-dark-800 rounded p-3 text-xs text-gray-200 space-y-2 mb-4 scrollbar-thin">
                      <p className="font-bold text-white uppercase tracking-wider">1. Check-In & Check-Out</p>
                      <p>Standard check-in is 2:00 PM and check-out is 11:00 AM. Late check-out is subject to availability and additional fees.</p>
                      
                      <p className="font-bold text-white uppercase tracking-wider">2. Non-Smoking Policy</p>
                      <p>All rooms and suites are strictly non-smoking. A cleaning penalty of ₦50,000 will be applied to violations.</p>
                      
                      <p className="font-bold text-white uppercase tracking-wider">3. Damages & Incidentals</p>
                      <p>Guests are personally and jointly liable for any damages to the property, furniture, or fittings caused during their stay. Stay enhancements or extras must be cleared in full before or during check-out.</p>
                      
                      <p className="font-bold text-white uppercase tracking-wider">4. Disturbances & Gatherings</p>
                      <p>Quiet hours are observed from 10:00 PM to 7:00 AM. Parties, commercial events, or unauthorized gatherings are strictly prohibited.</p>
                    </div>

                    <label className="flex items-start gap-3 p-3 bg-dark-950 border border-dark-800 rounded cursor-pointer hover:bg-dark-900 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={signatureData === 'SIGNED_AGREED_TERMS'} 
                        onChange={e => setSignatureData(e.target.checked ? 'SIGNED_AGREED_TERMS' : null)}
                        className="w-5 h-5 mt-0.5 rounded border-dark-700 text-brand-500 accent-brand-500" 
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">Agree to Terms & Conditions</p>
                        <p className="text-xs text-gray-200 mt-0.5">The guest accepts all terms of stay and financial responsibility for Room {activeCheckIn.rooms?.room_number}.</p>
                      </div>
                    </label>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <button onClick={() => setCheckInStep(2)} className="bg-dark-700 text-white px-6 py-3 rounded">Back</button>
                    <button 
                      onClick={handleFinalizeCheckIn} 
                      disabled={signatureData !== 'SIGNED_AGREED_TERMS'} 
                      className={`flex-1 py-3 rounded font-bold transition-all ${signatureData === 'SIGNED_AGREED_TERMS' ? 'bg-brand-500 text-dark-900 hover:bg-brand-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-dark-700 text-gray-300 cursor-not-allowed'}`}
                    >
                      Complete Check-In
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Check-Out Modal --- */}
      {activeCheckOut && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col">
             <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <LogOut className="text-gray-200"/> Confirm Check-Out
              </h2>
              <button onClick={() => setActiveCheckOut(null)} className="text-gray-200 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-6">
              {(() => {
                const scheduledNights = Math.max(1, differenceInDays(new Date(activeCheckOut.check_out_date), new Date(activeCheckOut.check_in_date))) || 1;
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const finalCheckOutDate = activeCheckOut.check_out_date > todayStr ? todayStr : activeCheckOut.check_out_date;
                const actualNights = Math.max(1, differenceInDays(new Date(finalCheckOutDate), new Date(activeCheckOut.check_in_date))) || 1;
                
                const dailyRoomRate = Number(activeCheckOut.total_room_price_ngn || 0) / scheduledNights;
                const unusedNights = Math.max(0, scheduledNights - actualNights);
                const unusedNightsValue = dailyRoomRate * unusedNights;
                
                const originalTotal = Number(activeCheckOut.total_amount_ngn || 0);
                const newTotal = originalTotal - unusedNightsValue;
                const amountPaid = Number(activeCheckOut.amount_paid_ngn || 0);
                
                const totalExtras = Number(activeCheckOut.total_extras_price_ngn || 0);
                const accommodationCharges = Math.max(0, newTotal - totalExtras);
                
                const unpaidServicesTotal = (unpaidServices || []).reduce((sum, s) => {
                  const isTaxable = s.services?.tax_inclusive !== false;
                  const basePrice = Number(s.total_price_ngn || 0);
                  const tax = isTaxable ? basePrice * 0.075 : 0;
                  return sum + basePrice + tax;
                }, 0);
                
                // netOwed is the overall outstanding amount (Accommodation + Extras)
                const netOwed = newTotal - amountPaid;
                const totalOwed = Math.max(0, netOwed);
                const overpaidAmount = Math.max(0, -netOwed);
                const remainingBalance = totalOwed;
                const isPaidActual = totalOwed <= 0;

                return (
                  <>
                    <p className="text-white mb-4">You are about to check out <strong>{activeCheckOut.profiles ? `${activeCheckOut.profiles.first_name} ${activeCheckOut.profiles.last_name}` : activeCheckOut.guest_name}</strong> from Room <strong>{activeCheckOut.rooms?.room_number}</strong>.</p>
                    
                    {unusedNights > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl mb-4 text-xs space-y-1 animate-in slide-in-from-top duration-300">
                        <p className="font-extrabold text-yellow-500 flex items-center gap-1.5 uppercase tracking-wider">
                          ⏳ Early Check-Out Detected
                        </p>
                        <p className="text-gray-200">
                          Stay shortened from {scheduledNights} to {actualNights} nights ({unusedNights} night(s) unused).
                        </p>
                        <p className="text-gray-200">
                          Unused stay credit: <strong className="text-white font-mono">₦{unusedNightsValue.toLocaleString()}</strong>
                        </p>
                      </div>
                    )}

                    {unpaidServices && unpaidServices.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-4 text-xs space-y-2.5 animate-in slide-in-from-top duration-300">
                        <p className="font-extrabold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                          ⚠️ Unpaid Guest Services Folio
                        </p>
                        <p className="text-gray-200 leading-normal">
                          This stay has unpaid room folio services that must be paid at Finance & Billing before check-out:
                        </p>
                        <div className="divide-y divide-dark-750 bg-dark-900/50 p-2 rounded-lg border border-dark-700/50 max-h-[160px] overflow-y-auto space-y-1">
                          {unpaidServices.map(srv => {
                            const isTaxable = srv.services?.tax_inclusive !== false;
                            const basePrice = Number(srv.total_price_ngn || 0);
                            const tax = isTaxable ? basePrice * 0.075 : 0;
                            const total = basePrice + tax;
                            const qty = srv.quantity || 1;
                            const unitPrice = srv.unit_price_ngn || (qty > 0 ? basePrice / qty : basePrice);
                            return (
                              <div key={srv.id} className="flex flex-col py-1.5 border-b border-dark-700/30 last:border-b-0">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-300 font-medium truncate max-w-[220px]">{srv.services?.name || 'Guest Charge'}</span>
                                  <span className="font-bold text-white font-mono">₦{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-gray-300 mt-0.5">
                                  <span>Qty: {qty} | Unit: ₦{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span>Base: ₦{basePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {isTaxable ? `| VAT (7.5%): ₦${tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '(VAT Exempt)'}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center text-[11px] pt-1.5 font-bold text-red-400 border-t border-red-500/10">
                          <span>Total Unpaid Services:</span>
                          <span className="font-mono">₦{unpaidServicesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-dark-900 border border-dark-700 p-4 rounded mb-6 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-200">Accommodation Charges (Rent + Tax):</span>
                        <span className="font-bold text-white font-mono">₦{accommodationCharges.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-200">Stay Amount Paid:</span>
                        <span className="font-bold text-green-500 font-mono">₦{amountPaid.toLocaleString()}</span>
                      </div>
                      {unpaidServicesTotal > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-200">Unpaid Extras Folio:</span>
                          <span className="font-bold text-red-400 font-mono">₦{unpaidServicesTotal.toLocaleString()}</span>
                        </div>
                      )}
                      
                      {overpaidAmount > 0 ? (
                        <div className="border-t border-dark-700 pt-2 flex justify-between items-center">
                          <span className="text-amber-400 text-sm font-extrabold">Credit Owed to Guest:</span>
                          <span className="font-bold font-mono text-lg text-amber-400">
                            ₦{overpaidAmount.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <div className="border-t border-dark-700 pt-2 flex justify-between items-center">
                          <span className="text-gray-200 text-sm font-semibold">Total Outstanding Balance:</span>
                          <span className={`font-bold font-mono text-lg ${isPaidActual ? 'text-green-500' : 'text-red-400'}`}>
                            ₦{totalOwed.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {overpaidAmount > 0 && (
                      <div className="bg-dark-900 border border-dark-750 p-4 rounded-xl mb-6 space-y-3 animate-in fade-in duration-300">
                        <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                           Settle Refund Balance
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                            <input 
                              type="radio" 
                              name="settle_mode" 
                              value="ar_wallet"
                              checked={checkoutSettleMode === 'ar_wallet'}
                              onChange={() => setCheckoutSettleMode('ar_wallet')}
                              className="accent-brand-500 w-4 h-4"
                            />
                            <span>Transfer to AR Prepayment Wallet (Auto-activate)</span>
                          </label>
                          <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                            <input 
                              type="radio" 
                              name="settle_mode" 
                              value="cash_refund"
                              checked={checkoutSettleMode === 'cash_refund'}
                              onChange={() => setCheckoutSettleMode('cash_refund')}
                              className="accent-brand-500 w-4 h-4"
                            />
                            <span>Dispense Cash Refund to Guest</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Settlement Panel if guest owes money */}
                    {!isPaidActual && (
                      <div className="space-y-4 mb-6">
                        {pendingCheckoutPayments.length > 0 ? (
                          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl text-xs space-y-2 animate-in fade-in duration-300">
                            <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                              ⏳ Awaiting Finance Confirmation
                            </p>
                            {pendingCheckoutPayments.map(p => (
                              <p key={p.id} className="text-gray-300 text-[11px] leading-relaxed">
                                A pending payment of <strong className="text-white font-mono text-xs">₦{p.amount.toLocaleString()}</strong> via <strong className="text-white capitalize text-xs">{p.method === 'bank_transfer' ? 'Bank Transfer' : p.method}</strong> has been logged. Guest checkout is blocked until Finance verifies this payment.
                              </p>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-dark-900 border border-dark-750 p-4 rounded-xl space-y-3 animate-in fade-in duration-300">
                            <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                              Settle Folio Balance (₦{totalOwed.toLocaleString()})
                            </label>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <label className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all ${checkoutPaymentMethod === 'ar' ? 'border-purple-500 bg-purple-500/10 text-white font-semibold shadow-sm' : 'border-dark-700 bg-dark-800/50 text-gray-200 hover:border-dark-600'}`}>
                                <input 
                                  type="radio" 
                                  name="checkout_payment" 
                                  value="ar"
                                  checked={checkoutPaymentMethod === 'ar'}
                                  onChange={() => setCheckoutPaymentMethod('ar')}
                                  className="sr-only"
                                />
                                <Wallet size={18} className="mb-1" />
                                <span className="text-[10px]">AR Wallet</span>
                              </label>

                              <label className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all ${checkoutPaymentMethod === 'cash' ? 'border-brand-500 bg-brand-500/10 text-white font-semibold shadow-sm' : 'border-dark-700 bg-dark-800/50 text-gray-200 hover:border-dark-600'}`}>
                                <input 
                                  type="radio" 
                                  name="checkout_payment" 
                                  value="cash"
                                  checked={checkoutPaymentMethod === 'cash'}
                                  onChange={() => setCheckoutPaymentMethod('cash')}
                                  className="sr-only"
                                />
                                <Coins size={18} className="mb-1" />
                                <span className="text-[10px]">Cash</span>
                              </label>

                              <label className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all ${checkoutPaymentMethod === 'pos' ? 'border-brand-500 bg-brand-500/10 text-white font-semibold shadow-sm' : 'border-dark-700 bg-dark-800/50 text-gray-200 hover:border-dark-600'}`}>
                                <input 
                                  type="radio" 
                                  name="checkout_payment" 
                                  value="pos"
                                  checked={checkoutPaymentMethod === 'pos'}
                                  onChange={() => setCheckoutPaymentMethod('pos')}
                                  className="sr-only"
                                />
                                <CreditCard size={18} className="mb-1" />
                                <span className="text-[10px]">POS</span>
                              </label>

                              <label className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all ${checkoutPaymentMethod === 'bank_transfer' ? 'border-brand-500 bg-brand-500/10 text-white font-semibold shadow-sm' : 'border-dark-700 bg-dark-800/50 text-gray-200 hover:border-dark-600'}`}>
                                <input 
                                  type="radio" 
                                  name="checkout_payment" 
                                  value="bank_transfer"
                                  checked={checkoutPaymentMethod === 'bank_transfer'}
                                  onChange={() => setCheckoutPaymentMethod('bank_transfer')}
                                  className="sr-only"
                                />
                                <ArrowUpRight size={18} className="mb-1" />
                                <span className="text-[10px]">Transfer</span>
                              </label>
                            </div>

                            {checkoutPaymentMethod === 'ar' && (
                              <div className="pt-2 border-t border-dark-750 space-y-2">
                                {checkoutARProfile ? (
                                  <>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-gray-200">Available AR Balance:</span>
                                      <span className={`font-bold font-mono ${Number(checkoutARProfile.wallet_balance || 0) >= totalOwed ? 'text-green-500' : 'text-red-400'}`}>
                                        ₦{Number(checkoutARProfile.wallet_balance || 0).toLocaleString()}
                                      </span>
                                    </div>
                                    {Number(checkoutARProfile.wallet_balance || 0) >= totalOwed ? (
                                      <button
                                        type="button"
                                        disabled={checkoutProcessing}
                                        onClick={() => handleSettleARAndCheckout(totalOwed, unusedNightsValue)}
                                        className="w-full bg-purple-650 hover:bg-purple-750 text-white font-bold py-2.5 px-3 rounded-lg text-xs transition-all shadow-md mt-2 flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <Wallet size={13} />
                                        <span>Clear Folio via AR & Check Out</span>
                                      </button>
                                    ) : (
                                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-[11px] font-semibold">
                                        ⚠️ Insufficient AR Wallet Balance.
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-[11px] font-semibold">
                                    ⚠️ No AR Prepayment Wallet profile found for this guest.
                                  </div>
                                )}
                              </div>
                            )}

                            {checkoutPaymentMethod !== 'ar' && (
                              <div className="pt-2 border-t border-dark-750">
                                <button
                                  type="button"
                                  disabled={checkoutProcessing}
                                  onClick={() => handleLogPendingCheckoutPayment(totalOwed)}
                                  className="w-full bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold py-2.5 px-3 rounded-lg text-xs transition-all shadow-md mt-1 flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <FileText size={13} />
                                  <span>Log Payment for Finance Confirmation</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <button 
                      onClick={() => handleFinalizeCheckOutEarly(unusedNightsValue, overpaidAmount)} 
                      disabled={!isPaidActual || pendingCheckoutPayments.length > 0}
                      className={`w-full py-3 rounded font-bold transition-colors ${isPaidActual && pendingCheckoutPayments.length === 0 ? 'bg-brand-500 text-dark-900 hover:bg-brand-400 shadow-md' : 'bg-dark-700 text-gray-300 cursor-not-allowed'}`}
                    >
                      {overpaidAmount > 0 ? 'Settle Balance & Check Out' : 'Mark as Checked Out'}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* --- No-Show & Rebook Modal --- */}
      {activeNoShowModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-lg rounded-xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col">
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-orange-500"/> No-Show / Guest Rebooking
              </h2>
              <button onClick={() => setActiveNoShowModal(null)} className="text-gray-200 hover:text-white"><X size={24}/></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[550px] overflow-y-auto custom-scrollbar">
              {/* Guest Details */}
              <div className="bg-dark-900/40 border border-dark-700/60 p-4 rounded-xl space-y-2">
                <p className="text-xs uppercase font-extrabold tracking-wider text-gray-300">Current Reservation Details</p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-200 block">Guest Name:</span>
                    <strong className="text-white text-sm">{activeNoShowModal.profiles ? `${activeNoShowModal.profiles.first_name} ${activeNoShowModal.profiles.last_name}` : activeNoShowModal.guest_name}</strong>
                  </div>
                  <div>
                    <span className="text-gray-200 block">Original Room:</span>
                    <strong className="text-white text-sm">Room {activeNoShowModal.rooms?.room_number}</strong>
                  </div>
                  <div>
                    <span className="text-gray-200 block">Original Dates:</span>
                    <strong className="text-white">{activeNoShowModal.check_in_date} to {activeNoShowModal.check_out_date}</strong>
                  </div>
                  <div>
                    <span className="text-gray-200 block">Amount Paid originally:</span>
                    <strong className="text-green-400 font-mono">₦{Number(activeNoShowModal.amount_paid_ngn || 0).toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Action 1: Mark No-Show Only (if not already no-show) */}
              {activeNoShowModal.status !== 'no_show' && (
                <div className="bg-dark-900/20 border border-dark-850 p-4 rounded-xl space-y-3">
                  <p className="text-xs text-gray-200">If the guest will not arrive and you only want to release the room to available inventory without rebooking:</p>
                  <button 
                    type="button"
                    disabled={rebookProcessing}
                    onClick={() => handleMarkAsNoShowOnly(activeNoShowModal)}
                    className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-4 py-2 text-xs font-bold rounded border border-red-500/20 transition-all flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                  >
                    <AlertTriangle size={13} /> Mark as No-Show & Release Room
                  </button>
                </div>
              )}

              {/* Action 2: Rebook Form */}
              <form onSubmit={handleConfirmRebooking} className="space-y-4 pt-2 border-t border-dark-700/60">
                <p className="text-xs uppercase font-extrabold tracking-wider text-gray-300 mb-2">Rebook Guest for New Dates</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-200 mb-1 font-semibold">New Check-In Date *</label>
                    <input 
                      required 
                      type="date" 
                      value={rebookCheckIn} 
                      onChange={e => setRebookCheckIn(e.target.value)} 
                      className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-xs font-mono" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-200 mb-1 font-semibold">New Check-Out Date *</label>
                    <input 
                      required 
                      type="date" 
                      value={rebookCheckOut} 
                      onChange={e => setRebookCheckOut(e.target.value)} 
                      className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-xs font-mono" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-200 mb-1 font-semibold">Select Room *</label>
                  {loadingRebookRooms ? (
                    <div className="text-xs text-gray-300 italic py-2">Loading available rooms...</div>
                  ) : (
                    <select 
                      required
                      value={rebookRoomId} 
                      onChange={e => setRebookRoomId(e.target.value)} 
                      className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-xs"
                    >
                      <option value="">-- Select Available Room --</option>
                      {rebookRoomsList.map(r => (
                        <option key={r.id} value={r.id}>
                          Room {r.room_number} - {r.name} (₦{Number(r.base_price_ngn).toLocaleString()}/night)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Pricing / Balance Carryover Summary */}
                {rebookCheckIn && rebookCheckOut && rebookRoomId && (
                  (() => {
                    const selectedRoom = rebookRoomsList.find(r => r.id === rebookRoomId);
                    if (!selectedRoom) return null;
                    const nights = Math.max(1, differenceInDays(new Date(rebookCheckOut), new Date(rebookCheckIn)));
                    const newPrice = Number(selectedRoom.base_price_ngn) * nights;
                    const originalPaid = Number(activeNoShowModal.amount_paid_ngn || 0);
                    const balOwed = Math.max(0, newPrice - originalPaid);

                    return (
                      <div className="bg-dark-900 border border-dark-750 p-4 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-center text-gray-200">
                          <span>New Stay Period:</span>
                          <span className="text-white font-semibold">{nights} Night(s)</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-200">
                          <span>New Stay Total:</span>
                          <span className="text-white font-mono font-bold">₦{newPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-200">
                          <span>Original Prepayment:</span>
                          <span className="text-green-400 font-mono font-bold">₦{originalPaid.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-dark-700 pt-2 flex justify-between items-center text-sm">
                          <span className="text-amber-400 font-extrabold">Balance to Pay at Checkout:</span>
                          <span className={`font-mono font-black ${balOwed > 0 ? 'text-red-400 font-extrabold' : 'text-green-500'}`}>
                            ₦{balOwed.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                )}

                <button
                  type="submit"
                  disabled={rebookProcessing || loadingRebookRooms}
                  className="w-full bg-brand-500 hover:bg-brand-400 text-dark-950 font-bold py-3 text-xs transition-all rounded shadow-md mt-2 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  Confirm Guest Rebooking (₦0 payment today)
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- Visitor Registration Modal --- */}
      {activeVisitorRegistration && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col">
             <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="text-brand-500"/> Register Visitor
              </h2>
              <button onClick={() => setActiveVisitorRegistration(null)} className="text-gray-200 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-6">
              <p className="text-gray-200 text-sm mb-6">Registering an external visitor for Room <strong className="text-white">{activeVisitorRegistration.rooms?.room_number}</strong>.</p>
              
              <form onSubmit={handleRegisterVisitor} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-1 font-semibold">Visitor Full Name *</label>
                  <input required type="text" value={visitorName} onChange={e=>setVisitorName(e.target.value)} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1 font-semibold">Phone Number *</label>
                  <input required type="tel" value={visitorPhone} onChange={e=>setVisitorPhone(e.target.value)} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="e.g. 080XXXXXXXX" />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1 font-semibold">ID Number / Card Type *</label>
                  <input required type="text" value={visitorId} onChange={e=>setVisitorId(e.target.value)} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="Driver's License #, NIN, etc." />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1 font-semibold">Purpose of Visit</label>
                  <select value={visitorPurpose} onChange={e=>setVisitorPurpose(e.target.value)} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500 text-sm">
                    <option value="Social Visit">Social Visit</option>
                    <option value="Business Meeting">Business Meeting</option>
                    <option value="Delivery / Logistics">Delivery / Logistics</option>
                    <option value="Maintenance / Service">Maintenance / Service</option>
                    <option value="Other / Personal">Other / Personal</option>
                  </select>
                </div>
                <button type="submit" className="w-full btn-primary py-3 mt-4 text-sm font-bold shadow-md">Sign In Visitor</button>
              </form>
            </div>
          </div>
        </div>
      )}

      <RoomTransferModal 
        isOpen={Boolean(transferBooking)} 
        onClose={() => setTransferBooking(null)} 
        booking={transferBooking} 
        onSuccess={fetchFrontDeskData} 
      />

      <ManualBookingModal 
        isOpen={isNewBookingModalOpen} 
        onClose={() => {
          setIsNewBookingModalOpen(false);
          setPreselectedRoomId(null);
        }} 
        preselectedRoomId={preselectedRoomId}
        onSuccess={fetchFrontDeskData} 
      />

      {/* --- Manager Inspection Checklist Modal --- */}
      {activeInspection && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col">
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle className="text-yellow-500"/> Manager Inspection
              </h2>
              <button onClick={() => setActiveInspection(null)} className="text-gray-200 hover:text-white"><X size={24}/></button>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-200">
                Please verify the standard housekeeping quality checklist before certifying the room as <strong>Vacant - Ready</strong>.
              </p>
              
              <div className="space-y-3 bg-dark-900/60 p-4 border border-dark-700/50 rounded-lg">
                {[
                  { key: 'bed', label: 'Beds made properly with fresh linens' },
                  { key: 'bathroom', label: 'Bathroom sanitized & toiletries restocked' },
                  { key: 'trash', label: 'Trash bins emptied and clean liners inserted' },
                  { key: 'floors', label: 'Floors vacuumed, swept, or mopped cleanly' },
                  { key: 'restock', label: 'Minibar, coffee, & water supplies restocked' }
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-3 p-2.5 rounded hover:bg-dark-850 cursor-pointer transition-colors text-sm text-gray-300">
                    <input 
                      type="checkbox" 
                      checked={checklist[item.key]} 
                      onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="w-5 h-5 rounded border-dark-600 text-brand-500 accent-brand-500 focus:ring-0 focus:ring-offset-0 bg-dark-800" 
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={handleRejectInspection} 
                  className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 py-2.5 rounded-lg font-bold transition-all text-sm"
                >
                  Fail Inspection
                </button>
                <button 
                  onClick={handleSubmitInspection} 
                  className="flex-1 btn-primary py-2.5 rounded-lg font-bold text-sm"
                >
                  Approve & Ready
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Add Service to Stay Folio Modal --- */}
      {activeAddServiceBooking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-lg rounded-xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="text-purple-400"/> Add Stay Enhancement to Folio
              </h2>
              <button onClick={() => setActiveAddServiceBooking(null)} className="text-gray-200 hover:text-white"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleAddServiceSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-700/50 text-xs text-gray-200">
                <span className="block text-gray-300 font-semibold mb-1">Target Account:</span>
                Room {activeAddServiceBooking.rooms?.room_number} — {activeAddServiceBooking.profiles ? `${activeAddServiceBooking.profiles.first_name} ${activeAddServiceBooking.profiles.last_name}` : activeAddServiceBooking.guest_name}
              </div>

              {/* Standard Services */}
              <div className="space-y-3 text-left">
                <h5 className="text-xs font-extrabold text-purple-400 uppercase tracking-wider">Standard Services</h5>
                {availableServices.length === 0 ? (
                  <p className="text-xs text-gray-300">No active standard services registered.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableServices.map(service => {
                      const isVirtualMeals = service.id === 'meals-virtual';
                      const isChecked = isVirtualMeals ? isMealsSelected : !!bulkSelections[service.id];
                      return (
                        <div 
                          key={service.id} 
                          onClick={() => handleToggleBulkCheck(service, !isChecked)}
                          className={`p-3.5 border rounded-xl transition-all cursor-pointer bg-dark-900/40 hover:bg-dark-900/60 flex items-center justify-between gap-3 ${
                            isChecked 
                              ? (isVirtualMeals ? 'border-amber-500 bg-amber-500/5 shadow-md shadow-amber-500/5' : 'border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/5') 
                              : 'border-dark-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Controlled by outer div click
                              className={`w-4 h-4 rounded border-dark-600 accent-current focus:ring-0 focus:ring-offset-0 bg-dark-800 cursor-pointer ${
                                isVirtualMeals ? 'text-amber-500' : 'text-purple-500'
                              }`}
                            />
                            <div className="text-left">
                              <span className="text-xs font-bold text-white block leading-tight">{service.name}</span>
                              <span className="text-[10px] text-gray-200 font-mono">
                                {isVirtualMeals ? 'Order Food / Drinks' : `₦${Number(service.base_price_ngn).toLocaleString()}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Food & Beverage Meals Selection Panel (opens upon selection of Meals virtual service) */}
              {isMealsSelected && foodMenuServices.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-dark-700/50 text-left animate-in slide-in-from-top-2 duration-200">
                  <h5 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ChefHat size={14} /> Kitchen Menu Selection
                  </h5>
                  
                  {/* Menu Tabs */}
                  <div className="flex flex-wrap gap-1 bg-dark-900 p-1.5 rounded-xl border border-dark-700 w-fit">
                    {['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Drinks', 'Appetizers'].map(tab => {
                      const count = foodMenuServices.filter(s => parseDescription(s.description).segment === tab).length;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setKitchenMenuTab(tab)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            kitchenMenuTab === tab 
                              ? 'bg-amber-500 text-dark-900 font-extrabold shadow-sm' 
                              : 'text-gray-200 hover:text-white'
                          }`}
                        >
                          {tab} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Menu items under active tab */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                    {foodMenuServices
                      .filter(s => parseDescription(s.description).segment === kitchenMenuTab)
                      .map(service => {
                        const isChecked = !!bulkSelections[service.id];
                        return (
                          <div 
                            key={service.id} 
                            onClick={() => handleToggleBulkCheck(service, !isChecked)}
                            className={`p-3 border rounded-xl transition-all cursor-pointer bg-dark-900/40 hover:bg-dark-900/60 flex items-center justify-between gap-3 ${
                              isChecked ? 'border-amber-500 bg-amber-500/5 shadow-md shadow-amber-500/5' : 'border-dark-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // Controlled by outer div click
                                className="w-4 h-4 rounded border-dark-600 text-amber-500 accent-amber-500 focus:ring-0 focus:ring-offset-0 bg-dark-800 cursor-pointer"
                              />
                              <div className="text-left">
                                <span className="text-xs font-bold text-white block leading-tight">{service.name}</span>
                                <span className="text-[10px] text-gray-450 font-mono">₦{Number(service.base_price_ngn).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Configure Selected Items Section */}
              {Object.keys(bulkSelections).length > 0 && (
                <div className="border border-purple-500/20 bg-purple-500/5 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-250">
                  <h4 className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-2 border-b border-purple-500/10 pb-2">
                    Configure Selected Services ({Object.keys(bulkSelections).length})
                  </h4>
                  
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {Object.entries(bulkSelections).map(([serviceId, data]) => {
                      const { service, quantity, date, time, notes } = data;
                      const needsScheduling = service.scheduling_required || /pickup|spa|massage/i.test(service.name);
                      const isMeal = service.internal_notes?.toLowerCase().trim() === 'restaurant';
                      const price = calculateSingleServicePrice(service, quantity, activeAddServiceBooking);
                      
                      return (
                        <div key={serviceId} className="bg-dark-900/80 p-3.5 border border-dark-750 rounded-xl space-y-3 relative text-left" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleBulkCheck(service, false)}
                            className="absolute top-2.5 right-2.5 text-gray-300 hover:text-red-400 text-xs font-bold"
                          >
                            Remove
                          </button>
                          
                          <div>
                            <span className="text-xs font-black text-white">{service.name}</span>
                            <span className="text-[10px] text-gray-300 block">Unit Price: ₦{Number(service.base_price_ngn).toLocaleString()}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Quantity */}
                            {(service.pricing_type === 'quantity_based' || 
                              service.pricing_type === 'time_based' || 
                              service.pricing_type === 'per_person' ||
                              isMeal) && (
                              <div>
                                <label className="block text-[10px] text-gray-200 font-bold uppercase tracking-wider mb-1">Quantity</label>
                                <input
                                  type="number"
                                  required
                                  min="1"
                                  value={quantity}
                                  onChange={e => handleUpdateBulkField(serviceId, 'quantity', Math.max(1, Number(e.target.value)))}
                                  className="w-full bg-dark-850 border border-dark-700 p-2 rounded text-white text-xs outline-none focus:border-purple-500 font-semibold"
                                />
                              </div>
                            )}

                            {/* Special Notes */}
                            <div className={(service.pricing_type === 'quantity_based' || service.pricing_type === 'time_based' || service.pricing_type === 'per_person' || isMeal) ? "" : "col-span-2"}>
                              <label className="block text-[10px] text-gray-200 font-bold uppercase tracking-wider mb-1">Special Notes / Instructions</label>
                              <input
                                type="text"
                                value={notes}
                                placeholder={isMeal ? "e.g., Spicy, no butter..." : "Special instructions..."}
                                onChange={e => handleUpdateBulkField(serviceId, 'notes', e.target.value)}
                                className="w-full bg-dark-850 border border-dark-700 p-2 rounded text-white text-xs outline-none focus:border-purple-500"
                              />
                            </div>
                          </div>

                          {/* Scheduling controls if needed */}
                          {needsScheduling && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="block text-[10px] text-gray-200 font-bold uppercase tracking-wider mb-1">Scheduled Date</label>
                                <input
                                  type="date"
                                  required
                                  value={date}
                                  onChange={e => handleUpdateBulkField(serviceId, 'date', e.target.value)}
                                  className="w-full bg-dark-850 border border-dark-700 p-1.5 rounded text-white text-xs outline-none focus:border-purple-500 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-200 font-bold uppercase tracking-wider mb-1">Scheduled Time</label>
                                <input
                                  type="time"
                                  required
                                  value={time}
                                  onChange={e => handleUpdateBulkField(serviceId, 'time', e.target.value)}
                                  className="w-full bg-dark-850 border border-dark-700 p-1.5 rounded text-white text-xs outline-none focus:border-purple-500 font-semibold"
                                />
                              </div>
                            </div>
                          )}

                          <div className="text-right text-xs font-bold pt-1 text-purple-400">
                            Est. Charge: ₦{price.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBulkToCart}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-dark-950 font-black py-2.5 rounded-xl transition-all text-xs flex justify-center items-center gap-1.5 shadow-md shadow-purple-500/10 active:scale-[0.98]"
                  >
                    <Plus size={14} className="stroke-[3]" /> Add Checked Items to Folio Order List
                  </button>
                </div>
              )}

              {/* Cart List */}
              {selectedServicesList.length > 0 && (
                <div className="border border-dark-700 rounded-lg p-4 bg-dark-900/40 space-y-3 mt-3">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2 border-b border-dark-700 pb-2">
                    <ShoppingBag size={14} className="text-brand-500" /> Pending stay enhancements ({selectedServicesList.length})
                  </h4>
                  <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 custom-scrollbar text-xs">
                    {selectedServicesList.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-dark-900 p-2.5 rounded border border-dark-750 gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-300 mt-0.5">
                            Qty: {item.quantity} | ₦{Number(item.total_price_ngn).toLocaleString()}
                            {item.notes && <span className="block truncate italic text-[9px] text-gray-200">"{item.notes}"</span>}
                          </p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setSelectedServicesList(selectedServicesList.filter(x => x.id !== item.id))}
                          className="text-red-400 hover:text-red-300 font-bold text-[10px] px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-dark-700 pt-2 flex justify-between items-center text-xs font-bold">
                    <span className="text-gray-200">Total list cost:</span>
                    <span className="text-brand-400 font-black text-sm">₦{selectedServicesList.reduce((acc, curr) => acc + curr.total_price_ngn, 0).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isAddingService || selectedServicesList.length === 0}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-dark-700 disabled:text-gray-300 text-dark-950 font-black py-3 mt-2 rounded shadow transition-all flex justify-center items-center gap-2"
              >
                {isAddingService ? 'Adding Services...' : `Charge ${selectedServicesList.length} enhancements to folio (₦${selectedServicesList.reduce((acc, curr) => acc + curr.total_price_ngn, 0).toLocaleString()})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Night Audit No-Show Sweep Modal --- */}
      {isNoShowSweepOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-dark-800 border border-dark-700/80 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
            <div className="absolute -left-20 -top-20 w-44 h-44 rounded-full bg-brand-500/[0.02] blur-3xl pointer-events-none"></div>
            
            <div className="bg-dark-900 p-5 border-b border-dark-700/85 flex justify-between items-center relative z-10">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="text-brand-500 animate-pulse" />
                <span>Expired Bookings Sweep & Night Audit</span>
              </h2>
              <button 
                onClick={() => setIsNoShowSweepOpen(false)} 
                disabled={isSweepingNoShows}
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar relative z-10">
              <p className="text-xs text-gray-200 leading-relaxed">
                The background audit engine has detected the following confirmed or pending bookings whose check-in dates have expired. Sweeping these will automatically mark them as <strong className="text-brand-400">No Show</strong> and release their assigned rooms back to active available inventory.
              </p>

              {noShowBookings.length === 0 ? (
                <div className="bg-dark-950/40 p-8 rounded-lg border border-dark-800 text-center space-y-2">
                  <CheckCircle size={32} className="text-green-500 mx-auto" />
                  <h4 className="font-bold text-white text-sm">Perfect Audit Integration</h4>
                  <p className="text-xs text-gray-300">There are no pending expired arrivals to sweep today.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {noShowBookings.map((b) => {
                    const guestName = b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : b.guest_name;
                    return (
                      <div key={b.id} className="bg-dark-900 border border-dark-800 p-3 rounded-lg flex items-center justify-between text-xs transition-all hover:border-dark-700">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{guestName}</span>
                            {b.profiles?.vip_status && (
                              <span className="bg-yellow-500/20 text-yellow-400 text-[8px] font-black uppercase tracking-widest px-1 rounded-sm">VIP</span>
                            )}
                          </div>
                          <p className="text-gray-200 font-medium">Room {b.rooms?.room_number} • Ref: <span className="font-mono text-gray-300 font-bold">{b.booking_reference || 'MANUAL'}</span></p>
                          <p className="text-gray-300 text-[10px]">Expected Check-In: <span className="font-semibold">{format(new Date(b.check_in_date + 'T00:00:00'), 'MMM dd, yyyy')}</span></p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            b.payment_status === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            b.payment_status === 'partial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {b.payment_status}
                          </span>
                          <span className="text-[10px] text-gray-300 font-mono">₦{Number(b.total_amount_ngn || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-lg text-xs space-y-1">
                <span className="font-bold block">⚠️ Policy & Financial Guidance:</span>
                <p className="leading-normal text-gray-300 text-[11px]">
                  According to hotel cancellation terms, bookings that do not show up are strictly non-refundable. If a client requested a manual override, please proceed to the Billing dashboard to issue a credit or manual refund transaction.
                </p>
              </div>
            </div>

            <div className="bg-dark-900/60 p-4 border-t border-dark-700/80 flex gap-3 justify-end relative z-10">
              <button 
                onClick={() => setIsNoShowSweepOpen(false)} 
                disabled={isSweepingNoShows}
                className="bg-dark-950 text-gray-200 hover:text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-dark-800 transition-colors border border-dark-800"
              >
                Close Audit
              </button>
              <button 
                onClick={handleExecuteNoShowSweep} 
                disabled={isSweepingNoShows || noShowBookings.length === 0}
                className="bg-brand-500 hover:bg-brand-400 disabled:bg-dark-700 disabled:text-gray-300 text-dark-950 font-bold px-5 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(234,179,8,0.25)]"
              >
                {isSweepingNoShows ? "Sweeping Inventory..." : `Process No-Show Sweep (${noShowBookings.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Guest Wallet Modal */}
      {isActivateWalletOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md relative rounded-xl animate-in zoom-in-95 flex flex-col">
            <button onClick={() => setIsActivateWalletOpen(false)} className="absolute top-4 right-4 text-gray-450 hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Wallet className="text-brand-500" />
              <span>Activate Guest AR Prepayment Wallet</span>
            </h2>
            
            {(() => {
              const matchedGuest = walletForm.guest_id ? walletGuests.find(g => g.id === walletForm.guest_id) : null;
              const isSelectedGuestActive = matchedGuest && (matchedGuest.wallet_balance !== null && matchedGuest.wallet_balance !== undefined);
              return (
                <form onSubmit={handleActivateGuestWallet} className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-200 mb-1.5 font-medium">Search Guest Profile</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                        <input 
                          type="text"
                          placeholder="Type guest name, email, or phone number..."
                          value={walletSearchQuery}
                          onChange={e => setWalletSearchQuery(e.target.value)}
                          className="w-full bg-dark-900 border border-dark-700 pl-10 pr-4 py-2.5 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-semibold"
                        />
                        {walletSearchQuery && (
                          <button 
                            type="button" 
                            onClick={() => setWalletSearchQuery('')} 
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-450 hover:text-white text-xs font-bold"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-200 mb-1.5 font-medium">Select CRM Registered Guest *</label>
                      <select 
                        required
                        value={walletForm.guest_id}
                        onChange={e => setWalletForm({...walletForm, guest_id: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-semibold"
                      >
                        <option value="" className="bg-dark-900 text-white">-- Select Guest ({filteredWalletGuests.length} found) --</option>
                        {filteredWalletGuests.map(g => {
                          const isActive = g.wallet_balance !== null && g.wallet_balance !== undefined;
                          return (
                            <option key={g.id} value={g.id} className="bg-dark-900 text-white">
                              {`${g.first_name || ''} ${g.last_name || ''}`.trim() || g.guest_name || 'Unnamed Guest'} ({g.email || 'No email'}) {isActive ? "💼 [ACTIVE]" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {walletForm.guest_id && (
                    isSelectedGuestActive ? (
                      <div className="bg-dark-900 p-5 rounded-2xl border border-dark-700 flex flex-col gap-4 mt-2">
                        <div className="flex items-center justify-between border-b border-dark-750 pb-3">
                          <div className="flex items-center gap-3">
                            <Wallet className="text-brand-500" size={24} />
                            <span className="text-xs text-gray-200 font-bold uppercase tracking-wider">AR Prepayment Wallet</span>
                          </div>
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-wide">
                            Prepayment Wallet Active
                          </span>
                        </div>
                        
                        <div className="text-center py-2 bg-dark-950/50 rounded-xl border border-dark-800">
                          <p className="text-xs text-gray-300">Current Wallet Balance</p>
                          <h3 className="text-3xl font-extrabold text-white mt-1">₦{Number(matchedGuest.wallet_balance || 0).toLocaleString()}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAddFundsAmount('');
                              setAddFundsRef('');
                              setAddFundsMethod('cash');
                              setIsAddFundsOpen(true);
                            }}
                            className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 text-center flex items-center justify-center gap-1.5"
                          >
                            <Plus size={14} />
                            Add Funds
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivateGuestWallet(matchedGuest.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 py-2.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
                          >
                            <X size={14} />
                            Deactivate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs text-gray-200 mb-1.5 font-medium">Initial Prepayment Balance (NGN)</label>
                          <input 
                            type="number" 
                            min="0"
                            value={walletForm.initial_balance}
                            onChange={e => setWalletForm({...walletForm, initial_balance: e.target.value})}
                            placeholder="e.g. 50000 (Optional)"
                            className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                          />
                          <span className="text-[10px] text-gray-300 mt-1 block">If initial balance &gt; 0, an initial Cash prepayment deposit inflow will be automatically registered.</span>
                        </div>

                        <div className="flex gap-3 justify-end pt-2 border-t border-dark-700/50">
                          <button 
                            type="button"
                            onClick={() => setIsActivateWalletOpen(false)}
                            className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-4 text-xs rounded-xl transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            disabled={isActivatingWallet}
                            className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold py-2.5 px-5 text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                          >
                            {isActivatingWallet ? "Activating..." : "Activate Wallet"}
                          </button>
                        </div>
                      </>
                    )
                  )}
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {isAddFundsOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md relative rounded-xl animate-in zoom-in-95 flex flex-col shadow-2xl">
            <button onClick={() => setIsAddFundsOpen(false)} className="absolute top-4 right-4 text-gray-450 hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Wallet className="text-brand-500" />
              <span>Add Prepayment Funds</span>
            </h2>
            <p className="text-xs text-gray-200 mb-6 uppercase tracking-wider font-bold">
              Guest: {(() => {
                const matched = walletGuests.find(g => g.id === walletForm.guest_id);
                return matched ? `${matched.first_name || ''} ${matched.last_name || ''}`.trim() : 'N/A';
              })()}
            </p>
            
            <form onSubmit={handleAddFunds} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Payment Amount (₦) *</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  value={addFundsAmount}
                  onChange={e => setAddFundsAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Payment Method *</label>
                <select 
                  required
                  value={addFundsMethod}
                  onChange={e => setAddFundsMethod(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-semibold"
                >
                  <option value="cash" className="bg-dark-900">Cash Payment</option>
                  <option value="pos" className="bg-dark-900">POS Terminal</option>
                  <option value="bank_transfer" className="bg-dark-900">Bank Transfer / Electronic Credit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Reference Number (Optional)</label>
                <input 
                  type="text" 
                  value={addFundsRef}
                  onChange={e => setAddFundsRef(e.target.value)}
                  placeholder="e.g. TXN-91827364"
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-dark-700/50">
                <button 
                  type="button"
                  onClick={() => setIsAddFundsOpen(false)}
                  className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-4 text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isProcessingAddFunds || !addFundsAmount}
                  className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-dark-900 font-bold py-2.5 px-5 text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  {isProcessingAddFunds ? "Processing..." : "Confirm & Add Funds"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Corporate Group Modal */}
      {isAddGroupOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-lg relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => setIsAddGroupOpen(false)} className="absolute top-4 right-4 text-gray-300 hover:text-white"><X size={24}/></button>
            <h2 className="text-xl font-bold text-white mb-6">Create Corporate / Group Account</h2>
            <form onSubmit={handleAddGroupAccount} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-200 mb-1">Company / Group Name *</label>
                <input required type="text" value={newGroupForm.name} onChange={e => setNewGroupForm({...newGroupForm, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" placeholder="e.g. Chevron Nigeria Ltd" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Group Type</label>
                  <select value={newGroupForm.group_type} onChange={e => setNewGroupForm({...newGroupForm, group_type: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500">
                    <option value="Company">Company</option>
                    <option value="Government Agency">Government Agency</option>
                    <option value="Church">Church</option>
                    <option value="Group">Group</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-1">Credit Limit (₦) *</label>
                  <input required type="number" value={newGroupForm.credit_limit} onChange={e => setNewGroupForm({...newGroupForm, credit_limit: parseFloat(e.target.value) || 0})} className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded text-white outline-none focus:border-brand-500" />
                </div>
              </div>
              <div className="border-t border-dark-700/50 pt-4 mt-2">
                <p className="text-xs font-bold text-white uppercase tracking-wider mb-3">Primary Contact Representative</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-300 mb-1">Full Name</label>
                    <input type="text" value={newGroupForm.contact_name} onChange={e => setNewGroupForm({...newGroupForm, contact_name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="e.g. Grace Udemba" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Email Address</label>
                      <input type="email" value={newGroupForm.contact_email} onChange={e => setNewGroupForm({...newGroupForm, contact_email: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="grace@company.com" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Phone Number</label>
                      <input type="text" value={newGroupForm.contact_phone} onChange={e => setNewGroupForm({...newGroupForm, contact_phone: e.target.value})} className="w-full bg-dark-900 border border-dark-700 p-2 rounded text-white outline-none focus:border-brand-500 text-sm" placeholder="+234..." />
                    </div>
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full btn-primary py-3 mt-4">Save Group Account</button>
            </form>
          </div>
        </div>
      )}

      {/* --- Store Requisition Modal --- */}
      <StoreRequisitionModal 
        isOpen={isRequisitionOpen} 
        onClose={() => setIsRequisitionOpen(false)} 
        department="front office"
      />

      {/* --- MODAL: CLOSE OF DAY --- */}
      {isCloseOfDayModalOpen && closeOfDayReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-dark-800 rounded-3xl border border-dark-700 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 my-8 text-white">
            <div className="flex justify-between items-center p-6 border-b border-dark-700 bg-dark-900 rounded-t-3xl">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Clock className="text-amber-500" size={20} />
                Front Office - Close of Day Verification
              </h2>
              <button 
                onClick={() => setIsCloseOfDayModalOpen(false)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-dark-900/50 p-5 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-200 block mb-1">Consolidated Booking Revenue</span>
                  <span className="text-3xl font-black text-white">₦{closeOfDayReport.total_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-300 block mt-1">{closeOfDayReport.total_count} reservation payments today</span>
                </div>
                <div className="bg-dark-900/50 p-5 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-200 block mb-1">Business Date</span>
                  <span className="text-3xl font-black text-brand-500">{closeOfDayReport.business_date}</span>
                  <span className="text-[10px] text-gray-300 block mt-1">Front Desk ledger status: pending closure</span>
                </div>
              </div>

              {/* Transactions list */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-2 border-b border-dark-700 pb-2">
                  <FileText size={14} />
                  Booking & Stay Payment Receipts
                </h3>
                {closeOfDayReport.txns.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">No Front Desk booking payments recorded today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-dark-750 text-gray-200 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Reference</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750">
                        {closeOfDayReport.txns.map((t, idx) => (
                          <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                            <td className="py-2.5 px-3 font-mono text-gray-300">{t.time}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{t.ref}</td>
                            <td className="py-2.5 px-3">{t.description}</td>
                            <td className="py-2.5 px-3">
                              <span className="bg-dark-900 text-[10px] font-bold px-2 py-0.5 rounded border border-dark-700 uppercase">
                                {t.method?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">₦{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-dark-700 bg-dark-900 flex justify-end gap-3 rounded-b-3xl">
              <button 
                type="button"
                onClick={() => setIsCloseOfDayModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-200 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmCloseOfDayFrontDesk}
                className="bg-amber-500 hover:bg-amber-600 text-dark-950 font-black text-xs py-2.5 px-6 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Confirm Close of Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFrontDesk;

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  Car, Flower2, Droplets, Plus, Clock, User, ShieldCheck, 
  DollarSign, Calendar, Search, RefreshCw, AlertCircle, 
  Check, ArrowRight, UserCheck, X, ClipboardList, BookOpen, Compass,
  Utensils
} from 'lucide-react';

const ServicesPortal = () => {
  const { profile, hasAccess } = useAuth();
  
  // Tab control: 'transport', 'spa', 'pool', 'register', 'close_day'
  const [activeTab, setActiveTab] = useState('transport');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [departmentalClosures, setDepartmentalClosures] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / assignment states
  const [assigningRequest, setAssigningRequest] = useState(null); // request object
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [assignedStaffName, setAssignedStaffName] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Walk-in Register form states
  const [registerForm, setRegisterForm] = useState({
    serviceId: '',
    guestType: 'folio', // 'folio' (in-house) or 'walkin' (direct)
    bookingId: '',
    customerName: '',
    quantity: 1,
    customPrice: '',
    paymentMethod: 'cash',
    notes: ''
  });
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

  // Close of day states
  const [isCloseOfDayModalOpen, setIsCloseOfDayModalOpen] = useState(false);
  const [closeOfDayReport, setCloseOfDayReport] = useState(null);
  const [isCompilingCloseOfDay, setIsCompilingCloseOfDay] = useState(false);
  const [targetClosureDept, setTargetClosureDept] = useState('transportation'); // 'transportation', 'spa', 'pool'

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Real-time synchronization
  useRealtimeSync(['booking_services', 'payments', 'system_settings', 'profiles'], () => {
    fetchPortalData();
  });

  useEffect(() => {
    fetchPortalData();
  }, []);

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      // 1. Fetch booking services requests
      const { data: reqData, error: reqErr } = await supabase
        .from('booking_services')
        .select(`
          *,
          bookings (
            id,
            booking_reference,
            guest_name,
            guest_email,
            status,
            bill_to_group,
            group_account_id,
            rooms (room_number)
          ),
          services (
            id,
            name,
            category,
            base_price_ngn,
            icon_name,
            internal_notes
          )
        `)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      
      if (reqErr) throw reqErr;
      setRequests(reqData || []);

      // 2. Fetch active services (all transport & wellness categories)
      const { data: srvData, error: srvErr } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true);
      
      if (srvErr) throw srvErr;
      setServices(srvData || []);

      // 3. Fetch staff profiles for assignments (excluding guests)
      const { data: staffData, error: staffErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .neq('role', 'guest')
        .order('first_name');
      
      if (staffErr) throw staffErr;
      setStaff(staffData || []);

      // 4. Fetch checked-in guest bookings for folio linkages
      const { data: checkInBookings, error: bookErr } = await supabase
        .from('bookings')
        .select('*, rooms(room_number)')
        .eq('status', 'checked_in')
        .order('guest_name');
      
      if (bookErr) throw bookErr;
      setActiveBookings(checkInBookings || []);

      // 5. Fetch departmental closures
      const { data: closuresData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'departmental_closures')
        .maybeSingle();
      
      if (closuresData && closuresData.setting_value) {
        setDepartmentalClosures(
          typeof closuresData.setting_value === 'string' 
            ? JSON.parse(closuresData.setting_value) 
            : closuresData.setting_value
        );
      }
    } catch (err) {
      console.error('Failed to load portal data:', err);
      toast.error('Failed to retrieve services registries');
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse notes for assignments (e.g. "driver_assigned: John" or "therapist_assigned: Alice")
  const parseAssignment = (notesStr, type) => {
    if (!notesStr) return '';
    const prefix = type === 'driver' ? 'driver_assigned:' : 'therapist_assigned:';
    const parts = notesStr.split('|');
    const match = parts.find(p => p.trim().startsWith(prefix));
    if (match) {
      return match.replace(prefix, '').trim();
    }
    return '';
  };

  // Helper to parse raw guest notes, removing assignment info
  const parseNotes = (notesStr) => {
    if (!notesStr) return '';
    const parts = notesStr.split('|');
    // First part is usually the original description/guest instruction
    return parts[0].replace(/^(restaurant_order|laundry_request|dashboard_request):\s*/, '').trim();
  };

  // Status transitions
  const handleUpdateStatus = async (requestId, nextStatus) => {
    const loadingToast = toast.loading(`Updating status to ${nextStatus}...`);
    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ status: nextStatus })
        .eq('id', requestId);

      if (error) throw error;
      toast.success(`Service request status updated to ${nextStatus}!`, { id: loadingToast });
      fetchPortalData();
    } catch (err) {
      toast.error('Failed to update request status', { id: loadingToast });
    }
  };

  // Open assignment modal (for driver or therapist)
  const openAssignModal = (request) => {
    setAssigningRequest(request);
    const existingAssign = parseAssignment(request.notes, activeTab === 'transport' ? 'driver' : 'therapist');
    setAssignedStaffName(existingAssign);
    // Find staff id matching name if possible
    const match = staff.find(s => `${s.first_name} ${s.last_name}`.trim() === existingAssign);
    setAssignedStaffId(match ? match.id : '');
    setIsAssignModalOpen(true);
  };

  // Submit assignment
  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!assigningRequest) return;

    let finalStaffName = assignedStaffName.trim();
    if (assignedStaffId) {
      const match = staff.find(s => s.id === assignedStaffId);
      if (match) finalStaffName = `${match.first_name} ${match.last_name}`.trim();
    }

    if (!finalStaffName) {
      return toast.error('Please select or input an assignee name.');
    }

    const typePrefix = activeTab === 'transport' ? 'driver_assigned:' : 'therapist_assigned:';
    
    // Clean existing assignment info from notes and append new one
    const cleanNotes = parseNotes(assigningRequest.notes);
    const updatedNotes = `${cleanNotes} | ${typePrefix} ${finalStaffName}`;

    const loadingToast = toast.loading('Saving assignment...');
    try {
      // Assign staff changes status to 'scheduled' if it was 'confirmed'
      const nextStatus = assigningRequest.status === 'confirmed' ? 'scheduled' : assigningRequest.status;

      const { error } = await supabase
        .from('booking_services')
        .update({ 
          notes: updatedNotes,
          status: nextStatus
        })
        .eq('id', assigningRequest.id);

      if (error) throw error;

      toast.success('Assignment saved successfully!', { id: loadingToast });
      setIsAssignModalOpen(false);
      fetchPortalData();
    } catch (err) {
      toast.error('Failed to save assignment', { id: loadingToast });
    }
  };

  // Submit walk-in / direct register
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerForm.serviceId) return toast.error('Please select a service.');
    
    const service = services.find(s => s.id === registerForm.serviceId);
    if (!service) return toast.error('Selected service is invalid.');

    const unitPrice = registerForm.customPrice !== '' ? Number(registerForm.customPrice) : Number(service.base_price_ngn);
    const totalAmount = unitPrice * Number(registerForm.quantity);

    if (totalAmount <= 0) return toast.error('Please enter a valid amount.');

    setIsSubmittingRegister(true);
    const toastId = toast.loading('Registering transaction...');

    try {
      if (registerForm.guestType === 'folio') {
        // Post to room folio (creates a booking_services record marked completed but payment unpaid)
        if (!registerForm.bookingId) throw new Error('Please select an in-house room check-in.');

        const selectedBooking = activeBookings.find(b => b.id === registerForm.bookingId);

        const payload = {
          booking_id: registerForm.bookingId,
          service_id: registerForm.serviceId,
          quantity: Number(registerForm.quantity),
          unit_price_ngn: unitPrice,
          total_price_ngn: totalAmount,
          status: 'completed',
          payment_status: 'unpaid',
          notes: `walkin_post: Posted to Room ${selectedBooking?.rooms?.room_number || 'N/A'} Folio. Notes: ${registerForm.notes || 'None'}`
        };

        const { error } = await supabase.from('booking_services').insert([payload]);
        if (error) throw error;

        // Log audit
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Charged service ${service.name} (₦${totalAmount.toLocaleString()}) to Room ${selectedBooking?.rooms?.room_number} Folio`,
          module: 'Accounting'
        });

        toast.success(`✓ Service charged successfully to Room ${selectedBooking?.rooms?.room_number} Folio!`, { id: toastId });
      } else {
        // Direct cash/card/transfer checkout (inserts directly into payments table)
        if (!registerForm.customerName.trim()) throw new Error('Please enter customer/walk-in name.');

        const refPrefix = activeTab === 'transport' ? 'TRN-POS-' : activeTab === 'spa' ? 'SPA-POS-' : activeTab === 'pool' ? 'POL-POS-' : 'SRV-POS-';
        const transactionRef = `${refPrefix}${Date.now()}`;

        const payload = {
          amount: totalAmount,
          currency: 'NGN',
          method: registerForm.paymentMethod,
          transaction_ref: transactionRef,
          status: 'completed',
          notes: `Walk-in register sale: ${service.name} (x${registerForm.quantity}) for customer: ${registerForm.customerName.trim()}. Staff notes: ${registerForm.notes || 'None'}`
        };

        const { error } = await supabase.from('payments').insert([payload]);
        if (error) throw error;

        // Log audit
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Registered direct walk-in sale for ${service.name} (₦${totalAmount.toLocaleString()}) via ${registerForm.paymentMethod.toUpperCase()}`,
          module: 'Accounting'
        });

        toast.success(`✓ Walk-in sale registered successfully! Transaction Reference: ${transactionRef}`, { id: toastId });
      }

      // Reset form
      setRegisterForm({
        serviceId: '',
        guestType: 'folio',
        bookingId: '',
        customerName: '',
        quantity: 1,
        customPrice: '',
        paymentMethod: 'cash',
        notes: ''
      });
      fetchPortalData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to complete transaction registration', { id: toastId });
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  // Compile close of day
  const handleCompileCloseOfDay = async (dept) => {
    setTargetClosureDept(dept);
    setIsCompilingCloseOfDay(true);
    const toastId = toast.loading(`Compiling today's ${dept.toUpperCase()} ledger...`);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // 1. Fetch payments
      const { data: payments, error: payErr } = await supabase.from('payments').select('*');
      if (payErr) throw payErr;

      // 2. Fetch completed booking services
      const { data: bs, error: bsErr } = await supabase
        .from('booking_services')
        .select('*, bookings(rooms(room_number), guest_name, booking_reference), services(name, category)')
        .eq('status', 'completed');
      if (bsErr) throw bsErr;

      // Filter walk-in POS payments matching department prefix
      const walkinTxns = (payments || []).filter(p => {
        const dStr = format(new Date(p.processed_at || p.created_at), 'yyyy-MM-dd');
        if (dStr !== todayStr) return false;
        
        if (dept === 'transportation') {
          return p.transaction_ref?.startsWith('TRN-POS-');
        } else if (dept === 'spa') {
          return p.transaction_ref?.startsWith('SPA-POS-');
        } else if (dept === 'pool') {
          return p.transaction_ref?.startsWith('POL-POS-');
        }
        return false;
      }).map(p => ({
        time: format(new Date(p.processed_at || p.created_at), 'HH:mm'),
        ref: p.transaction_ref,
        description: p.notes || 'Walk-in Direct Sale',
        amount: Number(p.amount),
        method: p.method
      }));

      // Filter in-house charges
      const inhouseTxns = (bs || []).filter(item => {
        const dStr = format(new Date(item.updated_at || item.created_at), 'yyyy-MM-dd');
        if (dStr !== todayStr) return false;
        
        const cat = item.services?.category?.toLowerCase() || '';
        const name = item.services?.name?.toLowerCase() || '';
        
        if (dept === 'transportation') {
          return cat === 'transportation' || name.includes('pickup') || name.includes('shuttle');
        } else if (dept === 'spa') {
          return cat === 'wellness' && (name.includes('spa') || name.includes('massage'));
        } else if (dept === 'pool') {
          return cat === 'wellness' && name.includes('pool');
        }
        return false;
      }).map(i => ({
        time: format(new Date(i.updated_at), 'HH:mm'),
        ref: i.bookings?.booking_reference || 'IN-HOUSE',
        description: `Room ${i.bookings?.rooms?.room_number || 'N/A'} Folio Charge - ${i.services?.name || 'Enhancement'} (x${i.quantity || 1})`,
        amount: Number(i.total_price_ngn || 0),
        method: i.payment_status === 'paid' ? 'corporate_billed' : 'room_charge'
      }));

      const allTxns = [...walkinTxns, ...inhouseTxns];
      const totalRev = allTxns.reduce((sum, t) => sum + t.amount, 0);

      setCloseOfDayReport({
        department: dept,
        business_date: todayStr,
        walkin_txns: walkinTxns,
        inhouse_txns: inhouseTxns,
        total_walkin_revenue: walkinTxns.reduce((sum, t) => sum + t.amount, 0),
        total_inhouse_revenue: inhouseTxns.reduce((sum, t) => sum + t.amount, 0),
        total_revenue: totalRev,
        total_count: allTxns.length
      });

      toast.dismiss(toastId);
      setIsCloseOfDayModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to compile ${dept} reports: ` + err.message, { id: toastId });
    } finally {
      setIsCompilingCloseOfDay(false);
    }
  };

  // Confirm close of day
  const handleConfirmCloseOfDay = async () => {
    if (!closeOfDayReport) return;
    const toastId = toast.loading("Saving daily ledger closure report...");
    try {
      const todayStr = closeOfDayReport.business_date;
      const dept = closeOfDayReport.department;

      const closureRecord = {
        department: dept,
        business_date: todayStr,
        staff_id: profile?.id || 'unknown',
        staff_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        revenue: closeOfDayReport.total_revenue,
        transactions_count: closeOfDayReport.total_count,
        closed_at: new Date().toISOString()
      };

      // Load existing closures
      let currentClosures = [];
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'departmental_closures').maybeSingle();
        if (data && data.setting_value) {
          currentClosures = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        }
      } catch {}

      // Avoid duplicates for same department & date
      const updatedClosures = [...currentClosures.filter(c => !(c.department === dept && c.business_date === todayStr)), closureRecord];

      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_closures',
        setting_value: updatedClosures
      }, { onConflict: 'setting_key' });

      // Save detailed reports
      const reportRecord = {
        id: `dept_close_${dept}_${todayStr}`,
        department: dept,
        business_date: todayStr,
        staff_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        closed_at: new Date().toISOString(),
        total_revenue: closeOfDayReport.total_revenue,
        transactions_count: closeOfDayReport.total_count,
        details: {
          walkin_revenue: closeOfDayReport.total_walkin_revenue,
          inhouse_revenue: closeOfDayReport.total_inhouse_revenue
        },
        transactions: [
          ...closeOfDayReport.walkin_txns.map(t => ({ ...t, type: 'Walk-in Sale' })),
          ...closeOfDayReport.inhouse_txns.map(t => ({ ...t, type: 'In-house Folio Charge' }))
        ]
      };

      // Load existing close reports
      let currentReports = [];
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'departmental_close_reports').maybeSingle();
        if (data && data.setting_value) {
          currentReports = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        }
      } catch {}

      const updatedReports = [reportRecord, ...currentReports.filter(r => !(r.department === dept && r.business_date === todayStr))];

      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_close_reports',
        setting_value: updatedReports
      }, { onConflict: 'setting_key' });

      await supabase.from('system_logs').insert({
        user_id: profile?.id,
        log_type: 'activity',
        action: `Closed departmental ledger for ${dept.toUpperCase()} on date ${todayStr}. Revenue: ₦${closeOfDayReport.total_revenue.toLocaleString()}`,
        module: 'Accounting'
      });

      toast.success(`✓ ${dept.toUpperCase()} close of day completed successfully!`, { id: toastId });
      setIsCloseOfDayModalOpen(false);
      setDepartmentalClosures(updatedClosures);
      fetchPortalData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to complete ledger close: " + err.message, { id: toastId });
    }
  };

  // Filter requests based on query and current tab
  const filteredRequests = requests.filter(req => {
    // Only show requests for checked-in guests, unless it's transportation/pickup
    if (req.bookings?.status !== 'checked_in' && activeTab !== 'transport') return false;

    const serviceName = req.services?.name || '';
    const serviceCat = req.services?.category || '';
    const internalNotes = req.services?.internal_notes?.toLowerCase().trim() || '';
    
    // Tab filters
    if (activeTab === 'transport') {
      if (serviceCat.toLowerCase() !== 'transportation' && !serviceName.toLowerCase().includes('pickup')) return false;
    } else if (activeTab === 'spa') {
      if (serviceCat.toLowerCase() !== 'wellness' || (!serviceName.toLowerCase().includes('spa') && !serviceName.toLowerCase().includes('massage'))) return false;
    } else if (activeTab === 'pool') {
      if (!serviceName.toLowerCase().includes('pool')) return false;
    } else if (activeTab === 'restaurant') {
      if (internalNotes !== 'restaurant') return false;
    } else {
      return false; // Other tabs don't show request list directly
    }

    // Search query filter
    const query = searchQuery.toLowerCase();
    const guestName = req.bookings?.guest_name || '';
    const roomNum = req.bookings?.rooms?.room_number || '';
    return guestName.toLowerCase().includes(query) || 
           roomNum.toLowerCase().includes(query) || 
           serviceName.toLowerCase().includes(query);
  });

  // Check if a department is closed today
  const isDeptClosed = (dept) => {
    return departmentalClosures.some(c => c.department === dept && c.business_date === todayStr);
  };

  // Render stats cards
  const activePickupCount = requests.filter(r => (r.services?.category?.toLowerCase() === 'transportation' || r.services?.name?.toLowerCase().includes('pickup')) && ['confirmed', 'scheduled', 'in_progress'].includes(r.status)).length;
  const activeSpaCount = requests.filter(r => r.bookings?.status === 'checked_in' && r.services?.category?.toLowerCase() === 'wellness' && (r.services?.name?.toLowerCase().includes('spa') || r.services?.name?.toLowerCase().includes('massage')) && ['confirmed', 'scheduled', 'in_progress'].includes(r.status)).length;
  const activePoolCount = requests.filter(r => r.bookings?.status === 'checked_in' && r.services?.name?.toLowerCase().includes('pool') && ['confirmed', 'scheduled', 'in_progress'].includes(r.status)).length;
  const activeRestaurantCount = requests.filter(r => r.bookings?.status === 'checked_in' && r.services?.internal_notes?.toLowerCase().trim() === 'restaurant' && ['confirmed', 'scheduled', 'in_progress'].includes(r.status)).length;

  return (
    <div className="min-h-screen pb-12 text-white">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-black tracking-tight flex items-center gap-3">
            <Compass className="text-gold-500 w-8 h-8" />
            Unified Services Portals
          </h1>
          <p className="text-gray-400 text-sm mt-1">Operational dispatch queues, walk-in registers, and close of day modules for hotel amenities.</p>
        </div>
        
        {/* Quick actions info */}
        <div className="bg-dark-800 border border-dark-700/80 rounded-2xl px-5 py-3 text-xs text-gray-400 flex items-center gap-3 w-fit shadow-md">
          <ShieldCheck className="text-gold-500 w-5 h-5" />
          <div>
            <span className="block font-bold text-gray-200">Terminal Authorization</span>
            <span className="block text-[10px] text-gray-500 font-medium uppercase">Role: {profile?.role?.replace(/_/g, ' ') || 'Staff'}</span>
          </div>
        </div>
      </div>

      {/* Stats Counter Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-dark-800 border border-dark-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-all">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center">
            <Car size={24} />
          </div>
          <div>
            <span className="block text-[10px] text-gray-450 uppercase tracking-widest font-black">Active Pickups</span>
            <span className="block text-2xl font-black text-white mt-0.5">{activePickupCount}</span>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-all">
          <div className="w-12 h-12 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-xl flex items-center justify-center">
            <Flower2 size={24} />
          </div>
          <div>
            <span className="block text-[10px] text-gray-450 uppercase tracking-widest font-black">Spa Tickets</span>
            <span className="block text-2xl font-black text-white mt-0.5">{activeSpaCount}</span>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-all">
          <div className="w-12 h-12 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl flex items-center justify-center">
            <Droplets size={24} />
          </div>
          <div>
            <span className="block text-[10px] text-gray-450 uppercase tracking-widest font-black">Pool Guests</span>
            <span className="block text-2xl font-black text-white mt-0.5">{activePoolCount}</span>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:scale-[1.01] transition-all">
          <div className="w-12 h-12 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Utensils size={24} />
          </div>
          <div>
            <span className="block text-[10px] text-gray-450 uppercase tracking-widest font-black">Restaurant</span>
            <span className="block text-2xl font-black text-white mt-0.5">{activeRestaurantCount}</span>
          </div>
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Navigation Sidebar Pane (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-dark-800 border border-dark-700 p-4 rounded-3xl space-y-2.5 shadow-xl select-none">
            <span className="block text-[10px] text-gray-500 font-black uppercase tracking-wider px-3 mb-2">Department Portals</span>
            
            <button
              onClick={() => { setActiveTab('transport'); setSearchQuery(''); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold border transition-all ${
                activeTab === 'transport' 
                  ? 'bg-gradient-to-tr from-brand-900/40 to-brand-850/20 border-brand-500/80 text-white shadow shadow-brand-500/10' 
                  : 'border-transparent text-gray-450 hover:text-white hover:bg-dark-750/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Car size={16} className={activeTab === 'transport' ? 'text-brand-400' : 'text-gray-500'} />
                <span>Airport Shuttle</span>
              </div>
              {isDeptClosed('transportation') && <span className="text-[9px] bg-red-500/15 border border-red-500/20 text-red-400 px-1.5 py-0.2 rounded font-black">CLOSED</span>}
            </button>

            <button
              onClick={() => { setActiveTab('spa'); setSearchQuery(''); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold border transition-all ${
                activeTab === 'spa' 
                  ? 'bg-gradient-to-tr from-brand-900/40 to-brand-850/20 border-brand-500/80 text-white shadow shadow-brand-500/10' 
                  : 'border-transparent text-gray-450 hover:text-white hover:bg-dark-750/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Flower2 size={16} className={activeTab === 'spa' ? 'text-brand-400' : 'text-gray-500'} />
                <span>Spa & Massage</span>
              </div>
              {isDeptClosed('spa') && <span className="text-[9px] bg-red-500/15 border border-red-500/20 text-red-400 px-1.5 py-0.2 rounded font-black">CLOSED</span>}
            </button>

            <button
              onClick={() => { setActiveTab('pool'); setSearchQuery(''); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold border transition-all ${
                activeTab === 'pool' 
                  ? 'bg-gradient-to-tr from-brand-900/40 to-brand-850/20 border-brand-500/80 text-white shadow shadow-brand-500/10' 
                  : 'border-transparent text-gray-450 hover:text-white hover:bg-dark-750/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Droplets size={16} className={activeTab === 'pool' ? 'text-brand-400' : 'text-gray-500'} />
                <span>Swimming Pool</span>
              </div>
              {isDeptClosed('pool') && <span className="text-[9px] bg-red-500/15 border border-red-500/20 text-red-400 px-1.5 py-0.2 rounded font-black">CLOSED</span>}
            </button>

            <button
              onClick={() => { setActiveTab('restaurant'); setSearchQuery(''); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold border transition-all ${
                activeTab === 'restaurant' 
                  ? 'bg-gradient-to-tr from-brand-900/40 to-brand-850/20 border-brand-500/80 text-white shadow shadow-brand-500/10' 
                  : 'border-transparent text-gray-450 hover:text-white hover:bg-dark-750/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Utensils size={16} className={activeTab === 'restaurant' ? 'text-brand-400' : 'text-gray-500'} />
                <span>Restaurant Orders</span>
              </div>
              {isDeptClosed('restaurant') && <span className="text-[9px] bg-red-500/15 border border-red-500/20 text-red-400 px-1.5 py-0.2 rounded font-black">CLOSED</span>}
            </button>

            <span className="block text-[10px] text-gray-500 font-black uppercase tracking-wider px-3 mt-4 mb-2">Register & Closeout</span>

            <button
              onClick={() => { setActiveTab('register'); setSearchQuery(''); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold border transition-all ${
                activeTab === 'register' 
                  ? 'bg-gradient-to-tr from-brand-900/40 to-brand-850/20 border-brand-500/80 text-white shadow shadow-brand-500/10' 
                  : 'border-transparent text-gray-450 hover:text-white hover:bg-dark-750/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Plus size={16} className={activeTab === 'register' ? 'text-brand-400' : 'text-gray-500'} />
                <span>Walk-in POS Register</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('close_day'); setSearchQuery(''); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold border transition-all ${
                activeTab === 'close_day' 
                  ? 'bg-gradient-to-tr from-brand-900/40 to-brand-850/20 border-brand-500/80 text-white shadow shadow-brand-500/10' 
                  : 'border-transparent text-gray-450 hover:text-white hover:bg-dark-750/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock size={16} className={activeTab === 'close_day' ? 'text-brand-400' : 'text-gray-500'} />
                <span>Ledger Close of Day</span>
              </div>
            </button>
          </div>

          <div className="bg-dark-900 border border-dark-750 p-4 rounded-3xl text-[11px] text-gray-400 space-y-2 leading-relaxed shadow-lg">
            <h4 className="font-extrabold text-gray-300 uppercase text-[9px] tracking-wider flex items-center gap-1.5"><ShieldCheck size={12} className="text-gold-500" /> Operational Guide</h4>
            <p>1. Confirm requested services post guest check-in.</p>
            <p>2. Assign drivers or therapists to set schedule.</p>
            <p>3. Direct POS sales post instantly to Accounting logs.</p>
          </div>
        </div>

        {/* Content Pane (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Active List Headers (Search + count for lists) */}
          {['transport', 'spa', 'pool', 'restaurant'].includes(activeTab) && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-dark-700/60 pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {activeTab === 'transport' ? 'Airport Pickup & Logistics' : activeTab === 'spa' ? 'Spa & Relaxation Services' : activeTab === 'pool' ? 'Poolside Access Logs' : 'Restaurant Orders'}
                </h2>
                <p className="text-gray-400 text-xs mt-0.5">Manage live booking request items and confirm, schedule, or close logs.</p>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2 text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search guests, rooms, etc..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700/70 rounded-xl pl-9 pr-4 py-1.5 text-xs outline-none focus:border-brand-500 transition-all text-white"
                />
              </div>
            </div>
          )}

          {/* LOADING STATE */}
          {loading && ['transport', 'spa', 'pool'].includes(activeTab) ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500 mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Loading registry logs...</p>
            </div>
          ) : (
            <>
              {activeTab === 'transport' && (
                filteredRequests.length === 0 ? (
                  <div className="glass-panel p-16 text-center rounded-3xl border border-dark-700/50">
                    <Car className="mx-auto mb-3 opacity-25 text-gray-400 animate-pulse" size={44} />
                    <h3 className="text-lg font-bold text-white mb-1">No Shuttle Requests</h3>
                    <p className="text-gray-500 text-xs">Airport pickup reservations from checked-in stay logs will appear here.</p>
                  </div>
                ) : (
                  <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden shadow-md">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-dark-900 border-b border-dark-700 text-xs text-gray-400 font-bold uppercase">
                          <th className="p-4">Guest</th>
                          <th className="p-4">Room #</th>
                          <th className="p-4">Service</th>
                          <th className="p-4">Schedule</th>
                          <th className="p-4">Driver</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {filteredRequests.map(req => {
                          const driver = parseAssignment(req.notes, 'driver');
                          const noteText = parseNotes(req.notes);
                          const isClosed = isDeptClosed('transportation');
                          return (
                            <tr key={req.id} className="hover:bg-dark-750/30 transition-colors">
                              <td className="p-4">
                                <p className="font-bold text-white">{req.bookings?.guest_name}</p>
                                {noteText && <p className="text-[10px] text-gray-500 mt-0.5 italic max-w-[160px] truncate" title={noteText}>{noteText}</p>}
                              </td>
                              <td className="p-4 font-mono text-gray-300">{req.bookings?.rooms?.room_number || 'N/A'}</td>
                              <td className="p-4 font-medium text-white">{req.services?.name}</td>
                              <td className="p-4 text-xs text-gray-400">
                                <span className="block">{req.scheduled_date || 'TBD'}</span>
                                <span className="font-semibold text-white">{req.scheduled_time || 'TBD'}</span>
                              </td>
                              <td className="p-4">
                                <span className="text-xs font-extrabold text-brand-400">{driver || <span className="text-gray-600 italic font-normal">Unassigned</span>}</span>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                  req.status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                  req.status === 'confirmed' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                                  req.status === 'scheduled' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                  req.status === 'in_progress' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' :
                                  'bg-green-500/10 border-green-500/20 text-green-400'
                                }`}>{req.status}</span>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex gap-2 justify-end flex-wrap">
                                  <button
                                    onClick={() => openAssignModal(req)}
                                    disabled={isClosed}
                                    className="px-3 py-1 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                  >
                                    {driver ? 'Change Driver' : 'Assign Driver'}
                                  </button>
                                  {req.status === 'scheduled' && (
                                    <button
                                      onClick={() => handleUpdateStatus(req.id, 'in_progress')}
                                      disabled={isClosed}
                                      className="px-3 py-1 bg-teal-500 hover:bg-teal-600 text-dark-950 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                    >
                                      Start Transit
                                    </button>
                                  )}
                                  {req.status === 'in_progress' && (
                                    <button
                                      onClick={() => handleUpdateStatus(req.id, 'completed')}
                                      disabled={isClosed}
                                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-dark-950 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                    >
                                      Arrived/Complete
                                    </button>
                                  )}
                                  {req.status === 'pending' && (
                                    <button
                                      onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                                      disabled={isClosed}
                                      className="px-3 py-1 bg-brand-500 hover:bg-brand-600 text-dark-950 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                    >
                                      Confirm
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* SPA & MASSAGE */}
              {activeTab === 'spa' && (
                filteredRequests.length === 0 ? (
                  <div className="glass-panel p-16 text-center rounded-3xl border border-dark-700/50">
                    <Flower2 className="mx-auto mb-3 opacity-25 text-gray-400 animate-pulse" size={44} />
                    <h3 className="text-lg font-bold text-white mb-1">No Spa Sessions</h3>
                    <p className="text-gray-500 text-xs">Wellness and therapist requests from checked-in guests will appear here.</p>
                  </div>
                ) : (
                  <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden shadow-md">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-dark-900 border-b border-dark-700 text-xs text-gray-400 font-bold uppercase">
                          <th className="p-4">Guest</th>
                          <th className="p-4">Room #</th>
                          <th className="p-4">Service</th>
                          <th className="p-4">Schedule</th>
                          <th className="p-4">Therapist</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {filteredRequests.map(req => {
                          const therapist = parseAssignment(req.notes, 'therapist');
                          const noteText = parseNotes(req.notes);
                          const isClosed = isDeptClosed('spa');
                          return (
                            <tr key={req.id} className="hover:bg-dark-750/30 transition-colors">
                              <td className="p-4">
                                <p className="font-bold text-white">{req.bookings?.guest_name}</p>
                                {noteText && <p className="text-[10px] text-gray-500 mt-0.5 italic max-w-[160px] truncate" title={noteText}>{noteText}</p>}
                              </td>
                              <td className="p-4 font-mono text-gray-300">{req.bookings?.rooms?.room_number || 'N/A'}</td>
                              <td className="p-4 font-medium text-white">{req.services?.name}</td>
                              <td className="p-4 text-xs text-gray-400">
                                <span className="block">{req.scheduled_date || 'TBD'}</span>
                                <span className="font-semibold text-white">{req.scheduled_time || 'TBD'}</span>
                              </td>
                              <td className="p-4">
                                <span className="text-xs font-extrabold text-brand-400">{therapist || <span className="text-gray-600 italic font-normal">Unassigned</span>}</span>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                  req.status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                  req.status === 'confirmed' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                                  req.status === 'scheduled' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                  req.status === 'in_progress' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' :
                                  'bg-green-500/10 border-green-500/20 text-green-400'
                                }`}>{req.status}</span>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex gap-2 justify-end flex-wrap">
                                  <button
                                    onClick={() => openAssignModal(req)}
                                    disabled={isClosed}
                                    className="px-3 py-1 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                  >
                                    {therapist ? 'Change Therapist' : 'Assign Therapist'}
                                  </button>
                                  {req.status === 'scheduled' && (
                                    <button
                                      onClick={() => handleUpdateStatus(req.id, 'in_progress')}
                                      disabled={isClosed}
                                      className="px-3 py-1 bg-teal-500 hover:bg-teal-600 text-dark-950 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                    >
                                      Begin Session
                                    </button>
                                  )}
                                  {req.status === 'in_progress' && (
                                    <button
                                      onClick={() => handleUpdateStatus(req.id, 'completed')}
                                      disabled={isClosed}
                                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-dark-950 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                    >
                                      Complete Session
                                    </button>
                                  )}
                                  {req.status === 'pending' && (
                                    <button
                                      onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                                      disabled={isClosed}
                                      className="px-3 py-1 bg-brand-500 hover:bg-brand-600 text-dark-950 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                    >
                                      Confirm
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* SWIMMING POOL */}
              {activeTab === 'pool' && (
                filteredRequests.length === 0 ? (
                  <div className="glass-panel p-16 text-center rounded-3xl border border-dark-700/50">
                    <Droplets className="mx-auto mb-3 opacity-25 text-gray-400 animate-pulse" size={44} />
                    <h3 className="text-lg font-bold text-white mb-1">No Pool Cards</h3>
                    <p className="text-gray-500 text-xs">Pool entry logs and guest pool passes will appear here.</p>
                  </div>
                ) : (
                  <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden shadow-md">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-dark-900 border-b border-dark-700 text-xs text-gray-400 font-bold uppercase">
                          <th className="p-4">Guest</th>
                          <th className="p-4">Room #</th>
                          <th className="p-4">Service</th>
                          <th className="p-4">Price</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {filteredRequests.map(req => {
                          const isClosed = isDeptClosed('pool');
                          return (
                            <tr key={req.id} className="hover:bg-dark-750/30 transition-colors">
                              <td className="p-4 font-bold text-white">{req.bookings?.guest_name}</td>
                              <td className="p-4 font-mono">{req.bookings?.rooms?.room_number || 'N/A'}</td>
                              <td className="p-4 font-medium">{req.services?.name}</td>
                              <td className="p-4 font-bold">₦{Number(req.total_price_ngn).toLocaleString()}</td>
                              <td className="p-4">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${
                                  req.status === 'completed' 
                                    ? 'bg-green-500/10 border-green-500/25 text-green-400' 
                                    : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
                                }`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                {req.status !== 'completed' ? (
                                  <button
                                    onClick={() => handleUpdateStatus(req.id, 'completed')}
                                    disabled={isClosed}
                                    className="px-3 py-1 bg-brand-500 hover:bg-brand-650 text-dark-950 rounded font-bold text-xs transition-all active:scale-95"
                                  >
                                    Check-in/Fulfilled
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-500">Fulfilled</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* WALK-IN POS REGISTER */}
              {activeTab === 'register' && (
                <div className="bg-dark-800 border border-dark-700 p-6 rounded-3xl shadow-xl max-w-2xl mx-auto">
                  <div className="border-b border-dark-700 pb-4 mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                      <Plus size={18} className="text-gold-500" />
                      Walk-in / Direct POS register
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">Post immediate direct sales or charge checked-in guest folios directly.</p>
                  </div>

                  <form onSubmit={handleRegisterSubmit} className="space-y-5">
                    {/* Service Selector */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Service *</label>
                      <select
                        required
                        value={registerForm.serviceId}
                        onChange={e => {
                          const s = services.find(x => x.id === e.target.value);
                          setRegisterForm({
                            ...registerForm,
                            serviceId: e.target.value,
                            customPrice: s ? s.base_price_ngn : ''
                          });
                        }}
                        className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-gold-500 outline-none text-xs font-semibold"
                      >
                        <option value="">-- Choose a Service --</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>
                            [{s.category}] {s.name} — ₦{Number(s.base_price_ngn).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Guest Type Toggle */}
                    <div className="grid grid-cols-2 gap-4 bg-dark-900 p-1.5 rounded-xl border border-dark-700 text-center text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, guestType: 'folio' })}
                        className={`py-2 rounded-lg transition-all ${
                          registerForm.guestType === 'folio' ? 'bg-gold-500 text-dark-900' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Room Folio Charge (In-House)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegisterForm({ ...registerForm, guestType: 'walkin' })}
                        className={`py-2 rounded-lg transition-all ${
                          registerForm.guestType === 'walkin' ? 'bg-gold-500 text-dark-900' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Direct Walk-in (Settled POS)
                      </button>
                    </div>

                    {/* Guest Selector OR Walk-in Customer Name */}
                    {registerForm.guestType === 'folio' ? (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select In-House Guest Booking *</label>
                        <select
                          required
                          value={registerForm.bookingId}
                          onChange={e => setRegisterForm({ ...registerForm, bookingId: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-gold-500 outline-none text-xs font-semibold"
                        >
                          <option value="">-- Selectchecked-in room booking --</option>
                          {activeBookings.map(b => (
                            <option key={b.id} value={b.id}>
                              Room {b.rooms?.room_number} — {b.guest_name} ({b.booking_reference})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Customer Name *</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Jerry Prince"
                          value={registerForm.customerName}
                          onChange={e => setRegisterForm({ ...registerForm, customerName: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-gold-500 outline-none text-xs font-semibold"
                        />
                      </div>
                    )}

                    {/* Qty and Custom Price */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={registerForm.quantity}
                          onChange={e => setRegisterForm({ ...registerForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-gold-500 outline-none text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Rate/Price (₦)</label>
                        <input
                          type="number"
                          placeholder="Default price"
                          value={registerForm.customPrice}
                          onChange={e => setRegisterForm({ ...registerForm, customPrice: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-gold-500 outline-none text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* Payment Method Selector for Walk-in */}
                    {registerForm.guestType === 'walkin' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Settlement Method</label>
                        <select
                          value={registerForm.paymentMethod}
                          onChange={e => setRegisterForm({ ...registerForm, paymentMethod: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-gold-500 outline-none text-xs font-semibold"
                        >
                          <option value="cash">Cash Settlement</option>
                          <option value="pos">POS Card Swipe</option>
                          <option value="transfer">Bank Electronic Transfer</option>
                        </select>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Internal Notes / Instructions</label>
                      <textarea
                        rows="3"
                        placeholder="Dietary details, pickup location notes,card log numbers, etc."
                        value={registerForm.notes}
                        onChange={e => setRegisterForm({ ...registerForm, notes: e.target.value })}
                        className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-gold-500 outline-none text-xs resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      disabled={isSubmittingRegister}
                      type="submit"
                      className="w-full btn-primary py-4 font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      {isSubmittingRegister ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-dark-900 border-t-transparent"></div>
                          <span>Processing Register Posting...</span>
                        </>
                      ) : (
                        <>
                          <DollarSign size={16} />
                          <span>Post & Complete Transaction</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* CLOSE OF DAY COMPILER */}
              {activeTab === 'close_day' && (
                <div className="bg-dark-800 border border-dark-700 p-6 rounded-3xl shadow-xl max-w-2xl mx-auto space-y-6">
                  <div className="border-b border-dark-700 pb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                      <Clock size={18} className="text-gold-500" />
                      Ledger Close of Day Compiler
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">Generate final compiled reports and lock department registers for the day.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="border border-dark-700 bg-dark-900/40 p-4 rounded-2xl flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-300 uppercase">Shuttle Service</h4>
                        <p className="text-[10px] text-gray-500 mt-1">Transportation & Airport pickup closure reports.</p>
                      </div>
                      <button
                        onClick={() => handleCompileCloseOfDay('transportation')}
                        disabled={isCompilingCloseOfDay}
                        className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-dark-950 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                      >
                        Compile Shuttle
                      </button>
                    </div>

                    <div className="border border-dark-700 bg-dark-900/40 p-4 rounded-2xl flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-300 uppercase">Spa & Massage</h4>
                        <p className="text-[10px] text-gray-500 mt-1">Therapist and massage session registries.</p>
                      </div>
                      <button
                        onClick={() => handleCompileCloseOfDay('spa')}
                        disabled={isCompilingCloseOfDay}
                        className="mt-4 w-full bg-pink-500 hover:bg-pink-600 text-dark-950 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                      >
                        Compile Spa
                      </button>
                    </div>

                    <div className="border border-dark-700 bg-dark-900/40 p-4 rounded-2xl flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-300 uppercase">Swimming Pool</h4>
                        <p className="text-[10px] text-gray-500 mt-1">Poolside lounge cards and entry access logs.</p>
                      </div>
                      <button
                        onClick={() => handleCompileCloseOfDay('pool')}
                        disabled={isCompilingCloseOfDay}
                        className="mt-4 w-full bg-teal-500 hover:bg-teal-650 text-dark-950 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                      >
                        Compile Pool
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-dark-700 pt-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Completed Closures Today</h4>
                    {departmentalClosures.filter(c => c.business_date === todayStr).length === 0 ? (
                      <p className="text-xs text-gray-650 italic">No departmental closures recorded today.</p>
                    ) : (
                      <div className="space-y-3">
                        {departmentalClosures.filter(c => c.business_date === todayStr).map((c, i) => (
                          <div key={i} className="flex justify-between items-center bg-dark-900/60 p-3 rounded-xl border border-dark-700/50">
                            <div>
                              <span className="text-xs font-bold text-white capitalize">{c.department.replace('_', ' ')}</span>
                              <span className="block text-[9px] text-gray-500 mt-0.5">Closed at: {format(new Date(c.closed_at), 'HH:mm')} | Compiled by: {c.staff_name}</span>
                            </div>
                            <span className="text-sm font-black text-brand-400">₦{Number(c.revenue).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ASSIGNMENT MODAL */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-dark-800 border border-dark-700 p-6 rounded-3xl w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute right-4 top-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold mb-2 text-white font-serif flex items-center gap-2">
              <UserCheck size={18} className="text-brand-500" />
              Assign Operations Staff
            </h3>
            <p className="text-gray-400 text-xs mb-5">Select or input staff name to schedule this request.</p>

            <form onSubmit={handleSaveAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-550 uppercase tracking-widest mb-2">Staff Dropdown</label>
                <select
                  value={assignedStaffId}
                  onChange={e => {
                    setAssignedStaffId(e.target.value);
                    const match = staff.find(x => x.id === e.target.value);
                    if (match) setAssignedStaffName(`${match.first_name} ${match.last_name}`.trim());
                  }}
                  className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-brand-500 outline-none text-xs font-semibold"
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.role.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-550 uppercase tracking-widest mb-2">Or Type Custom Name</label>
                <input
                  type="text"
                  placeholder="e.g. Contract Driver"
                  value={assignedStaffName}
                  onChange={e => {
                    setAssignedStaffName(e.target.value);
                    setAssignedStaffId('');
                  }}
                  className="w-full bg-dark-900 border border-dark-700 text-white rounded-xl p-3 focus:border-brand-500 outline-none text-xs font-semibold"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="flex-1 bg-dark-750 hover:bg-dark-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-500 hover:bg-brand-600 text-dark-950 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE OF DAY REPORT MODAL */}
      {isCloseOfDayModalOpen && closeOfDayReport && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-dark-800 border border-dark-700 p-6 rounded-3xl w-full max-w-xl shadow-2xl relative max-h-[85vh] flex flex-col justify-between overflow-hidden">
            <button
              onClick={() => setIsCloseOfDayModalOpen(false)}
              className="absolute right-4 top-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="overflow-y-auto pr-1 custom-scrollbar space-y-5">
              <div className="border-b border-dark-700 pb-3">
                <h3 className="text-lg font-bold text-white capitalize">
                  Close of Day: {closeOfDayReport.department.replace('_', ' ')}
                </h3>
                <span className="text-[10px] text-gray-500 block font-mono mt-0.5">Business Date: {closeOfDayReport.business_date}</span>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-dark-900/60 p-3 rounded-xl border border-dark-700/50 text-center">
                  <span className="block text-[9px] text-gray-500 uppercase font-bold">POS/Walk-in</span>
                  <span className="block text-sm font-black text-white mt-1">₦{closeOfDayReport.total_walkin_revenue.toLocaleString()}</span>
                </div>
                <div className="bg-dark-900/60 p-3 rounded-xl border border-dark-700/50 text-center">
                  <span className="block text-[9px] text-gray-500 uppercase font-bold">Folio Charges</span>
                  <span className="block text-sm font-black text-white mt-1">₦{closeOfDayReport.total_inhouse_revenue.toLocaleString()}</span>
                </div>
                <div className="bg-dark-900/60 p-3 rounded-xl border border-dark-700/50 text-center bg-brand-500/5 border-brand-500/20">
                  <span className="block text-[9px] text-brand-400 uppercase font-bold">Total Revenue</span>
                  <span className="block text-sm font-black text-brand-400 mt-1">₦{closeOfDayReport.total_revenue.toLocaleString()}</span>
                </div>
              </div>

              {/* Transactions list */}
              <div>
                <h4 className="text-xs font-bold text-gray-450 uppercase mb-3">Transaction Entries ({closeOfDayReport.total_count})</h4>
                
                {closeOfDayReport.total_count === 0 ? (
                  <p className="text-xs text-gray-500 italic py-4 text-center">No transactions recorded today for this department.</p>
                ) : (
                  <div className="max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar space-y-2">
                    {[...closeOfDayReport.walkin_txns, ...closeOfDayReport.inhouse_txns].map((txn, index) => (
                      <div key={index} className="flex justify-between items-center bg-dark-900/40 p-2.5 rounded-lg border border-dark-750 text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="text-gray-500 font-mono block text-[9px]">{txn.time} | Ref: {txn.ref}</span>
                          <span className="text-white block font-medium truncate max-w-[320px] mt-0.5">{txn.description}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-bold block">₦{txn.amount.toLocaleString()}</span>
                          <span className="text-[9px] text-brand-500 uppercase tracking-widest font-black block mt-0.5">{txn.method}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-dark-900 p-4 rounded-xl text-xs text-gray-400 flex items-start gap-2.5">
                <AlertCircle className="text-gold-500 w-5 h-5 flex-shrink-0" />
                <p>⚠️ Confirming this Close of Day will lock all current day transactions for this department and post final revenues directly to the billing and accounting modules.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-dark-700 flex gap-4 mt-6">
              <button
                type="button"
                onClick={() => setIsCloseOfDayModalOpen(false)}
                className="flex-1 bg-dark-750 hover:bg-dark-700 text-white py-3 rounded-xl text-xs font-bold transition-all"
              >
                Go Back / Adjust
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseOfDay}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-dark-950 py-3 rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Confirm & Lock Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesPortal;

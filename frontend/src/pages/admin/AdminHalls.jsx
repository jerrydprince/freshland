import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { format, differenceInDays, addDays } from 'date-fns';
import { 
  Building2, Calendar, Coffee, Plus, Trash2, Edit, Check, X,
  Search, Users, DollarSign, Clock, ShieldAlert, Sparkles, Receipt,
  CheckCircle, Landmark, CreditCard, ChevronRight, FileText, Banknote, AlertCircle
} from 'lucide-react';

const AdminHalls = ({ isFrontOfficeClosed }) => {
  const { profile, hasAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Data lists
  const [halls, setHalls] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [mealOptions, setMealOptions] = useState([]);
  
  // Search / Filter
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activePaymentModal, setActivePaymentModal] = useState(null); // stores booking object
  const [installmentForm, setInstallmentForm] = useState({ amount: '', method: 'cash', notes: '' });
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  
  // Form states - Booking
  const [bookingForm, setBookingForm] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    organization_name: '',
    hall_id: '',
    booking_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    booking_type: 'daily',
    start_time: '08:00',
    end_time: '18:00',
    number_of_participants: 10,
    special_requests: '',
    amount_paid: 0,
    payment_method: 'cash',
    selected_meals: [] // array of meal option ids
  });

  const [isSaving, setIsSaving] = useState(false);

  // Sync databases in real-time
  useRealtimeSync(['halls', 'hall_bookings', 'hall_meal_options', 'hall_booking_meals'], () => {
    fetchData();
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Auto No-Show polling: runs every 5 minutes, marks bookings as no_show if 1 hour past END time with no check-in
  useEffect(() => {
    const checkNoShows = async () => {
      try {
        const now = new Date();
        // Fetch all pending/confirmed bookings
        const { data: pending } = await supabase
          .from('hall_bookings')
          .select('id, end_time, status')
          .in('status', ['pending', 'confirmed']);

        if (!pending || pending.length === 0) return;

        const noShowIds = pending
          .filter(b => {
            const endTime = new Date(b.end_time);
            const oneHourAfterEnd = new Date(endTime.getTime() + 60 * 60 * 1000);
            return now > oneHourAfterEnd;
          })
          .map(b => b.id);

        if (noShowIds.length > 0) {
          await supabase
            .from('hall_bookings')
            .update({ status: 'no_show' })
            .in('id', noShowIds);
          fetchData();
        }
      } catch (err) {
        console.warn('No-show auto-check failed:', err);
      }
    };

    checkNoShows(); // run immediately on mount
    const interval = setInterval(checkNoShows, 5 * 60 * 1000); // then every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hallsRes, bookingsRes, mealsRes] = await Promise.all([
        supabase.from('halls').select('*').order('name'),
        supabase.from('hall_bookings').select('*, halls(*)').order('created_at', { ascending: false }),
        supabase.from('hall_meal_options').select('*').order('name')
      ]);

      if (hallsRes.error) throw hallsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (mealsRes.error) throw mealsRes.error;

      setHalls(hallsRes.data || []);
      setBookings(bookingsRes.data || []);
      setMealOptions(mealsRes.data || []);
    } catch (err) {
      console.error("Failed to load halls module data:", err);
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  // --- Pricing Calculation for New Booking Form ---
  const bookingSummary = useMemo(() => {
    const selectedHall = halls.find(h => h.id === bookingForm.hall_id);
    if (!selectedHall) return { hallPrice: 0, mealsPrice: 0, subtotal: 0, tax: 0, total: 0, days: 1, hours: 10 };

    let days = 1;
    let hours = 10;

    if (bookingForm.booking_type === 'daily') {
      days = Math.max(1, differenceInDays(new Date(bookingForm.end_date), new Date(bookingForm.booking_date)) + 1);
    } else {
      const [sh, sm] = bookingForm.start_time.split(':').map(Number);
      const [eh, em] = bookingForm.end_time.split(':').map(Number);
      hours = Math.max(1, (eh + em/60) - (sh + sm/60));
    }

    const hallPrice = bookingForm.booking_type === 'daily' 
      ? Number(selectedHall.base_price_ngn) * days 
      : Number(selectedHall.hourly_price_ngn) * hours;

    let mealsPrice = 0;
    bookingForm.selected_meals.forEach(mealId => {
      const option = mealOptions.find(o => o.id === mealId);
      if (option) {
        mealsPrice += Number(option.price_per_participant_ngn) * Number(bookingForm.number_of_participants) * days;
      }
    });

    const subtotal = hallPrice + mealsPrice;
    const tax = subtotal * 0.075;
    const total = subtotal + tax;

    return { hallPrice, mealsPrice, subtotal, tax, total, days, hours };
  }, [bookingForm, halls, mealOptions]);

  // --- Hall Booking Operations ---
  const handleSaveBooking = async (e) => {
    e.preventDefault();
    if (isFrontOfficeClosed) {
      return toast.error("Operations are locked due to daily ledger closure.");
    }
    if (!bookingForm.guest_name || !bookingForm.guest_email || !bookingForm.guest_phone || !bookingForm.hall_id) {
      return toast.error("Please fill in all guest details and select a hall.");
    }

    setIsSaving(true);
    const toastId = toast.loading("Processing booking...");
    try {
      // 1. Double-booking overlapping verification
      const checkInStr = bookingForm.booking_date;
      const checkOutStr = bookingForm.booking_type === 'daily' ? bookingForm.end_date : bookingForm.booking_date;
      
      const { data: conflicts, error: confErr } = await supabase
        .from('hall_bookings')
        .select('id, start_time, end_time')
        .eq('hall_id', bookingForm.hall_id)
        .in('status', ['confirmed', 'checked_in']); // Only block if confirmed (fully paid) or actively in use

      if (confErr) throw confErr;

      const newStart = new Date(`${checkInStr}T${bookingForm.booking_type === 'daily' ? '00:00' : bookingForm.start_time}:00`);
      const newEnd = new Date(`${checkOutStr}T${bookingForm.booking_type === 'daily' ? '23:59' : bookingForm.end_time}:00`);

      const hasOverlap = conflicts.some(c => {
        const cStart = new Date(c.start_time);
        const cEnd = new Date(c.end_time);
        return newStart < cEnd && newEnd > cStart;
      });

      if (hasOverlap) {
        toast.dismiss(toastId);
        setIsSaving(false);
        return toast.error("This Hall is already confirmed / in use for the requested period. Please choose a different date or time.");
      }

      // Warn if within 48 hours
      const hoursUntilStart = (newStart.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilStart < 48 && hoursUntilStart > 0) {
        toast(`⚠️ This booking is less than 48 hours away. Ensure the guest completes payment before the 24-hour cutoff.`, { icon: '⚠️', duration: 5000 });
      }

      // 2. Build references and amounts
      const ref = `HALL-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const amountPaid = Number(bookingForm.amount_paid);
      const isPaid = amountPaid >= bookingSummary.total;
      const statusPayment = isPaid ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');

      // 3. Create Booking Record
      const bookingPayload = {
        booking_reference: ref,
        guest_name: bookingForm.guest_name,
        guest_email: bookingForm.guest_email,
        guest_phone: bookingForm.guest_phone,
        organization_name: bookingForm.organization_name || null,
        hall_id: bookingForm.hall_id,
        booking_date: bookingForm.booking_date,
        booking_type: bookingForm.booking_type,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        num_days: bookingSummary.days,
        num_hours: bookingForm.booking_type === 'hourly' ? bookingSummary.hours : null,
        number_of_participants: Number(bookingForm.number_of_participants),
        status: 'pending',
        booking_source: 'front_office',
        total_hall_price_ngn: bookingSummary.hallPrice,
        total_meals_price_ngn: bookingSummary.mealsPrice,
        total_amount_ngn: bookingSummary.total,
        amount_paid_ngn: amountPaid,
        payment_status: statusPayment,
        special_requests: bookingForm.special_requests || null
      };

      const { data: newBooking, error: insErr } = await supabase
        .from('hall_bookings')
        .insert([bookingPayload])
        .select()
        .single();

      if (insErr) throw insErr;

      // 4. Create Detailed Scheduled Kitchen Catering Items (for each selected meal & each day)
      if (bookingForm.selected_meals.length > 0 && newBooking) {
        const mealFeeds = [];
        
        for (let i = 0; i < bookingSummary.days; i++) {
          const servingDate = format(addDays(new Date(bookingForm.booking_date), i), 'yyyy-MM-dd');
          
          bookingForm.selected_meals.forEach(mealId => {
            const option = mealOptions.find(o => o.id === mealId);
            if (option) {
              mealFeeds.push({
                hall_booking_id: newBooking.id,
                meal_option_id: option.id,
                course_type: option.course_type,
                serving_date: servingDate,
                price_per_participant_ngn: option.price_per_participant_ngn,
                number_of_participants: Number(bookingForm.number_of_participants),
                total_price_ngn: option.price_per_participant_ngn * Number(bookingForm.number_of_participants),
                status: 'pending'
              });
            }
          });
        }

        const { error: feedErr } = await supabase.from('hall_booking_meals').insert(mealFeeds);
        if (feedErr) console.error("Catering schedules setup error:", feedErr);
      }

      // 5. Post to general ledger payments table if paid
      if (amountPaid > 0 && newBooking) {
        const txnRef = `PAY-HALL-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const { error: payErr } = await supabase.from('payments').insert([{
          hall_booking_id: newBooking.id,
          amount: amountPaid,
          method: bookingForm.payment_method,
          status: 'completed',
          transaction_ref: txnRef,
          notes: `Hall Booking Deposit/Payment for Ref: ${ref} | Guest: ${bookingForm.guest_name}`
        }]);

        if (payErr) console.error("Payments sync error:", payErr);
      }

      toast.success(`Booking created! Ref: ${ref}`, { id: toastId });
      setIsBookingModalOpen(false);
      setBookingForm({
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        organization_name: '',
        hall_id: halls[0]?.id || '',
        booking_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        booking_type: 'daily',
        start_time: '08:00',
        end_time: '18:00',
        number_of_participants: 10,
        special_requests: '',
        amount_paid: 0,
        payment_method: 'cash',
        selected_meals: []
      });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBookingStatus = async (id, newStatus) => {
    if (isFrontOfficeClosed) {
      return toast.error("Ledger locked. Action rejected.");
    }
    const toastId = toast.loading(`Updating status to ${newStatus}...`);
    try {
      const { error } = await supabase
        .from('hall_bookings')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // If cancelled or no_show, update kitchen tasks as well
      if (newStatus === 'cancelled' || newStatus === 'no_show') {
        await supabase.from('hall_booking_meals').update({ status: 'cancelled' }).eq('hall_booking_id', id);
        // Only delete ledger entries for full cancellations, not no-shows
        if (newStatus === 'cancelled') {
          await supabase.from('invoices').delete().eq('hall_booking_id', id);
          await supabase.from('payments').delete().eq('hall_booking_id', id);
        }
      }

      toast.success(`Booking status updated to ${newStatus}!`, { id: toastId });
      fetchData();
    } catch (err) {
      toast.error("Failed to update booking status.", { id: toastId });
    }
  };

  // --- Record Installment Payment ---
  const handleRecordInstallmentPayment = async (e) => {
    e.preventDefault();
    if (isFrontOfficeClosed) return toast.error("Ledger locked. Action rejected.");
    if (!activePaymentModal) return;

    const amount = Number(installmentForm.amount);
    if (!amount || amount <= 0) return toast.error("Enter a valid payment amount.");

    const outstanding = Number(activePaymentModal.total_amount_ngn) - Number(activePaymentModal.amount_paid_ngn);
    if (amount > outstanding) return toast.error(`Amount exceeds outstanding balance of ₦${outstanding.toLocaleString()}.`);

    // 24-hour installment cutoff
    const startTime = new Date(activePaymentModal.start_time);
    const hoursToStart = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursToStart < 24 && hoursToStart > 0) {
      return toast.error("Payment cutoff reached — no installment payments accepted within 24 hours of event start.");
    }
    if (hoursToStart <= 0) {
      return toast.error("Event has already started or passed — no new payments can be recorded.");
    }

    setIsSavingPayment(true);
    const toastId = toast.loading("Recording payment...");
    try {
      const txRef = `INST-HALL-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const newAmountPaid = Number(activePaymentModal.amount_paid_ngn) + amount;
      const isFullyPaid = newAmountPaid >= Number(activePaymentModal.total_amount_ngn);
      const newPaymentStatus = isFullyPaid ? 'paid' : 'partial';
      const newBookingStatus = isFullyPaid ? 'confirmed' : activePaymentModal.status;

      // 1. Log to payments ledger
      const { error: payErr } = await supabase.from('payments').insert([{
        hall_booking_id: activePaymentModal.id,
        amount,
        method: installmentForm.method,
        status: 'completed',
        transaction_ref: txRef,
        notes: installmentForm.notes || `Hall installment payment for Ref: ${activePaymentModal.booking_reference} | Guest: ${activePaymentModal.guest_name}`
      }]);
      if (payErr) throw payErr;

      // 2. Update booking totals and status
      const { error: updateErr } = await supabase
        .from('hall_bookings')
        .update({
          amount_paid_ngn: newAmountPaid,
          payment_status: newPaymentStatus,
          status: newBookingStatus
        })
        .eq('id', activePaymentModal.id);
      if (updateErr) throw updateErr;

      // 3. Update the generated invoice so financial folios reflect the partial payment balance
      try {
        await supabase
          .from('invoices')
          .update({
            amount_paid: newAmountPaid,
            status: newPaymentStatus === 'paid' ? 'paid' : 'partial'
          })
          .eq('hall_booking_id', activePaymentModal.id);
      } catch (invErr) {
        console.warn("Failed to sync invoice amount_paid:", invErr);
      }

      toast.success(
        isFullyPaid
          ? `✅ Full payment received! Booking ${activePaymentModal.booking_reference} is now Confirmed.`
          : `✔ ₦${amount.toLocaleString()} recorded. Outstanding: ₦${(outstanding - amount).toLocaleString()}`,
        { id: toastId, duration: 5000 }
      );

      // 4. Print receipt for this specific installment transaction
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const formattedDate = format(new Date(), 'MMM dd, yyyy, HH:mm');
          printWindow.document.write(`
            <html>
              <head>
                <title>Payment Receipt - Hall Booking ${activePaymentModal.booking_reference}</title>
                <style>
                  @page { size: A5; margin: 20mm; }
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; }
                  .header { text-align: center; border-bottom: 2px solid #374151; padding-bottom: 15px; margin-bottom: 20px; }
                  .header h1 { font-size: 22px; margin: 0; font-weight: 900; }
                  .header p { margin: 2px 0; font-size: 12px; color: #6b7280; }
                  .title { font-size: 16px; font-weight: 800; text-align: center; text-transform: uppercase; color: #059669; margin: 0 0 20px 0; letter-spacing: 0.05em; }
                  table { width: 100%; border-collapse: collapse; font-size: 13px; }
                  td { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
                  td:first-child { font-weight: 700; width: 45%; }
                  .amount { font-size: 22px; font-weight: 900; color: #059669; text-align: center; padding: 15px 0; border-top: 2px solid #374151; margin-top: 10px; }
                  .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>SPARKLES APARTMENTS</h1>
                  <p>Premium Luxury Shortlets</p>
                </div>
                <p class="title">Installment Payment Receipt</p>
                <table>
                  <tr><td>Booking Ref:</td><td>${activePaymentModal.booking_reference}</td></tr>
                  <tr><td>Guest Name:</td><td>${activePaymentModal.guest_name}</td></tr>
                  <tr><td>Event Hall:</td><td>${activePaymentModal.halls?.name || 'Event Space'}</td></tr>
                  <tr><td>Event Date:</td><td>${activePaymentModal.booking_date}</td></tr>
                  <tr><td>Payment Date:</td><td>${formattedDate}</td></tr>
                  <tr><td>Transaction Ref:</td><td style="font-family: monospace; font-weight: bold;">${txRef}</td></tr>
                  <tr><td>Payment Status:</td><td style="color: ${isFullyPaid ? '#059669' : '#d97706'}; font-weight: bold;">${isFullyPaid ? 'FULLY PAID' : 'PARTIAL / DEPOSIT'}</td></tr>
                  ${!isFullyPaid ? `<tr><td>Outstanding Balance:</td><td style="color: #dc2626; font-weight: bold;">₦${(outstanding - amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
                </table>
                <div class="amount">₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div class="footer">
                  <p>Authorized and confirmed by Sparkles Apartments Front Office.</p>
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        }
      } catch (printErr) { console.warn('Receipt print failed:', printErr); }

      setActivePaymentModal(null);
      setInstallmentForm({ amount: '', method: 'cash', notes: '' });
      fetchData();
    } catch (err) {
      toast.error("Failed to record payment: " + err.message, { id: toastId });
    } finally {
      setIsSavingPayment(false);
    }
  };

  // --- Filters & Search ---
  const filteredBookings = bookings.filter(b => {
    const name = b.guest_name || '';
    const email = b.guest_email || '';
    const ref = b.booking_reference || '';
    const hallName = b.halls?.name || '';
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || 
           email.toLowerCase().includes(q) || 
           ref.toLowerCase().includes(q) || 
           hallName.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="bg-dark-800 border border-dark-700/60 p-6 rounded-xl shadow-2xl min-h-[500px]">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-500"></div>
            <p className="text-gray-500 text-sm">Fetching records...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-left w-full md:w-auto">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Landmark size={20} className="text-gold-500" />
                  Event Hall Reservations
                </h3>
                <p className="text-xs text-gray-400 mt-1">Manage and track bookings and physical rentals of event spaces.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search bookings..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-dark-900 border border-dark-700 w-full pl-10 pr-4 py-2 text-sm rounded-xl focus:border-brand-500 outline-none text-white transition-colors"
                  />
                </div>
                <button 
                  onClick={() => {
                    if (halls.length === 0) return toast.error("Please add a hall to inventory first.");
                    setBookingForm(prev => ({ ...prev, hall_id: halls[0]?.id }));
                    setIsBookingModalOpen(true);
                  }}
                  className="bg-brand-600 hover:bg-brand-500 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-white border-0 cursor-pointer w-full md:w-auto justify-center"
                >
                  <Plus size={18} /> Book a Hall
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-dark-700/50">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-900 text-gray-400 uppercase tracking-wider text-xs border-b border-dark-700">
                  <tr>
                    <th className="p-4">Ref / Guest</th>
                    <th className="p-4">Hall</th>
                    <th className="p-4">Event Date / Type</th>
                    <th className="p-4">Pax / Catering</th>
                    <th className="p-4">Invoice / Paid</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filteredBookings.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-gray-500">No hall bookings found.</td>
                    </tr>
                  )}
                  {filteredBookings.map(b => (
                    <tr key={b.id} className="hover:bg-dark-700/35 transition-colors">
                      <td className="p-4">
                        <div className="font-black text-white text-md tracking-wider flex items-center gap-1.5">
                          <Receipt size={16} className="text-gold-500" /> {b.booking_reference}
                        </div>
                        <div className="text-sm font-semibold text-gray-300 mt-1">{b.guest_name}</div>
                        {b.organization_name && <div className="text-xs text-gray-400">{b.organization_name}</div>}
                      </td>
                      <td className="p-4 font-bold text-brand-400">{b.halls?.name || 'N/A'}</td>
                      <td className="p-4">
                        <div className="font-semibold text-white">{format(new Date(b.booking_date), 'MMM dd, yyyy')}</div>
                        <div className="text-xs text-gray-400 mt-1 capitalize font-medium flex items-center gap-1">
                          <Clock size={12} /> {b.booking_type} {b.booking_type === 'hourly' && `(${format(new Date(b.start_time), 'HH:mm')} - ${format(new Date(b.end_time), 'HH:mm')})`}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-white flex items-center gap-1"><Users size={14} /> {b.number_of_participants} pax</div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Coffee size={12} className="text-amber-500" /> ₦{Number(b.total_meals_price_ngn).toLocaleString()} meals
                        </div>
                      </td>
                      <td className="p-4 font-bold">
                        <div className="text-gold-500">₦{Number(b.total_amount_ngn).toLocaleString()}</div>
                        <div className="text-xs mt-1 text-gray-400">Paid: <span className="text-green-400">₦{Number(b.amount_paid_ngn).toLocaleString()}</span></div>
                        {/* Payment progress bar */}
                        {(() => {
                          const pct = Math.min(100, Math.round((Number(b.amount_paid_ngn) / Number(b.total_amount_ngn)) * 100));
                          return (
                            <div className="mt-1.5 w-full bg-dark-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          );
                        })()}
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {Math.round((Number(b.amount_paid_ngn) / Number(b.total_amount_ngn)) * 100)}% paid
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                          b.status === 'confirmed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          b.status === 'checked_in' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                          b.status === 'checked_out' ? 'bg-gray-500/10 text-gray-500 border-gray-500/20' :
                          b.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          b.status === 'no_show' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        }`}>
                          {b.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <div className="flex flex-col gap-1.5 items-end">
                            {/* Record Payment: only if not fully paid and >24hrs to start */}
                            {b.payment_status !== 'paid' && (() => {
                              const hrs = (new Date(b.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
                              return hrs > 24;
                            })() && (
                              <button
                                disabled={isFrontOfficeClosed}
                                onClick={() => {
                                  setActivePaymentModal(b);
                                  setInstallmentForm({ amount: '', method: 'cash', notes: '' });
                                }}
                                className="text-xs bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1 disabled:opacity-40"
                              >
                                <Banknote size={12} /> Record Payment
                              </button>
                            )}
                            {/* Warn if within 24hrs and still not paid */}
                            {b.payment_status !== 'paid' && (() => {
                              const hrs = (new Date(b.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
                              return hrs <= 24 && hrs > 0;
                            })() && (
                              <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                                <AlertCircle size={11} /> Payment cutoff
                              </span>
                            )}
                            {/* Check In: only if fully paid */}
                            {b.status === 'confirmed' && b.payment_status === 'paid' && (
                              <button 
                                onClick={() => handleUpdateBookingStatus(b.id, 'checked_in')}
                                className="text-xs bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/30 px-2 py-1.5 rounded-lg font-bold cursor-pointer"
                              >
                                Check In
                              </button>
                            )}
                            <button 
                              onClick={() => handleUpdateBookingStatus(b.id, 'no_show')}
                              className="text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1.5 rounded-lg font-bold cursor-pointer"
                            >
                              No Show
                            </button>
                            <button 
                              onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                              className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-1.5 rounded-lg font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {b.status === 'checked_in' && (
                          <button 
                            onClick={() => handleUpdateBookingStatus(b.id, 'checked_out')}
                            className="text-xs bg-gray-500/10 hover:bg-gray-500/20 text-gray-300 border border-gray-500/30 px-2 py-1.5 rounded-lg font-bold cursor-pointer"
                          >
                            Check Out
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL: CREATE HALL BOOKING --- */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-4xl rounded-2xl shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="text-gold-500"/> Manual Hall Booking Desk</h3>
              <button onClick={() => setIsBookingModalOpen(false)} className="text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveBooking} className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Guest Details */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase font-extrabold tracking-widest text-gold-500">Guest Information</h4>
                  
                  <div className="space-y-3 bg-dark-900/40 p-4 rounded-xl border border-dark-700/60">
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Contact/Guest Name *</label>
                      <input 
                        type="text" 
                        required
                        value={bookingForm.guest_name}
                        onChange={e => setBookingForm(prev => ({ ...prev, guest_name: e.target.value }))}
                        className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Guest Email *</label>
                      <input 
                        type="email" 
                        required
                        value={bookingForm.guest_email}
                        onChange={e => setBookingForm(prev => ({ ...prev, guest_email: e.target.value }))}
                        className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Guest Phone *</label>
                      <input 
                        type="text" 
                        required
                        value={bookingForm.guest_phone}
                        onChange={e => setBookingForm(prev => ({ ...prev, guest_phone: e.target.value }))}
                        className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500"
                        placeholder="080XXXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Organization Name (Optional)</label>
                      <input 
                        type="text" 
                        value={bookingForm.organization_name}
                        onChange={e => setBookingForm(prev => ({ ...prev, organization_name: e.target.value }))}
                        className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500"
                        placeholder="Google Inc."
                      />
                    </div>
                  </div>
                </div>

                {/* Booking parameters */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase font-extrabold tracking-widest text-gold-500">Booking Specifications</h4>
                  
                  <div className="space-y-3 bg-dark-900/40 p-4 rounded-xl border border-dark-700/60">
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Select Event Hall *</label>
                      <select
                        value={bookingForm.hall_id}
                        onChange={e => setBookingForm(prev => ({ ...prev, hall_id: e.target.value }))}
                        className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500 cursor-pointer"
                      >
                        {halls.map(h => (
                          <option key={h.id} value={h.id}>{h.name} (Cap: {h.capacity})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 font-bold mb-1">Pricing Scheme *</label>
                        <select
                          value={bookingForm.booking_type}
                          onChange={e => setBookingForm(prev => ({ ...prev, booking_type: e.target.value }))}
                          className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500 cursor-pointer"
                        >
                          <option value="daily">Daily Rental</option>
                          <option value="hourly">Hourly Rental</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 font-bold mb-1">Expected Participants *</label>
                        <input 
                          type="number" 
                          required
                          min="1"
                          value={bookingForm.number_of_participants}
                          onChange={e => setBookingForm(prev => ({ ...prev, number_of_participants: Number(e.target.value) }))}
                          className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Start Date *</label>
                      <input 
                        type="date" 
                        required
                        value={bookingForm.booking_date}
                        onChange={e => setBookingForm(prev => ({ ...prev, booking_date: e.target.value }))}
                        className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500 cursor-pointer"
                      />
                    </div>

                    {bookingForm.booking_type === 'daily' ? (
                      <div>
                        <label className="block text-xs text-gray-400 font-bold mb-1">End Date *</label>
                        <input 
                          type="date" 
                          required
                          min={bookingForm.booking_date}
                          value={bookingForm.end_date}
                          onChange={e => setBookingForm(prev => ({ ...prev, end_date: e.target.value }))}
                          className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500 cursor-pointer"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 font-bold mb-1">Start Time *</label>
                          <input 
                            type="time" 
                            required
                            value={bookingForm.start_time}
                            onChange={e => setBookingForm(prev => ({ ...prev, start_time: e.target.value }))}
                            className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 font-bold mb-1">End Time *</label>
                          <input 
                            type="time" 
                            required
                            value={bookingForm.end_time}
                            onChange={e => setBookingForm(prev => ({ ...prev, end_time: e.target.value }))}
                            className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Catering meal checklist */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-extrabold tracking-widest text-gold-500">Catering feeding plans</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-dark-900/40 p-4 rounded-xl border border-dark-700/60">
                  {mealOptions.filter(o => o.is_active).map(option => {
                    const isSelected = bookingForm.selected_meals.includes(option.id);
                    return (
                      <div 
                        key={option.id}
                        onClick={() => {
                          setBookingForm(prev => {
                            const selected = isSelected 
                              ? prev.selected_meals.filter(id => id !== option.id)
                              : [...prev.selected_meals, option.id];
                            return { ...prev, selected_meals: selected };
                          });
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                          isSelected ? 'border-gold-500 bg-gold-500/10' : 'border-dark-700 bg-dark-900 hover:border-dark-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                            isSelected ? 'bg-gold-500 border-gold-500 text-dark-900' : 'border-gray-600'
                          }`}>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-white">{option.name}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{option.combination_items?.join(' + ')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-gold-500">₦{Number(option.price_per_participant_ngn).toLocaleString()}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5">per pax/day</p>
                        </div>
                      </div>
                    );
                  })}
                  {mealOptions.length === 0 && <p className="text-gray-500 text-xs">No active meals defined.</p>}
                </div>
              </div>

              {/* Special instructions */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Special instructions / requests</label>
                <textarea 
                  value={bookingForm.special_requests}
                  onChange={e => setBookingForm(prev => ({ ...prev, special_requests: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500 h-20 resize-none"
                  placeholder="E.g., Vegetarian options, Audio visual requirements, decoration details..."
                />
              </div>

              {/* Payments & Ledger posting */}
              <div className="border-t border-dark-700/60 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-dark-900/60 border border-dark-700/50 p-5 rounded-2xl">
                  
                  {/* Costs summary */}
                  <div className="space-y-2.5">
                    <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-2 text-left">Cost Breakdown</h5>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Hall Rental ({bookingForm.booking_type === 'daily' ? `${bookingSummary.days} days` : `${bookingSummary.hours} hrs`}):</span>
                      <span className="font-semibold text-white">₦{bookingSummary.hallPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Catering meals ({bookingForm.number_of_participants} pax x {bookingSummary.days} days):</span>
                      <span className="font-semibold text-white">₦{bookingSummary.mealsPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>VAT (7.5%):</span>
                      <span className="font-semibold text-white">₦{bookingSummary.tax.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-dark-700/60 pt-2 flex justify-between font-black text-md text-white">
                      <span>Grand Total:</span>
                      <span className="text-gold-500 text-lg">₦{bookingSummary.total.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Payment Inputs */}
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-bold text-white text-xs uppercase tracking-wider text-left">Initial Payment (Optional)</h5>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Booking is reserved immediately. Remaining balance can be paid in installments up to <strong className="text-yellow-400">24 hours before event start</strong>. Hall is only blocked for other bookings once fully confirmed.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 font-bold mb-1">Amount Paid (₦)</label>
                        <input 
                          type="number" 
                          min="0"
                          max={bookingSummary.total}
                          value={bookingForm.amount_paid}
                          onChange={e => setBookingForm(prev => ({ ...prev, amount_paid: Number(e.target.value) }))}
                          className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 font-bold mb-1">Payment Method</label>
                        <select
                          value={bookingForm.payment_method}
                          onChange={e => setBookingForm(prev => ({ ...prev, payment_method: e.target.value }))}
                          className="bg-dark-900 border border-dark-700 w-full px-3 py-2 rounded-lg text-white outline-none focus:border-brand-500 cursor-pointer"
                        >
                          <option value="cash">Cash Payment</option>
                          <option value="pos">POS Terminal</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="text-right text-xs font-semibold text-gray-400">
                      Balance Due: <span className="text-red-400 font-bold">₦{(bookingSummary.total - bookingForm.amount_paid).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 border-t border-dark-700/60 pt-6">
                <button 
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="bg-dark-700 hover:bg-dark-650 text-white px-5 py-2.5 rounded-xl font-bold transition-all border-0 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-1.5 border-0 cursor-pointer"
                >
                  {isSaving ? "Creating..." : "Confirm & Save Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: RECORD INSTALLMENT PAYMENT --- */}
      {activePaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Banknote className="text-brand-500" size={18} /> Record Installment Payment
              </h3>
              <button onClick={() => setActivePaymentModal(null)} className="text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer"><X size={18} /></button>
            </div>

            <form onSubmit={handleRecordInstallmentPayment} className="p-6 space-y-5 text-sm">
              {/* Booking Summary */}
              <div className="bg-dark-900/60 border border-dark-700 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Booking Ref</span>
                  <span className="text-white font-bold font-mono">{activePaymentModal.booking_reference}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Guest</span>
                  <span className="text-white font-semibold">{activePaymentModal.guest_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Hall</span>
                  <span className="text-brand-400 font-bold">{activePaymentModal.halls?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Event Date</span>
                  <span className="text-white">{format(new Date(activePaymentModal.start_time), 'MMM dd, yyyy HH:mm')}</span>
                </div>
                <div className="border-t border-dark-700 mt-2 pt-2 flex justify-between font-bold">
                  <span className="text-gray-300">Total Due</span>
                  <span className="text-gold-500">₦{Number(activePaymentModal.total_amount_ngn).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Already Paid</span>
                  <span className="text-green-400 font-bold text-xs">₦{Number(activePaymentModal.amount_paid_ngn).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Outstanding</span>
                  <span className="text-red-400 font-bold text-xs">
                    ₦{(Number(activePaymentModal.total_amount_ngn) - Number(activePaymentModal.amount_paid_ngn)).toLocaleString()}
                  </span>
                </div>
                {/* Progress bar */}
                {(() => {
                  const pct = Math.min(100, Math.round((Number(activePaymentModal.amount_paid_ngn) / Number(activePaymentModal.total_amount_ngn)) * 100));
                  return (
                    <div className="mt-1 w-full bg-dark-700 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  );
                })()}
              </div>

              {/* 24hr warning if close */}
              {(() => {
                const hrs = (new Date(activePaymentModal.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
                if (hrs > 24 && hrs < 48) {
                  return (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                      <p className="text-yellow-300 text-xs">Event is within 48 hours. This is the final window to accept installments — payments are locked 24 hours before start.</p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Payment Fields */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Amount to Record (₦) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Number(activePaymentModal.total_amount_ngn) - Number(activePaymentModal.amount_paid_ngn)}
                  value={installmentForm.amount}
                  onChange={e => setInstallmentForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-lg text-white outline-none focus:border-brand-500"
                  placeholder="0"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-500">Max: ₦{(Number(activePaymentModal.total_amount_ngn) - Number(activePaymentModal.amount_paid_ngn)).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => setInstallmentForm(prev => ({
                      ...prev,
                      amount: String(Number(activePaymentModal.total_amount_ngn) - Number(activePaymentModal.amount_paid_ngn))
                    }))}
                    className="text-[10px] text-brand-400 hover:underline cursor-pointer bg-transparent border-0"
                  >Pay Full Balance</button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Payment Method</label>
                <select
                  value={installmentForm.method}
                  onChange={e => setInstallmentForm(prev => ({ ...prev, method: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-lg text-white outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="pos">POS Terminal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={installmentForm.notes}
                  onChange={e => setInstallmentForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-lg text-white outline-none focus:border-brand-500"
                  placeholder="e.g. 2nd installment via GTB transfer"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentModal(null)}
                  className="flex-1 bg-dark-700 hover:bg-dark-600 text-white py-2.5 rounded-xl font-bold transition-all border-0 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPayment || !installmentForm.amount}
                  className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border-0 cursor-pointer"
                >
                  {isSavingPayment ? 'Recording...' : <><Check size={14} /> Record Payment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminHalls;

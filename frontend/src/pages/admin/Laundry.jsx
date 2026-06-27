import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Shirt, Sparkles, User, Users, Plus, DollarSign, Clock, 
  CheckCircle, Search, RefreshCw, X, CreditCard, Droplets, 
  Trash2, ShieldCheck, Phone, Mail, ArrowRight, ClipboardList, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
const PaginationControl = ({ currentPage, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-dark-700 bg-dark-900/30 px-4 py-3 sm:px-6 mt-0 rounded-b-lg">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="relative inline-flex items-center rounded-md border border-dark-750 bg-dark-800 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="relative ml-3 inline-flex items-center rounded-md border border-dark-750 bg-dark-800 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-gray-400">
            Showing <span className="font-semibold text-white">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
            <span className="font-semibold text-white">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{' '}
            of <span className="font-semibold text-white">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-dark-750 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="sr-only">Previous</span>
              &larr;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                type="button"
                key={page}
                onClick={() => onPageChange(page)}
                className={`relative inline-flex items-center px-3 py-2 text-xs font-bold ring-1 ring-inset ring-dark-750 cursor-pointer ${
                  page === currentPage
                    ? 'z-10 bg-brand-500 text-dark-950 focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 font-extrabold'
                    : 'text-gray-300 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-dark-750 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="sr-only">Next</span>
              &rarr;
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

const PRICING_METHODS = ['stripe', 'paystack', 'bank_transfer', 'pos', 'cash'];

const AdminLaundry = () => {
  const { profile, hasAccess } = useAuth();
  const [activeTab, setActiveTab] = useState('inhouse'); // inhouse, walkin, history
  const [loading, setLoading] = useState(true);
  
  // Data lists
  const [inhouseRequests, setInhouseRequests] = useState([]);
  const [walkinPayments, setWalkinPayments] = useState([]);
  const [inhouseHistory, setInhouseHistory] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  
  // Search states
  const [inhouseSearch, setInhouseSearch] = useState('');
  const [walkinSearch, setWalkinSearch] = useState('');

  // Pagination states
  const [currentPageInhouse, setCurrentPageInhouse] = useState(1);
  const [currentPageWalkin, setCurrentPageWalkin] = useState(1);
  const [currentPageHistory, setCurrentPageHistory] = useState(1);
  const pageSize = 10;

  // Reset pagination when search terms or active tabs change
  useEffect(() => {
    setCurrentPageInhouse(1);
  }, [inhouseSearch]);

  useEffect(() => {
    setCurrentPageWalkin(1);
  }, [walkinSearch]);

  useEffect(() => {
    setCurrentPageInhouse(1);
    setCurrentPageWalkin(1);
    setCurrentPageHistory(1);
  }, [activeTab]);

  // Post Charge Modal State (for Inhouse Laundry)
  const [activeProcessingOrder, setActiveProcessingOrder] = useState(null);
  const [customCharge, setCustomCharge] = useState('');
  const [launderingNotes, setLaunderingNotes] = useState('');
  const [isSubmittingCharge, setIsSubmittingCharge] = useState(false);
  const [chargeToGroup, setChargeToGroup] = useState(false);

  // Walkin Registration Form State
  const [showWalkinForm, setShowWalkinForm] = useState(false);
  const [walkinForm, setWalkinForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    itemsDescription: '',
    quantity: 1,
    chargeAmount: '',
    paymentMethod: 'cash',
    isPaid: true
  });
  const [isRegisteringWalkin, setIsRegisteringWalkin] = useState(false);

  // Close of Day states
  const [departmentalClosures, setDepartmentalClosures] = useState([]);
  const [isCloseOfDayModalOpen, setIsCloseOfDayModalOpen] = useState(false);
  const [closeOfDayReport, setCloseOfDayReport] = useState(null);
  const [isCompilingCloseOfDay, setIsCompilingCloseOfDay] = useState(false);

  useEffect(() => {
    fetchLaundryData();
    fetchClosures();
  }, []);

  useRealtimeSync(['booking_services', 'bookings', 'system_settings'], (table) => {
    fetchLaundryData(false);
    if (table === 'system_settings') {
      fetchClosures();
    }
  });

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
      console.warn("Failed to fetch closures in Laundry:", err);
    }
  };

  const handleCompileCloseOfDayLaundry = async () => {
    setIsCompilingCloseOfDay(true);
    const toastId = toast.loading("Compiling today's Laundry transactions...");
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // 1. Fetch payments for today
      const { data: payments, error: payErr } = await supabase.from('payments').select('*');
      if (payErr) throw payErr;

      // 2. Fetch completed booking services for today
      const { data: bs, error: bsErr } = await supabase
        .from('booking_services')
        .select('*, bookings(rooms(room_number), guest_name, booking_reference), services(name, category)')
        .eq('status', 'completed');
      if (bsErr) throw bsErr;

      // Filter walk-in payments (prefix LDY-POS-)
      const walkinTxns = (payments || []).filter(p => {
        const dStr = format(new Date(p.processed_at || p.created_at), 'yyyy-MM-dd');
        return dStr === todayStr && p.transaction_ref?.startsWith('LDY-POS-');
      }).map(p => ({
        time: format(new Date(p.processed_at || p.created_at), 'HH:mm'),
        ref: p.transaction_ref,
        description: p.notes || 'Walk-in Laundry Direct Sale',
        amount: Number(p.amount),
        method: p.method
      }));

      // Filter in-house charges
      const inhouseTxns = (bs || []).filter(item => {
        const dStr = format(new Date(item.updated_at || item.created_at), 'yyyy-MM-dd');
        return dStr === todayStr && (item.services?.category?.toLowerCase() === 'laundry' || item.services?.name?.toLowerCase()?.includes('laundry'));
      }).map(i => ({
        time: format(new Date(i.updated_at), 'HH:mm'),
        ref: i.bookings?.booking_reference || 'IN-HOUSE',
        description: `Room ${i.bookings?.rooms?.room_number || 'N/A'} Folio Charge - ${i.services?.name || 'Laundry'} (x${i.quantity || 1})`,
        amount: Number(i.total_price_ngn || 0),
        method: i.payment_status === 'paid' ? 'corporate_billed' : 'room_charge'
      }));

      const allTxns = [...walkinTxns, ...inhouseTxns];
      const totalRev = allTxns.reduce((sum, t) => sum + t.amount, 0);

      setCloseOfDayReport({
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
      toast.error("Failed to compile Close of Day metrics: " + err.message, { id: toastId });
    } finally {
      setIsCompilingCloseOfDay(false);
    }
  };

  const handleConfirmCloseOfDayLaundry = async () => {
    if (!closeOfDayReport) return;
    const toastId = toast.loading("Closing day and saving reports...");
    try {
      const todayStr = closeOfDayReport.business_date;

      const closureRecord = {
        department: 'laundry',
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
        id: `dept_close_laundry_${todayStr}`,
        department: 'laundry',
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
        action: `Closed departmental ledger for LAUNDRY on date ${todayStr}. Revenue: ₦${closeOfDayReport.total_revenue.toLocaleString()}`,
        module: 'Accounting'
      });

      toast.success("✓ Laundry close of day completed successfully!", { id: toastId });
      setIsCloseOfDayModalOpen(false);
      setDepartmentalClosures(updatedClosures);
    } catch (err) {
      console.error(err);
      toast.error("Failed to close business day: " + err.message, { id: toastId });
    }
  };

  const fetchLaundryData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Fetch In-House Active Laundry Requests
      const { data: activeRequests, error: reqErr } = await supabase
        .from('booking_services')
        .select(`
          *,
          bookings (
            id,
            booking_reference,
            guest_name,
            status,
            bill_to_group,
            group_account_id,
            group_accounts (id, name),
            rooms (room_number),
            profiles (first_name, last_name, phone)
          ),
          services!inner (
            name,
            category
          )
        `)
        .or('category.eq.Laundry,name.ilike.%laundry%', { foreignTable: 'services' })
        .in('status', ['pending', 'confirmed', 'scheduled', 'in_progress'])
        .order('created_at', { ascending: false });

      if (reqErr) throw reqErr;
      
      // Filter out any entries that might be null due to inner join filtering limits
      // and ensure we only show requests for checked-in guests
      const resolvedRequests = (activeRequests || []).filter(r => r.bookings && r.services && r.bookings.status === 'checked_in');
      setInhouseRequests(resolvedRequests);

      // 2. Fetch Completed Inhouse Laundry History
      const { data: historyRequests, error: histErr } = await supabase
        .from('booking_services')
        .select(`
          *,
          bookings (
            booking_reference,
            guest_name,
            rooms (room_number),
            profiles (first_name, last_name)
          ),
          services!inner (
            name,
            category
          )
        `)
        .or('category.eq.Laundry,name.ilike.%laundry%', { foreignTable: 'services' })
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(50);
      
      if (histErr) throw histErr;
      setInhouseHistory((historyRequests || []).filter(h => h.bookings && h.services));

      // 3. Fetch Walk-in Laundry Sales from payments table (prefix LDY-POS-)
      const { data: walkinSales, error: saleErr } = await supabase
        .from('payments')
        .select('*')
        .ilike('transaction_ref', 'LDY-POS-%')
        .order('processed_at', { ascending: false });

      if (saleErr) throw saleErr;
      setWalkinPayments(walkinSales || []);

      // 4. Fetch Active In-House bookings to link laundry orders created manually by staff
      const { data: checkedInBookings, error: bookErr } = await supabase
        .from('bookings')
        .select('*, rooms(room_number)')
        .eq('status', 'checked_in')
        .order('guest_name');
      
      if (bookErr) throw bookErr;
      setActiveBookings(checkedInBookings || []);

    } catch (err) {
      console.error('Failed to load laundry data:', err);
      toast.error('Failed to retrieve laundry registries');
    } finally {
      setLoading(false);
    }
  };

  // Manage Room Laundry Status lifecycle (pending -> in_progress)
  const handleUpdateStatus = async (orderId, nextStatus) => {
    if (!hasAccess('Laundry - Process Laundry Orders')) {
      return toast.error("You do not have permission to process laundry orders.");
    }
    const loadingToast = toast.loading(`Updating order status to ${nextStatus.replace('_', ' ')}...`);
    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ status: nextStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success(`Laundry request marked as ${nextStatus.replace('_', ' ')}!`, { id: loadingToast });
      fetchLaundryData();
    } catch (err) {
      toast.error('Failed to update status', { id: loadingToast });
    }
  };

  // Open modal to post laundering fee & complete the service
  const handleOpenPostCharge = (order) => {
    setActiveProcessingOrder(order);
    setCustomCharge('');
    setChargeToGroup(order.bookings?.bill_to_group || false);
    
    // Extract original guest notes
    const guestInstructions = order.notes?.replace('laundry_request:', '').trim() || '';
    setLaunderingNotes(guestInstructions);
  };

  // Submit inhouse guest charge and post to stay folio
  const handlePostRoomChargeSubmit = async (e) => {
    e.preventDefault();
    if (!hasAccess('Laundry - Post Folio Charges')) {
      return toast.error("You do not have permission to post room folio laundry charges.");
    }
    if (!customCharge || isNaN(customCharge) || Number(customCharge) <= 0) {
      return toast.error("Please enter a valid laundering fee.");
    }

    setIsSubmittingCharge(true);
    const toastId = toast.loading("Processing and posting room folio charge...");

    try {
      const quantity = activeProcessingOrder.quantity || 1;
      const totalAmount = Number(customCharge);
      const unitPrice = totalAmount / quantity;
      
      const isBilledToGroup = activeProcessingOrder.bookings?.group_account_id && chargeToGroup;

      const formattedNotes = launderingNotes.trim()
        ? `laundry_completed: ${launderingNotes.trim()}${isBilledToGroup ? ' [Billed to Group]' : ''}`
        : `laundry_charge: ${activeProcessingOrder.quantity} item(s) processed.${isBilledToGroup ? ' [Billed to Group]' : ''}`;

      // Update booking_services which triggers stay folio trigger
      const { error } = await supabase
        .from('booking_services')
        .update({
          unit_price_ngn: unitPrice,
          total_price_ngn: totalAmount,
          notes: isBilledToGroup ? `laundry_completed_group: ${launderingNotes.trim() || 'Dry Cleaning'}` : formattedNotes,
          status: 'completed',
          payment_status: isBilledToGroup ? 'paid' : 'unpaid' // If billed to group, it's considered resolved on individual folio
        })
        .eq('id', activeProcessingOrder.id);

      if (error) throw error;

      if (isBilledToGroup) {
        // Increment group account outstanding balance
        const { data: groupAcc } = await supabase.from('group_accounts').select('outstanding_balance').eq('id', activeProcessingOrder.bookings.group_account_id).single();
        const currentOutstanding = Number(groupAcc?.outstanding_balance || 0);
        await supabase.from('group_accounts').update({ outstanding_balance: currentOutstanding + totalAmount }).eq('id', activeProcessingOrder.bookings.group_account_id);
        
        // Log payment inflow under method 'corporate_billed' so it registers in P&L ledger reports
        await supabase.from('payments').insert([{
          booking_id: activeProcessingOrder.booking_id,
          amount: totalAmount,
          method: 'corporate_billed',
          status: 'completed',
          notes: `Laundry Corporate Charge Billed to Account: ${activeProcessingOrder.bookings.group_accounts?.name || 'Company'} | Room ${activeProcessingOrder.bookings.rooms?.room_number} | Items: ${launderingNotes.trim() || 'Dry Cleaning'}`,
          transaction_ref: `CORP-CHG-LDY-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`
        }]);

        toast.success(`✓ NGN ${totalAmount.toLocaleString()} successfully billed to Corporate Group "${activeProcessingOrder.bookings.group_accounts?.name}"!`, { id: toastId });
      } else {
        toast.success(`✓ NGN ${totalAmount.toLocaleString()} successfully posted to Room stay folio!`, { id: toastId });
      }

      // Log system audit log
      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Completed laundry and posted charge of NGN ${totalAmount} ${isBilledToGroup ? 'to Group Account' : 'to Suite stay'} [Booking Ref: ${activeProcessingOrder.bookings?.booking_reference}]`,
          module: 'Laundry'
        });
      } catch (logErr) {
        console.error(logErr);
      }

      setActiveProcessingOrder(null);
      fetchLaundryData();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to post charge: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmittingCharge(false);
    }
  };

  // Register walkin direct sale
  const handleRegisterWalkinSubmit = async (e) => {
    e.preventDefault();
    if (!hasAccess('Laundry - Register Walk-in Sales')) {
      return toast.error("You do not have permission to register walk-in laundry sales.");
    }
    const { customerName, customerPhone, itemsDescription, quantity, chargeAmount, paymentMethod, isPaid } = walkinForm;

    if (!customerName || !customerPhone || !itemsDescription || !chargeAmount) {
      return toast.error("Please fill in all required walk-in customer details.");
    }
    if (isNaN(chargeAmount) || Number(chargeAmount) <= 0) {
      return toast.error("Please enter a valid charge amount.");
    }

    setIsRegisteringWalkin(true);
    const toastId = toast.loading("Registering walk-in transaction...");

    try {
      const transactionRef = `LDY-POS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const totalAmount = Number(chargeAmount);

      const notesText = `Walk-in Laundry Direct Sale | Customer: ${customerName} | Phone: ${customerPhone} | Email: ${walkinForm.customerEmail || 'N/A'} | Items: ${itemsDescription} (x${quantity})`;

      const payload = {
        booking_id: null, // Null indicates walkin
        processed_by: profile?.id,
        amount: totalAmount,
        currency: 'NGN',
        method: paymentMethod,
        transaction_ref: transactionRef,
        status: isPaid ? 'completed' : 'pending', // pending indicates payment on pickup
        notes: notesText
      };

      const { error } = await supabase.from('payments').insert([payload]);
      if (error) throw error;

      // Log system audit log
      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Registered walk-in laundry sale of NGN ${totalAmount} for ${customerName} (${isPaid ? 'Paid' : 'Unpaid'})`,
          module: 'Laundry'
        });
      } catch (logErr) {
        console.error(logErr);
      }

      toast.success(`✓ Walk-in Laundry transaction successfully created!`, { id: toastId });
      setShowWalkinForm(false);
      setWalkinForm({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        itemsDescription: '',
        quantity: 1,
        chargeAmount: '',
        paymentMethod: 'cash',
        isPaid: true
      });
      fetchLaundryData();
    } catch (err) {
      console.error(err);
      toast.error(`Registration failed: ${err.message}`, { id: toastId });
    } finally {
      setIsRegisteringWalkin(false);
    }
  };

  // Mark an unpaid walkin ticket as paid
  const handleMarkWalkinAsPaid = async (paymentId, currentNotes) => {
    if (!hasAccess('Laundry - Register Walk-in Sales')) {
      return toast.error("You do not have permission to settle walk-in laundry sales.");
    }
    const loadingToast = toast.loading("Confirming walk-in payment...");
    try {
      const updatedNotes = currentNotes.replace('Unpaid', 'Paid') + " | Settled on Pick-up";
      const { error } = await supabase
        .from('payments')
        .update({ 
          status: 'completed',
          notes: updatedNotes,
          processed_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;
      toast.success("✓ Payment completed and clothes marked as picked up!", { id: loadingToast });
      fetchLaundryData();
    } catch (err) {
      toast.error("Failed to complete transaction", { id: loadingToast });
    }
  };

  // Memoized Search Filter lists
  const filteredInhouse = useMemo(() => {
    if (!inhouseSearch) return inhouseRequests;
    return inhouseRequests.filter(req => {
      const gName = (req.bookings?.guest_name || req.bookings?.profiles?.first_name || '').toLowerCase();
      const rNum = (req.bookings?.rooms?.room_number || '').toLowerCase();
      const ref = (req.bookings?.booking_reference || '').toLowerCase();
      const notes = (req.notes || '').toLowerCase();
      
      return gName.includes(inhouseSearch.toLowerCase()) || 
             rNum.includes(inhouseSearch.toLowerCase()) ||
             ref.includes(inhouseSearch.toLowerCase()) ||
             notes.includes(inhouseSearch.toLowerCase());
    });
  }, [inhouseRequests, inhouseSearch]);

  const filteredWalkins = useMemo(() => {
    if (!walkinSearch) return walkinPayments;
    return walkinPayments.filter(sale => {
      const notes = (sale.notes || '').toLowerCase();
      const ref = (sale.transaction_ref || '').toLowerCase();
      return notes.includes(walkinSearch.toLowerCase()) || ref.includes(walkinSearch.toLowerCase());
    });
  }, [walkinPayments, walkinSearch]);

  const paginatedInhouse = useMemo(() => {
    const start = (currentPageInhouse - 1) * pageSize;
    return filteredInhouse.slice(start, start + pageSize);
  }, [filteredInhouse, currentPageInhouse, pageSize]);

  const paginatedWalkins = useMemo(() => {
    const start = (currentPageWalkin - 1) * pageSize;
    return filteredWalkins.slice(start, start + pageSize);
  }, [filteredWalkins, currentPageWalkin, pageSize]);

  const paginatedHistory = useMemo(() => {
    const start = (currentPageHistory - 1) * pageSize;
    return inhouseHistory.slice(start, start + pageSize);
  }, [inhouseHistory, currentPageHistory, pageSize]);

  // Earnings calculations
  const totalEarnings = useMemo(() => {
    const walkinPaid = walkinPayments
      .filter(s => s.status === 'completed')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const inhousePaid = inhouseHistory
      .reduce((sum, item) => sum + Number(item.total_price_ngn), 0);

    return walkinPaid + inhousePaid;
  }, [walkinPayments, inhouseHistory]);

  if (!hasAccess('Laundry')) {
    return <div className="p-8 text-center text-gray-500">You do not have permission to access the Laundry Department.</div>;
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isLaundryClosed = departmentalClosures.some(c => c.department === 'laundry' && c.business_date === todayStr);

  return (
    <div className="space-y-6 pb-20 text-white select-none">
      {isLaundryClosed && (
        <div className="bg-red-500/10 border-2 border-red-500/35 text-red-200 p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-red-500/5 animate-pulse">
          <AlertTriangle size={24} className="text-red-500 animate-bounce flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-white">Laundry Department Ledger Closed for Today</h4>
            <p className="text-xs text-red-300/95 mt-0.5 font-medium">
              All laundry operations including walk-in orders, laundering pickup actions, and completing charges are locked. Contact a super admin, admin or hotel manager to re-open the daily ledger.
            </p>
          </div>
        </div>
      )}
      
      {/* Header Panel */}
      <div className="bg-dark-800 border border-dark-700 p-6 flex flex-col md:flex-row justify-between items-center rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-lg flex items-center justify-center text-white shadow-md animate-pulse">
            <Shirt size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">Laundry Service Department</h1>
            <p className="text-gray-400 mt-1">Manage guest clothes processing, calculate drycleaning charges, and post stay folio logs.</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          {hasAccess('Laundry - Register Walk-in Sales') && (
            <button 
              onClick={() => {
                if (isLaundryClosed) return toast.error("Laundry operations are locked due to daily ledger closure.");
                setShowWalkinForm(true);
              }}
              disabled={isLaundryClosed}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-lg flex items-center gap-2 transition-all shadow-lg"
            >
              <Plus size={18} /> Register Walk-In Sale
            </button>
          )}
          {(() => {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const closure = departmentalClosures.find(c => c.department === 'laundry' && c.business_date === todayStr);
            return closure ? (
              <div className="bg-green-500/10 text-green-400 border border-green-500/25 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                <span>Closed today by {closure.staff_name}</span>
              </div>
            ) : (
              <button 
                onClick={handleCompileCloseOfDayLaundry}
                disabled={isCompilingCloseOfDay}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-dark-950 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Clock size={14} />
                <span>Close of Day</span>
              </button>
            );
          })()}
          <button 
            onClick={fetchLaundryData}
            className="bg-dark-700 hover:bg-dark-600 border border-dark-600 py-2.5 px-4 rounded-lg text-gray-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={16} /> Sync
          </button>
        </div>
      </div>

      {/* Laundry Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-yellow-500 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Pending Pickup</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {inhouseRequests.filter(r => r.status === 'pending').length} Order(s)
              </h3>
            </div>
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded"><Clock size={20} /></div>
          </div>
        </div>
        
        <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-blue-500 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Active washing</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {inhouseRequests.filter(r => r.status === 'scheduled' || r.status === 'in_progress').length} load(s)
              </h3>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded"><Droplets size={20} className="animate-bounce" /></div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-green-500 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Completed Today</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {inhouseHistory.length + walkinPayments.filter(s => s.status === 'completed').length} ticket(s)
              </h3>
            </div>
            <div className="p-2 bg-green-500/10 text-green-500 rounded"><CheckCircle size={20} /></div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 p-5 rounded-xl border-l-4 border-l-emerald-500 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Department Revenue</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">₦{totalEarnings.toLocaleString()}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded"><DollarSign size={20} /></div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b border-dark-700 overflow-x-auto select-none">
        <button 
          onClick={() => setActiveTab('inhouse')} 
          className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap text-sm ${activeTab === 'inhouse' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          <Users size={16} /> Suite Guests Processing ({inhouseRequests.length})
        </button>
        <button 
          onClick={() => setActiveTab('walkin')} 
          className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap text-sm ${activeTab === 'walkin' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          <ClipboardList size={16} /> Walk-In Sales Ledger ({walkinPayments.length})
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap text-sm ${activeTab === 'history' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          <CheckCircle size={16} /> Folio Charging History
        </button>
      </div>

      {/* Tab Panels */}
      {loading ? (
        <div className="text-center py-20 text-gray-500 flex flex-col items-center justify-center gap-3 bg-dark-800 border border-dark-700 rounded-xl">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Syncing laundry department databases...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: INHOUSE GUESTS */}
          {activeTab === 'inhouse' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl flex items-center gap-3">
                <Search size={18} className="text-gray-500 ml-2" />
                <input 
                  type="text"
                  placeholder="Search orders by Guest Name, Suite # or stay reservation ref..."
                  value={inhouseSearch}
                  onChange={e => setInhouseSearch(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm placeholder-gray-500 text-white"
                />
              </div>

              <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-dark-900 border-b border-dark-700 text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                        <th className="p-4">Suite #</th>
                        <th className="p-4">Guest stays details</th>
                        <th className="p-4">Estimated Items</th>
                        <th className="p-4">Laundering Description notes</th>
                        <th className="p-4">Laundering Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700/60">
                      {filteredInhouse.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-12 text-center text-gray-500 italic">No active laundry requests found matching query.</td>
                        </tr>
                      ) : (
                        paginatedInhouse.map(order => {
                          const guestName = order.bookings?.profiles 
                            ? `${order.bookings.profiles.first_name} ${order.bookings.profiles.last_name}`
                            : (order.bookings?.guest_name || 'N/A');
                          const roomNo = order.bookings?.rooms?.room_number || 'N/A';
                          const laundryNote = order.notes?.replace('laundry_request:', '').trim() || 'No special instructions';

                          return (
                            <tr key={order.id} className="hover:bg-dark-700/35 transition-colors">
                              <td className="p-4 font-black text-blue-400 text-base">{roomNo}</td>
                              <td className="p-4">
                                <p className="font-bold text-white">{guestName}</p>
                                <span className="text-[10px] text-gray-500 font-mono block mt-0.5 select-all">Ref: {order.bookings?.booking_reference}</span>
                              </td>
                              <td className="p-4 font-mono font-bold text-white text-center w-[120px]">
                                <span className="bg-dark-900 border border-dark-700 px-3 py-1 rounded text-xs inline-block">{order.quantity} item(s)</span>
                              </td>
                              <td className="p-4">
                                <div className="bg-dark-900/50 border border-dark-700/55 p-2 rounded text-xs text-gray-300 max-w-[300px] whitespace-pre-wrap leading-relaxed select-text">
                                  {laundryNote}
                                </div>
                              </td>
                              <td className="p-4">
                                {order.status === 'pending' ? (
                                  <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-extrabold uppercase px-2 py-1 rounded flex items-center gap-1.5 w-fit">
                                    <Clock size={12} /> Pending Collection
                                  </span>
                                ) : (
                                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-extrabold uppercase px-2 py-1 rounded flex items-center gap-1.5 w-fit animate-pulse">
                                    <Droplets size={12} className="animate-bounce" /> Laundering...
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex gap-2 justify-end">
                                  {order.status === 'pending' ? (
                                    <button 
                                      onClick={() => {
                                        if (isLaundryClosed) return toast.error("Laundry operations are locked due to daily ledger closure.");
                                        handleUpdateStatus(order.id, 'in_progress');
                                      }}
                                      disabled={isLaundryClosed}
                                      className="bg-blue-500 hover:bg-blue-600 text-dark-950 font-extrabold text-xs py-1.5 px-3 rounded shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      Pick Up & Wash
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        if (isLaundryClosed) return toast.error("Laundry operations are locked due to daily ledger closure.");
                                        handleOpenPostCharge(order);
                                      }}
                                      disabled={isLaundryClosed}
                                      className="bg-green-500 hover:bg-green-600 text-dark-950 font-extrabold text-xs py-1.5 px-3 rounded shadow transition-all flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <CheckCircle size={13} /> Complete & Post Folio Charge
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => {
                                      if (isLaundryClosed) return toast.error("Laundry operations are locked due to daily ledger closure.");
                                      handleUpdateStatus(order.id, 'cancelled');
                                    }}
                                    disabled={isLaundryClosed}
                                    className="bg-dark-700 hover:bg-red-500/20 hover:text-red-400 text-xs py-1.5 px-3 rounded border border-dark-600 transition-all text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControl
                  currentPage={currentPageInhouse}
                  totalItems={filteredInhouse.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPageInhouse}
                />
              </div>
            </div>
          )}

          {/* TAB 2: WALK-IN SALES */}
          {activeTab === 'walkin' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl flex items-center gap-3">
                <Search size={18} className="text-gray-500 ml-2" />
                <input 
                  type="text"
                  placeholder="Search walk-in customers by name, phone or laundry description..."
                  value={walkinSearch}
                  onChange={e => setWalkinSearch(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm placeholder-gray-500 text-white"
                />
              </div>

              <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-dark-900 border-b border-dark-700 text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                        <th className="p-4">Invoice Reference</th>
                        <th className="p-4">Customer Details</th>
                        <th className="p-4">Laundering Description notes</th>
                        <th className="p-4">Payment Method</th>
                        <th className="p-4">Total Fee</th>
                        <th className="p-4 text-right">Service status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700/60">
                      {filteredWalkins.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-12 text-center text-gray-500 italic">No walk-in laundry tickets recorded.</td>
                        </tr>
                      ) : (
                        paginatedWalkins.map(sale => {
                          // Parse customer details from notes: Notes contains: Customer: Emeka | Phone: +234 | Items: ...
                          const custMatch = sale.notes?.match(/Customer:\s*([^|]+)/);
                          const phoneMatch = sale.notes?.match(/Phone:\s*([^|]+)/);
                          const itemsMatch = sale.notes?.match(/Items:\s*(.+)$/);

                          const cName = custMatch ? custMatch[1].trim() : 'Walk-In Customer';
                          const cPhone = phoneMatch ? phoneMatch[1].trim() : 'N/A';
                          const itemsText = itemsMatch ? itemsMatch[1].trim() : sale.notes;

                          return (
                            <tr key={sale.id} className="hover:bg-dark-700/35 transition-colors">
                              <td className="p-4 font-mono font-bold text-gray-400 text-xs select-all">{sale.transaction_ref}</td>
                              <td className="p-4">
                                <p className="font-bold text-white">{cName}</p>
                                <span className="text-[10px] text-gray-500 font-mono block mt-0.5 select-all">{cPhone}</span>
                              </td>
                              <td className="p-4">
                                <div className="bg-dark-900/50 border border-dark-700/55 p-2 rounded text-xs text-gray-300 max-w-[300px] whitespace-pre-wrap leading-relaxed select-text font-medium">
                                  {itemsText}
                                </div>
                              </td>
                              <td className="p-4 uppercase font-bold text-xs text-gray-400">{sale.method}</td>
                              <td className="p-4 font-black text-emerald-400 text-base">₦{Number(sale.amount).toLocaleString()}</td>
                              <td className="p-4 text-right">
                                {sale.status === 'completed' ? (
                                  <span className="bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-extrabold uppercase px-2 py-1 rounded inline-block">
                                    ✓ Done & Paid
                                  </span>
                                ) : (
                                  hasAccess('Laundry - Register Walk-in Sales') ? (
                                    <button 
                                      onClick={() => {
                                        if (isLaundryClosed) return toast.error("Laundry operations are locked due to daily ledger closure.");
                                        handleMarkWalkinAsPaid(sale.id, sale.notes);
                                      }}
                                      disabled={isLaundryClosed}
                                      className="bg-yellow-500 hover:bg-yellow-600 text-dark-950 font-extrabold text-xs py-1.5 px-3 rounded shadow transition-all flex items-center gap-1.5 ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <CheckCircle size={12} /> Settle & Settle clothes
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-gray-500 italic block mt-1">Read-Only Ticket</span>
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControl
                  currentPage={currentPageWalkin}
                  totalItems={filteredWalkins.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPageWalkin}
                />
              </div>
            </div>
          )}

          {/* TAB 3: CHARGING HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-dark-900 border-b border-dark-700 text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                        <th className="p-4">Suite #</th>
                        <th className="p-4">Guest Details</th>
                        <th className="p-4">Order Reference</th>
                        <th className="p-4">Items / Processing Details</th>
                        <th className="p-4">Posted Date</th>
                        <th className="p-4 text-right">Laundering Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700/60">
                      {inhouseHistory.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-12 text-center text-gray-500 italic">No completed inhouse laundry logs.</td>
                        </tr>
                      ) : (
                        paginatedHistory.map(order => {
                          const guestName = order.bookings?.profiles 
                            ? `${order.bookings.profiles.first_name} ${order.bookings.profiles.last_name}`
                            : (order.bookings?.guest_name || 'N/A');
                          const roomNo = order.bookings?.rooms?.room_number || 'N/A';
                          const laundryNote = order.notes?.replace('laundry_completed:', '').trim() || 'Completed';

                          return (
                            <tr key={order.id} className="hover:bg-dark-700/35 transition-colors">
                              <td className="p-4 font-black text-blue-400 text-base">{roomNo}</td>
                              <td className="p-4 font-bold text-white">{guestName}</td>
                              <td className="p-4 font-mono text-gray-500 text-xs select-all">{order.bookings?.booking_reference}</td>
                              <td className="p-4">
                                <div className="bg-dark-900/50 border border-dark-700/55 p-2 rounded text-xs text-gray-300 max-w-[300px] whitespace-pre-wrap select-text leading-relaxed font-semibold">
                                  {laundryNote}
                                </div>
                              </td>
                              <td className="p-4 text-gray-400 text-xs">{format(new Date(order.updated_at), 'yyyy-MM-dd HH:mm')}</td>
                              <td className="p-4 text-right font-black text-emerald-400 text-base">₦{Number(order.total_price_ngn).toLocaleString()}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControl
                  currentPage={currentPageHistory}
                  totalItems={inhouseHistory.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPageHistory}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* --- MODAL: POST ROOM CHARGE & COMPLETE --- */}
      {activeProcessingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shirt className="text-blue-500" /> Complete Service & Post Room Charge
              </h2>
              <button 
                onClick={() => setActiveProcessingOrder(null)} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handlePostRoomChargeSubmit}>
              <div className="p-6 space-y-4">
                
                {/* Stay Info Card */}
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold uppercase">Suite Number:</span>
                    <span className="text-blue-400 font-black text-sm">Room {activeProcessingOrder.bookings?.rooms?.room_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold uppercase">In-House Guest:</span>
                    <span className="text-white font-bold">{activeProcessingOrder.bookings?.guest_name || 'Confirmed Guest'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold uppercase">Quantity requested:</span>
                    <span className="text-white font-bold">{activeProcessingOrder.quantity} item(s)</span>
                  </div>
                </div>

                {activeProcessingOrder.bookings?.group_account_id && (
                  <div className="bg-dark-900 border border-dark-750 p-4 rounded-xl space-y-2 animate-in fade-in duration-300">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                      💼 Group Corporate Billing
                    </label>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      This stay is linked to corporate group <strong>{activeProcessingOrder.bookings.group_accounts?.name || 'Company'}</strong>. Choose drycleaning billing target:
                    </p>
                    <div className="grid grid-cols-2 gap-2 bg-dark-800 p-1 rounded-lg border border-dark-700/50">
                      <button 
                        type="button"
                        onClick={() => setChargeToGroup(false)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all ${!chargeToGroup ? 'bg-dark-900 text-white border border-dark-700/60 shadow-sm' : 'text-gray-450 hover:text-white'}`}
                      >
                        Room Folio
                      </button>
                      <button 
                        type="button"
                        onClick={() => setChargeToGroup(true)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all ${chargeToGroup ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-gray-455 hover:text-white'}`}
                      >
                        Group Account
                      </button>
                    </div>
                  </div>
                )}

                {/* Processing details */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Processed Clothes Details / Laundering Notes</label>
                  <textarea 
                    value={launderingNotes}
                    onChange={e => setLaunderingNotes(e.target.value)}
                    placeholder="e.g., 3 white shirts ironed, 2 black trousers washed and pressed."
                    className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-3 text-xs outline-none focus:border-blue-500 min-h-[80px]"
                  />
                </div>

                {/* Pricing Fee */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Total Laundry Charge Fee (₦) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
                    <input 
                      type="number"
                      required
                      min="1"
                      placeholder="e.g., 5000"
                      value={customCharge}
                      onChange={e => setCustomCharge(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-700 text-white pl-8 pr-4 py-2.5 rounded-lg text-sm font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-lg flex items-start gap-2.5 text-[11px] text-gray-400 leading-relaxed">
                  <ShieldCheck className="text-blue-400 w-5 h-5 flex-shrink-0" />
                  <p>💡 Clicking complete will update the stay enhancements invoice folio with this custom Laundering Fee. The guest will settle this charge upon checking out of the hotel.</p>
                </div>
              </div>

              <div className="p-6 border-t border-dark-700 bg-dark-900/50 flex justify-end gap-3 rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => setActiveProcessingOrder(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingCharge}
                  className="bg-green-500 hover:bg-green-600 text-dark-950 font-extrabold text-xs py-2 px-5 rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmittingCharge ? 'Posting Folio...' : 'Post Charge & Complete Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: REGISTER WALK-IN CUSTOMER --- */}
      {showWalkinForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-dark-700 flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shirt className="text-blue-500" /> Register Walk-In Laundry Customer
              </h2>
              <button 
                onClick={() => setShowWalkinForm(false)} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleRegisterWalkinSubmit} className="overflow-y-auto flex-1 custom-scrollbar">
              <div className="p-6 space-y-4">
                
                {/* Customer Contact */}
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-blue-400">1. Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Customer Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                      <input 
                        type="text" required
                        placeholder="e.g. Chief Emeka"
                        value={walkinForm.customerName}
                        onChange={e => setWalkinForm({...walkinForm, customerName: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white pl-9 pr-3 py-2 text-xs rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                      <input 
                        type="tel" required
                        placeholder="e.g. +234803..."
                        value={walkinForm.customerPhone}
                        onChange={e => setWalkinForm({...walkinForm, customerPhone: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white pl-9 pr-3 py-2 text-xs rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Email Address (Optional)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                      <input 
                        type="email"
                        placeholder="e.g. customer@laundry.com"
                        value={walkinForm.customerEmail}
                        onChange={e => setWalkinForm({...walkinForm, customerEmail: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white pl-9 pr-3 py-2 text-xs rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Laundry Details */}
                <hr className="border-dark-700/50" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-blue-400">2. Laundry details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Clothes Description list *</label>
                    <textarea 
                      required
                      placeholder="e.g. 2 Native wears drycleaning, 3 Premium Cotton Suits."
                      value={walkinForm.itemsDescription}
                      onChange={e => setWalkinForm({...walkinForm, itemsDescription: e.target.value})}
                      className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-3 text-xs outline-none focus:border-blue-500 min-h-[60px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Total Quantity</label>
                      <input 
                        type="number" min="1" required
                        value={walkinForm.quantity}
                        onChange={e => setWalkinForm({...walkinForm, quantity: Number(e.target.value)})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 text-xs rounded-lg outline-none focus:border-blue-500 font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Custom laundering Charge (₦) *</label>
                      <input 
                        type="number" min="1" required
                        placeholder="e.g. 15000"
                        value={walkinForm.chargeAmount}
                        onChange={e => setWalkinForm({...walkinForm, chargeAmount: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 text-xs rounded-lg outline-none focus:border-blue-500 font-bold font-mono text-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Settle / Payment */}
                <hr className="border-dark-700/50" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-blue-400">3. Settlement Status</h3>
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-300">
                      <input 
                        type="radio" 
                        name="isPaid" 
                        checked={walkinForm.isPaid === true}
                        onChange={() => setWalkinForm({...walkinForm, isPaid: true})}
                        className="accent-blue-500 w-4 h-4"
                      />
                      <span>Paid Immediately (Cash/POS Checkout)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-300">
                      <input 
                        type="radio" 
                        name="isPaid" 
                        checked={walkinForm.isPaid === false}
                        onChange={() => setWalkinForm({...walkinForm, isPaid: false})}
                        className="accent-blue-500 w-4 h-4"
                      />
                      <span>Deferred Billing (Pay on Pick-up)</span>
                    </label>
                  </div>

                  {walkinForm.isPaid && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Payment Method</label>
                      <select 
                        value={walkinForm.paymentMethod}
                        onChange={e => setWalkinForm({...walkinForm, paymentMethod: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 text-xs rounded-lg outline-none focus:border-blue-500 capitalize"
                      >
                        {PRICING_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-lg flex items-start gap-2.5 text-[11px] text-gray-400 leading-relaxed mt-2">
                  <ShieldCheck className="text-emerald-400 w-5 h-5 flex-shrink-0" />
                  <p>💡 Submitting this walk-in registry registers the transaction directly as a cash/POS receipt in the general ledger. It will instantly update accounting inflows under the "Laundry Revenue" category.</p>
                </div>
              </div>

              <div className="p-6 border-t border-dark-700 bg-dark-900/50 flex justify-end gap-3 rounded-b-2xl flex-shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowWalkinForm(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isRegisteringWalkin}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-2 px-5 rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  {isRegisteringWalkin ? 'Processing...' : 'Register Walk-In Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CLOSE OF DAY --- */}
      {isCloseOfDayModalOpen && closeOfDayReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-dark-800 rounded-3xl border border-dark-700 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center p-6 border-b border-dark-700 bg-dark-900 rounded-t-3xl">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Clock className="text-amber-500" size={20} />
                Laundry Department - Close of Day Verification
              </h2>
              <button 
                onClick={() => setIsCloseOfDayModalOpen(false)} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-400 block mb-1">Consolidated Revenue</span>
                  <span className="text-2xl font-black text-white">₦{closeOfDayReport.total_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">{closeOfDayReport.total_count} total transactions</span>
                </div>
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-400 block mb-1">Walk-in Sales Revenue</span>
                  <span className="text-2xl font-black text-blue-400">₦{closeOfDayReport.total_walkin_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">{closeOfDayReport.walkin_txns.length} walk-in receipts</span>
                </div>
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-400 block mb-1">In-house Guest Revenue</span>
                  <span className="text-2xl font-black text-brand-500">₦{closeOfDayReport.total_inhouse_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">{closeOfDayReport.inhouse_txns.length} stay folio charges</span>
                </div>
              </div>

              {/* Walk-in Sales */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 border-b border-dark-700 pb-2">
                  <ClipboardList size={14} />
                  Walk-In Direct Sales Receipts
                </h3>
                {closeOfDayReport.walkin_txns.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No walk-in sales recorded today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-dark-750 text-gray-400 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Reference / Customer</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750">
                        {closeOfDayReport.walkin_txns.map((t, idx) => (
                          <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                            <td className="py-2.5 px-3 font-mono text-gray-500">{t.time}</td>
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

              {/* In-house Folio Charges */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-2 border-b border-dark-700 pb-2">
                  <Users size={14} />
                  In-House Suite Stay Folio Charges
                </h3>
                {closeOfDayReport.inhouse_txns.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No in-house guest laundry charges recorded today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-dark-750 text-gray-400 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Booking Ref</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750">
                        {closeOfDayReport.inhouse_txns.map((t, idx) => (
                          <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                            <td className="py-2.5 px-3 font-mono text-gray-500">{t.time}</td>
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
                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmCloseOfDayLaundry}
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

export default AdminLaundry;

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import toast from 'react-hot-toast';
import { FileText, CreditCard, Download, Search, CheckCircle, RefreshCcw, DollarSign, Wallet, ArrowRightLeft, Printer, Eye, X, AlertTriangle, Wrench, CalendarClock, Landmark } from 'lucide-react';
import { format, addMonths, addYears } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import Accounting from './Accounting';
import { triggerAutomationRules, sendResendEmail, sendSMSNotification } from '../../lib/emailService';
import { usePaystackPayment } from 'react-paystack';
const PaginationControl = ({ currentPage, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-dark-700 bg-dark-900/30 px-4 py-3 sm:px-6 mt-4 rounded-b-lg">
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

const AdminBilling = ({ isFrontOfficeClosed }) => {
  const { hasAccess } = useAuth();
  
  const [paystackConfig, setPaystackConfig] = useState({
    reference: '',
    email: '',
    amount: 0,
    publicKey: ''
  });
  const initializePaystack = usePaystackPayment(paystackConfig);

  useEffect(() => {
    if (paystackConfig && paystackConfig.amount > 0 && paystackConfig.publicKey) {
      initializePaystack(
        (reference) => {
          handlePaystackSuccess(reference, paystackConfig.amount / 100);
          setPaystackConfig({ reference: '', email: '', amount: 0, publicKey: '' });
        },
        () => {
          toast.error("Paystack payment cancelled.");
          setPaystackConfig({ reference: '', email: '', amount: 0, publicKey: '' });
        }
      );
    }
  }, [paystackConfig]);

  const [activeTab, setActiveTab] = useState('invoices'); // invoices or accounting
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, pendingReceivables: 0, taxCollected: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const [pendingServicePayments, setPendingServicePayments] = useState([]);
  const [pendingCheckoutPayments, setPendingCheckoutPayments] = useState([]);
  const [specialistPayouts, setSpecialistPayouts] = useState([]);
  const [specialistPayoutTab, setSpecialistPayoutTab] = useState('pending'); // 'pending' | 'history'
  const [isPayoutReceiptModalOpen, setIsPayoutReceiptModalOpen] = useState(false);
  const [activePayoutReceipt, setActivePayoutReceipt] = useState(null);
  const [reminderPayouts, setReminderPayouts] = useState([]);
  const [nigerianBanks, setNigerianBanks] = useState([]);
  const [hallPayouts, setHallPayouts] = useState([]);
  const [hallBookingMeals, setHallBookingMeals] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [printType, setPrintType] = useState('a4'); // a4 or thermal
  const [contactInfo, setContactInfo] = useState({
    address: 'Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja',
    phone: '08033214684, 08062332639, 08171278657',
    email: 'info@sparklesapartments.ng',
    logo: ''
  });

  // Modals
  const [activePaymentModal, setActivePaymentModal] = useState(null); // stores invoice obj
  const [activeRefundModal, setActiveRefundModal] = useState(null);
  const [activeInvoiceModal, setActiveInvoiceModal] = useState(null); // stores invoice obj for viewing/printing
  const [activeHallPayoutModal, setActiveHallPayoutModal] = useState(null); // stores hallBooking for payment confirmation

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paystack');
  const [isProcessing, setIsProcessing] = useState(false);

  const [paystackPublicKey, setPaystackPublicKey] = useState('');

  // Refund Bank & OTP States
  const [refundBankName, setRefundBankName] = useState('');
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [refundAccountName, setRefundAccountName] = useState('');
  
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [managerPhoneDisplay, setManagerPhoneDisplay] = useState('');

  // Refund Settlements states
  const [refundSettlements, setRefundSettlements] = useState([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [settlementFilter, setSettlementFilter] = useState('all'); // 'all', 'daily', 'weekly', 'monthly'

  // Pagination states
  const [currentPageInvoices, setCurrentPageInvoices] = useState(1);
  const [currentPagePayouts, setCurrentPagePayouts] = useState(1);
  const [currentPageService, setCurrentPageService] = useState(1);
  const [currentPageCheckout, setCurrentPageCheckout] = useState(1);
  const [currentPageSettlements, setCurrentPageSettlements] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchInvoices();
    fetchContactSettings();
    fetchSpecialistPayouts();
    fetchReminderPayouts();
    fetchHallPayouts();
    fetchRefundSettlements();
  }, []);

  // Real-time synchronization for invoices, bookings, booking_services, payments, maintenance_payments, reminders, refund_settlements, hall_bookings
  useRealtimeSync(['invoices', 'bookings', 'booking_services', 'payments', 'maintenance_payments', 'reminders', 'refund_settlements', 'hall_bookings'], () => {
    fetchInvoices(false);
    fetchSpecialistPayouts();
    fetchReminderPayouts();
    fetchHallPayouts();
    fetchRefundSettlements();
  });

  const fetchRefundSettlements = async () => {
    setSettlementsLoading(true);
    try {
      const { data, error } = await supabase
        .from('refund_settlements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRefundSettlements(data || []);
    } catch (err) {
      console.warn("Failed to fetch refund settlements from database, checking local storage:", err);
      const localSettlements = JSON.parse(localStorage.getItem('pms_refund_settlements') || '[]');
      setRefundSettlements(localSettlements);
    } finally {
      setSettlementsLoading(false);
    }
  };

  const fetchContactSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['contact_address', 'contact_phone', 'contact_email', 'contact_logo', 'paystack_public', 'nigerian_banks']);
        
      if (!error && data) {
        const settingsMap = data.reduce((acc, curr) => {
          acc[curr.setting_key] = curr.setting_value;
          return acc;
        }, {});
        
        setContactInfo(prev => ({
          address: settingsMap.contact_address || prev.address,
          phone: settingsMap.contact_phone || prev.phone,
          email: settingsMap.contact_email || prev.email,
          logo: settingsMap.contact_logo || prev.logo
        }));

        setPaystackPublicKey(settingsMap.paystack_public || '');

        // Load Nigerian banks list from settings
        try {
          const banksRaw = settingsMap.nigerian_banks;
          if (banksRaw) {
            const parsed = typeof banksRaw === 'string' ? JSON.parse(banksRaw) : banksRaw;
            if (Array.isArray(parsed)) setNigerianBanks(parsed);
          }
        } catch (banksErr) {
          console.warn('Failed to parse nigerian_banks from settings:', banksErr);
        }
      }
    } catch (e) {
      console.error("Failed to load contact settings:", e);
    }
  };

  const fetchInvoices = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          bookings (
            id,
            status,
            id_verified,
            crm_guest_id,
            guest_email,
            booking_reference,
            guest_name,
            check_in_date,
            check_out_date,
            total_room_price_ngn,
            total_extras_price_ngn,
            discount_amount_ngn,
            profiles (first_name, last_name, phone),
            rooms (name, room_number),
            booking_services (
              id,
              quantity,
              total_price_ngn,
              unit_price_ngn,
              payment_status,
              status,
              services (name, tax_inclusive)
            )
          ),
          hall_bookings (
            id,
            status,
            guest_email,
            booking_reference,
            guest_name,
            guest_phone,
            booking_date,
            booking_type,
            start_time,
            end_time,
            num_days,
            num_hours,
            number_of_participants,
            total_hall_price_ngn,
            total_meals_price_ngn,
            total_amount_ngn,
            amount_paid_ngn,
            payment_status,
            halls (name, capacity)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const { data: bookingsData } = await supabase.from('bookings').select('amount_paid_ngn');

      setInvoices(data || []);

      // Fetch pending stay enhancements awaiting payment confirmation
      try {
        const { data: servicesRes } = await supabase
          .from('booking_services')
          .select('*, bookings(id, crm_guest_id, booking_reference, guest_name, guest_email, guest_phone, amount_paid_ngn, status), services(name, base_price_ngn, tax_inclusive)')
          .eq('payment_status', 'awaiting_confirmation')
          .eq('status', 'pending');
        if (servicesRes) {
          const activeServices = servicesRes.filter(s => s.bookings?.status !== 'cancelled');
          setPendingServicePayments(activeServices);
        }
      } catch (srvErr) {
        console.warn("Failed to fetch pending service payments:", srvErr);
      }

      // Fetch pending checkout payments
      try {
        const { data: checkoutRes } = await supabase
          .from('payments')
          .select('*, bookings(id, booking_reference, guest_name, guest_email, guest_phone, amount_paid_ngn, total_amount_ngn, status, rooms(room_number))')
          .eq('status', 'pending');
        if (checkoutRes) {
          const activeCheckoutPayments = checkoutRes.filter(p => p.bookings?.status !== 'cancelled');
          setPendingCheckoutPayments(activeCheckoutPayments);
        }
      } catch (chkErr) {
        console.warn("Failed to fetch pending checkout payments:", chkErr);
      }

      // Calculate Stats
      let revenue = 0;
      let pending = 0;
      let tax = 0;

      // Calculate Total Revenue using bookings (to match Dashboard exactly)
      if (bookingsData) {
        revenue = bookingsData.reduce((sum, b) => sum + Number(b.amount_paid_ngn || 0), 0);
      }

      data?.forEach(inv => {
        if (inv.bookings?.status === 'cancelled') return;
        
        if (Number(inv.total_amount) > 0) {
          tax += (Number(inv.amount_paid || 0) / Number(inv.total_amount)) * Number(inv.tax_amount || 0);
        }
        if (inv.status !== 'paid' && inv.status !== 'cancelled') {
          pending += (Number(inv.total_amount || 0) - Number(inv.amount_paid || 0));
        }
      });

      setStats({ totalRevenue: revenue, pendingReceivables: pending, taxCollected: tax });
    } catch (error) {
      console.error("Billing Fetch Error:", error);
      setFetchError(error.message || JSON.stringify(error));
      toast.error('Failed to load billing data');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchSpecialistPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_payments')
        .select(`
          *,
          professional:professional_id (
            id,
            name,
            phone,
            email,
            trade_specialty,
            bank_name,
            account_number,
            account_name
          )
        `)
        .in('payment_status', ['approved', 'paid'])
        .not('professional_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSpecialistPayouts(data || []);
    } catch (err) {
      console.warn("Failed to fetch specialist payouts from database, checking local storage:", err);
      const localPayments = JSON.parse(localStorage.getItem('pms_maintenance_payments') || '[]');
      const localProfs = JSON.parse(localStorage.getItem('pms_maintenance_professionals') || '[]');
      
      const approvedSpecialistPayments = localPayments
        .filter(p => ['approved', 'paid'].includes(p.payment_status) && p.professional_id)
        .map(p => {
          const prof = localProfs.find(pr => pr.id === p.professional_id);
          return {
            ...p,
            professional: prof || { name: 'Unknown Specialist', email: '', bank_name: '', account_number: '', account_name: '' }
          };
        });
      setSpecialistPayouts(approvedSpecialistPayments);
    }
  };

  const fetchReminderPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('status', 'approved')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setReminderPayouts(data || []);
    } catch (err) {
      console.warn('Failed to fetch reminder payouts:', err);
      setReminderPayouts([]);
    }
  };

  const fetchHallPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('hall_bookings')
        .select('*, halls(*)')
        .eq('status', 'pending')
        .order('booking_date', { ascending: true });

      if (error) throw error;
      setHallPayouts(data || []);
    } catch (err) {
      console.warn('Failed to fetch pending hall bookings for payouts:', err);
      setHallPayouts([]);
    }
  };

  const fetchHallBookingMeals = async (hallBookingId) => {
    try {
      const { data, error } = await supabase
        .from('hall_booking_meals')
        .select('*, hall_meal_options(name)')
        .eq('hall_booking_id', hallBookingId)
        .order('serving_date', { ascending: true });
      if (error) throw error;
      setHallBookingMeals(data || []);
    } catch (err) {
      console.warn("Failed to fetch hall booking meals:", err);
      setHallBookingMeals([]);
    }
  };

  useEffect(() => {
    if (activeInvoiceModal && activeInvoiceModal.hall_bookings) {
      fetchHallBookingMeals(activeInvoiceModal.hall_bookings.id);
    } else {
      setHallBookingMeals([]);
    }
  }, [activeInvoiceModal]);

  const handleConfirmHallPayoutSubmit = async (e) => {
    e.preventDefault();
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }

    const hallBooking = activeHallPayoutModal;
    if (!hallBooking) return;

    const totalAmount = Number(hallBooking.total_amount_ngn || 0);
    const alreadyPaid = Number(hallBooking.amount_paid_ngn || 0);
    const outstanding = totalAmount - alreadyPaid;

    if (outstanding <= 0) {
      toast.error("This booking is already fully paid.");
      return;
    }

    const amountToPay = Number(paymentAmount);
    if (isNaN(amountToPay) || amountToPay <= 0) {
      toast.error("Invalid payment amount.");
      return;
    }

    if (amountToPay > outstanding) {
      toast.error(`Payment amount exceeds the outstanding balance of ₦${outstanding.toLocaleString()}.`);
      return;
    }

    const newAmountPaid = alreadyPaid + amountToPay;
    const isFullyPaid = newAmountPaid >= totalAmount;
    const newPaymentStatus = isFullyPaid ? 'paid' : 'partial';
    const newBookingStatus = isFullyPaid ? 'confirmed' : hallBooking.status;

    const toastId = toast.loading('Confirming hall booking payment...');
    try {
      // 1. Update hall_bookings
      const { error: hbErr } = await supabase
        .from('hall_bookings')
        .update({ 
          status: newBookingStatus,
          payment_status: newPaymentStatus,
          amount_paid_ngn: newAmountPaid
        })
        .eq('id', hallBooking.id);
      
      if (hbErr) throw hbErr;

      // 2. Update invoice status
      try {
        const { data: invData } = await supabase
          .from('invoices')
          .select('id')
          .eq('hall_booking_id', hallBooking.id)
          .maybeSingle();

        if (invData) {
          await supabase
            .from('invoices')
            .update({ 
              status: newPaymentStatus,
              amount_paid: newAmountPaid
            })
            .eq('id', invData.id);
        }
      } catch (invSyncErr) {
        console.warn("Invoice status update failed in hall payout confirmation:", invSyncErr);
      }

      // 3. Record Payment inflow
      const txnRef = `PAY-HALL-CONF-${Date.now()}`;
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          hall_booking_id: hallBooking.id,
          amount: amountToPay,
          method: 'bank_transfer', // Default to bank_transfer for finance confirmations
          status: 'completed',
          transaction_ref: txnRef,
          notes: `Hall Booking payment confirmed by finance: Ref: ${hallBooking.booking_reference} | Guest: ${hallBooking.guest_name}`
        }]);

      if (payErr) throw payErr;

      // Print receipt in new window
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const formattedDate = format(new Date(), 'MMM dd, yyyy, HH:mm');
          printWindow.document.write(`
            <html>
              <head>
                <title>Payment Receipt - Hall Booking ${hallBooking.booking_reference}</title>
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
                <p class="title">Hall Booking Receipt</p>
                <table>
                  <tr><td>Booking Ref:</td><td>${hallBooking.booking_reference}</td></tr>
                  <tr><td>Guest Name:</td><td>${hallBooking.guest_name}</td></tr>
                  <tr><td>Event Hall:</td><td>${hallBooking.halls?.name || 'Event Space'}</td></tr>
                  <tr><td>Event Date:</td><td>${hallBooking.booking_date}</td></tr>
                  <tr><td>Duration:</td><td>${hallBooking.booking_type === 'daily' ? `${hallBooking.num_days} Day(s)` : `${hallBooking.num_hours} Hour(s)`}</td></tr>
                  <tr><td>Payment Date:</td><td>${formattedDate}</td></tr>
                  <tr><td>Transaction Ref:</td><td style="font-family: monospace; font-weight: bold;">${txnRef}</td></tr>
                  <tr><td>Status:</td><td style="color: ${isFullyPaid ? '#059669' : '#d97706'}; font-weight: bold;">${isFullyPaid ? 'PAID / CONFIRMED' : 'PARTIAL / DEPOSIT'}</td></tr>
                  ${!isFullyPaid ? `<tr><td>Outstanding Balance:</td><td style="color: #dc2626; font-weight: bold;">₦${(totalAmount - newAmountPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
                </table>
                <div class="amount">₦${amountToPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div class="footer">
                  <p>Authorized and confirmed by Sparkles Apartments Finance Department.</p>
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          printWindow.close();
        }
      } catch (printErr) { console.warn('Receipt print failed:', printErr); }
      
      toast.success('Hall Booking payment confirmed successfully!', { id: toastId });
      setActiveHallPayoutModal(null);
      setPaymentAmount('');
      fetchHallPayouts();
      fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error('Failed to confirm hall booking payment: ' + err.message, { id: toastId });
    }
  };

  const handleCancelHallBookingPayment = async (invoiceId, hallBookingId) => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    if (!window.confirm("Are you sure you want to cancel / decline this hall booking due to failed payment?")) return;
    
    const toastId = toast.loading('Cancelling hall booking and invoice...');
    try {
      // 1. Update hall_bookings status to cancelled
      const { error: hbErr } = await supabase
        .from('hall_bookings')
        .update({ status: 'cancelled' })
        .eq('id', hallBookingId);
      if (hbErr) throw hbErr;

      // 2. Update invoice status to cancelled
      const { error: invoiceErr } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoiceId);
      if (invoiceErr) throw invoiceErr;

      // 3. Update hall_booking_meals status to cancelled
      try {
        await supabase
          .from('hall_booking_meals')
          .update({ status: 'cancelled' })
          .eq('hall_booking_id', hallBookingId);
      } catch (srvErr) {
        console.warn("Failed to cancel kitchen catering items:", srvErr);
      }

      // 4. Update payments status to cancelled (if any exist)
      try {
        await supabase
          .from('payments')
          .update({ status: 'cancelled' })
          .eq('hall_booking_id', hallBookingId);
      } catch (payErr) {
        console.warn("Failed to cancel payments:", payErr);
      }

      toast.success('Hall booking and invoice successfully cancelled!', { id: toastId });
      fetchHallPayouts();
      fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel: ' + err.message, { id: toastId });
    }
  };

  // Confirm payment of a Reminder/Subscription payout → marks reminder as 'paid', updates expense to 'paid', rollover recurrence
  const handleConfirmReminderPayout = async (reminder) => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    if (!window.confirm(`Confirm payment of ₦${Number(reminder.amount_ngn || 0).toLocaleString()} for "${reminder.title}"? This will finalize the expense ledger entry and print a receipt.`)) return;

    const toastId = toast.loading('Confirming reminder payment...');
    const txRef = `TX-REM-${Date.now().toString().slice(-6)}`;
    const paidDate = new Date().toISOString();

    try {
      // 1. Mark reminder as 'paid'
      const { error: remErr } = await supabase
        .from('reminders')
        .update({ status: 'paid' })
        .eq('id', reminder.id);
      if (remErr) throw remErr;

      // 2. Update related pending expense to 'paid'
      try {
        await supabase
          .from('expenses')
          .update({ status: 'paid', payment_method: 'bank_transfer' })
          .eq('reminder_id', reminder.id)
          .eq('status', 'pending');
      } catch (expErr) {
        console.warn('Could not update pending expense to paid for reminder:', expErr);
        // Fallback: insert a paid expense
        try {
          const categoryMapping = {
            'Subscription': 'Utilities', 'Utility': 'Utilities',
            'Maintenance': 'Maintenance', 'Tax': 'Taxes', 'License': 'Utilities'
          };
          await supabase.from('expenses').insert([{
            amount: Number(reminder.amount_ngn || 0),
            category: categoryMapping[reminder.category] || 'Other',
            description: `Settled: ${reminder.title}. Tx Ref: ${txRef}`,
            expense_date: paidDate.split('T')[0],
            paid_to: reminder.title,
            payment_method: 'bank_transfer',
            status: 'paid'
          }]);
        } catch (expInsertErr) { console.warn('Expense fallback insert failed:', expInsertErr); }
      }

      // 3. Rollover recurrence — create next pending reminder
      if (reminder.recurrence && reminder.recurrence !== 'none') {
        try {
          const currentDate = new Date(reminder.due_date);
          let nextDueDate;
          if (reminder.recurrence === 'monthly') nextDueDate = addMonths(currentDate, 1);
          else if (reminder.recurrence === 'yearly') nextDueDate = addYears(currentDate, 1);
          
          if (nextDueDate) {
            await supabase.from('reminders').insert([{
              title: reminder.title,
              description: reminder.description,
              due_date: format(nextDueDate, 'yyyy-MM-dd'),
              amount_ngn: reminder.amount_ngn,
              recurrence: reminder.recurrence,
              category: reminder.category,
              status: 'pending',
              assigned_to: reminder.assigned_to
            }]);
          }
        } catch (rolloverErr) {
          console.warn('Failed to rollover recurrence:', rolloverErr);
        }
      }

      // 4. Print receipt in new window
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Payment Receipt - ${reminder.title}</title>
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
                <p class="title">Payment Receipt</p>
                <table>
                  <tr><td>Description:</td><td>${reminder.title}</td></tr>
                  <tr><td>Category:</td><td>${reminder.category}</td></tr>
                  <tr><td>Payment Date:</td><td>${format(new Date(paidDate), 'MMM dd, yyyy, HH:mm')}</td></tr>
                  <tr><td>Transaction Ref:</td><td style="font-family: monospace; font-weight: bold;">${txRef}</td></tr>
                  <tr><td>Recurrence:</td><td>${reminder.recurrence === 'none' ? 'One-time payment' : reminder.recurrence}</td></tr>
                  <tr><td>Status:</td><td style="color: #059669; font-weight: bold;">PAID</td></tr>
                </table>
                <div class="amount">₦${Number(reminder.amount_ngn || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div class="footer">
                  <p>Authorized and confirmed by Sparkles Apartments Finance Department.</p>
                  ${reminder.recurrence !== 'none' ? '<p style="color: #f59e0b; font-weight: bold;">Next recurrence reminder has been automatically scheduled.</p>' : ''}
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          printWindow.close();
        }
      } catch (printErr) { console.warn('Receipt print failed:', printErr); }

      toast.success(`✓ Payment of ₦${Number(reminder.amount_ngn || 0).toLocaleString()} confirmed and receipt printed!${reminder.recurrence !== 'none' ? ' Next recurrence scheduled.' : ''}`, { id: toastId });
      fetchReminderPayouts();
      fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error('Failed to confirm reminder payment', { id: toastId });
    }
  };

  const handleProcessSpecialistPayout = async (payout, payoutMethod = 'bank_transfer') => {

    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    const toastId = toast.loading(`Processing payout of ₦${Number(payout.amount_ngn).toLocaleString()} to specialist...`);
    try {
      const txRef = `TX-PAYOUT-${Date.now().toString().slice(-4)}`;
      const paidDate = new Date().toISOString();

      // 1. Update the payout status to paid in maintenance_payments
      const { error: payErr } = await supabase
        .from('maintenance_payments')
        .update({
          payment_status: 'paid',
          paid_at: paidDate,
          payment_method: payoutMethod,
          transaction_reference: txRef
        })
        .eq('id', payout.id);

      if (payErr) throw payErr;

      // 2. Update the related pending expense to 'paid'
      try {
        await supabase
          .from('expenses')
          .update({ status: 'paid', payment_method: payoutMethod, description: `Maintenance disbursement: ${payout.professional?.name || 'Specialist'}. Tx Ref: ${txRef}. Notes: ${payout.notes || 'None'}` })
          .eq('maintenance_payment_id', payout.id)
          .eq('status', 'pending');
      } catch (expUpdateErr) {
        console.warn('Could not update pending expense to paid:', expUpdateErr);
        // Fallback: insert new paid expense record
        try {
          await supabase.from('expenses').insert([{
            amount: Number(payout.amount_ngn),
            category: 'Maintenance',
            description: `Maintenance disbursement paid: ${payout.professional?.name || 'Specialist'}. Ref: ${txRef}`,
            expense_date: paidDate.split('T')[0],
            paid_to: payout.professional?.name || 'Maintenance Specialist',
            payment_method: payoutMethod,
            status: 'paid'
          }]);
        } catch (expInsertErr) { console.warn('Expense insert fallback failed:', expInsertErr); }
      }

      // 3. Send email receipt automatically to specialist's email!
      let emailSent = false;
      const specialistEmail = payout.professional?.email;
      if (specialistEmail) {
        try {
          const receiptHtml = `
            <div style="font-family: 'Outfit', sans-serif; padding: 40px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-top: 8px solid #DF6853; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 25px; margin-bottom: 25px;">
                ${contactInfo.logo ? `<img src="${contactInfo.logo}" alt="Sparkles Apartments" style="max-height: 50px; object-fit: contain; margin-bottom: 8px; border-radius: 4px;" />` : ''}
                <h2 style="color: #000000; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.05em;">SPARKLES APARTMENTS</h2>
                <span style="font-size: 11px; color: #DF6853; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">Premium Luxury Shortlets</span>
              </div>
              
              <div style="margin-bottom: 30px;">
                <h3 style="color: #111827; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 15px; border-left: 4px solid #DF6853; padding-left: 10px;">Payment Disbursement Receipt</h3>
                <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0;">
                  Dear <strong>${payout.professional?.name || 'Partner'}</strong>,
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-top: 10px; margin-bottom: 0;">
                  This is to confirm that a payout of <strong>₦${Number(payout.amount_ngn).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> has been successfully processed for the maintenance services carried out at Sparkles Apartments.
                </p>
              </div>

              <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
                <h4 style="color: #374151; font-size: 13px; font-weight: 700; margin-top: 0; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.05em;">Disbursement Transaction Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #4b5563;">
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; width: 45%;">Specialty:</td>
                    <td style="padding: 6px 0; color: #111827;">${payout.professional?.trade_specialty || 'General Repair'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold;">Disbursed Amount:</td>
                    <td style="padding: 6px 0; color: #df6853; font-weight: bold; font-size: 15px;">₦${Number(payout.amount_ngn).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold;">Payment Method:</td>
                    <td style="padding: 6px 0; color: #111827; text-transform: capitalize;">${payoutMethod.replace('_', ' ')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold;">Tx Reference:</td>
                    <td style="padding: 6px 0; color: #111827; font-family: monospace; font-weight: bold;">${txRef}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold;">Payment Date:</td>
                    <td style="padding: 6px 0; color: #111827;">${format(new Date(paidDate), 'MMM dd, yyyy, HH:mm')}</td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
                <h4 style="color: #b45309; font-size: 13px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Specialist Settlement Bank Account</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #4b5563;">
                  <tr>
                    <td style="padding: 4px 0; font-weight: bold; width: 45%;">Bank Name:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 600;">${payout.professional?.bank_name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-weight: bold;">Account Number:</td>
                    <td style="padding: 4px 0; color: #111827; font-family: monospace; font-size: 14px; font-weight: bold;">${payout.professional?.account_number || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-weight: bold;">Account Name:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: 600;">${payout.professional?.account_name || 'N/A'}</td>
                  </tr>
                </table>
              </div>

              ${payout.notes ? `
              <div style="margin-bottom: 30px; font-size: 13px; color: #6b7280; line-height: 1.5; border-top: 1px solid #f3f4f6; padding-top: 15px;">
                <strong>Service Notes:</strong><br/>
                <em>${payout.notes}</em>
              </div>
              ` : ''}

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
                <p style="margin: 0 0 5px 0;">This is an official automated disbursement confirmation from Sparkles Apartments.</p>
                <p style="margin: 0;">${contactInfo.address}</p>
                <p style="margin: 5px 0 0 0;">Phones: ${contactInfo.phone} | Email: ${contactInfo.email}</p>
              </div>
            </div>
          `;

          const emailRes = await sendResendEmail({
            to: specialistEmail,
            subject: `Payment Receipt: ₦${Number(payout.amount_ngn).toLocaleString()} - Sparkles Apartments`,
            from: 'booking@sparklesapartments.ng',
            html: receiptHtml
          });
          
          if (emailRes?.success) emailSent = true;
        } catch (emailErr) {
          console.error("Failed to email specialist payout receipt:", emailErr);
        }
      }

      toast.success(
        emailSent 
          ? `✓ Payout successful and email receipt sent to ${specialistEmail}!`
          : `✓ Payout successful! (Email receipt dispatch simulated).`,
        { id: toastId }
      );
      fetchSpecialistPayouts();
      fetchInvoices();
    } catch (err) {
      console.warn("DB update failed, using local storage fallback for processing specialist payout:", err);
      const localPayments = JSON.parse(localStorage.getItem('pms_maintenance_payments') || '[]');
      const localProfs = JSON.parse(localStorage.getItem('pms_maintenance_professionals') || '[]');
      const txRef = `TX-SANDBOX-${Date.now().toString().slice(-4)}`;
      const paidDate = new Date().toISOString();

      const updatedPayments = localPayments.map(p => {
        if (p.id === payout.id) {
          return {
            ...p,
            payment_status: 'paid',
            paid_at: paidDate,
            payment_method: payoutMethod,
            transaction_reference: txRef
          };
        }
        return p;
      });
      localStorage.setItem('pms_maintenance_payments', JSON.stringify(updatedPayments));

      // Log into local expenses
      try {
        const expensePayload = {
          id: `exp-maint-${Date.now()}`,
          property_id: 'mock-hq',
          amount: Number(payout.amount_ngn),
          category: 'Maintenance',
          description: `Disbursed maintenance fix payout to specialist. Ref: ${txRef}. Notes: ${payout.notes || 'None'}`,
          expense_date: paidDate.split('T')[0],
          paid_to: payout.professional?.name || 'Maintenance Specialist',
          payment_method: payoutMethod,
          status: 'paid',
          created_at: paidDate
        };
        const currentLocal = JSON.parse(localStorage.getItem('luxe_expenses') || '[]');
        localStorage.setItem('luxe_expenses', JSON.stringify([expensePayload, ...currentLocal]));
      } catch (localErr) {
        console.error("Local accounts synchronization error:", localErr);
      }

      let emailSent = false;
      const specialistEmail = payout.professional?.email;
      if (specialistEmail) {
        try {
          const emailRes = await sendResendEmail({
            to: specialistEmail,
            subject: `Payment Receipt: ₦${Number(payout.amount_ngn).toLocaleString()} - Sparkles Apartments`,
            from: 'booking@sparklesapartments.ng',
            html: `<p>Payment of ₦${Number(payout.amount_ngn).toLocaleString()} received successfully for maintenance!</p>`
          });
          if (emailRes?.success) emailSent = true;
        } catch {}
      }

      toast.success(
        emailSent 
          ? `✓ Payout successful and email receipt sent to ${specialistEmail} (local sandbox)!`
          : `✓ Payout processed successfully (local sandbox)!`,
        { id: toastId }
      );
      fetchSpecialistPayouts();
      fetchInvoices();
    }
  };

  const handleConfirmServicePayment = async (req, method = 'bank_transfer') => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    const toastId = toast.loading('Confirming stay enhancement payment...');
    try {
      const isTaxable = req.services?.tax_inclusive !== false;
      const baseAmount = Number(req.total_price_ngn || 0);
      const taxAmount = isTaxable ? baseAmount * 0.075 : 0;
      const amount = baseAmount + taxAmount;

      let guestProfile = null;
      if (method === 'ar') {
        const crmGuestId = req.bookings?.crm_guest_id;
        const guestEmail = req.bookings?.guest_email;

        if (!crmGuestId && !guestEmail) {
          toast.error("Cannot resolve CRM guest account. AR charge failed.", { id: toastId });
          return;
        }

        if (crmGuestId) {
          const { data } = await supabase.from('crm_guests').select('*').eq('id', crmGuestId).maybeSingle();
          guestProfile = data;
        } else if (guestEmail) {
          const { data } = await supabase.from('crm_guests').select('*').eq('email', guestEmail.toLowerCase()).maybeSingle();
          guestProfile = data;
        }

        if (!guestProfile) {
          toast.error("CRM Guest Profile not found. Cannot charge to AR.", { id: toastId });
          return;
        }

        const currentWalletBalance = Number(guestProfile.wallet_balance || 0);
        if (currentWalletBalance < amount) {
          toast.error(`Insufficient AR wallet balance. Available: ₦${currentWalletBalance.toLocaleString()}`, { id: toastId });
          return;
        }

        // Deduct balance
        const newWalletBalance = currentWalletBalance - amount;
        const { error: walletErr } = await supabase
          .from('crm_guests')
          .update({ wallet_balance: newWalletBalance })
          .eq('id', guestProfile.id);

        if (walletErr) throw walletErr;

        // Upsert ar_accounts
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
          console.warn("ar_accounts upsert fallback", err);
        }
      }

      // 1. Update booking_services payment status to paid
      const { error: servErr } = await supabase
        .from('booking_services')
        .update({ 
          payment_status: 'paid'
        })
        .eq('id', req.id);

      if (servErr) throw servErr;

      // 2. Fetch the corresponding booking's current amount_paid_ngn
      const { data: booking, error: bookErr } = await supabase
        .from('bookings')
        .select('amount_paid_ngn')
        .eq('id', req.booking_id)
        .single();
      
      if (bookErr) throw bookErr;
      const currentPaid = Number(booking.amount_paid_ngn || 0);
      const newPaid = currentPaid + amount;

      // Determine notes
      let paymentNotes = '';
      if (method === 'ar' && guestProfile) {
        paymentNotes = `AR Prepayment Wallet deduction for service: ${req.services?.name || 'Enhancement'} (Ref: ${req.id}) for guest: ${guestProfile.first_name} ${guestProfile.last_name} (${guestProfile.email || 'N/A'})`;
      } else {
        paymentNotes = `Service payment confirmed by finance: ${req.services?.name || 'Enhancement'} (Ref: ${req.id}) for guest: ${req.bookings?.guest_name || 'Confirmed Guest'}`;
      }

      // 3. Record Payment inflow in payments table so it reflects in Accounting
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: req.booking_id,
          amount: amount,
          method: method === 'ar' ? 'cash' : method,
          status: 'completed',
          notes: paymentNotes,
          transaction_ref: method === 'ar' ? `MOCK-AR-${Date.now()}` : `OFFLINE-CONF-${Date.now()}`
        }]);

      if (payErr) throw payErr;

      // 4. Update booking paid amount in bookings table
      // (This will also update the invoice amount_paid via database triggers!)
      const { error: bUpdateErr } = await supabase
        .from('bookings')
        .update({
          amount_paid_ngn: newPaid
        })
        .eq('id', req.booking_id);

      if (bUpdateErr) throw bUpdateErr;

      toast.success(`Payment of ₦${amount.toLocaleString()} confirmed successfully!`, { id: toastId });
      
      // Refresh billing data
      fetchInvoices();
    } catch (err) {
      toast.error('Failed to confirm service payment', { id: toastId });
      console.error(err);
    }
  };

  const handleConfirmPendingPayment = async (payment) => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    const toastId = toast.loading('Confirming pending checkout payment...');
    try {
      // 1. Update the payment record status to 'completed'
      const { error: payErr } = await supabase
        .from('payments')
        .update({ status: 'completed' })
        .eq('id', payment.id);

      if (payErr) throw payErr;

      // 2. Fetch the corresponding booking's current amount_paid_ngn and total_amount_ngn
      const { data: booking, error: bookErr } = await supabase
        .from('bookings')
        .select('amount_paid_ngn, total_amount_ngn')
        .eq('id', payment.booking_id)
        .single();
      
      if (bookErr) throw bookErr;

      const currentPaid = Number(booking.amount_paid_ngn || 0);
      const paymentAmount = Number(payment.amount || 0);
      const newPaid = currentPaid + paymentAmount;
      const totalAmount = Number(booking.total_amount_ngn || 0);

      // 3. Update the booking's amount_paid_ngn
      const { error: bUpdateErr } = await supabase
        .from('bookings')
        .update({
          amount_paid_ngn: newPaid
        })
        .eq('id', payment.booking_id);

      if (bUpdateErr) throw bUpdateErr;

      // 4. If booking is now fully paid, mark all booking services as paid
      if (newPaid >= totalAmount) {
        await supabase
          .from('booking_services')
          .update({ payment_status: 'paid' })
          .eq('booking_id', payment.booking_id);
      }

      toast.success(`✓ Payment of ₦${paymentAmount.toLocaleString()} confirmed successfully!`, { id: toastId });
      fetchInvoices();
    } catch (err) {
      toast.error(`Failed to confirm checkout payment: ${err.message || 'Error occurred'}`, { id: toastId });
      console.error(err);
    }
  };

  const handleConfirmBookingPayment = async (bookingId) => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    const toastId = toast.loading('Confirming payment with finance...');
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          id_verified: true,
          status: 'confirmed'
        })
        .eq('id', bookingId);
      
      if (error) throw error;

      try {
        await supabase
          .from('booking_services')
          .update({ status: 'confirmed' })
          .eq('booking_id', bookingId);
      } catch (srvErr) {
        console.warn("Failed to auto-confirm booking services:", srvErr);
      }
      
      toast.success('Payment successfully confirmed by finance!', { id: toastId });

      // Trigger confirmation, receipt, and invoice emails
      try {
        const { data: bData } = await supabase
          .from('bookings')
          .select('*, profiles(*), rooms(*)')
          .eq('id', bookingId)
          .single();
        if (bData) {
          triggerAutomationRules('booking_confirmed', bData);
          triggerAutomationRules('payment_received', {
            ...bData,
            payment_amount: bData.amount_paid_ngn || bData.total_amount_ngn || '0.00',
            payment_method: bData.payment_method || 'Bank Transfer',
            payment_ref: bData.payment_reference || 'N/A'
          });
          triggerAutomationRules('invoice_issued', bData);
        }
      } catch (autoErr) {
        console.warn("Automations triggered after confirming payment failed:", autoErr);
      }

      fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error('Failed to confirm payment: ' + err.message, { id: toastId });
    }
  };

  const handleCancelBookingPayment = async (invoiceId, bookingId) => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    if (!window.confirm("Are you sure you want to cancel / decline this booking due to failed payment?")) return;
    
    const toastId = toast.loading('Cancelling booking and invoice...');
    try {
      // 1. Update booking status to cancelled
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);
      if (bookingErr) throw bookingErr;

      // 2. Update invoice status to cancelled
      const { error: invoiceErr } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoiceId);
      if (invoiceErr) throw invoiceErr;

      // 3. Update booking services status to cancelled
      try {
        await supabase
          .from('booking_services')
          .update({ status: 'cancelled' })
          .eq('booking_id', bookingId);
      } catch (srvErr) {
        console.warn("Failed to cancel booking services:", srvErr);
      }

      // 4. Update payments status to cancelled (if any exist)
      try {
        await supabase
          .from('payments')
          .update({ status: 'cancelled' })
          .eq('booking_id', bookingId);
      } catch (payErr) {
        console.warn("Failed to cancel payments:", payErr);
      }

      toast.success('Booking and invoice successfully cancelled due to failed payment!', { id: toastId });

      // Trigger cancellation automation
      try {
        const { data: bData } = await supabase
          .from('bookings')
          .select('*, profiles(*), rooms(*)')
          .eq('id', bookingId)
          .single();
        if (bData) {
          triggerAutomationRules('booking_cancelled', bData);
        }
      } catch (autoErr) {
        console.warn("Cancellation automation trigger failed in handleCancelBookingPayment:", autoErr);
      }

      fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel: ' + err.message, { id: toastId });
    }
  };

  const handlePaystackSuccess = async (reference, amount) => {
    setIsProcessing(true);
    const toastId = toast.loading('Confirming transaction with Paystack...');
    try {
      const transRef = typeof reference === 'string' ? reference : (reference?.reference || reference?.transaction || `PAYSTACK-${Date.now()}`);
      const newAmountPaid = Number(activePaymentModal.amount_paid) + amount;
      const newStatus = newAmountPaid >= activePaymentModal.total_amount ? 'paid' : 'partial';

      // 1. Record Payment
      const { error: payErr } = await supabase.from('payments').insert([{
        booking_id: activePaymentModal.booking_id,
        invoice_id: activePaymentModal.id,
        amount: amount,
        method: 'paystack',
        status: 'completed',
        transaction_ref: transRef,
        notes: `Payment processed via Paystack modal for invoice: ${activePaymentModal.invoice_number}`
      }]);

      if (payErr) throw payErr;

      // 2. Update Invoice
      await supabase.from('invoices').update({
        amount_paid: newAmountPaid,
        status: newStatus
      }).eq('id', activePaymentModal.id);

      // 3. Sync with Bookings
      await supabase.from('bookings').update({
        amount_paid_ngn: newAmountPaid,
        payment_status: newStatus,
        id_verified: true,
        status: 'confirmed'
      }).eq('id', activePaymentModal.booking_id);

      // 3b. If invoice is fully paid, mark all booking services as paid
      if (newStatus === 'paid') {
        await supabase
          .from('booking_services')
          .update({ payment_status: 'paid' })
          .eq('booking_id', activePaymentModal.booking_id);
      }

      toast.success(`Payment of ₦${amount.toLocaleString()} processed via Paystack!`, { id: toastId });

      // Trigger alerts
      try {
        const { data: bData } = await supabase
          .from('bookings')
          .select('*, profiles(*), rooms(*)')
          .eq('id', activePaymentModal.booking_id)
          .single();
        if (bData) {
          triggerAutomationRules('payment_received', {
            ...bData,
            payment_amount: amount,
            payment_method: 'paystack',
            payment_ref: transRef
          });
          if (activePaymentModal.bookings?.status === 'pending') {
            triggerAutomationRules('booking_confirmed', bData);
          }
          triggerAutomationRules('invoice_issued', bData);
        }
      } catch (autoErr) {
        console.warn("Automation alerts processing failed in handlePaystackSuccess:", autoErr);
      }

      setActivePaymentModal(null);
      setPaymentAmount('');
      fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error('Payment verification failed', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }

    const amount = Number(paymentAmount);
    if (amount <= 0 || amount > (activePaymentModal.total_amount - activePaymentModal.amount_paid)) {
      toast.error("Invalid payment amount");
      return;
    }

    if (paymentMethod === 'paystack') {
      const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || paystackPublicKey || '';
      if (!pubKey) {
        toast.error("Paystack public key is not configured.");
        return;
      }
      const ref = `OFFLINE-PAYSTACK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setPaystackConfig({
        reference: ref,
        email: activePaymentModal.bookings?.guest_email || 'guest@example.com',
        amount: Math.round(amount * 100), // in kobo
        publicKey: pubKey,
        currency: 'NGN'
      });
      return;
    }

    setIsProcessing(true);
    
    // Simulate Gateway Delay
    setTimeout(async () => {
      try {
        let guestProfile = null;
        if (paymentMethod === 'ar') {
          const crmGuestId = activePaymentModal.bookings?.crm_guest_id;
          const guestEmail = activePaymentModal.bookings?.guest_email;
          
          if (!crmGuestId && !guestEmail) {
            toast.error("Cannot resolve CRM guest account for this booking. AR charge failed.");
            setIsProcessing(false);
            return;
          }

          if (crmGuestId) {
            const { data } = await supabase.from('crm_guests').select('*').eq('id', crmGuestId).maybeSingle();
            guestProfile = data;
          } else if (guestEmail) {
            const { data } = await supabase.from('crm_guests').select('*').eq('email', guestEmail.toLowerCase()).maybeSingle();
            guestProfile = data;
          }

          if (!guestProfile) {
            toast.error("CRM Guest Profile not found. Cannot charge to AR.");
            setIsProcessing(false);
            return;
          }

          const currentWalletBalance = Number(guestProfile.wallet_balance || 0);
          if (currentWalletBalance < amount) {
            toast.error(`Insufficient AR wallet balance. Available: ₦${currentWalletBalance.toLocaleString()}`);
            setIsProcessing(false);
            return;
          }

          const newWalletBalance = currentWalletBalance - amount;
          await supabase.from('crm_guests').update({ wallet_balance: newWalletBalance }).eq('id', guestProfile.id);

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
            console.warn("ar_accounts upsert fallback", err);
          }
        }

        const newAmountPaid = Number(activePaymentModal.amount_paid) + amount;
        const newStatus = newAmountPaid >= activePaymentModal.total_amount ? 'paid' : 'partial';

        // 1. Record Payment
        const { error: payErr } = await supabase.from('payments').insert([{
          booking_id: activePaymentModal.booking_id,
          invoice_id: activePaymentModal.id,
          amount: amount,
          method: paymentMethod === 'ar' ? 'cash' : paymentMethod,
          status: 'completed',
          transaction_ref: `MOCK-${paymentMethod.toUpperCase()}-${Date.now()}`,
          notes: paymentMethod === 'ar' && guestProfile 
            ? `AR Prepayment Wallet deduction for invoice: ${activePaymentModal.invoice_number} (Ref: ${activePaymentModal.bookings?.booking_reference || 'N/A'}) for guest: ${guestProfile.first_name} ${guestProfile.last_name} (${guestProfile.email || 'N/A'})`
            : `Payment processed via ${paymentMethod.toUpperCase()} for invoice: ${activePaymentModal.invoice_number}`
        }]);

        if (payErr) throw payErr;

        // 2. Update Invoice
        await supabase.from('invoices').update({
          amount_paid: newAmountPaid,
          status: newStatus
        }).eq('id', activePaymentModal.id);

        // 3. Sync with Bookings (Important so check-out is allowed, set status to confirmed on payment confirmation)
        await supabase.from('bookings').update({
          amount_paid_ngn: newAmountPaid,
          payment_status: newStatus,
          id_verified: true,
          status: 'confirmed'
        }).eq('id', activePaymentModal.booking_id);

        // 3b. If invoice is fully paid, mark all booking services as paid
        if (newStatus === 'paid') {
          await supabase
            .from('booking_services')
            .update({ payment_status: 'paid' })
            .eq('booking_id', activePaymentModal.booking_id);
        }

        toast.success(`Payment of ₦${amount.toLocaleString()} processed via ${paymentMethod.toUpperCase()}`);

        // Trigger alerts
        try {
          const { data: bData } = await supabase
            .from('bookings')
            .select('*, profiles(*), rooms(*)')
            .eq('id', activePaymentModal.booking_id)
            .single();
          if (bData) {
            triggerAutomationRules('payment_received', {
              ...bData,
              payment_amount: amount,
              payment_method: paymentMethod,
              payment_ref: `MOCK-${paymentMethod.toUpperCase()}-${Date.now()}`
            });
            // If booking was pending and now confirmed, trigger booking_confirmed
            if (activePaymentModal.bookings?.status === 'pending') {
              triggerAutomationRules('booking_confirmed', bData);
            }
            // Trigger invoice email
            triggerAutomationRules('invoice_issued', bData);
          }
        } catch (autoErr) {
          console.warn("Automation alerts processing failed in handleProcessPayment:", autoErr);
        }

        setActivePaymentModal(null);
        setPaymentAmount('');
        fetchInvoices();
      } catch (err) {
        toast.error('Payment processing failed');
      } finally {
        setIsProcessing(false);
      }
    }, 1500);
  };

  const requestRefundOTP = async () => {
    if (!activeRefundModal) return;
    
    if (paymentMethod === 'bank_transfer') {
      if (!refundBankName || !refundAccountNumber || !refundAccountName) {
        toast.error("Please enter guest bank details first.");
        return;
      }
      if (refundAccountNumber.length < 8) {
        toast.error("Please enter a valid bank account number.");
        return;
      }
    }

    const toastId = toast.loading("Resolving manager and dispatching authorization OTP...");
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setOtpCode(code);
      
      let managerPhone = '08033214684'; // Default fallback
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('phone')
          .in('role', ['hotel_manager', 'super_admin', 'admin', 'manager'])
          .not('phone', 'is', null)
          .limit(1);

        if (!error && data && data.length > 0) {
          managerPhone = data[0].phone;
        } else if (contactInfo?.phone) {
          const firstPhone = contactInfo.phone.split(',')[0].trim();
          if (firstPhone) managerPhone = firstPhone;
        }
      } catch (ex) {
        console.warn("Error querying manager profiles", ex);
      }

      setManagerPhoneDisplay(managerPhone);

      const smsMessage = `Sparkles Apartments: Security OTP code for Refund Auth is ${code}. Invoice Ref: ${activeRefundModal.invoice_number}, Amount: ₦${Number(paymentAmount).toLocaleString()}. Valid for 5 minutes.`;
      
      const res = await sendSMSNotification({
        to: managerPhone,
        message: smsMessage
      });

      if (res.success) {
        setOtpSent(true);
        toast.success(`Security Authorization OTP code sent to Manager's phone number (${managerPhone.slice(0, 4)}***${managerPhone.slice(-4)})`, { id: toastId, duration: 6000 });
      } else {
        throw new Error(res.error || "SMS delivery failed");
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to send OTP: ${err.message || 'Error occurred'}. Please try again.`, { id: toastId });
    }
  };

  const handleMarkAsSettled = async (settlementId) => {
    const toastId = toast.loading("Marking refund as settled...");
    try {
      const settledTime = new Date().toISOString();
      const { error } = await supabase
        .from('refund_settlements')
        .update({ status: 'settled', settled_at: settledTime })
        .eq('id', settlementId);

      if (error) throw error;
      toast.success("Refund successfully marked as settled!", { id: toastId });
      fetchRefundSettlements();
    } catch (err) {
      console.warn("DB update failed, updating local storage for settlement:", err);
      const local = JSON.parse(localStorage.getItem('pms_refund_settlements') || '[]');
      const updated = local.map(s => s.id === settlementId ? { ...s, status: 'settled', settled_at: new Date().toISOString() } : s);
      localStorage.setItem('pms_refund_settlements', JSON.stringify(updated));
      toast.success("Refund marked as settled (local storage)!", { id: toastId });
      fetchRefundSettlements();
    }
  };

  const getFilteredSettlements = () => {
    const now = new Date();
    return refundSettlements.filter(s => {
      const date = new Date(s.created_at);
      if (settlementFilter === 'daily') {
        return date.toDateString() === now.toDateString();
      }
      if (settlementFilter === 'weekly') {
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (settlementFilter === 'monthly') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  };

  const handlePrintSettlements = () => {
    const filtered = getFilteredSettlements();
    const tableRows = filtered.map(s => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${s.guest_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${s.guest_email}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">₦${Number(s.refund_amount).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${s.bank_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold;">${s.account_number}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${s.account_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; font-weight: bold; color: ${s.status === 'settled' ? '#047857' : '#b45309'}">${s.status}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${s.settled_at ? new Date(s.settled_at).toLocaleDateString() : 'N/A'}</td>
      </tr>
    `).join('');

    const printWindow = window.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Refund Settlements Bank Report - Sparkles Apartments</title>
          <style>
            @page { size: landscape; margin: 20mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { border-bottom: 2px solid #e5e7eb; padding: 10px; text-align: left; background-color: #f9fafb; font-weight: bold; color: #374151; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #374151; padding-bottom: 15px; }
            .header h1 { margin: 0; font-size: 22px; color: #111827; }
            .meta { display: flex; justify-content: space-between; margin-top: 15px; font-size: 13px; }
            .footer { margin-top: 40px; font-size: 11px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${contactInfo.logo ? `<img src="${contactInfo.logo}" style="max-height: 50px; object-fit: contain; margin-bottom: 10px;" /><br/>` : ''}
            <h1>REFUND SETTLEMENTS REPORT (BANK OUTWARD SHEET)</h1>
            <div style="font-size: 13px; color: #6b7280; margin-top: 5px;">Filter Batch: ${settlementFilter.toUpperCase()}</div>
          </div>
          
          <div class="meta">
            <div>
              <strong>Sparkles Apartments Premium Luxury Shortlets</strong><br />
              Compiled Date: ${new Date().toLocaleString()}<br />
              Total Records: ${filtered.length}
            </div>
            <div style="text-align: right;">
              <strong>Total Refund Outward:</strong><br />
              <span style="font-size: 20px; font-weight: 900; color: #b91c1c;">
                ₦${filtered.reduce((sum, s) => sum + Number(s.refund_amount), 0).toLocaleString()}
              </span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Guest Name</th>
                <th>Guest Email</th>
                <th>Refund Amount</th>
                <th>Bank Name</th>
                <th>Account Number</th>
                <th>Account Name</th>
                <th>Status</th>
                <th>Settled Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows.length > 0 ? tableRows : '<tr><td colspan="8" style="text-align: center; padding: 20px;">No refund settlements found for this filter.</td></tr>'}
            </tbody>
          </table>
          
          <div class="footer">
            Confidential Bank Disbursement Report. Authorized by Hotel Management.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const handleIssueRefund = async (e) => {
    e.preventDefault();
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }

    if (!otpSent || otpInput !== otpCode) {
      toast.error("Invalid or missing One-Time Password authorization code.");
      return;
    }

    setIsProcessing(true);
    
    setTimeout(async () => {
      try {
        const amount = Number(paymentAmount);
        if (amount <= 0 || amount > activeRefundModal.amount_paid) {
          toast.error("Invalid refund amount");
          setIsProcessing(false);
          return;
        }

        let guestProfile = null;
        if (paymentMethod === 'ar') {
          const crmGuestId = activeRefundModal.bookings?.crm_guest_id;
          const guestEmail = activeRefundModal.bookings?.guest_email;
          
          if (crmGuestId || guestEmail) {
            if (crmGuestId) {
              const { data } = await supabase.from('crm_guests').select('*').eq('id', crmGuestId).maybeSingle();
              guestProfile = data;
            } else if (guestEmail) {
              const { data } = await supabase.from('crm_guests').select('*').eq('email', guestEmail.toLowerCase()).maybeSingle();
              guestProfile = data;
            }

            if (guestProfile) {
              const currentWalletBalance = Number(guestProfile.wallet_balance || 0);
              const newWalletBalance = currentWalletBalance + amount;

              await supabase.from('crm_guests').update({ wallet_balance: newWalletBalance }).eq('id', guestProfile.id);

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
                console.warn("ar_accounts upsert fallback", err);
              }
            }
          }
        }

        const newAmountPaid = Number(activeRefundModal.amount_paid) - amount;
        const newStatus = newAmountPaid === 0 ? 'cancelled' : 'partial';

        // 1. Record Refund in payments
        const { error: payErr } = await supabase.from('payments').insert([{
          booking_id: activeRefundModal.booking_id,
          invoice_id: activeRefundModal.id,
          amount: amount,
          method: paymentMethod === 'ar' ? 'cash' : paymentMethod, // Method refunded back to
          status: 'refunded',
          is_refund: true,
          transaction_ref: `REF-${paymentMethod.toUpperCase()}-${Date.now()}`,
          notes: paymentMethod === 'ar' && guestProfile
            ? `AR Prepayment Wallet refund for invoice: ${activeRefundModal.invoice_number} (Ref: ${activeRefundModal.bookings?.booking_reference || 'N/A'}) for guest: ${guestProfile.first_name} ${guestProfile.last_name} (${guestProfile.email || 'N/A'})`
            : `Refund issued via ${paymentMethod.toUpperCase()} for invoice: ${activeRefundModal.invoice_number}`
        }]);

        if (payErr) throw payErr;

        // 2. Update Invoice
        await supabase.from('invoices').update({
          amount_paid: newAmountPaid,
          status: newStatus
        }).eq('id', activeRefundModal.id);

        // 3. Sync with Bookings
        await supabase.from('bookings').update({
          amount_paid_ngn: newAmountPaid,
          payment_status: newStatus
        }).eq('id', activeRefundModal.booking_id);

        // 4. Log Refund Settlement capturing guest bank details
        const settlementPayload = {
          invoice_id: activeRefundModal.id,
          booking_id: activeRefundModal.booking_id,
          guest_name: activeRefundModal.bookings?.profiles 
            ? `${activeRefundModal.bookings.profiles.first_name} ${activeRefundModal.bookings.profiles.last_name}` 
            : activeRefundModal.bookings?.guest_name || 'Walk-in Guest',
          guest_email: activeRefundModal.bookings?.guest_email || 'N/A',
          refund_amount: amount,
          bank_name: refundBankName,
          account_number: refundAccountNumber,
          account_name: refundAccountName,
          status: 'pending'
        };

        const { error: setlErr } = await supabase.from('refund_settlements').insert([settlementPayload]);
        if (setlErr) {
          console.warn("Database settlement logging failed, using local storage backup:", setlErr);
          const localSettlements = JSON.parse(localStorage.getItem('pms_refund_settlements') || '[]');
          const newSettlement = {
            ...settlementPayload,
            id: `setl-${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          localStorage.setItem('pms_refund_settlements', JSON.stringify([newSettlement, ...localSettlements]));
        }

        toast.success(`Refund of ₦${amount.toLocaleString()} issued and settlements logged successfully.`);
        setActiveRefundModal(null);
        setPaymentAmount('');
        
        // Reset states
        setRefundBankName('');
        setRefundAccountNumber('');
        setRefundAccountName('');
        setOtpSent(false);
        setOtpCode('');
        setOtpInput('');
        setManagerPhoneDisplay('');

        fetchInvoices();
        fetchRefundSettlements();
      } catch (err) {
        toast.error('Refund failed');
      } finally {
        setIsProcessing(false);
      }
    }, 1500);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'paid': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'partial': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'overdue': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'cancelled': return 'bg-dark-600 text-gray-500 border border-dark-500';
      default: return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'; // draft/sent
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    
    const guestName = inv.bookings?.profiles 
      ? `${inv.bookings.profiles.first_name} ${inv.bookings.profiles.last_name}` 
      : (inv.bookings?.guest_name || inv.hall_bookings?.guest_name || '');
    const bookingRef = inv.bookings?.booking_reference || inv.hall_bookings?.booking_reference || '';
    const searchLower = searchTerm.toLowerCase();
    
    return inv.invoice_number.toLowerCase().includes(searchLower) || 
           bookingRef.toLowerCase().includes(searchLower) || 
           guestName.toLowerCase().includes(searchLower);
   });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (sortBy === 'created_at_desc') {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (sortBy === 'created_at_asc') {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    if (sortBy === 'status_custom') {
      const getStatusPriority = (status) => {
        if (status === 'paid') return 1;
        if (status === 'partial') return 3;
        if (status === 'cancelled') return 4;
        return 2; // 'sent', 'draft', 'overdue' (Not Paid)
      };
      return getStatusPriority(a.status) - getStatusPriority(b.status);
    }
    if (sortBy === 'status_custom_desc') {
      const getStatusPriority = (status) => {
        if (status === 'paid') return 1;
        if (status === 'partial') return 3;
        if (status === 'cancelled') return 4;
        return 2;
      };
      return getStatusPriority(b.status) - getStatusPriority(a.status);
    }
    if (sortBy === 'balance_desc') {
      const balanceA = Number(a.total_amount || 0) - Number(a.amount_paid || 0);
      const balanceB = Number(b.total_amount || 0) - Number(b.amount_paid || 0);
        return balanceB - balanceA;
    }
    if (sortBy === 'amount_desc') {
      return Number(b.total_amount || 0) - Number(a.total_amount || 0);
    }
    return 0;
  });

  useEffect(() => {
    setCurrentPageInvoices(1);
  }, [searchTerm, sortBy]);

  useEffect(() => {
    setCurrentPageSettlements(1);
  }, [settlementFilter]);

  const startIndexInvoices = (currentPageInvoices - 1) * pageSize;
  const paginatedInvoices = sortedInvoices.slice(startIndexInvoices, startIndexInvoices + pageSize);

  const startIndexPayouts = (currentPagePayouts - 1) * pageSize;
  const paginatedPayouts = specialistPayouts.slice(startIndexPayouts, startIndexPayouts + pageSize);

  const startIndexService = (currentPageService - 1) * pageSize;
  const paginatedService = pendingServicePayments.slice(startIndexService, startIndexService + pageSize);

  const startIndexCheckout = (currentPageCheckout - 1) * pageSize;
  const paginatedCheckout = pendingCheckoutPayments.slice(startIndexCheckout, startIndexCheckout + pageSize);

  const filteredSettlements = getFilteredSettlements();
  const startIndexSettlements = (currentPageSettlements - 1) * pageSize;
  const paginatedSettlements = filteredSettlements.slice(startIndexSettlements, startIndexSettlements + pageSize);

  return (
    <div className="space-y-6 pb-20">
      {isFrontOfficeClosed && (
        <div className="bg-red-500/10 border-2 border-red-500/35 text-red-200 p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-red-500/5 mb-6 animate-pulse">
          <AlertTriangle size={24} className="text-red-500 animate-bounce flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-white">Front Office Operations Locked</h4>
            <p className="text-xs text-red-300/95 mt-0.5 font-medium">
              Daily ledger is closed. Stay enhancement confirmation, checkout payments, invoices settlement, and refund operations are locked.
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dark-800 border border-dark-700 p-6 rounded-lg gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="text-brand-500" />
            Financial Folios & Billing Ledger
          </h1>
          <p className="text-gray-400 mt-1">Manage invoices, process multi-gateway payments, and issue refunds.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-dark-700 overflow-x-auto">
        <button onClick={() => setActiveTab('invoices')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'invoices' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'}`}>
          <FileText size={18} /> Invoices & Billings
        </button>
        {hasAccess('Accounting') && (
          <button onClick={() => setActiveTab('payouts')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'payouts' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'}`}>
            <ArrowRightLeft size={18} /> Specialist Payouts
          </button>
        )}
        {hasAccess('Accounting') && (
          <button onClick={() => setActiveTab('settlements')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'settlements' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'}`}>
            <RefreshCcw size={18} /> Refund Settlements
          </button>
        )}
        {hasAccess('Accounting') && (
          <button onClick={() => setActiveTab('accounting')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'accounting' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400 hover:text-white'}`}>
            <Wallet size={18} /> Accounting & Ledgers
          </button>
        )}
      </div>

      {activeTab === 'invoices' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-dark-800 border border-dark-700 p-5 rounded-lg border-l-4 border-l-green-500">
          <p className="text-sm text-gray-400 font-medium">Total Collected Revenue</p>
          <h3 className="text-3xl font-bold text-white mt-1">₦{stats.totalRevenue.toLocaleString()}</h3>
        </div>
        <div className="bg-dark-800 border border-dark-700 p-5 rounded-lg border-l-4 border-l-yellow-500">
          <p className="text-sm text-gray-400 font-medium">Pending Receivables</p>
          <h3 className="text-3xl font-bold text-white mt-1">₦{stats.pendingReceivables.toLocaleString()}</h3>
        </div>
        <div className="bg-dark-800 border border-dark-700 p-5 rounded-lg border-l-4 border-l-brand-500">
          <p className="text-sm text-gray-400 font-medium">VAT/Tax Collected (Estimated)</p>
          <h3 className="text-3xl font-bold text-white mt-1">₦{stats.taxCollected.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
        </div>
      </div>

      {/* Pending Service Payments Section */}
      {pendingServicePayments.length > 0 && (
        <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            ⚠️ Service Payments Awaiting Finance Confirmation ({pendingServicePayments.length})
          </h2>
          <p className="text-gray-400 text-xs">
            Guests have requested these stay enhancements. Confirm their cash, POS, or bank transfer payments to credit their account and allow front desk approval.
          </p>
          <div className="overflow-x-auto border border-dark-700 rounded bg-dark-900/50">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-900 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Guest / Room</th>
                  <th className="py-3 px-4">Service Details</th>
                  <th className="py-3 px-4">Total Cost</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Confirm Payment Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {paginatedService.map(req => {
                  const guestName = req.bookings?.guest_name || 'Guest';
                  return (
                    <tr key={req.id} className="hover:bg-dark-700/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-white">{guestName}</p>
                        <span className="text-[10px] text-gray-500 font-mono">Ref: {req.bookings?.booking_reference}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-white">{req.services?.name}</p>
                        <span className="text-xs text-gray-400">Qty: {req.quantity}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gold-500 font-mono">
                        ₦{Number(req.total_price_ngn).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {req.notes || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right flex justify-end gap-2 items-center">
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleConfirmServicePayment(req, 'ar')}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1.5 px-3 rounded shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          AR Deduction
                        </button>
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleConfirmServicePayment(req, 'bank_transfer')}
                          className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs py-1.5 px-3 rounded shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Bank Transfer
                        </button>
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleConfirmServicePayment(req, 'pos')}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs py-1.5 px-3 rounded shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          POS
                        </button>
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleConfirmServicePayment(req, 'cash')}
                          className="bg-green-500 hover:bg-green-600 text-dark-950 font-bold text-xs py-1.5 px-3 rounded shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Cash
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControl
            currentPage={currentPageService}
            totalItems={pendingServicePayments.length}
            pageSize={pageSize}
            onPageChange={setCurrentPageService}
          />
        </div>
      )}

      {/* Pending Checkout Payments Section */}
      {pendingCheckoutPayments.length > 0 && (
        <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            ⚠️ Checkout Payments Awaiting Finance Confirmation ({pendingCheckoutPayments.length})
          </h2>
          <p className="text-gray-400 text-xs">
            Guests are attempting to check out at Front Office and have logged these payments. Confirm their cash, POS, or bank transfer payments to allow Front Office to finalize their checkout.
          </p>
          <div className="overflow-x-auto border border-dark-700 rounded bg-dark-900/50">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-900 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Guest / Room</th>
                  <th className="py-3 px-4">Booking Reference</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Notes / Ref</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {paginatedCheckout.map(p => {
                  const guestName = p.bookings?.guest_name || 'Guest';
                  const roomNumber = p.bookings?.rooms?.room_number || 'N/A';
                  return (
                    <tr key={p.id} className="hover:bg-dark-700/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-white">{guestName}</p>
                        <span className="text-xs text-gray-400">Room: {roomNumber}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                        {p.bookings?.booking_reference || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gold-500 font-mono">
                        ₦{Number(p.amount).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-white text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.method === 'bank_transfer' ? 'bg-blue-500/20 text-blue-400' : p.method === 'pos' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                          {p.method === 'bank_transfer' ? 'Bank Transfer' : p.method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        <p className="truncate max-w-[250px]" title={p.notes}>{p.notes || 'N/A'}</p>
                        <span className="text-[10px] text-gray-500 font-mono">Ref: {p.transaction_ref}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right flex justify-end gap-2 items-center">
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleConfirmPendingPayment(p)}
                          className="bg-brand-500 hover:bg-brand-600 text-dark-950 font-bold text-xs py-1.5 px-3 rounded shadow transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Confirm Payment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControl
            currentPage={currentPageCheckout}
            totalItems={pendingCheckoutPayments.length}
            pageSize={pageSize}
            onPageChange={setCurrentPageCheckout}
          />
        </div>
      )}

      {/* Main Content */}
      {fetchError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded text-sm mb-4">
          <p className="font-bold">Error loading data:</p>
          <pre className="mt-2 whitespace-pre-wrap">{fetchError}</pre>
        </div>
      )}
      <div className="bg-dark-800 border border-dark-700 shadow-sm rounded-lg overflow-hidden">
        <div className="p-4 border-b border-dark-700 bg-dark-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search by Invoice #, Booking Ref, or Guest..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-dark-800 border border-dark-700 text-white rounded outline-none focus:border-brand-500 transition-colors" 
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Sort By:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-dark-800 border border-dark-700 text-white rounded px-3 py-2 text-sm outline-none focus:border-brand-500 transition-colors cursor-pointer"
            >
              <option value="created_at_desc">Date Created (Newest)</option>
              <option value="created_at_asc">Date Created (Oldest)</option>
              <option value="status_custom">Status (Paid &rarr; Not Paid &rarr; Partial)</option>
              <option value="status_custom_desc">Status (Partial &rarr; Not Paid &rarr; Paid)</option>
              <option value="balance_desc">Balance Due (Highest)</option>
              <option value="amount_desc">Invoice Total (Highest)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-dark-900 border-b border-dark-700 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Booking Ref</th>
                <th className="p-4">Guest</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Discount</th>
                <th className="p-4">Balance Due</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700 text-sm">
              {loading && <tr><td colSpan="8" className="p-8 text-center text-gray-500">Loading invoices...</td></tr>}
              {!loading && sortedInvoices.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-gray-500">No invoices found.</td></tr>}
              
              {paginatedInvoices.map(inv => {
                const guestName = inv.bookings?.profiles 
                  ? `${inv.bookings.profiles.first_name} ${inv.bookings.profiles.last_name}` 
                  : (inv.bookings?.guest_name || inv.hall_bookings?.guest_name || 'Walk-in Guest');
                const balanceDue = Number(inv.total_amount) - Number(inv.amount_paid);
                const discount = Number(inv.bookings?.discount_amount_ngn || 0);

                return (
                  <tr key={inv.id} className="hover:bg-dark-700 transition-colors group">
                    <td className="p-4">
                      <p className="font-bold text-white flex items-center gap-2"><FileText size={14} className="text-gray-500"/> {inv.invoice_number}</p>
                      <p className="text-xs text-gray-500">Due: {format(new Date(inv.due_date), 'MMM dd, yyyy')}</p>
                    </td>
                    <td className="p-4 font-medium text-brand-500">{inv.bookings?.booking_reference || inv.hall_bookings?.booking_reference || 'N/A'}</td>
                    <td className="p-4 font-medium text-gray-300">{guestName}</td>
                    <td className="p-4 font-bold text-white">₦{Number(inv.total_amount).toLocaleString()}</td>
                    <td className="p-4">
                      {discount > 0 ? (
                        <span className="text-yellow-500 font-semibold">-₦{discount.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${balanceDue > 0 ? 'text-red-400' : 'text-green-500'}`}>
                        ₦{balanceDue.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded uppercase font-bold tracking-wider ${getStatusColor(inv.status)}`}>
                        {inv.status === 'paid' ? 'paid' : 
                         inv.status === 'partial' ? 'partial' : 
                         inv.status === 'cancelled' ? 'cancelled' : 'not paid'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => setActiveInvoiceModal(inv)} className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded font-bold text-xs transition-colors inline-flex items-center gap-1">
                        <Eye size={14} /> View
                      </button>
                      {inv.bookings?.status === 'pending' && !inv.bookings?.id_verified && (
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleConfirmBookingPayment(inv.bookings.id)} 
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Confirm Payment
                        </button>
                      )}
                      {inv.bookings?.status === 'pending' && !inv.bookings?.id_verified && (
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleCancelBookingPayment(inv.id, inv.bookings.id)} 
                          className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Decline / Cancel
                        </button>
                      )}
                      {inv.hall_bookings?.status === 'pending' && (
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => {
                            setActiveHallPayoutModal(inv.hall_bookings);
                            setPaymentAmount(Math.max(0, Number(inv.hall_bookings.total_amount_ngn || 0) - Number(inv.hall_bookings.amount_paid_ngn || 0)).toString());
                            setPaymentMethod('bank_transfer');
                          }} 
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Confirm Payment
                        </button>
                      )}
                      {inv.hall_bookings?.status === 'pending' && (
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleCancelHallBookingPayment(inv.id, inv.hall_bookings.id)} 
                          className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Decline / Cancel
                        </button>
                      )}
                      {balanceDue > 0 && inv.status !== 'cancelled' && (
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => {
                            if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                            setActivePaymentModal(inv); 
                            setPaymentAmount(balanceDue.toString());
                          }} 
                          className="bg-brand-500 hover:bg-brand-400 text-dark-900 px-3 py-1.5 rounded font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Pay
                        </button>
                      )}
                      <button 
                        disabled={isFrontOfficeClosed || Number(inv.amount_paid) <= Number(inv.total_amount)}
                        onClick={() => {
                          if (isFrontOfficeClosed) return toast.error("Front Office operations are locked due to daily ledger closure.");
                          setActiveRefundModal(inv); 
                          setPaymentAmount((Number(inv.amount_paid) - Number(inv.total_amount)).toString());
                          setRefundBankName('');
                          setRefundAccountNumber('');
                          setRefundAccountName('');
                          setOtpSent(false);
                          setOtpCode('');
                          setOtpInput('');
                        }} 
                        className={`px-3 py-1.5 rounded font-bold text-xs transition-colors ${
                          Number(inv.amount_paid) > Number(inv.total_amount) 
                            ? "bg-dark-600 hover:bg-red-500/20 hover:text-red-400 text-gray-300 cursor-pointer" 
                            : "bg-dark-700 text-gray-600 cursor-not-allowed opacity-40"
                        }`}
                      >
                        Refund
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationControl
          currentPage={currentPageInvoices}
          totalItems={sortedInvoices.length}
          pageSize={pageSize}
          onPageChange={setCurrentPageInvoices}
        />
      </div>
    </div>
  )}

      {activeTab === 'accounting' && hasAccess('Accounting') && (
        <div className="animate-in fade-in duration-300">
          <Accounting />
        </div>
      )}

      {activeTab === 'payouts' && hasAccess('Accounting') && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-brand-500 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Wrench className="text-brand-500" /> Specialist Maintenance Payouts
              </span>
              <div className="flex bg-dark-900 border border-dark-700 rounded p-1">
                <button
                  type="button"
                  onClick={() => setSpecialistPayoutTab('pending')}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${specialistPayoutTab === 'pending' ? 'bg-dark-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  Pending Confirmation
                </button>
                <button
                  type="button"
                  onClick={() => setSpecialistPayoutTab('history')}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${specialistPayoutTab === 'history' ? 'bg-dark-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  Payout History
                </button>
              </div>
            </h2>
            <p className="text-gray-400 text-xs">
              {specialistPayoutTab === 'pending' ? 'These disbursements were approved from the Maintenance module. Confirm payout here to mark as paid.' : 'History of all completed specialist disbursements and receipts.'}
            </p>
            
            <div className="overflow-x-auto border border-dark-700 rounded bg-dark-900/50">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-dark-700 bg-dark-900 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4">Specialist / Trade</th>
                    <th className="py-3 px-4">Disbursement Target Bank Details</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4 font-normal">Requisition Details / Notes</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {paginatedPayouts.filter(p => specialistPayoutTab === 'pending' ? p.payment_status === 'approved' : p.payment_status === 'paid').length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 px-4 text-center text-gray-500 italic text-xs">
                        {specialistPayoutTab === 'pending' ? 'No approved disbursements awaiting confirmation.' : 'No payout history found.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedPayouts.filter(p => specialistPayoutTab === 'pending' ? p.payment_status === 'approved' : p.payment_status === 'paid').map(pay => {
                      const profName = pay.professional?.name || 'Unknown Specialist';
                      const trade = pay.professional?.trade_specialty || 'General';
                      const bankName = pay.professional?.bank_name || 'N/A';
                      const acctNum = pay.professional?.account_number || 'N/A';
                      const acctName = pay.professional?.account_name || 'N/A';
                      
                      return (
                        <tr key={pay.id} className="hover:bg-dark-700/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-white">{profName}</p>
                            <span className="inline-block bg-brand-500/10 text-brand-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1">
                              {trade}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-sans text-xs">
                            <div className="bg-dark-900/70 p-2.5 rounded-lg border border-dark-750 max-w-xs space-y-1">
                              <div className="flex justify-between text-gray-400">
                                <span>Bank:</span>
                                <strong className="text-white">{bankName}</strong>
                              </div>
                              <div className="flex justify-between text-gray-400">
                                <span>Acct #:</span>
                                <strong className="text-brand-500 font-mono font-bold select-all">{acctNum}</strong>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5 truncate italic" title={acctName}>
                                {acctName}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-white text-base">
                            ₦{Number(pay.amount_ngn).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-400 max-w-sm">
                            <p className="line-clamp-2" title={pay.notes}>
                              {pay.notes || 'Disbursement requested for maintenance ticket.'}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {specialistPayoutTab === 'pending' ? (
                              <button
                                disabled={isFrontOfficeClosed}
                                onClick={() => handleProcessSpecialistPayout(pay)}
                                className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold text-xs py-2 px-4 rounded-lg shadow-md transition-all inline-flex items-center gap-1 hover:scale-102 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <ArrowRightLeft size={13} /> Confirm Payout
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setActivePayoutReceipt(pay);
                                  setIsPayoutReceiptModalOpen(true);
                                }}
                                className="bg-dark-700 hover:bg-dark-600 text-brand-400 font-bold text-xs py-2 px-4 rounded-lg shadow-md transition-all inline-flex items-center gap-1 hover:scale-102 active:scale-98"
                              >
                                <FileText size={13} /> View Receipt
                              </button>
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
              currentPage={currentPagePayouts}
              totalItems={specialistPayouts.filter(p => specialistPayoutTab === 'pending' ? p.payment_status === 'approved' : p.payment_status === 'paid').length}
              pageSize={pageSize}
              onPageChange={setCurrentPagePayouts}
            />
          </div>

          {/* Reminder / Subscription Payouts */}
          <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-orange-400 flex items-center gap-2">
              <CalendarClock className="text-orange-400" /> Subscriptions & Utility Schedule Payouts ({reminderPayouts.length})
            </h2>
            <p className="text-gray-400 text-xs">
              These are subscription and utility payments approved by scheduling. Confirm payment to finalize the expense ledger, print a receipt, and auto-schedule the next recurrence.
            </p>

            <div className="overflow-x-auto border border-dark-700 rounded bg-dark-900/50">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-dark-700 bg-dark-900 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4">Schedule / Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Recurrence</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {reminderPayouts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 px-4 text-center text-gray-500 italic text-xs">
                        No pending subscription/utility payment approvals at this time.
                      </td>
                    </tr>
                  ) : (
                    reminderPayouts.map(rem => (
                      <tr key={rem.id} className="hover:bg-dark-700/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-white">{rem.title}</p>
                          {rem.description && (
                            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{rem.description}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">{rem.category}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white text-base">
                          ₦{Number(rem.amount_ngn || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-400 font-mono">{rem.due_date}</td>
                        <td className="py-3.5 px-4 text-xs text-gray-400 capitalize">{rem.recurrence}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            disabled={isFrontOfficeClosed}
                            onClick={() => handleConfirmReminderPayout(rem)}
                            className="bg-orange-500 hover:bg-orange-400 text-dark-900 font-bold text-xs py-2 px-4 rounded-lg shadow-md transition-all inline-flex items-center gap-1 hover:scale-102 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <CheckCircle size={13} /> Confirm Payment
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hall & Catering Booking Payouts */}
          <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-emerald-450 flex items-center gap-2">
              <Landmark className="text-emerald-450" /> Hall & Catering Booking Payouts ({hallPayouts.length})
            </h2>
            <p className="text-gray-400 text-xs">
              These are event hall and catering bookings awaiting payment confirmation. Confirm payment here to mark the booking as confirmed, record payment inflow, and print the receipt.
            </p>

            <div className="overflow-x-auto border border-dark-700 rounded bg-dark-900/50">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-dark-700 bg-dark-900 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4">Booking Ref / Guest</th>
                    <th className="py-3 px-4">Event Hall</th>
                    <th className="py-3 px-4">Event Date / Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {hallPayouts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 px-4 text-center text-gray-500 italic text-xs">
                        No pending hall booking payment confirmations at this time.
                      </td>
                    </tr>
                  ) : (
                    hallPayouts.map(hb => (
                      <tr key={hb.id} className="hover:bg-dark-700/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-white">{hb.booking_reference}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{hb.guest_name}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white">{hb.halls?.name || 'Event Space'}</span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-400">
                          <p className="font-medium">{hb.booking_date}</p>
                          <span className="text-[10px] text-gray-500 mt-0.5 capitalize">{hb.booking_type}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white text-base">
                          ₦{Number(hb.total_amount_ngn || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            disabled={isFrontOfficeClosed}
                            onClick={() => {
                              setActiveHallPayoutModal(hb);
                              setPaymentAmount(Math.max(0, Number(hb.total_amount_ngn || 0) - Number(hb.amount_paid_ngn || 0)).toString());
                              setPaymentMethod('bank_transfer');
                            }}
                            className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-bold text-xs py-2 px-4 rounded-lg shadow-md transition-all inline-flex items-center gap-1 hover:scale-102 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <CheckCircle size={13} /> Confirm Payment
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {activeTab === 'settlements' && hasAccess('Accounting') && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-dark-800 border border-dark-700 p-6 rounded-lg shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-brand-500 flex items-center gap-2">
                  <RefreshCcw className="text-brand-500" /> Guest Refund Settlements & Bank Outwards ({getFilteredSettlements().length})
                </h2>
                <p className="text-gray-400 text-xs">
                  Generate daily, weekly, or monthly reports for outward bank settlements, print reports, and mark refunds as paid.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrintSettlements}
                  className="bg-brand-500 hover:bg-brand-600 text-dark-950 font-bold text-xs py-2 px-4 rounded shadow-md transition-all inline-flex items-center gap-2 hover:scale-102 active:scale-98"
                >
                  <Printer size={14} /> Print Bank Report
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-900 border border-dark-700 rounded-lg">
              <span className="text-xs text-gray-400 font-medium">Batch Filter:</span>
              <div className="flex gap-2">
                {['all', 'daily', 'weekly', 'monthly'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSettlementFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${
                      settlementFilter === filter
                        ? 'bg-brand-500 text-dark-950'
                        : 'bg-dark-850 text-gray-400 hover:text-white hover:bg-dark-750'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto border border-dark-700 rounded bg-dark-900/50">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-dark-700 bg-dark-900 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4">Guest Info</th>
                    <th className="py-3 px-4">Refund Amount</th>
                    <th className="py-3 px-4">Settlement Bank Details</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {settlementsLoading ? (
                    <tr>
                      <td colSpan="5" className="py-8 px-4 text-center text-gray-500">
                        Loading settlements...
                      </td>
                    </tr>
                  ) : paginatedSettlements.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 px-4 text-center text-gray-500 italic text-xs">
                        No settlements found for this filter batch.
                      </td>
                    </tr>
                  ) : (
                    paginatedSettlements.map((setl) => {
                      return (
                        <tr key={setl.id} className="hover:bg-dark-700/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-white">{setl.guest_name}</p>
                            <span className="text-xs text-gray-400 font-mono">{setl.guest_email}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-red-400 text-base">
                            ₦{Number(setl.refund_amount).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-xs">
                            <div className="bg-dark-900/70 p-2.5 rounded-lg border border-dark-750 max-w-xs space-y-1">
                              <div className="flex justify-between text-gray-400">
                                <span>Bank:</span>
                                <strong className="text-white">{setl.bank_name}</strong>
                              </div>
                              <div className="flex justify-between text-gray-400">
                                <span>Acct #:</span>
                                <strong className="text-brand-500 font-mono font-bold select-all">{setl.account_number}</strong>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5 truncate italic" title={setl.account_name}>
                                {setl.account_name}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${
                                setl.status === 'settled'
                                  ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}
                            >
                              {setl.status}
                            </span>
                            {setl.settled_at && (
                              <p className="text-[10px] text-gray-500 font-mono mt-1">
                                Settled: {new Date(setl.settled_at).toLocaleDateString()}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {setl.status !== 'settled' && (
                              <button
                                disabled={isFrontOfficeClosed}
                                onClick={() => handleMarkAsSettled(setl.id)}
                                className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-md transition-all inline-flex items-center gap-1 hover:scale-102 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <CheckCircle size={13} /> Mark as Settled
                              </button>
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
              currentPage={currentPageSettlements}
              totalItems={filteredSettlements.length}
              pageSize={pageSize}
              onPageChange={setCurrentPageSettlements}
            />
          </div>
        </div>
      )}

      {/* --- Payment Modal (Multi-Gateway Mock) --- */}
      {activePaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => !isProcessing && setActivePaymentModal(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><CreditCard className="text-brand-500"/> Process Payment</h2>
            <p className="text-sm text-gray-400 mb-6">Invoice: {activePaymentModal.invoice_number}</p>
            
            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Payment Method Gateway</label>
                <select disabled={isProcessing} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white outline-none focus:border-brand-500 transition-colors">
                  <option value="paystack">Paystack</option>
                  <option value="flutterwave">Flutterwave</option>
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="ar">Accounts Receivable (AR)</option>
                  <option value="bank_transfer">Bank Transfer (Manual)</option>
                  <option value="pos">POS Terminal (Manual)</option>
                  <option value="cash">Cash (Manual)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Amount to Charge (₦)</label>
                <input 
                  disabled={isProcessing}
                  required 
                  type="number" 
                  max={activePaymentModal.total_amount - activePaymentModal.amount_paid} 
                  min="1" 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white outline-none focus:border-brand-500 transition-colors" 
                />
                <p className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>Balance Due: ₦{(activePaymentModal.total_amount - activePaymentModal.amount_paid).toLocaleString()}</span>
                  <span className="text-brand-500 cursor-pointer hover:underline" onClick={() => setPaymentAmount((activePaymentModal.total_amount - activePaymentModal.amount_paid).toString())}>Pay Full</span>
                </p>
              </div>

              <button type="submit" disabled={isProcessing || !paymentAmount} className={`w-full py-3 mt-4 rounded font-bold transition-all flex items-center justify-center gap-2 ${isProcessing || !paymentAmount ? 'bg-dark-700 text-gray-500 cursor-not-allowed' : 'bg-brand-500 text-dark-900 hover:bg-brand-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]'}`}>
                {isProcessing ? <><RefreshCcw size={18} className="animate-spin" /> Processing via {paymentMethod.toUpperCase()}...</> : `Charge ₦${Number(paymentAmount).toLocaleString()}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Refund Modal --- */}
      {activeRefundModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => !isProcessing && setActiveRefundModal(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ArrowRightLeft className="text-red-500"/> Issue Refund</h2>
            <p className="text-sm text-gray-400 mb-6">Invoice: {activeRefundModal.invoice_number}</p>
            
            <form onSubmit={handleIssueRefund} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Refund Method</label>
                <select disabled={isProcessing} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white outline-none focus:border-red-500 transition-colors">
                  <option value="ar">Accounts Receivable (AR)</option>
                  <option value="bank_transfer">Bank Transfer (Manual Outward)</option>
                  <option value="stripe">Stripe (Auto Reversal)</option>
                  <option value="paystack">Paystack (Auto Reversal)</option>
                  <option value="cash">Cash (Manual Outward)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Amount to Refund (₦)</label>
                <input 
                  disabled={isProcessing}
                  required 
                  type="number" 
                  max={Number(activeRefundModal.amount_paid) - Number(activeRefundModal.total_amount)} 
                  min="1" 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-white outline-none focus:border-red-500 transition-colors" 
                />
                <p className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>Max Refundable: ₦{Number(activeRefundModal.amount_paid - activeRefundModal.total_amount).toLocaleString()}</span>
                  <span className="text-red-500 cursor-pointer hover:underline" onClick={() => setPaymentAmount((Number(activeRefundModal.amount_paid) - Number(activeRefundModal.total_amount)).toString())}>Refund Full Amount</span>
                </p>
              </div>

              {/* Guest Bank Details — only shown for bank_transfer */}
              {paymentMethod === 'bank_transfer' && (
                <div className="bg-dark-900/60 p-4 border border-dark-700/60 rounded-xl space-y-3">
                  <span className="text-xs uppercase font-bold text-red-400 tracking-wider">Guest Settlement Bank Details</span>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Bank Name *</label>
                    <select
                      required={paymentMethod === 'bank_transfer'}
                      disabled={isProcessing}
                      value={refundBankName}
                      onChange={e => setRefundBankName(e.target.value)}
                      className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-white text-xs outline-none focus:border-red-500"
                    >
                      <option value="">Select Bank</option>
                      {nigerianBanks.length > 0 ? nigerianBanks.map(bank => (
                        <option key={typeof bank === 'string' ? bank : bank.name} value={typeof bank === 'string' ? bank : bank.name}>
                          {typeof bank === 'string' ? bank : bank.name}
                        </option>
                      )) : (
                        <>
                          <option value="Access Bank">Access Bank</option>
                          <option value="First Bank">First Bank</option>
                          <option value="GTBank">GTBank</option>
                          <option value="Zenith Bank">Zenith Bank</option>
                          <option value="UBA">UBA</option>
                          <option value="Opay">Opay</option>
                          <option value="Kuda Bank">Kuda Bank</option>
                          <option value="Sterling Bank">Sterling Bank</option>
                          <option value="Polaris Bank">Polaris Bank</option>
                          <option value="Stanbic IBTC">Stanbic IBTC</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Account Number *</label>
                      <input
                        required={paymentMethod === 'bank_transfer'}
                        disabled={isProcessing}
                        type="text"
                        maxLength={10}
                        placeholder="10-digit number"
                        value={refundAccountNumber}
                        onChange={e => setRefundAccountNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-white text-xs outline-none focus:border-red-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Account Name *</label>
                      <input
                        required={paymentMethod === 'bank_transfer'}
                        disabled={isProcessing}
                        type="text"
                        placeholder="Account Holder"
                        value={refundAccountName}
                        onChange={e => setRefundAccountName(e.target.value)}
                        className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-white text-xs outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* OTP Security Verification — required for ALL refund methods */}
              <div className="bg-red-500/5 border border-red-500/15 p-4 rounded-xl space-y-3">
                <span className="text-xs uppercase font-bold text-red-500 tracking-wider">Manager Authorization Code</span>
                
                {!otpSent ? (
                  <button
                    type="button"
                    disabled={isProcessing || (paymentMethod === 'bank_transfer' && (!refundBankName || !refundAccountNumber || !refundAccountName))}
                    onClick={requestRefundOTP}
                    className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 py-2.5 rounded text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Request Manager Security OTP
                  </button>

                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-400">
                      Enter the 6-digit OTP code sent to Manager's phone number ({managerPhoneDisplay.slice(0, 4)}***{managerPhoneDisplay.slice(-4)}):
                    </p>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 bg-dark-900 border border-dark-700 rounded p-2 text-white text-center text-sm font-bold font-mono outline-none focus:border-red-500"
                      />
                      <button
                        type="button"
                        onClick={requestRefundOTP}
                        className="bg-dark-750 hover:bg-dark-700 border border-dark-700 px-3 py-2 rounded text-xs font-bold text-gray-300 transition-all"
                      >
                        Resend
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-xs mt-2">
                Warning: Once a refund is recorded, it will deduct from the total amount paid on this invoice and the booking.
              </div>

              <button type="submit" disabled={isProcessing || !paymentAmount || !otpSent || otpInput.length < 6} className={`w-full py-3 mt-4 rounded font-bold transition-all flex items-center justify-center gap-2 ${isProcessing || !paymentAmount || !otpSent || otpInput.length < 6 ? 'bg-dark-700 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`}>
                {isProcessing ? <><RefreshCcw size={18} className="animate-spin" /> Processing Refund...</> : `Authorize & Confirm Refund (₦${Number(paymentAmount).toLocaleString()})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- View/Print Invoice Modal --- */}
      {activeInvoiceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-start z-50 p-4 md:p-10 overflow-y-auto print:bg-white select-none">
          {/* Floating Fixed Close Button */}
          <button 
            onClick={() => setActiveInvoiceModal(null)} 
            className="fixed top-6 right-6 z-[60] bg-dark-900/90 hover:bg-dark-750 text-white p-3 rounded-full border border-dark-700 hover:border-red-500/40 hover:text-red-400 hover:scale-110 transition-all shadow-2xl print:hidden flex items-center justify-center cursor-pointer"
            title="Close Invoice (Esc)"
          >
            <X size={22} className="stroke-[2.5]" />
          </button>
          
          <div className={`print-container ${printType === 'thermal' ? 'print-thermal' : 'print-a4'} bg-dark-800 border border-dark-700 text-gray-300 print:border-none print:bg-white print:text-black w-full max-w-3xl rounded-xl shadow-2xl relative my-8 p-8 animate-in zoom-in-95 print:!m-0 print:!p-8`}>
            
            {/* Print Button */}
            <div className="flex gap-2 mb-6 print:hidden">
               <button onClick={() => { setPrintType('a4'); setTimeout(() => window.print(), 100); }} className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors">
                 <Printer size={18} /> Print (A4)
               </button>
               <button onClick={() => { setPrintType('thermal'); setTimeout(() => window.print(), 100); }} className="bg-dark-700 hover:bg-dark-800 text-white px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors">
                 <Printer size={18} /> Print (Thermal)
               </button>
            </div>

            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b border-dark-700 print:border-gray-200 pb-6 mb-6">
              <div>
                <h1 className="text-4xl font-black tracking-tight mb-1 text-white print:text-black">
                  {activeInvoiceModal.status === 'paid' ? 'OFFICIAL RECEIPT' : 'INVOICE'}
                </h1>
                <p className="text-gray-400 print:text-gray-500 font-medium">#{activeInvoiceModal.invoice_number}</p>
              </div>
              <div className="text-right">
                <div className="flex flex-col justify-center items-end">
                  {contactInfo.logo ? (
                    <img src={contactInfo.logo} alt="Sparkles Apartments Logo" className="max-h-12 object-contain print:max-h-16 mb-2" />
                  ) : (
                    <>
                      <span className="text-[20px] font-sans font-extrabold text-white print:text-black leading-none tracking-wide">SPARKLES</span>
                      <span className="text-[10px] font-sans text-brand-500 leading-tight tracking-[0.25em] mt-1">APARTMENTS</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-400 print:text-gray-500 mt-2">{contactInfo.address}</p>
                <p className="text-sm text-gray-400 print:text-gray-500">{contactInfo.email}</p>
                <p className="text-sm text-gray-400 print:text-gray-500">{contactInfo.phone.split(',')[0]}</p>
              </div>
            </div>

            {/* Invoice Info */}
            <div className="flex justify-between mb-8">
              <div>
                <p className="text-sm text-gray-500 font-bold uppercase mb-1">Billed To:</p>
                <p className="font-bold text-lg text-white print:text-black">
                  {activeInvoiceModal.bookings 
                    ? (activeInvoiceModal.bookings.profiles ? `${activeInvoiceModal.bookings.profiles.first_name} ${activeInvoiceModal.bookings.profiles.last_name}` : activeInvoiceModal.bookings.guest_name) 
                    : (activeInvoiceModal.hall_bookings?.guest_name || 'Walk-in Guest')}
                </p>
                {(activeInvoiceModal.bookings?.profiles?.phone || activeInvoiceModal.hall_bookings?.guest_phone) && (
                  <p className="text-sm text-gray-400 print:text-gray-650 font-medium">
                    {activeInvoiceModal.bookings?.profiles?.phone || activeInvoiceModal.hall_bookings?.guest_phone}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-left">
                  <span className="text-gray-400 print:text-gray-500 font-bold">Issue Timestamp:</span>
                  <span className="font-medium text-white print:text-black">{activeInvoiceModal.created_at ? format(new Date(activeInvoiceModal.created_at), 'MMM dd, yyyy, HH:mm') : format(new Date(activeInvoiceModal.issue_date), 'MMM dd, yyyy')}</span>
                  <span className="text-gray-400 print:text-gray-500 font-bold">Due Date:</span>
                  <span className="font-medium text-white print:text-black">{format(new Date(activeInvoiceModal.due_date), 'MMM dd, yyyy')}</span>
                  <span className="text-gray-400 print:text-gray-500 font-bold">Booking Ref:</span>
                  <span className="font-medium text-white print:text-black">{activeInvoiceModal.bookings?.booking_reference || activeInvoiceModal.hall_bookings?.booking_reference || 'N/A'}</span>
                  <span className="text-gray-400 print:text-gray-500 font-bold">Status:</span>
                  <span className={`font-bold uppercase ${activeInvoiceModal.status === 'paid' ? 'text-green-400 print:text-green-600' : activeInvoiceModal.status === 'partial' ? 'text-yellow-400 print:text-yellow-600' : 'text-red-400 print:text-red-655'}`}>
                    {activeInvoiceModal.status === 'paid' ? 'paid' : 
                     activeInvoiceModal.status === 'partial' ? 'partial' : 
                     activeInvoiceModal.status === 'cancelled' ? 'cancelled' : 'not paid'}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <table className="w-full mb-8 text-sm border-collapse text-left">
              <thead className="bg-dark-900/50 border-y border-dark-700 text-gray-400 print:bg-gray-100 print:border-gray-200 print:text-gray-600">
                <tr>
                  <th className="py-3 px-4 text-left font-bold">Description</th>
                  <th className="py-3 px-4 text-center font-bold">Payment Status</th>
                  <th className="py-3 px-4 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50 print:divide-gray-100">
                {(() => {
                  const renderStatusBadge = (status) => {
                    const normalized = (status || 'unpaid').toLowerCase();
                    let colorClasses = '';
                    let label = normalized;
                    if (normalized === 'paid') {
                      colorClasses = 'bg-green-500/10 text-green-500 border border-green-500/20 print:bg-green-100 print:text-green-800 print:border-green-200';
                      label = 'Paid';
                    } else if (normalized === 'partial' || normalized === 'partially paid') {
                      colorClasses = 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 print:bg-yellow-100 print:text-yellow-800 print:border-yellow-250';
                      label = 'Partial';
                    } else if (normalized === 'awaiting_confirmation') {
                      colorClasses = 'bg-amber-500/10 text-amber-500 border border-amber-500/20 print:bg-amber-100 print:text-amber-800 print:border-amber-250';
                      label = 'Awaiting';
                    } else {
                      colorClasses = 'bg-red-500/10 text-red-500 border border-red-500/20 print:bg-red-100 print:text-red-800 print:border-red-200';
                      label = 'Unpaid';
                    }
                    return (
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${colorClasses}`}>
                        {label}
                      </span>
                    );
                  };

                  if (activeInvoiceModal.hall_bookings) {
                    const hb = activeInvoiceModal.hall_bookings;
                    return (
                      <>
                        <tr>
                          <td className="py-4 px-4">
                            <p className="font-bold text-white print:text-black">
                              Hall Space Rental: {hb.halls?.name || 'Event Space'}
                            </p>
                            <p className="text-gray-400 print:text-gray-500 text-xs mt-0.5">
                              Booking Date: {hb.booking_date} | Type: {hb.booking_type === 'daily' ? 'Daily Rental' : 'Hourly Rental'}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-1">
                              Duration: {hb.booking_type === 'daily' ? `${hb.num_days} Day(s)` : `${hb.num_hours} Hour(s)`} | Capacity: {hb.halls?.capacity || 'N/A'} Guests
                            </p>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {renderStatusBadge(hb.payment_status)}
                          </td>
                          <td className="py-4 px-4 text-right font-medium text-white print:text-black font-mono">
                            ₦{Number(hb.total_hall_price_ngn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {hallBookingMeals.map((meal) => (
                          <tr key={meal.id}>
                            <td className="py-4 px-4">
                              <p className="font-bold text-white print:text-black">
                                Catering: {meal.hall_meal_options?.name || meal.course_type}
                              </p>
                              <p className="text-gray-400 print:text-gray-500 text-xs mt-0.5">
                                Serving Date: {meal.serving_date} | Course: {meal.course_type}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1">
                                Rate: ₦{Number(meal.price_per_participant_ngn || 0).toLocaleString()} per pax | Participants: {meal.number_of_participants}
                              </p>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {renderStatusBadge(hb.payment_status)}
                            </td>
                            <td className="py-4 px-4 text-right font-medium text-white print:text-black font-mono">
                              ₦{Number(meal.total_price_ngn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  }

                  const booking = activeInvoiceModal.bookings || {};
                  const roomPrice = Number(booking.total_room_price_ngn || activeInvoiceModal.subtotal || 0);
                  const discount = Number(booking.discount_amount_ngn || 0);
                  const roomBase = Math.max(0, roomPrice - discount);
                  const roomTax = roomBase * 0.075;
                  const roomTotalWithTax = roomBase + roomTax;

                  const amountPaidTotal = Number(activeInvoiceModal.amount_paid || 0);
                  let remainingPaid = amountPaidTotal;

                  // Pay room first
                  let roomPaymentStatus = 'unpaid';
                  if (activeInvoiceModal.status === 'paid' || remainingPaid >= roomTotalWithTax) {
                    roomPaymentStatus = 'paid';
                    remainingPaid -= roomTotalWithTax;
                  } else if (remainingPaid > 0) {
                    roomPaymentStatus = 'partial';
                    remainingPaid = 0;
                  }

                  const rawServices = booking.booking_services || [];
                  const activeServices = rawServices.filter(s => s.status !== 'cancelled') || [];

                  // Calculate status for each service sequentially
                  const servicesWithStatus = activeServices.map(extra => {
                    const isTaxable = extra.services?.tax_inclusive !== false;
                    const sBasePrice = Number(extra.total_price_ngn || 0);
                    const sTax = isTaxable ? sBasePrice * 0.075 : 0;
                    const sTotal = sBasePrice + sTax;
                    const uPrice = Number(extra.unit_price_ngn || (extra.quantity > 0 ? sBasePrice / extra.quantity : sBasePrice));

                    let servicePaymentStatus = 'unpaid';
                    if (activeInvoiceModal.status === 'paid' || remainingPaid >= sTotal) {
                      servicePaymentStatus = 'paid';
                      remainingPaid -= sTotal;
                    } else if (remainingPaid > 0) {
                      servicePaymentStatus = 'partial';
                      remainingPaid = 0;
                    }

                    return {
                      ...extra,
                      calculatedStatus: servicePaymentStatus,
                      sBasePrice,
                      sTax,
                      sTotal,
                      uPrice,
                      isTaxable
                    };
                  });

                  return (
                    <>
                      <tr>
                        <td className="py-4 px-4">
                          <p className="font-bold text-white print:text-black">
                            Accommodation Charges (Rent + Tax) {booking.rooms ? `(${booking.rooms.name} - Room ${booking.rooms.room_number})` : ''}
                          </p>
                          <p className="text-gray-400 print:text-gray-500 text-xs mt-0.5">
                            Check-in: {booking.check_in_date || 'N/A'} | Check-out: {booking.check_out_date || 'N/A'}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Rate: ₦{roomPrice.toLocaleString()} {discount > 0 && `| Discount: -₦${discount.toLocaleString()}`} | Taxable Base: ₦{roomBase.toLocaleString()} | VAT (7.5%): ₦{roomTax.toLocaleString()}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {renderStatusBadge(roomPaymentStatus)}
                        </td>
                        <td className="py-4 px-4 text-right font-medium text-white print:text-black">
                          ₦{roomTotalWithTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {servicesWithStatus.map((extra) => {
                        return (
                          <tr key={extra.id}>
                            <td className="py-4 px-4">
                              <p className="font-bold text-white print:text-black">
                                {extra.services?.name || 'Guest Service'}
                              </p>
                              <p className="text-gray-400 print:text-gray-500 text-xs mt-0.5">
                                Unit Price: ₦{extra.uPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Quantity: {extra.quantity}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1">
                                Base: ₦{extra.sBasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {extra.isTaxable ? `| VAT (7.5%): ₦${extra.sTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '(VAT Exempt)'}
                              </p>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {renderStatusBadge(extra.calculatedStatus)}
                            </td>
                            <td className="py-4 px-4 text-right font-medium text-white print:text-black">
                              ₦{extra.sTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })()}
              </tbody>
            </table>

            {/* Totals */}
            {(() => {
              const totalAmount = Number(activeInvoiceModal.total_amount || 0);
              const amountPaid = Number(activeInvoiceModal.amount_paid || 0);
              const balance = Math.max(0, totalAmount - amountPaid);
              const discount = Number(activeInvoiceModal.bookings?.discount_amount_ngn || 0);

              return (
                <div className="flex justify-end">
                  <div className="w-64 space-y-3 text-sm">
                    <div className="flex justify-between text-gray-400 print:text-gray-600">
                      <span>Subtotal</span>
                      <span className="text-white print:text-black font-medium">
                        ₦{(totalAmount + discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-yellow-500 print:text-yellow-600 font-medium">
                        <span>Room Discount</span>
                        <span>
                          -₦{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t border-dark-700 print:border-gray-200 pt-2 text-white print:text-black">
                      <span>Total Due</span>
                      <span>₦{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    
                    {amountPaid > 0 && (
                      <div className="flex justify-between text-green-400 print:text-green-600 font-medium pt-2">
                        <span>Amount Paid</span>
                        <span>₦{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between font-black text-xl border-t-2 border-dark-700 print:border-gray-300 pt-2 text-brand-500 print:text-brand-600">
                      <span>Balance</span>
                      <span>₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Signatures */}
            <div className="flex justify-between items-end pt-12 border-t border-dashed border-dark-700 print:border-gray-200 mt-12 text-left">
              <div className="text-center w-48">
                <div className="border-b border-dark-700 print:border-gray-300 h-8"></div>
                <span className="text-[10px] text-gray-450 print:text-gray-500 font-semibold block mt-1.5 uppercase">Prepared By</span>
              </div>
              <div className="text-center w-48">
                <div className="border-b border-dark-700 print:border-gray-300 h-8"></div>
                <span className="text-[10px] text-gray-450 print:text-gray-500 font-semibold block mt-1.5 uppercase">Audited By (Hotel Manager)</span>
              </div>
            </div>

            <div className="mt-16 text-center text-xs text-gray-400 print:text-gray-500 border-t border-dark-700 print:border-gray-200 pt-4">
              <p>Thank you for choosing Sparkles Apartments.</p>
              <p>Payment is due by the specified due date. Late payments may incur additional fees.</p>
            </div>
          </div>
        </div>
      )}
      {/* --- MODAL: Hall Payout Confirmation Modal --- */}
      {activeHallPayoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-8 w-full max-w-lg shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => { setActiveHallPayoutModal(null); setPaymentAmount(''); }} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-full bg-brand-500/10 flex items-center justify-center">
                <Landmark className="text-brand-500" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Confirm Hall Payment</h2>
                <p className="text-sm text-gray-400">Ref: {activeHallPayoutModal.booking_reference}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmHallPayoutSubmit} className="space-y-6">
              <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Guest Name</span>
                  <span className="text-white font-medium">{activeHallPayoutModal.guest_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Amount</span>
                  <span className="text-white font-bold">₦{Number(activeHallPayoutModal.total_amount_ngn || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Already Paid</span>
                  <span className="text-green-400 font-bold">₦{Number(activeHallPayoutModal.amount_paid_ngn || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-dark-700 pt-3">
                  <span className="text-gray-400">Outstanding Balance</span>
                  <span className="text-red-400 font-black text-lg">₦{Math.max(0, Number(activeHallPayoutModal.total_amount_ngn || 0) - Number(activeHallPayoutModal.amount_paid_ngn || 0)).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Amount (₦)</label>
                <input
                  type="number"
                  min="1"
                  max={Math.max(0, Number(activeHallPayoutModal.total_amount_ngn || 0) - Number(activeHallPayoutModal.amount_paid_ngn || 0))}
                  required
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3.5 text-white outline-none focus:border-brand-500 text-lg font-bold font-mono transition-colors"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-white outline-none focus:border-brand-500"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="pos">POS Terminal</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4 border-t border-dark-700">
                <button type="submit" className="bg-brand-500 hover:bg-brand-400 text-dark-900 flex-1 py-3.5 text-sm font-bold rounded-lg shadow-lg transition-all">
                  Confirm Payment & Print Receipt
                </button>
                <button type="button" onClick={() => { setActiveHallPayoutModal(null); setPaymentAmount(''); }} className="border border-dark-600 text-gray-300 flex-1 py-3.5 text-sm font-bold rounded-lg hover:bg-dark-700 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Payout Receipt Modal --- */}
      {isPayoutReceiptModalOpen && activePayoutReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-8 w-full max-w-lg shadow-2xl relative rounded-xl animate-in zoom-in-95">
            <button onClick={() => setIsPayoutReceiptModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-full bg-brand-500/10 flex items-center justify-center">
                <FileText className="text-brand-500" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Payout Receipt</h2>
                <p className="text-sm text-gray-400">Ref: {activePayoutReceipt.transaction_reference || 'N/A'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Date Paid</span>
                  <span className="text-white font-medium">{activePayoutReceipt.paid_at ? format(new Date(activePayoutReceipt.paid_at), 'MMM dd, yyyy HH:mm') : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Specialist</span>
                  <span className="text-white font-bold">{activePayoutReceipt.professional?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Bank Details</span>
                  <span className="text-white text-right">
                    {activePayoutReceipt.professional?.bank_name} - <span className="font-mono">{activePayoutReceipt.professional?.account_number}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-brand-400 font-bold font-mono text-lg">₦{Number(activePayoutReceipt.amount_ngn).toLocaleString()}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-dark-700">
                  <span className="text-gray-400 text-xs block mb-1">Notes / Description</span>
                  <p className="text-gray-300 text-sm italic">{activePayoutReceipt.notes || 'None'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => window.print()}
                className="bg-dark-700 hover:bg-dark-600 text-white font-bold text-sm py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminBilling;

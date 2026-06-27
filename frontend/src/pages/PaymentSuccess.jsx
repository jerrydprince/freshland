import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { 
  CheckCircle, Printer, Wallet, Home, ArrowRight, 
  Lock, Mail, Phone, User, Calendar, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

const safeFormatDate = (dateVal, formatStr = 'MMM dd, yyyy') => {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return format(d, formatStr);
  } catch (e) {
    console.error("Date formatting error:", e);
    return 'N/A';
  }
};


const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const type = searchParams.get('type') || 'booking';
  const ref = searchParams.get('ref');
  const paymentId = searchParams.get('payment_id');
  const amountParam = searchParams.get('amount');
  const password = searchParams.get('password');

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [contactInfo, setContactInfo] = useState({
    address: 'Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja',
    logo: ''
  });

  useEffect(() => {
    fetchPaymentDetails();
  }, [type, ref, paymentId]);

  const fetchPaymentDetails = async () => {
    setLoading(true);
    try {
      try {
        const { data: settingsData } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['contact_address', 'contact_logo']);

        if (settingsData) {
          const settingsMap = settingsData.reduce((acc, curr) => {
            acc[curr.setting_key] = curr.setting_value;
            return acc;
          }, {});
          setContactInfo(prev => ({
            ...prev,
            address: settingsMap.contact_address || prev.address,
            logo: settingsMap.contact_logo || prev.logo
          }));
        }
      } catch (settingsErr) {
        console.warn("Failed to load contact settings in PaymentSuccess:", settingsErr);
      }
      if (type === 'booking' && ref) {
        // Fetch booking details
        const { data: bookingData, error: bookingErr } = await supabase
          .from('bookings')
          .select('*, rooms(*)')
          .eq('booking_reference', ref)
          .maybeSingle();

        if (bookingErr) throw bookingErr;
        setBooking(bookingData);

        if (bookingData) {
          // Fetch associated paystack payment
          const { data: payData } = await supabase
            .from('payments')
            .select('*')
            .eq('booking_id', bookingData.id)
            .eq('method', 'paystack')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setPayment(payData);
        }
      } else if (type === 'hall_booking' && ref) {
        const { data: bookingData, error: bookingErr } = await supabase
          .from('hall_bookings')
          .select('*, halls(*)')
          .eq('booking_reference', ref)
          .maybeSingle();

        if (bookingErr) throw bookingErr;
        setBooking(bookingData);

        if (bookingData) {
          const { data: payData } = await supabase
            .from('payments')
            .select('*')
            .eq('hall_booking_id', bookingData.id)
            .eq('method', 'paystack')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setPayment(payData);
        }
      } else if (type === 'wallet') {
        // Fetch payment details
        if (paymentId) {
          const { data: payData } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .maybeSingle();
          setPayment(payData);
        }

        // Fetch wallet balance
        if (user?.email) {
          const { data: guestData } = await supabase
            .from('crm_guests')
            .select('wallet_balance')
            .eq('email', user.email.toLowerCase())
            .maybeSingle();
          if (guestData) {
            setWalletBalance(guestData.wallet_balance);
          }
        }
      } else if (type === 'service') {
        // Fetch payment details
        if (paymentId) {
          const { data: payData } = await supabase
            .from('payments')
            .select('*, bookings(*)')
            .eq('id', paymentId)
            .maybeSingle();
          setPayment(payData);
          if (payData && payData.bookings) {
            setBooking(payData.bookings);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching success page details:", err);
      toast.error("Failed to load receipt details.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500 mb-4"></div>
        <p className="text-gray-400 text-sm">Verifying transaction and generating receipt...</p>
      </div>
    );
  }

  const amountPaid = Number(amountParam || payment?.amount || 0);
  const receiptDate = payment?.processed_at || payment?.created_at || new Date().toISOString();

  return (
    <div className="min-h-screen bg-dark-900 text-white flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full space-y-6 z-10 print:max-w-full print:p-0">
        
        {/* Header Block (Hidden on print) */}
        <div className="text-center space-y-2 print:hidden">
          <div className="inline-flex w-16 h-16 bg-emerald-500/10 rounded-full items-center justify-center border border-emerald-500/30 animate-bounce">
            <CheckCircle className="text-emerald-400 w-9 h-9" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Payment Successful!</h1>
          <p className="text-gray-400 text-sm">Your transaction has been processed securely via Paystack.</p>
        </div>

        {/* Credentials / Auto-password Box (Hidden on print) */}
        {password && (
          <div className="bg-gold-500/5 border border-gold-500/20 rounded-2xl p-6 text-left animate-in slide-in-from-bottom duration-300 print:hidden">
            <h4 className="font-bold text-gold-500 mb-2 flex items-center gap-2">
              🔑 Guest Account Auto-Created!
            </h4>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              A guest profile has been automatically generated using your booking email. You can log in to manage your reservation, request room services, and view financials:
            </p>
            <div className="space-y-2 font-mono text-xs bg-dark-950/50 p-4 rounded-xl border border-dark-700/35">
              <div className="flex justify-between">
                <span className="text-gray-500">Username/Email:</span>
                <span className="text-white font-bold">{booking?.guest_email || user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Temporary Password:</span>
                <span className="text-white font-bold select-all">{password}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-3 italic flex items-center gap-1">
              💡 Tip: We recommend changing your password inside the guest portal profile page.
            </p>
          </div>
        )}

        {/* Receipt Wrapper */}
        <div className="glass-panel print-container print-a4 border border-dark-700/60 rounded-3xl overflow-hidden shadow-2xl bg-dark-800/80 backdrop-blur-md print:border-none print:shadow-none print:bg-transparent">
          
          {/* Receipt Top Section */}
          <div className="p-6 md:p-8 bg-dark-900/60 border-b border-dark-700/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:bg-transparent">
            <div>
              <div className="flex items-center gap-3">
                {contactInfo.logo ? (
                  <img src={contactInfo.logo} alt="Sparkles Apartments Logo" className="max-h-12 object-contain print:max-h-16" />
                ) : (
                  <div className="text-gold-500 font-black tracking-widest text-lg uppercase flex items-center gap-2">
                    <ShieldCheck size={20} />
                    <span>Sparkles Apartments</span>
                  </div>
                )}
              </div>
              {contactInfo.logo && (
                <div className="text-gold-500 font-black tracking-widest text-sm uppercase mt-1 print:text-black">
                  Sparkles Apartments
                </div>
              )}
              <p className="text-xs text-gray-500 mt-0.5 print:text-black">{contactInfo.address}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 uppercase tracking-wider block font-bold">Receipt Log</span>
              <span className="font-mono text-[10px] text-gray-500">Ref: {payment?.transaction_ref || 'N/A'}</span>
            </div>
          </div>

          {/* Receipt Content */}
          <div className="p-6 md:p-8 space-y-6">
            
            {/* Amount Box */}
            <div className="bg-dark-900/40 border border-dark-700/50 p-6 rounded-2xl text-center space-y-1">
              <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Amount Paid</span>
              <div className="text-3xl font-black text-brand-400 font-mono">
                ₦{amountPaid.toLocaleString()}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                Successful
              </div>
            </div>

            {/* General Transaction Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">Transaction Summary</h3>
              <div className="grid grid-cols-2 gap-y-2.5 text-xs font-medium border-t border-dark-700/40 pt-3">
                <span className="text-gray-400">Payment Gateway</span>
                <span className="text-white text-right font-semibold">Paystack (Online)</span>

                <span className="text-gray-400">Payment Date / Time</span>
                <span className="text-white text-right font-mono">
                  {safeFormatDate(receiptDate, 'MMM dd, yyyy HH:mm:ss')}
                </span>

                <span className="text-gray-400">Payment ID</span>
                <span className="text-white text-right font-mono truncate max-w-[180px] self-end justify-self-end" title={payment?.id}>
                  {payment?.id || 'N/A'}
                </span>

                {type === 'wallet' && walletBalance !== null && (
                  <>
                    <span className="text-gray-400">New Prepayment Balance</span>
                    <span className="text-emerald-400 text-right font-bold font-mono">₦{Number(walletBalance).toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>

            {/* Booking Details Section (Render if type booking) */}
            {type === 'booking' && booking && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">Reservation Details</h3>
                <div className="bg-dark-900/30 p-4 border border-dark-700/40 rounded-2xl text-xs space-y-3">
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-semibold">Booking Reference</span>
                    <span className="font-bold text-white font-mono tracking-wider">{booking.booking_reference}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Guest Name</span>
                    <span className="font-bold text-white">{booking.guest_name}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Room</span>
                    <span className="font-bold text-white">Room {booking.rooms?.room_number || 'N/A'} — {booking.rooms?.name || 'Luxe Room'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2.5 border-t border-dark-700/40 text-[11px]">
                    <div>
                      <span className="text-gray-500 block">Check-in</span>
                      <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                        <Calendar size={12} className="text-gold-500" />
                        {safeFormatDate(booking.check_in_date, 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Check-out</span>
                      <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                        <Calendar size={12} className="text-gold-500" />
                        {safeFormatDate(booking.check_out_date, 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {type === 'hall_booking' && booking && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">Hall Reservation Details</h3>
                <div className="bg-dark-900/30 p-4 border border-dark-700/40 rounded-2xl text-xs space-y-3">
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-semibold">Booking Reference</span>
                    <span className="font-bold text-white font-mono tracking-wider">{booking.booking_reference}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Guest Name</span>
                    <span className="font-bold text-white">{booking.guest_name}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Hall Name</span>
                    <span className="font-bold text-white">{booking.halls?.name || 'Event Hall'}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Booking Type / Duration</span>
                    <span className="font-bold text-white capitalize">{booking.booking_type} ({booking.booking_type === 'daily' ? `${booking.num_days} Days` : `${booking.num_hours} Hours`})</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Participants (Pax)</span>
                    <span className="font-bold text-white">{booking.number_of_participants} persons</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2.5 border-t border-dark-700/40 text-[11px]">
                    <div>
                      <span className="text-gray-500 block">Start Date / Time</span>
                      <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                        <Calendar size={12} className="text-gold-500" />
                        {safeFormatDate(booking.start_time, 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">End Date / Time</span>
                      <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                        <Calendar size={12} className="text-gold-500" />
                        {safeFormatDate(booking.end_time, 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Wallet Details Section (Render if type wallet) */}
            {type === 'wallet' && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">Wallet Profile</h3>
                <div className="bg-dark-900/30 p-4 border border-dark-700/40 rounded-2xl text-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-500 border border-brand-500/20">
                      <Wallet size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-white">{user?.email || 'N/A'}</p>
                      <span className="text-[10px] text-gray-500">Accounts Receivable Prepayment Account</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Service Details Section (Render if type service) */}
            {type === 'service' && payment && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-black uppercase text-gray-500 tracking-wider">Service Request Details</h3>
                <div className="bg-dark-900/30 p-4 border border-dark-700/40 rounded-2xl text-xs space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Description</span>
                    <span className="font-bold text-white text-right">{payment.notes || 'Additional Service Payment'}</span>
                  </div>
                  {booking && (
                    <div className="flex justify-between items-center border-t border-dark-700/30 pt-2.5">
                      <span className="text-gray-400">Linked Booking Reference</span>
                      <span className="font-bold text-white font-mono tracking-wider">{booking.booking_reference}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Receipt Footer for Print */}
          <div className="hidden print:block text-center text-[10px] text-gray-500 border-t border-dashed border-gray-700 pt-6 pb-2">
            Thank you for choosing Sparkles Apartments.<br />
            This is a computer-generated digital receipt. Secure payment verified via Paystack.
          </div>

        </div>

        {/* Action Buttons (Hidden on print) */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center print:hidden">
          <button 
            onClick={handlePrint} 
            className="w-full sm:w-auto bg-gold-500 hover:bg-gold-600 text-dark-900 font-extrabold py-3 px-6 text-sm flex items-center justify-center gap-2 rounded-xl transition-all active:scale-95 shadow-lg shadow-gold-500/10"
          >
            <Printer size={16} />
            <span>Print Receipt</span>
          </button>

          {type === 'booking' || type === 'hall_booking' ? (
            <>
              <button 
                onClick={() => navigate('/guest')} 
                className="w-full sm:w-auto border border-dark-600 bg-dark-800 hover:bg-dark-700 text-white font-semibold py-3 px-6 text-sm rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <span>Guest Dashboard</span>
                <ArrowRight size={14} />
              </button>
              <button 
                onClick={() => navigate('/booking')} 
                className="w-full sm:w-auto text-gray-400 hover:text-white text-xs font-semibold py-2 px-4 transition-colors"
              >
                Book Another Room
              </button>
            </>
          ) : type === 'service' ? (
            <button 
              onClick={() => navigate('/guest/services')} 
              className="w-full sm:w-auto border border-dark-600 bg-dark-800 hover:bg-dark-700 text-white font-semibold py-3 px-6 text-sm rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <span>Return to Services</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button 
              onClick={() => navigate('/guest/financials')} 
              className="w-full sm:w-auto border border-dark-600 bg-dark-800 hover:bg-dark-700 text-white font-semibold py-3 px-6 text-sm rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <span>Return to Financials</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default PaymentSuccess;

import React, { useState, useEffect } from 'react';
import { CalendarDays, Key, FileText, MapPin, Wallet, ArrowRight, Package, Clock, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { usePaystackPayment } from 'react-paystack';
import toast from 'react-hot-toast';

const GuestDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [crmGuest, setCrmGuest] = useState(null);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState(null);
  const [nextStayImageUrl, setNextStayImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchGuestData();

      const channel = supabase
        .channel('guest-dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
          fetchGuestData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_services' }, () => {
          fetchGuestData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_guests', filter: `email=eq.${user.email.toLowerCase()}` }, () => {
          fetchGuestData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchGuestData = async () => {
    setLoading(true);
    try {
      // Execute core queries in parallel to drastically improve loading speeds (Promise.all)
      // Exclude heavy rooms(image_url) Base64 strings from historical list to prevent downloading megabytes of data
      const [bookingsResult, crmResult] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, booking_reference, check_in_date, check_out_date, status, payment_status, total_amount_ngn, guest_id, guest_email, rooms(id, name, room_number)')
          .or(`guest_id.eq.${user.id},guest_email.eq.${user.email}`)
          .order('check_in_date', { ascending: true }),
        supabase
          .from('crm_guests')
          .select('*')
          .eq('email', user.email.toLowerCase())
          .maybeSingle()
      ]);

      // Handle Bookings Results
      if (bookingsResult.error) {
        console.warn("Bookings fetch error:", bookingsResult.error);
      } else {
        const cleanBookings = bookingsResult.data || [];
        setBookings(cleanBookings);

        // Dynamically fetch the featured next stay's room image_url separately.
        // This solves the 15-second loading lag by preventing fetching massive Base64 strings 8+ times.
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const activeNextStay = cleanBookings.find(b => b.check_in_date >= todayStr && ['confirmed', 'pending', 'checked_in'].includes(b.status));
        
        if (activeNextStay?.rooms?.id) {
          supabase
            .from('rooms')
            .select('image_url')
            .eq('id', activeNextStay.rooms.id)
            .single()
            .then(({ data, error }) => {
              if (!error && data?.image_url) {
                setNextStayImageUrl(data.image_url);
              }
            });
        }

        // Fetch service requests asynchronously if bookings are present without blocking the main loader
        if (cleanBookings.length > 0) {
          const bookingIds = cleanBookings.map(b => b.id);
          supabase
            .from('booking_services')
            .select('*, services(*), bookings(rooms(room_number, name))')
            .in('booking_id', bookingIds)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
              if (!error) {
                setServiceRequests(data || []);
              } else {
                console.warn("Service requests fetch error:", error);
              }
            });
        }
      }

      // Handle CRM Results
      if (crmResult.error) {
        console.warn("CRM guest fetch error:", crmResult.error);
      } else if (crmResult.data) {
        setCrmGuest(crmResult.data);
      }
    } catch (e) {
      console.error("Guest dashboard fetch error:", e);
    } finally {
      // Turn off loading screen instantly as soon as initial parallel queries complete
      setLoading(false);
    }
  };


  const initializePaystack = usePaystackPayment({});

  useEffect(() => {
    if (selectedPaymentRequest) {
      // Trigger Paystack payment popup
      initializePaystack({
        config: {
          email: user?.email || '',
          amount: Math.round(Number(selectedPaymentRequest.total_price_ngn) * 100), // in kobo
          publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_eaffa6e288470d49a1846f37feabe3a3eb3f30d8',
          currency: 'NGN'
        },
        onSuccess: (reference) => handleServicePaymentSuccess(reference),
        onClose: () => {
          setSelectedPaymentRequest(null);
          toast.error('Payment cancelled by guest.');
        }
      });
    }
  }, [selectedPaymentRequest, user]);

  const handleServicePaymentSuccess = async (reference) => {
    if (!selectedPaymentRequest) return;
    const toastId = toast.loading('Confirming payment...');
    try {
      const amount = Number(selectedPaymentRequest.total_price_ngn);
      const reqId = selectedPaymentRequest.id;
      const bookingId = selectedPaymentRequest.booking_id;

      // 1. Update service request payment status to paid
      const { error: servErr } = await supabase
        .from('booking_services')
        .update({ 
          payment_status: 'paid'
        })
        .eq('id', reqId);

      if (servErr) throw servErr;

      // 2. Fetch current booking amount_paid_ngn
      const { data: booking, error: bookErr } = await supabase
        .from('bookings')
        .select('amount_paid_ngn')
        .eq('id', bookingId)
        .single();
      
      if (bookErr) throw bookErr;
      const currentPaid = Number(booking.amount_paid_ngn || 0);
      const newPaid = currentPaid + amount;

      // 3. Record Payment inflow in payments table
      const transRef = typeof reference === 'string' ? reference : (reference?.reference || reference?.transaction || 'UNKNOWN');
      const { error: payErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: bookingId,
          amount: amount,
          method: 'paystack',
          status: 'completed',
          notes: `Paid via Paystack from guest dashboard: ${selectedPaymentRequest.services?.name || 'Enhancement'} (Ref: ${reqId})`,
          transaction_ref: transRef
        }]);

      if (payErr) throw payErr;

      // 4. Update bookings amount_paid_ngn (which will trigger invoice updates!)
      const { error: bUpdateErr } = await supabase
        .from('bookings')
        .update({
          amount_paid_ngn: newPaid
        })
        .eq('id', bookingId);

      if (bUpdateErr) throw bUpdateErr;

      toast.success('Service request paid successfully via Paystack!', { id: toastId });
      setSelectedPaymentRequest(null);
      
      const paymentIdQuery = insertedPayment ? `&payment_id=${insertedPayment.id}` : '';
      navigate(`/payment-success?type=service${paymentIdQuery}&amount=${amount}`);
    } catch (err) {
      toast.error('Payment processing failed', { id: toastId });
      console.error(err);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  // Stays math
  const upcomingStays = bookings.filter(b => b.check_in_date >= todayStr && b.status !== 'cancelled');
  const pastStays = bookings.filter(b => b.check_out_date < todayStr || b.status === 'checked_out');

  // Next stay is the closest upcoming confirmed/pending/checked_in booking
  const nextStay = bookings.find(b => b.check_in_date >= todayStr && ['confirmed', 'pending', 'checked_in'].includes(b.status));

  // Time gate variables for next stay
  const isCheckOutDay = nextStay && nextStay.check_out_date === todayStr && nextStay.status === 'checked_in';
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const totalMinutesToday = currentHour * 60 + currentMinute;
  
  const minutes11AM = 11 * 60;
  const minutes12PM = 12 * 60;
  const minutes4PM = 16 * 60;

  // Check if booking has an active/pending late checkout requested
  const hasActiveLateCheckout = serviceRequests.some(req => 
    req.booking_id === nextStay?.id &&
    req.status !== 'cancelled' && 
    (req.services?.name?.toLowerCase()?.includes('late checkout') || req.services?.category?.toLowerCase()?.includes('room add-ons'))
  );

  const isCheckoutCommenced = isCheckOutDay && totalMinutesToday >= minutes11AM && totalMinutesToday < minutes12PM;
  const isCheckoutElapsed = isCheckOutDay && totalMinutesToday >= (hasActiveLateCheckout ? minutes4PM : minutes12PM);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-dark-900 text-gray-400">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500 mb-4"></div>
        <p>Loading your personal dashboard...</p>
      </div>
    );
  }

  const guestFirstName = user?.first_name || 'Guest';

  return (
    <div className="space-y-10 text-white">
      <div>
        <h2 className="text-3xl font-bold text-white">Welcome back, {guestFirstName}!</h2>
        <p className="text-gray-400 mt-1">Manage your luxury stays, loyalty points, and premium service requests.</p>
      </div>
      
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-dark-800 border border-dark-700 p-6 rounded-xl flex items-center space-x-4">
          <div className="w-12 h-12 bg-dark-900 rounded-full flex items-center justify-center text-gold-500 border border-gold-500/20">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Upcoming Stays</p>
            <h3 className="text-2xl font-bold mt-1 text-white">{upcomingStays.length}</h3>
          </div>
        </div>
        <div className="bg-dark-800 border border-dark-700 p-6 rounded-xl flex items-center space-x-4">
          <div className="w-12 h-12 bg-dark-900 rounded-full flex items-center justify-center text-gold-500 border border-gold-500/20">
            <Key size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Past Stays</p>
            <h3 className="text-2xl font-bold mt-1 text-white">{pastStays.length}</h3>
          </div>
        </div>
        <div className="bg-dark-800 border border-dark-700 p-6 rounded-xl flex items-center space-x-4">
          <div className="w-12 h-12 bg-dark-900 rounded-full flex items-center justify-center text-gold-500 border border-gold-500/20">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Loyalty Points</p>
            <h3 className="text-2xl font-bold mt-1 text-gold-500">{crmGuest?.loyalty_points || 0} pts</h3>
          </div>
        </div>
        <div className="bg-dark-800 border border-dark-700 p-6 rounded-xl flex items-center space-x-4">
          <div className="w-12 h-12 bg-dark-900 rounded-full flex items-center justify-center text-gold-500 border border-gold-500/20">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Wallet Balance</p>
            <h3 className="text-2xl font-bold mt-1 text-white">₦{Number(crmGuest?.wallet_balance || 0).toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Main Next Stay Card or Booking Promo */}
      <div>
        <h3 className="text-xl font-bold mb-6 border-b border-dark-700 pb-3 flex justify-between items-center text-white">
          <span>Your Next Stay</span>
          {bookings.length > 0 && (
            <Link to="/guest/bookings" className="text-gold-500 text-xs font-semibold hover:underline flex items-center gap-1">
              View All Bookings <ArrowRight size={14}/>
            </Link>
          )}
        </h3>

        {nextStay ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg flex flex-col md:flex-row gap-8 hover:border-gold-500/30 transition-all duration-300">
            <div className="w-full md:w-2/5 aspect-video md:aspect-auto bg-dark-900 relative min-h-[220px]">
              {nextStayImageUrl ? (
                <img 
                  src={nextStayImageUrl} 
                  alt={nextStay.rooms?.name || "Apartment"} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-dark-900 to-black text-center p-4">
                  <span className="text-gold-500 font-serif text-sm tracking-widest uppercase">Luxe Residence</span>
                </div>
              )}
              <div className="absolute top-4 right-4 bg-gold-500 text-dark-900 text-xs px-3 py-1 uppercase font-black tracking-wider shadow-md">
                {nextStay.status.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="flex-1 p-6 md:py-8 md:pr-8 flex flex-col justify-between">
              <div>
                <h4 className="text-2xl font-extrabold text-white mb-1">{nextStay.rooms?.name || 'Luxury Suite'}</h4>
                <p className="text-gray-400 flex items-center gap-1.5 text-sm mb-4"><MapPin size={16} className="text-gold-500"/> Room {nextStay.rooms?.room_number || 'N/A'} — Victoria Island, Lagos</p>
                
                {isCheckoutCommenced && (
                  <div className="mb-4 bg-amber-500/10 border border-amber-500/25 text-amber-400 p-3.5 rounded-lg text-xs font-semibold animate-pulse flex items-start gap-2">
                    <span className="text-sm">⚠️</span>
                    <div>
                      <strong>Checkout has Commenced</strong>
                      <p className="text-[10px] text-gray-400 mt-0.5">Checkout began at 11:00 AM today. Please prepare to checkout by 12:00 PM.</p>
                    </div>
                  </div>
                )}

                {isCheckoutElapsed && (
                  <div className="mb-4 bg-red-500/10 border border-red-500/25 text-red-400 p-3.5 rounded-lg text-xs font-semibold flex items-start gap-2">
                    <span className="text-sm">🛑</span>
                    <div>
                      <strong>Checkout Time Elapsed</strong>
                      <p className="text-[10px] text-gray-400 mt-0.5">Your checkout deadline has elapsed. Please proceed to the front desk reception.</p>
                    </div>
                  </div>
                )}

                {hasActiveLateCheckout && isCheckOutDay && totalMinutesToday < minutes4PM && (
                  <div className="mb-4 bg-blue-500/10 border border-blue-500/25 text-blue-400 p-3.5 rounded-lg text-xs font-semibold flex items-start gap-2">
                    <span className="text-sm">⏰</span>
                    <div>
                      <strong>Late Checkout Approved</strong>
                      <p className="text-[10px] text-gray-400 mt-0.5">Your checkout has been successfully extended until 4:00 PM today.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6 mb-8 bg-dark-900 border border-dark-700/50 p-4 rounded-lg">
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Check-in Date</p>
                    <p className="font-bold text-white text-base">{format(new Date(nextStay.check_in_date), 'MMM dd, yyyy')}</p>
                    <p className="text-gray-400 text-xs mt-0.5">After 2:00 PM</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Check-out Date</p>
                    <p className="font-bold text-white text-base">{format(new Date(nextStay.check_out_date), 'MMM dd, yyyy')}</p>
                    <p className="text-gray-400 text-xs mt-0.5">Before 12:00 PM {hasActiveLateCheckout && "(Extended)"}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 pt-4 border-t border-dark-700/50">
                <Link to="/guest/check-in" className="bg-gold-500 hover:bg-gold-600 text-dark-900 font-bold py-2.5 px-6 text-sm rounded transition-colors shadow-md">
                  Online Check-in
                </Link>
                <Link to="/guest/services" className="border border-gold-500/30 text-gold-500 hover:bg-gold-500/10 font-bold py-2.5 px-6 text-sm rounded transition-colors">
                  Request Services
                </Link>
                <Link to="/guest/bookings" className="border border-dark-600 hover:bg-dark-700 text-white font-medium py-2.5 px-6 text-sm rounded transition-colors">
                  View Booking Receipt
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-10 text-center space-y-6 max-w-xl mx-auto shadow-md">
            <h4 className="text-xl font-bold text-white">No Upcoming Reservations Found</h4>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Plan your next luxury escape with us today! Experience premium comforts, spectacular city views, and Victoria Island elegance.
            </p>
            <Link to="/booking" className="btn-primary py-3 px-8 text-sm inline-block rounded font-bold shadow-md uppercase tracking-wider">
              Book Your Next Stay
            </Link>
          </div>
        )}
      </div>

      {/* Service Requests Section */}
      <div>
        <h3 className="text-xl font-bold mb-6 border-b border-dark-700 pb-3 flex justify-between items-center text-white">
          <span>Your Active Service Requests</span>
          {serviceRequests.length > 0 && (
            <Link to="/guest/services" className="text-gold-500 text-xs font-semibold hover:underline flex items-center gap-1">
              Request More Services <ArrowRight size={14}/>
            </Link>
          )}
        </h3>
        
        {serviceRequests.length > 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-700 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Room / Booking</th>
                    <th className="py-3 px-4">Scheduled For</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-center">Payment Status / Actions</th>
                    <th className="py-3 px-4 text-center">Approval Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50 text-sm">
                  {serviceRequests.map(req => {
                    const statusColors = {
                      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                      scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                      in_progress: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                      completed: 'bg-green-500/10 text-green-500 border-green-500/20',
                      cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
                    };

                    return (
                      <tr key={req.id} className="hover:bg-dark-900/40 transition-colors">
                        <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                          <span>{req.services?.name || 'Service'}</span>
                        </td>
                        <td className="py-4 px-4 text-gray-300">
                          {req.bookings?.rooms?.name ? `Room ${req.bookings.rooms.room_number} (${req.bookings.rooms.name})` : 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-gray-300">
                          {req.scheduled_date ? `${format(new Date(req.scheduled_date), 'MMM dd, yyyy')} @ ${req.scheduled_time?.substring(0, 5) || 'N/A'}` : 'As Soon As Possible'}
                        </td>
                        <td className="py-4 px-4 text-center text-gray-300 font-mono">{req.quantity}</td>
                        <td className="py-4 px-4 text-right font-bold text-gold-500 font-mono">₦{Number(req.total_price_ngn).toLocaleString()}</td>
                        <td className="py-4 px-4 text-center">
                          {req.payment_status === 'paid' ? (
                            <span className="bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded">
                              Confirmed (Paid)
                            </span>
                          ) : req.payment_status === 'awaiting_confirmation' ? (
                            <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded animate-pulse">
                              Awaiting Confirmation
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded">
                                Unpaid
                              </span>
                              <button 
                                onClick={() => setSelectedPaymentRequest(req)}
                                className="bg-gold-500 hover:bg-gold-600 text-dark-900 font-black text-[10px] uppercase py-1 px-3 rounded shadow transition-all"
                              >
                                Pay Now (Paystack)
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-2.5 py-1 text-xs uppercase font-extrabold tracking-wider border rounded-full ${statusColors[req.status] || 'bg-gray-500/10 text-gray-500'}`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center text-gray-400">
            <p className="mb-4">You have not requested any additional room services or stay enhancements yet.</p>
            <Link to="/guest/services" className="border border-gold-500/30 text-gold-500 hover:bg-gold-500/10 font-bold py-2 px-6 rounded text-sm transition-colors">
              Browse Stay Enhancements
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestDashboard;

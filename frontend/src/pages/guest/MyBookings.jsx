import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Calendar, CreditCard, Download, ExternalLink, Printer, ShieldCheck } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const MyBookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReceiptBooking, setActiveReceiptBooking] = useState(null);
  const [printType, setPrintType] = useState('receipt'); // 'receipt' or 'invoice'
  const [contactInfo, setContactInfo] = useState({
    address: 'No2. Gowon P Haruna Close, Karu, Abuja',
    phone: '08033214684, 08062332639, 08171278657',
    email: 'info@Freshlandhotels.com',
    logo: ''
  });

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchContactSettings();

      const channel = supabase
        .channel('guest-bookings-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
          fetchBookings();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchContactSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['contact_address', 'contact_phone', 'contact_email', 'contact_logo']);
        
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
      }
    } catch (e) {
      console.error("Failed to load contact settings:", e);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, booking_reference, check_in_date, check_out_date, created_at, status, payment_status, total_room_price_ngn, total_extras_price_ngn, total_amount_ngn, amount_paid_ngn, discount_amount_ngn, guest_name, guest_email, guest_phone, rooms(name, room_number), booking_services(id, quantity, total_price_ngn, unit_price_ngn, payment_status, status, services(name, tax_inclusive))')
        .or(`guest_id.eq.${user.id},guest_email.eq.${user.email}`)
        .order('check_in_date', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reservation history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Confirmed</span>;
      case 'pending':
        return <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Pending</span>;
      case 'checked_in':
        return <span className="bg-purple-500/10 text-purple-500 border border-purple-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Checked In</span>;
      case 'checked_out':
        return <span className="bg-gray-500/10 text-gray-200 border border-gray-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Completed</span>;
      case 'cancelled':
        return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Cancelled</span>;
      default:
        return <span className="bg-dark-700 text-gray-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  const handlePrint = (booking, type) => {
    setPrintType(type);
    setActiveReceiptBooking(booking);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  if (loading) {
    return <div className="text-gray-200 p-8 text-center bg-dark-800 border border-dark-700 rounded-lg">Loading booking history...</div>;
  }

  return (
    <div className="space-y-8 text-white relative">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-semibold text-white">Your Reservation History</h2>
          <p className="text-gray-200 mt-1">Review your upcoming bookings, dynamic invoices, and past luxury stays.</p>
        </div>
        <a href="/booking" className="btn-primary py-2.5 px-6 text-sm rounded font-bold uppercase tracking-wider shadow-md">
          Book a Room
        </a>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-10 text-center max-w-lg mx-auto shadow-md">
          <p className="text-gray-200 mb-6">You don't have any bookings yet. Start your next luxury reservation with us today!</p>
          <a href="/booking" className="btn-primary py-3 px-8 text-sm inline-block rounded font-bold uppercase tracking-wider shadow-md">
            Book a Room
          </a>
        </div>
      ) : (
        <div className="space-y-6 print:hidden">
          {bookings.map((booking) => {
            const nights = Math.max(1, differenceInDays(new Date(booking.check_out_date), new Date(booking.check_in_date)));
            
            return (
              <div 
                key={booking.id} 
                className="bg-dark-800 border border-dark-700 p-6 rounded-xl hover:border-gold-500/30 transition-all flex flex-col md:flex-row justify-between items-center gap-6 shadow-md hover:shadow-lg"
              >
                <div className="flex-1 w-full md:w-auto">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-white">{booking.rooms?.name || 'Luxury Stay'}</h3>
                      <p className="text-xs text-brand-500 font-bold mt-1">Room {booking.rooms?.room_number || 'N/A'}</p>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>
                  
                  <p className="text-xs text-gray-300 mb-4 font-mono">Reference: {booking.booking_reference}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs bg-dark-900/50 p-3 rounded border border-dark-700/50">
                    <div>
                      <p className="text-gray-300 uppercase tracking-widest text-[9px] font-bold mb-1">Check In</p>
                      <p className="font-semibold text-white">{format(new Date(booking.check_in_date), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-gray-300 uppercase tracking-widest text-[9px] font-bold mb-1">Check Out</p>
                      <p className="font-semibold text-white">{format(new Date(booking.check_out_date), 'MMM dd, yyyy')}</p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <p className="text-gray-300 uppercase tracking-widest text-[9px] font-bold mb-1">Duration</p>
                      <p className="font-semibold text-white">{nights} Nights</p>
                    </div>
                  </div>
                </div>
                
                <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-dark-700/50 pt-6 md:pt-0 md:pl-6 text-center md:text-right flex flex-col items-center md:items-end self-stretch justify-between">
                  <div className="mb-4">
                    <p className="text-gray-300 text-[10px] uppercase font-bold tracking-wider mb-1">Total Paid Amount</p>
                    <p className="text-2xl font-black text-gold-500">₦{Number(booking.total_amount_ngn).toLocaleString()}</p>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-300 block mt-1">
                      Payment: <span className={booking.payment_status === 'paid' ? 'text-green-500 font-extrabold' : 'text-yellow-500 font-extrabold'}>{booking.payment_status.toUpperCase()}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full justify-center md:justify-end">
                    {['confirmed', 'checked_in'].includes(booking.status) && (
                      <a 
                        href="/guest/services" 
                        className="flex-1 md:flex-none border border-gold-500/30 text-gold-500 hover:bg-gold-500/10 font-bold px-4 py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        Request Add-ons
                      </a>
                    )}
                    
                    <button 
                      onClick={() => handlePrint(booking, 'invoice')}
                      className="flex-1 md:flex-none border border-dark-600 hover:bg-dark-700 text-white font-medium px-4 py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Printer size={14} /> Print Invoice
                    </button>

                    {booking.payment_status === 'unpaid' ? (
                      <button 
                        disabled
                        className="flex-1 md:flex-none border border-dark-700 bg-dark-900/40 text-gray-300 font-medium px-4 py-2 rounded text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
                        title="Receipt becomes active upon payment confirmation"
                      >
                        <Printer size={14} /> Receipt (Awaiting Payment)
                      </button>
                    ) : (
                      <button 
                        onClick={() => handlePrint(booking, 'receipt')}
                        className="flex-1 md:flex-none border border-gold-500 hover:bg-gold-500/10 text-gold-500 font-bold px-4 py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Printer size={14} /> Print Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden Print Receipt Template */}
      {activeReceiptBooking && (
        <div className="hidden print:block print-container print-a4 bg-white text-black absolute inset-0 z-50 p-8 min-h-screen text-left">
          {/* Header */}
          <div className="flex justify-between items-start border-b pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight mb-1 text-black">{printType === 'receipt' ? 'OFFICIAL PAYMENT RECEIPT' : 'PRO FORMA INVOICE'}</h1>
              <p className="text-gray-600 text-xs">Ref: {activeReceiptBooking.booking_reference}</p>
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

          {/* Guest and Stays details */}
          <div className="flex justify-between mb-8 text-sm">
            <div>
              <p className="text-gray-300 font-bold uppercase text-[10px] mb-1">Guest Details:</p>
              <p className="font-bold text-black text-base">{activeReceiptBooking.guest_name}</p>
              <p className="text-gray-600">{activeReceiptBooking.guest_email}</p>
              <p className="text-gray-600">{activeReceiptBooking.guest_phone}</p>
            </div>
            <div className="text-right">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-left">
                <span className="text-gray-300 font-bold">Check-In:</span>
                <span className="font-medium text-black">{format(new Date(activeReceiptBooking.check_in_date), 'MMM dd, yyyy')}</span>
                <span className="text-gray-300 font-bold">Check-Out:</span>
                <span className="font-medium text-black">{format(new Date(activeReceiptBooking.check_out_date), 'MMM dd, yyyy')}</span>
                <span className="text-gray-300 font-bold">Transaction Date:</span>
                <span className="font-medium text-black">{activeReceiptBooking.created_at ? format(new Date(activeReceiptBooking.created_at), 'MMM dd, yyyy, HH:mm') : 'N/A'}</span>
                <span className="text-gray-300 font-bold">Nights Count:</span>
                <span className="font-medium text-black">{Math.max(1, differenceInDays(new Date(activeReceiptBooking.check_out_date), new Date(activeReceiptBooking.check_in_date)))} nights</span>
                <span className="text-gray-300 font-bold">Payment Status:</span>
                <span className="font-bold uppercase text-green-600">{activeReceiptBooking.payment_status === 'paid' ? 'PAID / CONFIRMED' : activeReceiptBooking.payment_status === 'partial' ? 'PARTIALLY PAID' : 'UNPAID / PENDING'}</span>
              </div>
            </div>
          </div>

          {/* Table Breakdown */}
          <table className="w-full mb-8 text-xs border-collapse text-left">
            <thead>
              <tr className="bg-gray-100 border-y border-gray-200">
                <th className="py-2.5 px-4 font-bold text-gray-600">Description</th>
                <th className="py-2.5 px-4 text-center font-bold text-gray-600">Payment Status</th>
                <th className="py-2.5 px-4 text-right font-bold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const discount = Number(activeReceiptBooking.discount_amount_ngn || 0);
                const booking = activeReceiptBooking;
                const roomPrice = Number(booking.total_room_price_ngn || booking.total_amount_ngn || 0);
                const roomBase = Math.max(0, roomPrice - discount);
                const roomTax = roomBase * 0.075;
                const roomTotalWithTax = roomBase + roomTax;

                const amountPaidTotal = Number(booking.amount_paid_ngn || 0);
                let remainingPaid = amountPaidTotal;

                // Pay room first
                let roomPaymentStatus = 'unpaid';
                if (booking.payment_status === 'paid' || remainingPaid >= roomTotalWithTax) {
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
                  } else if (normalized === 'partial' || normalized === 'partially paid') {
                    colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-250';
                    label = 'Partial';
                  } else if (normalized === 'awaiting_confirmation') {
                    colorClasses = 'bg-amber-100 text-amber-800 border-amber-250';
                    label = 'Awaiting';
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
                  if (booking.payment_status === 'paid' || remainingPaid >= sTotal) {
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
                      <td className="py-3 px-4">
                        <p className="font-bold text-black">{booking.rooms?.name || 'Luxury Room Stay'} (Room {booking.rooms?.room_number})</p>
                        <p className="text-gray-300 text-[10px] mt-0.5">Accommodation Charges (Rent + Tax)</p>
                          <p className="text-[9px] text-gray-200">
                            Rate: ₦{roomPrice.toLocaleString()} {discount > 0 && `| Discount: -₦${discount.toLocaleString()}`} | Taxable Base: ₦{roomBase.toLocaleString()} | VAT (7.5%): ₦{roomTax.toLocaleString()}
                          </p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(roomPaymentStatus)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-black">
                        ₦{roomTotalWithTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {servicesWithStatus.map((extra) => {
                      return (
                        <tr key={extra.id}>
                          <td className="py-3 px-4">
                            <p className="font-bold text-black">{extra.services?.name || 'Guest Service'}</p>
                            <p className="text-gray-300 text-[10px] mt-0.5">
                              Unit Price: ₦{extra.uPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Quantity: {extra.quantity}
                            </p>
                            <p className="text-[9px] text-gray-200">
                              Base: ₦{extra.sBasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {extra.isTaxable ? `| VAT (7.5%): ₦${extra.sTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '(VAT Exempt)'}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {renderStatusBadge(extra.calculatedStatus)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-black">
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

          {/* Invoice Summary */}
          {(() => {
            const totalAmount = Number(activeReceiptBooking.total_amount_ngn || 0);
            const amountPaid = Number(activeReceiptBooking.amount_paid_ngn || 0);
            const discount = Number(activeReceiptBooking.discount_amount_ngn || 0);
            const balance = Math.max(0, totalAmount - amountPaid);

            return (
              <div className="flex justify-end text-xs">
                <div className="w-64 space-y-2 border-t pt-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>₦{(totalAmount + discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-yellow-600 font-bold">
                      <span>Room Discount</span>
                      <span>-₦{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm border-t pt-2 text-black">
                    <span>Total Due</span>
                    <span>₦{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
            <p>Thank you for staying at Freshland. Have a wonderful experience!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;

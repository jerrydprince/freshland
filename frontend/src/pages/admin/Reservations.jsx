import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, MoreVertical, Edit, Trash2, CheckCircle, XCircle, Plus, X, Eye, Calendar, Package, Printer, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, addDays, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import ManualBookingModal from '../../components/admin/ManualBookingModal';
import RoomTransferModal from '../../components/admin/RoomTransferModal';
import { triggerAutomationRules } from '../../lib/emailService';

const AdminReservations = ({ onUpdate, isFrontOfficeClosed }) => {
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortField, setSortField] = useState('created_at'); // 'created_at', 'date', 'reference', 'amount', 'status'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

  // Server-Side Database Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  const [bookingServices, setBookingServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [editBookingForm, setEditBookingForm] = useState({
    status: 'confirmed',
  });
  const [transferBooking, setTransferBooking] = useState(null);
  const [contactInfo, setContactInfo] = useState({
    address: 'No2. Gowon P Haruna Close, Karu, Abuja',
    phone: '08103694837, 08174971881',
    email: 'info@Freshlandhotels.com'
  });

  useEffect(() => {
    fetchRooms();
    fetchContactSettings();
  }, []);

  const fetchContactSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['contact_address', 'contact_phone', 'contact_email']);
        
      if (!error && data) {
        const settingsMap = data.reduce((acc, curr) => {
          acc[curr.setting_key] = curr.setting_value;
          return acc;
        }, {});
        
        setContactInfo(prev => ({
          address: settingsMap.contact_address || prev.address,
          phone: settingsMap.contact_phone || prev.phone,
          email: settingsMap.contact_email || prev.email
        }));
      }
    } catch (e) {
      console.error("Failed to load contact settings:", e);
    }
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('id, name, room_number, base_price_ngn').eq('status', 'available');
    if (data) setRooms(data);
  };

  // High-performance database pagination & filter compiler
  const fetchReservations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings')
        .select('*, profiles(first_name, last_name), rooms(name)', { count: 'exact' });

      // Apply status filter natively
      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      // Apply date range filters natively
      if (startDateFilter) {
        query = query.gte('check_in_date', startDateFilter);
      }
      if (endDateFilter) {
        query = query.lte('check_out_date', endDateFilter);
      }

      // Apply search keyword terms natively
      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        query = query.or(`booking_reference.ilike.${term},guest_name.ilike.${term},guest_email.ilike.${term}`);
      }

      // Dynamic sorting mapped inside database engine
      let orderField = 'created_at';
      if (sortField === 'reference') orderField = 'booking_reference';
      if (sortField === 'amount') orderField = 'total_amount_ngn';
      if (sortField === 'status') orderField = 'status';
      if (sortField === 'date') orderField = 'check_in_date';
      if (sortField === 'created_at') orderField = 'created_at';

      query = query.order(orderField, { ascending: sortDirection === 'asc' });

      // Apply range bounds
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setReservations(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reservations database records');
    } finally {
      setLoading(false);
    }
  };

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, startDateFilter, endDateFilter, sortField, sortDirection]);

  // Debounced search typing listener
  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      fetchReservations();
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Handle active data triggers on bounds change
  useEffect(() => {
    fetchReservations();
  }, [currentPage, pageSize, statusFilter, startDateFilter, endDateFilter, sortField, sortDirection]);

  // Real-time Supabase postgres change listener
  useEffect(() => {
    const channel = supabase
      .channel(`reservations-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPage, pageSize, statusFilter, startDateFilter, endDateFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ▴' : ' ▾';
  };

  // Filtered reservations values mapping (empty since compile sorting and filters run at database level)

  const syncBookingGuestToCRM = async (booking) => {
    if (!booking || !booking.guest_email) {
      console.warn("Booking or guest email is missing for CRM sync.");
      return;
    }

    const email = booking.guest_email.trim().toLowerCase();
    
    try {
      // 1. Check if guest already exists in crm_guests (lookup by email)
      const { data: existingGuests, error: fetchError } = await supabase
        .from('crm_guests')
        .select('*')
        .eq('email', email);

      if (fetchError) {
        console.error("Error fetching guest from CRM:", fetchError);
        return;
      }

      const existingGuest = existingGuests && existingGuests.length > 0 ? existingGuests[0] : null;
      let crmGuestId = null;

      if (existingGuest) {
        // Guest already exists: increment loyalty points (+10) and upgrade segment status to 'frequent' if it was standard
        const newPoints = (existingGuest.loyalty_points || 0) + 10;
        const currentSegment = existingGuest.segment || 'standard';
        const newSegment = currentSegment === 'standard' ? 'frequent' : currentSegment;

        const { data: updatedGuest, error: updateError } = await supabase
          .from('crm_guests')
          .update({
            loyalty_points: newPoints,
            segment: newSegment
          })
          .eq('id', existingGuest.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating CRM guest:", updateError);
        } else if (updatedGuest) {
          crmGuestId = updatedGuest.id;
        }
      } else {
        // Guest does not exist: split guest_name, and insert a new guest record
        let firstName = 'Guest';
        let lastName = '';
        if (booking.guest_name) {
          const parts = booking.guest_name.trim().split(/\s+/);
          if (parts.length > 0) {
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
          }
        }

        const { data: newGuest, error: insertError } = await supabase
          .from('crm_guests')
          .insert([{
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: booking.guest_phone || '',
            nationality: 'Unspecified',
            segment: 'standard',
            vip_status: false,
            loyalty_points: 10,
            wallet_balance: 0
          }])
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting new CRM guest:", insertError);
        } else if (newGuest) {
          crmGuestId = newGuest.id;
        }
      }

      // 2. Link the booking to the CRM guest ID if we successfully resolved one
      if (crmGuestId) {
        const { error: linkError } = await supabase
          .from('bookings')
          .update({ crm_guest_id: crmGuestId })
          .eq('id', booking.id);

        if (linkError) {
          console.error("Error linking booking to CRM guest ID:", linkError);
        }
      }
    } catch (err) {
      console.error("CRM synchronization exception:", err);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const isARExempt = currentBooking?.payment_method === 'ar_wallet' || currentBooking?.payment_method === 'ar';
    const isConfirmedDisabled = currentBooking?.status === 'pending' && !isARExempt && !currentBooking?.id_verified;
    
    if (editBookingForm.status === 'confirmed' && isConfirmedDisabled) {
      toast.error('Payment must first be confirmed by finance before booking can be confirmed!');
      return;
    }
    const { error } = await supabase.from('bookings').update({ status: editBookingForm.status }).eq('id', currentBooking.id);
    if (error) {
      toast.error('Failed to update booking');
    } else {
      toast.success('Booking updated!');
      
      // Automatic CRM Sync when status transitions to confirmed
      if (editBookingForm.status === 'confirmed' && currentBooking?.status !== 'confirmed') {
        try {
          await syncBookingGuestToCRM(currentBooking);
        } catch (syncErr) {
          console.error("Failed to sync guest to CRM:", syncErr);
        }
      }

      // Trigger alerts
      try {
        const { data: fullBooking } = await supabase
          .from('bookings')
          .select('*, profiles(*), rooms(*)')
          .eq('id', currentBooking.id)
          .single();
        if (fullBooking) {
          if (editBookingForm.status === 'confirmed' && currentBooking?.status !== 'confirmed') {
            triggerAutomationRules('booking_confirmed', fullBooking);
          } else if (editBookingForm.status === 'cancelled' && currentBooking?.status !== 'cancelled') {
            triggerAutomationRules('booking_cancelled', fullBooking);
          }
        }
      } catch (autoErr) {
        console.warn("Automation trigger failed in handleUpdate:", autoErr);
      }

      // Update booking services to 'confirmed' if booking is confirmed
      if (editBookingForm.status === 'confirmed' || editBookingForm.status === 'checked_in') {
         await supabase.from('booking_services').update({ status: 'confirmed' }).eq('booking_id', currentBooking.id);
      }
      
      // If booking is cancelled, update status of invoices, payments, and booking services to cancelled
      if (editBookingForm.status === 'cancelled') {
        try {
          await supabase.from('invoices').update({ status: 'cancelled' }).eq('booking_id', currentBooking.id);
          await supabase.from('payments').update({ status: 'cancelled' }).eq('booking_id', currentBooking.id);
          await supabase.from('booking_services').update({ status: 'cancelled' }).eq('booking_id', currentBooking.id);
        } catch (dbErr) {
          console.warn("Direct billing status update failed on status update:", dbErr);
        }
      }

      setIsEditModalOpen(false);
      fetchReservations();
      if (onUpdate) onUpdate();
    }
  };

  const handleCancelBooking = async (bookingOrId) => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    const id = typeof bookingOrId === 'object' ? bookingOrId.id : bookingOrId;
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    // 1. Soft-update status to cancelled
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (error) {
      toast.error('Failed to cancel booking');
      return;
    }
    
    // 2. Update invoices, payments, and booking services status to cancelled
    try {
      await supabase.from('invoices').update({ status: 'cancelled' }).eq('booking_id', id);
      await supabase.from('payments').update({ status: 'cancelled' }).eq('booking_id', id);
      await supabase.from('booking_services').update({ status: 'cancelled' }).eq('booking_id', id);
      toast.success('Booking cancelled and billing records updated successfully');

      // Trigger automation rule
      if (bookingOrId && typeof bookingOrId === 'object') {
        triggerAutomationRules('booking_cancelled', bookingOrId);
      } else {
        const { data: fullBooking } = await supabase
          .from('bookings')
          .select('*, profiles(*), rooms(*)')
          .eq('id', id)
          .single();
        if (fullBooking) {
          triggerAutomationRules('booking_cancelled', fullBooking);
        }
      }
    } catch (dbErr) {
      console.warn("Direct billing status update failed:", dbErr);
    }
    
    fetchReservations();
    if (onUpdate) onUpdate();
  };

  const handleTransferClick = (booking) => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    setTransferBooking(booking);
  };

  const openEditModal = (booking) => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    setCurrentBooking(booking);
    setEditBookingForm({ status: booking.status });
    setIsEditModalOpen(true);
  };

  const openCreateModal = () => {
    if (isFrontOfficeClosed) {
      toast.error("Front Office operations are locked due to daily ledger closure.");
      return;
    }
    setIsCreateModalOpen(true);
  };

  const openViewModal = async (booking) => {
    setViewBooking(booking);
    setServicesLoading(true);
    const { data, error } = await supabase
      .from('booking_services')
      .select('*, services(name, icon_name, pricing_type)')
      .eq('booking_id', booking.id);
      
    if (!error && data) {
      setBookingServices(data);
    } else {
      setBookingServices([]);
    }
    setServicesLoading(false);
  };

  const renderPrintReceipt = () => {
    if (!viewBooking) return null;
    const discount = Number(viewBooking.discount_amount_ngn || 0);
    const totalNights = Math.max(1, differenceInDays(new Date(viewBooking.check_out_date), new Date(viewBooking.check_in_date)));
    
    // Check if stay purpose is stored in special_requests (formatted as [Purpose: Leisure] Extra notes)
    let purpose = 'Leisure';
    let cleanNotes = viewBooking.special_requests || '';
    if (viewBooking.special_requests && viewBooking.special_requests.startsWith('[Purpose:')) {
      const match = viewBooking.special_requests.match(/^\[Purpose:\s*([^\]]+)\]\s*(.*)/i);
      if (match) {
        purpose = match[1];
        cleanNotes = match[2];
      }
    }

    return (
      <div className="hidden print:block print-container print-a4 bg-white text-black absolute inset-0 z-50 p-8 min-h-screen text-left" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
        {/* Receipt Header */}
        <div className="flex justify-between items-start border-b pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 text-black" style={{ color: '#000000' }}>PAYMENT RECEIPT</h1>
            <p className="text-gray-600 text-xs">Ref: {viewBooking.booking_reference || 'N/A'}</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-black tracking-widest text-black" style={{ color: '#000000' }}>Freshland</h2>
            <p className="text-xs text-gray-600">{contactInfo.address}</p>
            <p className="text-xs text-gray-600">{contactInfo.phone}</p>
            <p className="text-xs text-gray-600">{contactInfo.email}</p>
          </div>
        </div>

        {/* Guest Details */}
        <div className="flex justify-between mb-8 text-sm text-left">
          <div>
            <p className="text-gray-300 font-bold uppercase text-[10px] mb-1">Guest Details:</p>
            <p className="font-bold text-black text-base">{viewBooking.profiles ? `${viewBooking.profiles.first_name} ${viewBooking.profiles.last_name}` : viewBooking.guest_name || 'Walk-in Guest'}</p>
            {viewBooking.guest_email && <p className="text-gray-600">{viewBooking.guest_email}</p>}
            {viewBooking.guest_phone && <p className="text-gray-600">{viewBooking.guest_phone}</p>}
          </div>
          <div className="text-right">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-left">
              <span className="text-gray-300 font-bold">Check-In:</span>
              <span className="font-medium text-black">{format(new Date(viewBooking.check_in_date), 'MMM dd, yyyy')}</span>
              <span className="text-gray-300 font-bold">Check-Out:</span>
              <span className="font-medium text-black">{format(new Date(viewBooking.check_out_date), 'MMM dd, yyyy')}</span>
              <span className="text-gray-300 font-bold">Transaction Date:</span>
              <span className="font-medium text-black">{viewBooking.created_at ? format(new Date(viewBooking.created_at), 'MMM dd, yyyy, HH:mm') : 'N/A'}</span>
              <span className="text-gray-300 font-bold">Purpose:</span>
              <span className="font-medium text-black">{purpose}</span>
              <span className="text-gray-300 font-bold">Payment Status:</span>
              <span className="font-bold uppercase text-green-600">{viewBooking.payment_status?.toUpperCase() || 'PAID'}</span>
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
              const booking = viewBooking;
              const roomPrice = Number(booking.total_room_price_ngn || 0);
              const discount = Number(booking.discount_amount_ngn || 0);
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

              const rawServices = bookingServices || [];
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

        {/* Totals Summary */}
        <div className="flex justify-end text-xs">
          <div className="w-64 space-y-2 border-t pt-4">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₦{(Number(viewBooking.total_amount_ngn) + discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-yellow-600 font-bold">
                <span>Room Discount</span>
                <span>-₦{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm border-t pt-2 text-black">
              <span>Total Due</span>
              <span>₦{Number(viewBooking.total_amount_ngn).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-green-600 pt-1">
              <span>Amount Paid</span>
              <span>₦{Number(viewBooking.amount_paid_ngn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-red-650 pt-1 border-t border-gray-100">
              <span>Balance</span>
              <span>₦{Math.max(0, Number(viewBooking.total_amount_ngn) - Number(viewBooking.amount_paid_ngn || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {cleanNotes && (
          <div className="mt-8 border-t pt-4 text-left">
            <p className="text-[10px] text-gray-200 font-bold uppercase mb-1">Notes / Requests:</p>
            <p className="text-xs text-gray-600 bg-gray-50 p-3 border border-gray-100 rounded italic">{cleanNotes}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="flex justify-between items-end pt-12 border-t border-dashed border-gray-200 mt-12 text-left">
          <div className="text-center w-48">
            <div className="border-b border-gray-300 h-8"></div>
            <span className="text-[10px] text-gray-300 font-semibold block mt-1.5 uppercase">Prepared By</span>
          </div>
          <div className="text-center w-48">
            <div className="border-b border-gray-300 h-8"></div>
            <span className="text-[10px] text-gray-300 font-semibold block mt-1.5 uppercase">Audited By (Hotel Manager)</span>
          </div>
        </div>

        <div className="mt-16 text-center text-[10px] text-gray-200 border-t pt-4">
          <p>Thank you for choosing Freshland. Have a wonderful stay!</p>
        </div>
      </div>
    );
  };

  return (
    <div>
      {isFrontOfficeClosed && (
        <div className="bg-red-500/10 border-2 border-red-500/35 text-red-200 p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-red-500/5 mb-6 animate-pulse">
          <AlertTriangle size={24} className="text-red-500 animate-bounce flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-white">Front Office Operations Locked</h4>
            <p className="text-xs text-red-300/95 mt-0.5 font-medium">
              Daily ledger is closed. Creating bookings, transferring rooms, cancellations, and status edits are locked.
            </p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Reservation Management</h1>
        <button 
          disabled={isFrontOfficeClosed}
          onClick={openCreateModal} 
          className="btn-primary py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={18}/> Create Manual Booking
        </button>
      </div>

      <div className="bg-dark-800 border border-dark-700 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-200" size={18} />
            <input 
              type="text" 
              placeholder="Search by Ref, Guest, or Room..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white pl-10 pr-4 py-2 focus:border-gold-500 outline-none" 
            />
          </div>
          <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
            <div className="flex items-center gap-2 bg-dark-900 border border-dark-700 px-3 py-2 rounded">
              <Calendar size={14} className="text-gray-200" />
              <span className="text-xs text-gray-300 font-bold uppercase">From:</span>
              <input 
                type="date"
                value={startDateFilter}
                onChange={e => setStartDateFilter(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-transparent text-xs text-white outline-none font-bold font-mono"
              />
            </div>

            <div className="flex items-center gap-2 bg-dark-900 border border-dark-700 px-3 py-2 rounded">
              <Calendar size={14} className="text-gray-200" />
              <span className="text-xs text-gray-300 font-bold uppercase">To:</span>
              <input 
                type="date"
                value={endDateFilter}
                onChange={e => setEndDateFilter(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-transparent text-xs text-white outline-none font-bold font-mono"
              />
            </div>

            {(startDateFilter || endDateFilter) && (
              <button
                type="button"
                onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                className="text-xs text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded transition-colors font-bold uppercase"
              >
                Clear Dates
              </button>
            )}

            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-dark-900 border border-dark-700 text-white px-4 py-2 outline-none rounded"
            >
              <option value="All">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 border border-dark-700 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-dark-900 border-b border-dark-700">
            <tr>
              <th onClick={() => handleSort('created_at')} className="p-4 font-medium text-gray-200 cursor-pointer hover:text-gold-500 select-none transition-colors">
                ID / Booked{renderSortIndicator('created_at')}
              </th>
              <th className="p-4 font-medium text-gray-200 select-none">Guest</th>
              <th className="p-4 font-medium text-gray-200 select-none">Room</th>
              <th onClick={() => handleSort('date')} className="p-4 font-medium text-gray-200 cursor-pointer hover:text-gold-500 select-none transition-colors">
                Dates{renderSortIndicator('date')}
              </th>
              <th onClick={() => handleSort('amount')} className="p-4 font-medium text-gray-200 cursor-pointer hover:text-gold-500 select-none transition-colors">
                Amount{renderSortIndicator('amount')}
              </th>
              <th className="p-4 font-medium text-gray-200 select-none">Discount</th>
              <th onClick={() => handleSort('status')} className="p-4 font-medium text-gray-200 cursor-pointer hover:text-gold-500 select-none transition-colors">
                Status{renderSortIndicator('status')}
              </th>
              <th className="p-4 font-medium text-gray-200 text-right select-none">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr>
                <td colSpan="8" className="p-8 text-center text-gray-200"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto"></div></td>
              </tr>
            ) : reservations.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-8 text-center text-gray-200">No reservations found.</td>
              </tr>
            ) : (
              reservations.map((res) => (
                <tr key={res.id} className="border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors">
                  <td className="p-4">
                    <span className="font-medium block">{res.booking_reference || 'N/A'}</span>
                    <span className="text-[11px] text-gray-300 block mt-0.5">
                      Booked: {res.created_at ? format(new Date(res.created_at), 'MMM dd, yyyy') : 'N/A'}
                    </span>
                  </td>
                  <td className="p-4">
                    {res.profiles ? `${res.profiles.first_name} ${res.profiles.last_name}` : (res.guest_name ? res.guest_name : (res.special_requests?.includes('Manual Guest:') ? res.special_requests.replace('Manual Guest: ', '') : 'Walk-in Guest'))}
                  </td>
                  <td className="p-4">
                    {res.rooms?.name || 'Unknown Room'}
                    {res.group_reference && <span className="block text-xs text-gold-500 mt-1">Group: {res.group_reference}</span>}
                  </td>
                  <td className="p-4 text-gray-200">
                    {format(new Date(res.check_in_date), 'MMM dd, yyyy')} to {format(new Date(res.check_out_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="p-4 font-medium">₦{Number(res.total_amount_ngn).toLocaleString()}</td>
                  <td className="p-4">
                    {Number(res.discount_amount_ngn) > 0 ? (
                      <span className="text-green-400 font-semibold">-₦{Number(res.discount_amount_ngn).toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {res.status === 'confirmed' && res.payment_status !== 'paid' ? (
                      <span className="px-3 py-1 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20 font-bold animate-pulse">
                        Confirmed (Inactive)
                      </span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs capitalize ${
                        res.status === 'confirmed' ? 'bg-blue-500/10 text-blue-500' :
                        res.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                        res.status === 'checked_in' ? 'bg-green-500/10 text-green-500' :
                        res.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                        res.status === 'no_show' ? 'bg-gray-500/10 text-gray-200' :
                        'bg-gray-500/10 text-gray-200'
                      }`}>
                        {res.status.replace('_', ' ')}
                      </span>
                    )}
                    <span className="block text-xs text-gray-300 mt-2">{res.booking_source?.replace('_', ' ')}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2 text-gray-200">
                      <button onClick={() => openViewModal(res)} className="hover:text-white transition-colors" title="View Details"><Eye size={18}/></button>
                      
                      {!['checked_out', 'cancelled', 'no_show'].includes(res.status) ? (
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleTransferClick(res)} 
                          className="hover:text-amber-500 disabled:hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" 
                          title={isFrontOfficeClosed ? "Locked (Ledger Closed)" : "Transfer Room"}
                        >
                          <ArrowRightLeft size={18}/>
                        </button>
                      ) : (
                        <button disabled className="text-gray-600 cursor-not-allowed" title="Transfer disabled (Stay finalized)"><ArrowRightLeft size={18}/></button>
                      )}

                      {!['checked_out', 'cancelled', 'no_show'].includes(res.status) ? (
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => openEditModal(res)} 
                          className="hover:text-blue-500 disabled:hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" 
                          title={isFrontOfficeClosed ? "Locked (Ledger Closed)" : "Edit Status"}
                        >
                          <Edit size={18}/>
                        </button>
                      ) : (
                        <button disabled className="text-gray-600 cursor-not-allowed" title="Editing disabled (Stay finalized)"><Edit size={18}/></button>
                      )}

                      {['pending', 'confirmed'].includes(res.status) ? (
                        <button 
                          disabled={isFrontOfficeClosed}
                          onClick={() => handleCancelBooking(res)} 
                          className="hover:text-red-500 disabled:hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" 
                          title={isFrontOfficeClosed ? "Locked (Ledger Closed)" : "Cancel Booking"}
                        >
                          <XCircle size={18}/>
                        </button>
                      ) : (
                        <button disabled className="text-gray-600 cursor-not-allowed" title="Cancellation disabled (Finalized stay)"><XCircle size={18}/></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-dark-700 bg-dark-900 flex flex-col sm:flex-row items-center justify-between gap-4 select-none mt-4">
        <div className="text-xs font-semibold text-gray-200">
          Showing <span className="text-white font-bold">{reservations.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
          <span className="text-white font-bold">
            {Math.min(currentPage * pageSize, totalCount)}
          </span>{' '}
          of <span className="text-white font-bold">{totalCount}</span> entries
        </div>

        <div className="flex items-center gap-3">
          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-300 uppercase font-black tracking-wider">Page Size:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-dark-800 border border-dark-700 text-white text-xs px-2 py-1 rounded outline-none focus:border-gold-500 font-bold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Page Navigation Buttons */}
          <div className="flex items-center gap-1.5 font-sans">
            <button
              disabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 bg-dark-850 hover:bg-dark-750 disabled:opacity-40 disabled:hover:bg-dark-850 border border-dark-700 rounded text-xs text-white font-bold transition-all"
            >
              Previous
            </button>

            <div className="text-xs font-black text-gold-500 px-3 font-mono">
              Page {currentPage} of {Math.max(Math.ceil(totalCount / pageSize), 1)}
            </div>

            <button
              disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount / pageSize)))}
              className="px-3 py-1.5 bg-dark-850 hover:bg-dark-750 disabled:opacity-40 disabled:hover:bg-dark-850 border border-dark-700 rounded text-xs text-white font-bold transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          {(() => {
            const isARExempt = currentBooking?.payment_method === 'ar_wallet' || currentBooking?.payment_method === 'ar';
            const isConfirmedDisabled = currentBooking?.status === 'pending' && !isARExempt && !currentBooking?.id_verified;
            
            return (
              <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-lg relative animate-in fade-in zoom-in-95">
                <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 text-gray-200 hover:text-white"><X size={24}/></button>
                <h2 className="text-xl font-semibold mb-6">Edit Reservation Status</h2>
                
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-200 mb-1">Status</label>
                    <select value={editBookingForm.status} onChange={e => setEditBookingForm({ status: e.target.value })} className="w-full bg-dark-900 border border-dark-700 p-2 text-white outline-none focus:border-gold-500">
                      <option value="pending">Pending</option>
                      <option value="confirmed" disabled={isConfirmedDisabled}>
                        Confirmed {isConfirmedDisabled ? '(Awaiting Payment Confirmation)' : ''}
                      </option>
                      <option value="checked_in" disabled>Checked In (Handled by Front Desk)</option>
                      <option value="checked_out" disabled>Checked Out (Handled by Front Desk)</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No Show</option>
                    </select>
                  </div>

                  <button type="submit" className="w-full btn-primary py-3 mt-4">Update Booking</button>
                </form>
              </div>
            );
          })()}
        </div>
      )}

      {/* View Details Modal */}
      {viewBooking && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-2xl relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar print:hidden">
            
            <div className="print:hidden">
              <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => setViewBooking(null)} className="text-gray-200 hover:text-white bg-dark-700 p-1.5 rounded"><X size={20}/></button>
              </div>
              
              <div className="flex justify-between items-start mb-6 border-b border-dark-700 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Booking Details</h2>
                  <p className="text-gray-200 text-sm">Ref: {viewBooking.booking_reference}</p>
                </div>
                <div className="text-right mr-8 flex flex-col items-end gap-2">
                  <button onClick={() => window.print()} className="text-gray-200 hover:text-white flex items-center gap-1 text-xs border border-dark-700 px-2 py-1 rounded transition-colors"><Printer size={14}/> Print Receipt</button>
                  {!['checked_out', 'cancelled', 'no_show'].includes(viewBooking.status) && (
                    <button 
                      disabled={isFrontOfficeClosed}
                      onClick={() => { 
                        handleTransferClick(viewBooking); 
                        setViewBooking(null); 
                      }} 
                      className="text-amber-500 hover:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs border border-amber-500/50 px-2 py-1 rounded transition-colors"
                    >
                      <ArrowRightLeft size={14}/> Transfer Room
                    </button>
                  )}
                  {viewBooking.status === 'confirmed' && viewBooking.payment_status !== 'paid' ? (
                    <span className="px-3 py-1 bg-red-500/25 border border-red-500/30 text-red-400 rounded font-bold uppercase text-xs animate-pulse">Confirmed (Inactive)</span>
                  ) : (
                    <span className="px-3 py-1 bg-gold-500/20 text-gold-500 rounded font-bold uppercase text-xs">{viewBooking.status}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-1">
                  <p className="text-xs text-gray-300 uppercase font-bold">Guest Info</p>
                  <p className="text-white">{viewBooking.profiles ? `${viewBooking.profiles.first_name} ${viewBooking.profiles.last_name}` : (viewBooking.guest_name || 'Walk-in Guest')}</p>
                  {viewBooking.guest_email && <p className="text-sm text-gray-200">{viewBooking.guest_email}</p>}
                  {viewBooking.guest_phone && <p className="text-sm text-gray-200">{viewBooking.guest_phone}</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-300 uppercase font-bold">Stay Info</p>
                  <p className="text-white">{viewBooking.rooms?.name}</p>
                  <p className="text-sm text-gray-200 flex items-center gap-1"><Calendar size={14}/> {format(new Date(viewBooking.check_in_date), 'MMM dd')} - {format(new Date(viewBooking.check_out_date), 'MMM dd, yyyy')}</p>
                </div>
              </div>

              {/* Financials & Add-ons */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white flex items-center gap-2 border-b border-dark-700 pb-2"><Package size={18}/> Selected Services & Add-ons</h3>
                
                {servicesLoading ? (
                  <p className="text-gray-300 text-sm italic">Loading services...</p>
                ) : bookingServices.length === 0 ? (
                  <p className="text-gray-300 text-sm italic bg-dark-900 p-4 rounded border border-dark-700">No additional services booked.</p>
                ) : (
                  <div className="space-y-3">
                    {bookingServices.map(bs => (
                      <div key={bs.id} className="flex justify-between items-center p-3 bg-dark-900 border border-dark-700 rounded">
                        <div>
                          <p className="font-medium text-white">{bs.services?.name}</p>
                          <p className="text-xs text-gray-200">
                            {bs.quantity}x • {bs.scheduled_date ? `Scheduled: ${format(new Date(bs.scheduled_date), 'MMM dd')} @ ${bs.scheduled_time}` : bs.services?.pricing_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">₦{Number(bs.total_price_ngn).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 bg-dark-900 p-4 rounded border border-dark-700">
                <div className="flex justify-between text-sm text-gray-200 mb-2">
                  <span>Room Cost</span>
                  <span>₦{Number(viewBooking.total_room_price_ngn).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-200 mb-2">
                  <span>Services Cost</span>
                  <span>₦{Number(viewBooking.total_extras_price_ngn).toLocaleString()}</span>
                </div>
                {Number(viewBooking.discount_amount_ngn) > 0 && (
                  <div className="flex justify-between text-sm text-green-500 mb-2">
                    <span>Room Discount Applied (Accommodation Only)</span>
                    <span>-₦{Number(viewBooking.discount_amount_ngn).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold pt-2 border-t border-dark-700">
                  <span>Grand Total</span>
                  <span className="text-gold-500">₦{Number(viewBooking.total_amount_ngn).toLocaleString()}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Room Transfer Modal */}
      <RoomTransferModal 
        isOpen={Boolean(transferBooking)} 
        onClose={() => setTransferBooking(null)} 
        booking={transferBooking} 
        onSuccess={() => { fetchReservations(); if (onUpdate) onUpdate(); }} 
      />

      {/* Manual Booking Shared Modal */}
      <ManualBookingModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={() => { fetchReservations(); if (onUpdate) onUpdate(); }} 
      />

      {renderPrintReceipt()}
    </div>
  );
};

export default AdminReservations;

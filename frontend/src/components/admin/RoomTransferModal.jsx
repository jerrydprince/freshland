import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { X, ArrowRightLeft, Key, DollarSign, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const RoomTransferModal = ({ isOpen, onClose, booking, onSuccess }) => {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pricing mode state: 'charge' (default), 'waive' (comp), 'custom'
  const [pricingMode, setPricingMode] = useState('charge');
  const [customRoomPrice, setCustomRoomPrice] = useState(0);

  useEffect(() => {
    if (isOpen && booking) {
      checkAvailability();
      // Reset selected room and pricing choices
      setSelectedRoomId('');
      setPricingMode('charge');
    }
  }, [isOpen, booking]);

  if (!isOpen || !booking) return null;

  // 1. Check dynamic availability of alternative rooms during guest stay
  const checkAvailability = async () => {
    setLoadingRooms(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      // For checked-in guests, availability starts today. Otherwise, it starts at check-in.
      const startCheck = booking.status === 'checked_in'
        ? (booking.check_in_date > todayStr ? booking.check_in_date : todayStr)
        : booking.check_in_date;
      const endCheck = booking.check_out_date;

      // Query all rooms
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name, room_number, base_price_ngn, status, type');

      if (roomsError) throw roomsError;

      // Query booked rooms during duration
      const { data: bookedRooms, error: rpcError } = await supabase.rpc('get_booked_room_ids', {
        req_start_date: startCheck,
        req_end_date: endCheck
      });

      if (rpcError) throw rpcError;

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

      const bookedRoomIds = new Set((bookedRooms || []).map(b => b.booked_room_id));
      
      // Filter out currently assigned room, dirty/maintenance rooms, and booked rooms
      const actuallyAvailable = (rooms || []).filter(r => {
        const isSelf = r.id === booking.room_id;
        const isStatusAvailable = r.status === 'available';
        const isBooked = bookedRoomIds.has(r.id);
        const taskStatus = latestTaskByRoom[r.id];
        const isClean = !taskStatus || taskStatus === 'inspected' || startCheck > todayStr;
        return !isSelf && isStatusAvailable && !isBooked && isClean;
      });
      
      setAvailableRooms(actuallyAvailable);
    } catch (err) {
      console.error('Error fetching room availability:', err);
      toast.error('Failed to query available alternative rooms.');
    } finally {
      setLoadingRooms(false);
    }
  };

  // 2. Stay statistics calculations
  const start = new Date(booking.check_in_date);
  const end = new Date(booking.check_out_date);
  const totalNights = Math.max(1, differenceInDays(end, start));
  
  // Calculate elapsed stays for checked-in guests
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  let elapsedNights = 0;
  if (booking.status === 'checked_in') {
    // If they checked in today or in future, elapsed is 0. Otherwise, count difference.
    elapsedNights = differenceInDays(today, start);
    elapsedNights = Math.max(0, Math.min(totalNights - 1, elapsedNights));
  }
  const remainingNights = totalNights - elapsedNights;

  // 3. Pricing formulas
  const oldPricePerNight = booking.rooms?.base_price_ngn || (booking.total_room_price_ngn / totalNights) || 0;
  
  const selectedRoom = availableRooms.find(r => r.id === selectedRoomId);
  const newPricePerNight = selectedRoom?.base_price_ngn || 0;

  // Calculated prorated price: lock elapsed nights at old rate, remaining nights at new rate
  const proratedNewRoomPrice = (oldPricePerNight * elapsedNights) + (newPricePerNight * remainingNights);
  
  // Choose final room price based on administrative mode
  let finalRoomPrice = booking.total_room_price_ngn;
  if (selectedRoomId) {
    if (pricingMode === 'charge') {
      finalRoomPrice = proratedNewRoomPrice;
    } else if (pricingMode === 'waive') {
      finalRoomPrice = booking.total_room_price_ngn;
    } else if (pricingMode === 'custom') {
      finalRoomPrice = Number(customRoomPrice) || 0;
    }
  }

  // Calculate booking final balances
  const finalTotalAmount = finalRoomPrice + Number(booking.total_extras_price_ngn || 0);
  const financialDelta = finalTotalAmount - booking.total_amount_ngn;

  // Setup default custom price on room selection
  const handleRoomChange = (e) => {
    const roomId = e.target.value;
    setSelectedRoomId(roomId);
    const room = availableRooms.find(r => r.id === roomId);
    if (room) {
      const calculatedProrated = (oldPricePerNight * elapsedNights) + (room.base_price_ngn * remainingNights);
      setCustomRoomPrice(calculatedProrated);
    }
  };

  // 4. Database persistence (Transaction update logic)
  const handleConfirmTransfer = async () => {
    if (!selectedRoomId) return toast.error("Please select a new room/apartment.");
    setIsSubmitting(true);

    try {
      const originalRoomId = booking.room_id;

      // A. Determine appropriate payment status update
      let newPaymentStatus = booking.payment_status;
      if (pricingMode === 'charge') {
        const outstanding = finalTotalAmount - Number(booking.amount_paid_ngn || 0);
        if (outstanding > 0) {
          newPaymentStatus = 'partial'; // has outstanding balance
        } else if (outstanding <= 0) {
          newPaymentStatus = 'paid'; // fully settled
        }
      }

      // B. Step 1: Update Booking records
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({
          room_id: selectedRoomId,
          total_room_price_ngn: finalRoomPrice,
          total_amount_ngn: finalTotalAmount,
          payment_status: newPaymentStatus
        })
        .eq('id', booking.id);

      if (bookingErr) throw bookingErr;

      // C. Step 2: Swap physical room statuses if guest is in-house
      if (booking.status === 'checked_in') {
        // Free old room
        const { error: roomOldErr } = await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('id', originalRoomId);

        if (roomOldErr) throw roomOldErr;

        // Occupy new room
        const { error: roomNewErr } = await supabase
          .from('rooms')
          .update({ status: 'occupied' })
          .eq('id', selectedRoomId);

        if (roomNewErr) throw roomNewErr;

        // Schedule auto cleaning task for old room
        await supabase.from('housekeeping_tasks').insert([{
          room_id: originalRoomId,
          task_type: 'checkout_cleaning',
          status: 'pending',
          assigned_date: format(new Date(), 'yyyy-MM-dd'),
          notes: `Automated cleanup generated via guest transfer of ${booking.guest_name || 'In-house guest'} (Ref: ${booking.booking_reference})`
        }]);
      }

      // D. Step 3: Update matching Invoice to maintain perfect financial synchrony
      const { data: invoiceList } = await supabase
        .from('invoices')
        .select('*')
        .eq('booking_id', booking.id);

      if (invoiceList && invoiceList.length > 0) {
        const invoice = invoiceList[0];
        const calculated_subtotal = finalTotalAmount / 1.075;
        const calculated_tax = finalTotalAmount - calculated_subtotal;

        let newInvoiceStatus = invoice.status;
        if (invoice.amount_paid >= finalTotalAmount) {
          newInvoiceStatus = 'paid';
        } else if (invoice.amount_paid > 0) {
          newInvoiceStatus = 'partial';
        } else {
          newInvoiceStatus = 'draft';
        }

        const { error: invoiceErr } = await supabase
          .from('invoices')
          .update({
            total_amount: finalTotalAmount,
            subtotal: calculated_subtotal,
            tax_amount: calculated_tax,
            status: newInvoiceStatus
          })
          .eq('id', invoice.id);

        if (invoiceErr) throw invoiceErr;
      }

      toast.success(`Guest transferred to ${selectedRoom?.name || 'new room'} successfully!`);
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error executing guest transfer:', err);
      toast.error(err.message || 'Failed to complete room transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 w-full max-w-2xl rounded-xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[95vh] custom-scrollbar">
        
        {/* Header */}
        <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="text-amber-500" size={20} />
            Transfer Guest Room / Apartment
          </h2>
          <button onClick={onClose} className="text-gray-200 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Guest Stay Profile Summaries */}
          <div className="grid grid-cols-2 gap-4 bg-dark-900 border border-dark-700/60 p-4 rounded-lg">
            <div>
              <p className="text-xs text-gray-300 uppercase tracking-wider font-semibold">Guest Name</p>
              <p className="text-white font-bold text-base mt-0.5">{booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : booking.guest_name}</p>
              <p className="text-xs text-gray-200 mt-1">Ref: {booking.booking_reference}</p>
            </div>
            <div>
              <p className="text-xs text-gray-300 uppercase tracking-wider font-semibold">Stay Duration</p>
              <p className="text-white font-medium mt-0.5">{totalNights} Nights</p>
              <p className="text-xs text-gray-200 mt-1">
                {format(start, 'MMM dd, yyyy')} - {format(end, 'MMM dd, yyyy')}
              </p>
            </div>
          </div>

          {/* Room Allocation Swap Console */}
          <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-4">
            
            {/* Old Room Card */}
            <div className="md:col-span-3 bg-dark-900 border border-dark-700 p-4 rounded-lg text-center">
              <span className="text-[10px] bg-dark-700 text-gray-300 font-bold px-2 py-0.5 rounded-full">CURRENT ROOM</span>
              <h4 className="text-xl font-bold text-white mt-2">{booking.rooms?.room_number || 'N/A'}</h4>
              <p className="text-sm text-gray-200 mt-1">{booking.rooms?.name || 'Unknown Room'}</p>
              <p className="text-xs text-amber-500 font-semibold mt-2">₦{Number(oldPricePerNight).toLocaleString()}/night</p>
            </div>

            {/* Transition Arrow Indicator */}
            <div className="md:col-span-1 flex justify-center">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center animate-pulse">
                <ArrowRightLeft size={20} className="rotate-90 md:rotate-0" />
              </div>
            </div>

            {/* New Room Selector Card */}
            <div className="md:col-span-3 bg-dark-900 border border-brand-500/20 p-4 rounded-lg text-center flex flex-col justify-between">
              <div>
                <span className="text-[10px] bg-brand-500/20 text-brand-400 font-bold px-2 py-0.5 rounded-full">NEW ASSIGNMENT</span>
                
                {loadingRooms ? (
                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-300 py-3">
                    <RefreshCw className="animate-spin" size={14} /> Loading available rooms...
                  </div>
                ) : availableRooms.length === 0 ? (
                  <div className="text-xs text-red-400 py-5 font-semibold">
                    ⚠️ No available alternative rooms for these dates!
                  </div>
                ) : (
                  <select 
                    required 
                    value={selectedRoomId} 
                    onChange={handleRoomChange} 
                    className="w-full bg-dark-800 border border-dark-700 rounded p-2 text-white outline-none focus:border-brand-500 transition-colors mt-3 text-sm"
                  >
                    <option value="">-- Choose New Room --</option>
                    {availableRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} - {r.name} (₦{Number(r.base_price_ngn).toLocaleString()}/n)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              {selectedRoom && (
                <div className="mt-3 border-t border-dark-700/50 pt-2 text-left">
                  <p className="text-xs text-gray-200 capitalize">Type: <strong className="text-white">{selectedRoom.type}</strong></p>
                  <p className="text-xs text-brand-400 font-semibold mt-1">Price: ₦{Number(selectedRoom.base_price_ngn).toLocaleString()}/night</p>
                </div>
              )}
            </div>

          </div>

          {/* Stay Timeline Proration Details */}
          {selectedRoomId && (
            <div className="bg-dark-900 border border-dark-700/60 p-4 rounded-lg space-y-3">
              <h4 className="text-xs text-gray-200 uppercase tracking-wider font-bold">Stay Timeline & Proration Calculation</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs border-b border-dark-700 pb-2">
                <div>
                  <p className="text-gray-300">Total Stay</p>
                  <p className="text-white font-bold mt-0.5">{totalNights} Nights</p>
                </div>
                <div>
                  <p className="text-gray-300">Elapsed Nights (Locked)</p>
                  <p className="text-white font-bold mt-0.5">{elapsedNights} Nights</p>
                </div>
                <div>
                  <p className="text-gray-300">Remaining (At New Rate)</p>
                  <p className="text-brand-400 font-bold mt-0.5">{remainingNights} Nights</p>
                </div>
              </div>
              
              {/* Detailed Breakdown */}
              <div className="space-y-1.5 text-sm font-medium">
                <div className="flex justify-between text-xs text-gray-200">
                  <span>Elapsed cost ({elapsedNights} x ₦{Number(oldPricePerNight).toLocaleString()}):</span>
                  <span>₦{Number(oldPricePerNight * elapsedNights).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-200">
                  <span>Remaining cost ({remainingNights} x ₦{Number(newPricePerNight).toLocaleString()}):</span>
                  <span>₦{Number(newPricePerNight * remainingNights).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-white font-bold pt-1.5 border-t border-dark-800">
                  <span>Prorated Room Total:</span>
                  <span className="text-brand-400">₦{Number(proratedNewRoomPrice).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Billing & Settlement Mode Options */}
          {selectedRoomId && (
            <div className="bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="text-brand-500" size={16} />
                Financial Settlement Mode
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Mode: Charge/Credit */}
                <button
                  type="button"
                  onClick={() => setPricingMode('charge')}
                  className={`p-3 border rounded text-left transition-all ${
                    pricingMode === 'charge'
                      ? 'border-brand-500 bg-brand-500/5'
                      : 'border-dark-700 hover:border-gray-600'
                  }`}
                >
                  <p className="text-xs font-bold text-white">Adjust Billing</p>
                  <p className="text-[10px] text-gray-200 mt-1 leading-normal">
                    Apply stay calculations. Invoice & Booking balances will adjust.
                  </p>
                </button>

                {/* Mode: Waive */}
                <button
                  type="button"
                  onClick={() => setPricingMode('waive')}
                  className={`p-3 border rounded text-left transition-all ${
                    pricingMode === 'waive'
                      ? 'border-brand-500 bg-brand-500/5'
                      : 'border-dark-700 hover:border-gray-600'
                  }`}
                >
                  <p className="text-xs font-bold text-white">Waive / Comp Difference</p>
                  <p className="text-[10px] text-gray-200 mt-1 leading-normal">
                    Transfer guest, but freeze overall billing at the original rate.
                  </p>
                </button>

                {/* Mode: Custom */}
                <button
                  type="button"
                  onClick={() => setPricingMode('custom')}
                  className={`p-3 border rounded text-left transition-all ${
                    pricingMode === 'custom'
                      ? 'border-brand-500 bg-brand-500/5'
                      : 'border-dark-700 hover:border-gray-600'
                  }`}
                >
                  <p className="text-xs font-bold text-white">Custom Room Price</p>
                  <p className="text-[10px] text-gray-200 mt-1 leading-normal">
                    Input a specific custom room total cost override.
                  </p>
                </button>

              </div>

              {/* Custom Price Override Selector */}
              {pricingMode === 'custom' && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-1">
                  <label className="block text-xs text-gray-200 mb-1 font-bold">Custom Room Price Total (₦)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={customRoomPrice}
                    onChange={(e) => setCustomRoomPrice(Number(e.target.value) || 0)}
                    className="w-full bg-dark-800 border border-brand-500 rounded p-2 text-white font-bold text-base outline-none focus:border-brand-400"
                  />
                  <p className="text-[10px] text-gray-300 mt-1">Updates booking room cost to exactly this figure.</p>
                </div>
              )}

              {/* Financial Balances Ledger comparison */}
              <div className="bg-dark-950 p-4 border border-dark-800 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between text-gray-200">
                  <span>Current Booking Grand Total:</span>
                  <span>₦{Number(booking.total_amount_ngn).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-200">
                  <span>Proposed Booking Grand Total:</span>
                  <span className="text-white font-semibold">₦{Number(finalTotalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-200">
                  <span>Guest Payments Recorded:</span>
                  <span>₦{Number(booking.amount_paid_ngn || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dark-800">
                  <span className="font-bold text-white">Financial Impact:</span>
                  {financialDelta > 0 ? (
                    <span className="font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Guest Owes: +₦{Number(financialDelta).toLocaleString()}
                    </span>
                  ) : financialDelta < 0 ? (
                    <span className="font-extrabold text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20">
                      Refund/Credit Due: ₦{Number(Math.abs(financialDelta)).toLocaleString()}
                    </span>
                  ) : (
                    <span className="font-bold text-gray-200 bg-dark-800 px-2 py-0.5 rounded border border-dark-700">
                      No Change in Bill
                    </span>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Action Panel */}
        <div className="bg-dark-900 p-4 border-t border-dark-700 flex justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-5 py-2.5 rounded bg-dark-750 text-white font-medium hover:bg-dark-700 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="button"
            disabled={isSubmitting || !selectedRoomId}
            onClick={handleConfirmTransfer}
            className={`px-6 py-2.5 rounded font-bold text-dark-900 transition-all flex items-center gap-2 ${
              selectedRoomId
                ? 'bg-amber-500 hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'bg-dark-700 text-gray-300 cursor-not-allowed border border-dark-600'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="animate-spin" size={16} /> Processing Transfer...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Complete Transfer
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default RoomTransferModal;

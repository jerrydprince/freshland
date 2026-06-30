import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar/lib/index.js';
import withDragAndDropModule from 'react-big-calendar/lib/addons/dragAndDrop/index.js';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});
const withDragAndDrop = withDragAndDropModule.default || withDragAndDropModule;
const DragAndDropCalendar = withDragAndDrop(Calendar);

const AdminCalendar = () => {
  const [events, setEvents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal and Rebooking State
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showRebookForm, setShowRebookForm] = useState(false);
  const [rebookCheckIn, setRebookCheckIn] = useState('');
  const [rebookCheckOut, setRebookCheckOut] = useState('');
  const [rebookRoomId, setRebookRoomId] = useState('');
  const [rebookRoomsList, setRebookRoomsList] = useState([]);
  const [loadingRebookRooms, setLoadingRebookRooms] = useState(false);
  const [rebookProcessing, setRebookProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch rooms to be used as resources
    const { data: roomData, error: roomError } = await supabase.from('rooms').select('id, name');
    
    // Fetch bookings with profiles and rooms details
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select('*, profiles(first_name, last_name), rooms(id, room_number, name, base_price_ngn)');

    if (roomError || bookingError) {
      toast.error('Failed to load calendar data');
    } else {
      setRooms(roomData);
      
      // Filter out online checkouts that are unpaid (abandoned checkout flow)
      const activeBookings = (bookingData || []).filter(
        b => !(b.booking_source === 'online' && b.payment_status === 'unpaid')
      );
      
      const calendarEvents = activeBookings.map(booking => {
        const guestName = booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : (booking.special_requests || 'Walk-in');
        return {
          id: booking.id,
          title: `${guestName} (${booking.status})`,
          start: new Date(booking.check_in_date),
          end: new Date(booking.check_out_date),
          resourceId: booking.room_id,
          status: booking.status,
          booking: booking // Preserve full booking reference for the modal
        };
      });
      setEvents(calendarEvents);
    }
    setLoading(false);
  };

  // Availability lookup for rebooking
  const fetchRebookAvailability = async (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return;
    setLoadingRebookRooms(true);
    try {
      const { data: roomsData } = await supabase.from('rooms').select('id, name, room_number, base_price_ngn');
      if (!roomsData) return setRebookRoomsList([]);

      const { data: bookedRooms, error: queryError } = await supabase.rpc('get_booked_room_ids', {
        req_start_date: checkIn,
        req_end_date: checkOut
      });
        
      if (queryError) console.error('Availability check error:', queryError);

      const bookedRoomIds = new Set((bookedRooms || []).map(b => typeof b === 'string' ? b : (b.booked_room_id || b.room_id || b.id || Object.values(b)[0])));
      
      const actuallyAvailable = roomsData.filter(r => !bookedRoomIds.has(r.id));
      setRebookRoomsList(actuallyAvailable);
    } catch (err) {
      console.error('Rebooking check failed:', err);
    } finally {
      setLoadingRebookRooms(false);
    }
  };

  useEffect(() => {
    if (showRebookForm && rebookCheckIn && rebookCheckOut) {
      fetchRebookAvailability(rebookCheckIn, rebookCheckOut);
    }
  }, [rebookCheckIn, rebookCheckOut, showRebookForm]);

  useEffect(() => {
    if (selectedEvent && showRebookForm) {
      const todayStr = moment().format('YYYY-MM-DD');
      const tomorrowStr = moment().add(1, 'days').format('YYYY-MM-DD');
      setRebookCheckIn(todayStr);
      setRebookCheckOut(tomorrowStr);
      setRebookRoomId(selectedEvent.booking.room_id || '');
    } else {
      setRebookCheckIn('');
      setRebookCheckOut('');
      setRebookRoomId('');
      setRebookRoomsList([]);
    }
  }, [selectedEvent, showRebookForm]);

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

      const nights = Math.max(1, moment(rebookCheckOut).diff(moment(rebookCheckIn), 'days'));
      const newRoomPrice = Number(selectedRoom.base_price_ngn) * nights;
      const newTotalAmount = newRoomPrice + (selectedEvent.booking.total_extras_price_ngn || 0);

      // Preserve payment but update date, status, room, and recalculated price.
      const amountPaid = Number(selectedEvent.booking.amount_paid_ngn || 0);
      const newPaymentStatus = amountPaid >= newTotalAmount ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');

      // 1. Release original room
      if (selectedEvent.booking.room_id) {
        const { error: oldRoomErr } = await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('id', selectedEvent.booking.room_id);
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
        .eq('id', selectedEvent.booking.id);
      if (updateErr) throw updateErr;

      // 3. Log ₦0 payment in stay ledger with notes = 'Rebook'
      const { error: paymentErr } = await supabase
        .from('payments')
        .insert([{
          booking_id: selectedEvent.booking.id,
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
      setSelectedEvent(null);
      setShowRebookForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(`Rebooking failed: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setRebookProcessing(false);
    }
  };

  const handleMarkAsNoShowOnly = async (booking) => {
    setRebookProcessing(true);
    const toastId = toast.loading(`Marking reservation as No-Show...`);
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
      setSelectedEvent(null);
      setShowRebookForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(`Operation failed: ${err.message || 'Error occurred'}`, { id: toastId });
    } finally {
      setRebookProcessing(false);
    }
  };

  const moveEvent = async ({ event, start, end, resourceId }) => {
    // Optimistic UI update
    const updatedEvents = events.map(e => 
      e.id === event.id ? { ...e, start, end, resourceId } : e
    );
    setEvents(updatedEvents);

    const { error } = await supabase
      .from('bookings')
      .update({
        check_in_date: moment(start).format('YYYY-MM-DD'),
        check_out_date: moment(end).format('YYYY-MM-DD'),
        room_id: resourceId
      })
      .eq('id', event.id);

    if (error) {
      toast.error('Failed to move booking');
      fetchData(); // Revert
    } else {
      toast.success('Booking updated successfully');
    }
  };

  const resizeEvent = async ({ event, start, end }) => {
    const updatedEvents = events.map(e => 
      e.id === event.id ? { ...e, start, end } : e
    );
    setEvents(updatedEvents);

    const { error } = await supabase
      .from('bookings')
      .update({
        check_in_date: moment(start).format('YYYY-MM-DD'),
        check_out_date: moment(end).format('YYYY-MM-DD')
      })
      .eq('id', event.id);

    if (error) {
      toast.error('Failed to resize booking');
      fetchData();
    } else {
      toast.success('Booking dates updated');
    }
  };

  const eventStyleGetter = (event) => {
    let backgroundColor = '#3182ce'; // blue for pending
    
    if (event.status === 'confirmed') backgroundColor = '#38a169'; // green
    if (event.status === 'checked_in') backgroundColor = '#805ad5'; // purple
    if (event.status === 'cancelled') backgroundColor = '#e53e3e'; // red
    if (event.status === 'no_show') backgroundColor = '#dd6b20'; // orange

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <style>{`
        /* Dark Mode overrides for react-big-calendar */
        .rbc-calendar {
          font-family: inherit;
        }
        .rbc-header {
          border-bottom: 1px solid #374151 !important;
          border-left: 1px solid #374151 !important;
          background: #111827;
          color: #9CA3AF;
          padding: 10px 0;
          font-weight: 600;
        }
        .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
          border: 1px solid #374151;
          border-radius: 0.5rem;
          background-color: #1F2937;
        }
        .rbc-day-bg {
          border-left: 1px solid #374151 !important;
        }
        .rbc-month-row {
          border-top: 1px solid #374151 !important;
        }
        .rbc-off-range-bg {
          background-color: #111827;
        }
        .rbc-today {
          background-color: rgba(223, 104, 83, 0.1);
        }
        .rbc-date-cell {
          padding-right: 5px;
          color: #D1D5DB;
        }
        .rbc-off-range {
          color: #4B5563;
        }
        .rbc-time-content {
          border-top: 1px solid #374151;
        }
        .rbc-time-header-content {
          border-left: 1px solid #374151;
        }
        .rbc-timeslot-group {
          border-bottom: 1px solid #374151;
        }
        .rbc-time-gutter .rbc-timeslot-group {
          background: #1F2937;
          color: #9CA3AF;
        }
        .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid rgba(55, 65, 81, 0.5);
        }
        .rbc-btn-group button {
          color: #D1D5DB;
          border: 1px solid #374151;
          background: #1F2937;
        }
        .rbc-btn-group button:hover {
          background: #374151;
          color: #FFF;
        }
        .rbc-btn-group button.rbc-active {
          background: #DF6853;
          border-color: #DF6853;
          color: #FFF;
          box-shadow: none;
        }
        .rbc-toolbar button:active, .rbc-toolbar button.rbc-active:hover {
          background: #c55b48;
        }
        .rbc-toolbar-label {
          color: #FFF;
          font-weight: bold;
          font-size: 1.25rem;
        }
        .rbc-event {
          border-radius: 4px;
        }
      `}</style>
      <div>
        <h1 className="text-2xl font-bold text-white">Visual Calendar</h1>
        <p className="text-gray-200 mt-1">Drag and drop bookings to change dates or assign rooms.</p>
      </div>

      <div className="bg-dark-800 border border-dark-700 shadow-sm p-4 rounded-lg flex-1 min-h-[700px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-300">Loading calendar data...</div>
        ) : (
          <DragAndDropCalendar
            localizer={localizer}
            events={events}
            onEventDrop={moveEvent}
            onEventResize={resizeEvent}
            onSelectEvent={(event) => {
              setSelectedEvent(event);
              setShowRebookForm(event.status === 'no_show');
            }}
            resizable
            selectable
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventStyleGetter}
            style={{ height: '100%' }}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
            popup
          />
        )}
      </div>

      {/* Guest Details & Rebooking Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-lg rounded-xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-dark-700 pb-3 mb-4">
              <h3 className="text-lg font-bold">Booking Details</h3>
              <button 
                onClick={() => {
                  setSelectedEvent(null);
                  setShowRebookForm(false);
                }}
                className="text-gray-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between py-1 border-b border-dark-700/50">
                <span className="text-gray-200">Guest Name:</span>
                <span className="font-semibold text-white">
                  {selectedEvent.booking.profiles 
                    ? `${selectedEvent.booking.profiles.first_name} ${selectedEvent.booking.profiles.last_name}` 
                    : (selectedEvent.booking.special_requests || 'Walk-in')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-dark-700/50">
                <span className="text-gray-200">Reference:</span>
                <span className="font-mono text-gold-500 font-semibold">{selectedEvent.booking.booking_reference}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-dark-700/50">
                <span className="text-gray-200">Room:</span>
                <span className="font-semibold text-white">
                  Room {selectedEvent.booking.rooms?.room_number} ({selectedEvent.booking.rooms?.name})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-dark-700/50">
                <span className="text-gray-200">Dates:</span>
                <span className="font-semibold text-white">
                  {selectedEvent.booking.check_in_date} to {selectedEvent.booking.check_out_date}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-dark-700/50">
                <span className="text-gray-200">Status:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  selectedEvent.status === 'confirmed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  selectedEvent.status === 'checked_in' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                  selectedEvent.status === 'no_show' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  selectedEvent.status === 'cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {selectedEvent.status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-dark-700/50">
                <span className="text-gray-200">Amount Paid:</span>
                <span className="font-semibold text-green-400 font-mono">
                  ₦{Number(selectedEvent.booking.amount_paid_ngn || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-200">Total Bill:</span>
                <span className="font-semibold text-white font-mono">
                  ₦{Number(selectedEvent.booking.total_amount_ngn || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="space-y-4 pt-2 border-t border-dark-700">
              {/* No-show & Rebook controls */}
              {!showRebookForm && selectedEvent.status !== 'cancelled' && selectedEvent.status !== 'checked_out' && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    disabled={rebookProcessing}
                    onClick={() => handleMarkAsNoShowOnly(selectedEvent.booking)}
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
                  >
                    Mark as No-Show Only
                  </button>
                  <button
                    disabled={rebookProcessing}
                    onClick={() => setShowRebookForm(true)}
                    className="flex-1 px-4 py-2.5 bg-gold-600 hover:bg-gold-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
                  >
                    Mark as No-Show & Rebook
                  </button>
                </div>
              )}

              {showRebookForm && (
                <form onSubmit={handleConfirmRebooking} className="space-y-4">
                  <div className="bg-dark-900 border border-dark-700 p-4 rounded-lg space-y-4">
                    <h4 className="font-bold text-gold-500 text-sm tracking-wider uppercase">Rebook Guest</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col space-y-1">
                        <label className="text-xs text-gray-200 font-semibold">New Check-In</label>
                        <input 
                          type="date"
                          required
                          value={rebookCheckIn}
                          onChange={(e) => setRebookCheckIn(e.target.value)}
                          className="bg-dark-800 border border-dark-700 rounded p-2 text-sm text-white focus:outline-none focus:border-gold-500"
                        />
                      </div>
                      <div className="flex flex-col space-y-1">
                        <label className="text-xs text-gray-200 font-semibold">New Check-Out</label>
                        <input 
                          type="date"
                          required
                          value={rebookCheckOut}
                          onChange={(e) => setRebookCheckOut(e.target.value)}
                          className="bg-dark-800 border border-dark-700 rounded p-2 text-sm text-white focus:outline-none focus:border-gold-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs text-gray-200 font-semibold">Select Room</label>
                      <select
                        required
                        value={rebookRoomId}
                        onChange={(e) => setRebookRoomId(e.target.value)}
                        className="bg-dark-800 border border-dark-700 rounded p-2 text-sm text-white focus:outline-none focus:border-gold-500"
                        disabled={loadingRebookRooms}
                      >
                        <option value="">-- Choose a Room --</option>
                        {rebookRoomsList.map(r => (
                          <option key={r.id} value={r.id}>
                            Room {r.room_number} - {r.name} (₦{Number(r.base_price_ngn).toLocaleString()}/night)
                          </option>
                        ))}
                      </select>
                      {loadingRebookRooms && <span className="text-xs text-gray-200 animate-pulse">Checking available inventory...</span>}
                      {!loadingRebookRooms && rebookRoomsList.length === 0 && rebookCheckIn && rebookCheckOut && (
                        <span className="text-xs text-red-400">No rooms available for the selected dates.</span>
                      )}
                    </div>
                  </div>

                  {/* Pricing Overview */}
                  {rebookCheckIn && rebookCheckOut && rebookRoomId && (
                    (() => {
                      const selectedRoom = rebookRoomsList.find(r => r.id === rebookRoomId);
                      if (!selectedRoom) return null;
                      const nights = Math.max(1, moment(rebookCheckOut).diff(moment(rebookCheckIn), 'days'));
                      const originalPaid = Number(selectedEvent.booking.amount_paid_ngn || 0);
                      const newRoomPrice = Number(selectedRoom.base_price_ngn) * nights;
                      const newTotal = newRoomPrice + (selectedEvent.booking.total_extras_price_ngn || 0);
                      const balance = newTotal - originalPaid;

                      return (
                        <div className="bg-dark-900/50 border border-dark-700/50 p-4 rounded-lg space-y-2 text-sm font-sans">
                          <div className="flex justify-between">
                            <span className="text-gray-200">Nights:</span>
                            <span>{nights} night(s)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-200">New Total Cost:</span>
                            <span className="font-semibold text-white font-mono">₦{newTotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-200">Carried Balance Paid:</span>
                            <span className="font-semibold text-green-400 font-mono">₦{originalPaid.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between border-t border-dark-700/50 pt-2 font-bold">
                            <span className="text-gray-300">{balance > 0 ? "Pending Balance:" : "Overpaid Balance:"}</span>
                            <span className={balance > 0 ? "text-amber-500 font-mono" : "text-green-400 font-mono"}>
                              ₦{Math.abs(balance).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-300 leading-normal">
                            * Confirming this rebooking updates the booking dates and assigns the selected room. A payment ledger entry of ₦0 with description 'rebook' is recorded.
                          </p>
                        </div>
                      );
                    })()
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRebookForm(false);
                      }}
                      className="flex-1 px-4 py-2.5 bg-dark-900 border border-dark-700 hover:bg-dark-950 text-gray-300 font-semibold rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={rebookProcessing || loadingRebookRooms || !rebookRoomId}
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
                    >
                      {rebookProcessing ? 'Confirming...' : 'Confirm Rebooking'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCalendar;

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Clock, LogIn, LogOut, FileText, CheckCircle, Sparkles, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInSeconds } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const TopbarAttendanceClock = () => {
  const { user, profile, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeShift, setActiveShift] = useState(null);
  const [elapsed, setElapsed] = useState('');
  const [notes, setNotes] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update current time clock ticking in dropdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active shift on load and when user changes
  useEffect(() => {
    if (user?.id) {
      fetchActiveShift();
    }
  }, [user]);

  // Event listener for attendance updates elsewhere to sync automatically
  useEffect(() => {
    const handleSync = () => {
      fetchActiveShift();
    };
    window.addEventListener('attendance-updated', handleSync);
    return () => window.removeEventListener('attendance-updated', handleSync);
  }, [user]);

  // Tick the shift duration elapsed timer
  useEffect(() => {
    let intervalId;
    if (activeShift && activeShift.clock_in) {
      const updateElapsed = () => {
        const diff = differenceInSeconds(new Date(), new Date(activeShift.clock_in));
        if (diff < 0) return setElapsed('00:00:00');
        const hrs = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const secs = diff % 60;
        setElapsed(
          `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      };
      updateElapsed();
      intervalId = setInterval(updateElapsed, 1000);
    } else {
      setElapsed('');
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeShift]);

  const fetchActiveShift = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('staff_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        setActiveShift(data[0]);
      } else {
        setActiveShift(null);
      }
    } catch (e) {
      console.error("Error fetching active shift:", e);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    const toastId = toast.loading("Clocking in shift...");
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('staff_attendance')
        .insert({
          staff_id: user.id,
          clock_in: now,
          status: 'present',
          notes: notes.trim() || null
        })
        .select();

      if (error) throw error;

      // Log activity
      try {
        await supabase.from('system_logs').insert({
          user_id: user.id,
          log_type: 'activity',
          action: `Clocked In shift: ${notes.trim() ? `"${notes.trim()}"` : 'No memo'}`,
          module: 'System',
          metadata: { details: notes.trim() || null }
        });
      } catch (logErr) {
        console.error("Failed to log activity:", logErr);
      }

      if (data && data.length > 0) {
        setActiveShift(data[0]);
      }

      toast.success("Clocked In successfully! Have a great shift.", { id: toastId });
      setNotes('');
      setIsOpen(false);
      
      // Dispatch global sync event
      window.dispatchEvent(new Event('attendance-updated'));
    } catch (e) {
      toast.error(`Clock In failed: ${e.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeShift) return;
    setLoading(true);
    const toastId = toast.loading("Clocking out shift...");
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('staff_attendance')
        .update({
          clock_out: now,
          notes: notes.trim() ? `${activeShift.notes ? activeShift.notes + ' | ' : ''}${notes.trim()}` : activeShift.notes
        })
        .eq('id', activeShift.id);

      if (error) throw error;

      // Log activity
      try {
        await supabase.from('system_logs').insert({
          user_id: user.id,
          log_type: 'activity',
          action: `Clocked Out shift`,
          module: 'System',
          metadata: { details: notes.trim() || null }
        });
      } catch (logErr) {
        console.error("Failed to log activity:", logErr);
      }

      setActiveShift(null);
      toast.success("Clocked Out successfully! Shift completed.", { id: toastId });
      setNotes('');
      setIsOpen(false);

      // Dispatch global sync event
      window.dispatchEvent(new Event('attendance-updated'));
      
      // Terminate login session on clock out
      await logout();
    } catch (e) {
      toast.error(`Clock Out failed: ${e.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Pulse Status Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-300 backdrop-blur-md ${
          activeShift 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50'
        }`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            activeShift ? 'bg-emerald-400' : 'bg-amber-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            activeShift ? 'bg-emerald-500' : 'bg-amber-500'
          }`}></span>
        </span>
        
        <span className="text-sm font-bold tracking-wide select-none font-mono">
          {activeShift ? `On Shift: ${elapsed || '00:00:00'}` : 'Off Shift / Clock In'}
        </span>
      </button>

      {/* Popover Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-80 glass-panel bg-dark-800/95 border border-dark-700/80 backdrop-blur-lg shadow-2xl rounded-2xl p-5 overflow-hidden text-white"
          >
            {/* Ambient gold/green accent circle inside popover */}
            <div className={`absolute -top-12 -right-12 w-28 h-28 rounded-full blur-3xl opacity-20 transition-colors duration-500 ${
              activeShift ? 'bg-emerald-500' : 'bg-amber-500'
            }`}></div>

            {/* Content Container */}
            <div className="relative z-10 space-y-4">
              {/* Header Info */}
              <div className="flex justify-between items-center border-b border-dark-700/50 pb-3">
                <div>
                  <h4 className="font-bold text-white text-base">Shift Attendance</h4>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {format(currentTime, 'eee, MMM dd, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-mono font-bold text-brand-500 leading-none">
                    {format(currentTime, 'HH:mm:ss')}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Local Time</p>
                </div>
              </div>

              {/* Status Display Card */}
              <div className={`p-4 rounded-xl border ${
                activeShift 
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
              }`}>
                <div className="flex gap-3 items-center">
                  <div className={`p-2.5 rounded-lg border ${
                    activeShift 
                      ? 'bg-emerald-500/10 border-emerald-500/20' 
                      : 'bg-amber-500/10 border-amber-500/20'
                  }`}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block leading-none mb-1">
                      Current Shift Status
                    </span>
                    <span className="font-extrabold text-sm leading-none block">
                      {activeShift ? 'ACTIVE (On the Clock)' : 'INACTIVE (Off the Clock)'}
                    </span>
                  </div>
                </div>

                {activeShift && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/10 grid grid-cols-2 gap-2 text-xs text-gray-300">
                    <div>
                      <span className="text-[10px] text-gray-500 block">Clocked In At</span>
                      <span className="font-bold text-white font-mono">{format(new Date(activeShift.clock_in), 'hh:mm a')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">Elapsed Time</span>
                      <span className="font-bold text-emerald-400 font-mono flex items-center gap-1">
                        <Timer size={12} /> {elapsed || '00:00:00'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Note / Memo Input */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  <FileText size={12} className="text-brand-500" />
                  <span>Shift Notes / Memo (Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={activeShift ? "Describe shift handover details or task summary..." : "Add shift goals or clock-in reasons..."}
                  className="w-full bg-dark-900 border border-dark-700/80 p-2.5 rounded-xl text-xs text-white outline-none focus:border-brand-500 transition-colors resize-none placeholder-gray-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2">
                {activeShift ? (
                  <button
                    onClick={handleClockOut}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <LogOut size={16} /> Clock Out Shift
                  </button>
                ) : (
                  <button
                    onClick={handleClockIn}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-950/20 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <LogIn size={16} /> Start Shift & Clock In
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopbarAttendanceClock;

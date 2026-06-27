import React, { useState } from 'react';
import { ShieldAlert, Database, Trash2, AlertOctagon, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const SystemWipeTab = ({ user }) => {
  const [confirmText, setConfirmText] = useState('');
  const [wipingModule, setWipingModule] = useState(null);

  const wipeModules = [
    { id: 'accounting', name: 'Accounting & Finance', fn: 'reset_accounting_data', desc: 'Deletes all payments, payouts, shift logs, expenses, and ledger entries.', color: 'border-blue-500/30' },
    { id: 'booking', name: 'Bookings & Reservations', fn: 'reset_booking_data', desc: 'Deletes all bookings, hall rentals, group accounts, and invoices.', color: 'border-purple-500/30' },
    { id: 'maintenance', name: 'Maintenance & Repairs', fn: 'reset_maintenance_data', desc: 'Deletes all maintenance tickets, purchases, and payments.', color: 'border-amber-500/30' },
    { id: 'staff', name: 'Staff & Employees', fn: 'reset_staff_data', desc: 'Deletes ALL staff accounts except Super Admin. Removes attendances and leave applications.', color: 'border-rose-500/30' },
    { id: 'logs', name: 'System Logs & Reports', fn: 'reset_logs_data', desc: 'Deletes all audit logs, system logs, duty reports, and departmental reports.', color: 'border-emerald-500/30' },
    { id: 'guest', name: 'Guest Directory', fn: 'reset_guest_directory_data', desc: 'Deletes all CRM guests, AR accounts, and communication logs.', color: 'border-indigo-500/30' },
  ];

  const handleWipe = async (module) => {
    if (confirmText !== 'CONFIRM WIPE') {
      toast.error('You must type CONFIRM WIPE to proceed.');
      return;
    }
    
    const toastId = toast.loading(`Wiping ${module.name} data...`);
    setWipingModule(module.id);
    try {
      const { error } = await supabase.rpc(module.fn, { caller_id: user.id });
      if (error) throw error;
      toast.success(`${module.name} successfully wiped!`, { id: toastId, duration: 5000 });
      setConfirmText('');
    } catch (err) {
      toast.error(`Wipe failed: ${err.message}`, { id: toastId, duration: 5000 });
    } finally {
      setWipingModule(null);
    }
  };

  const handleWipeAll = async () => {
    if (confirmText !== 'CONFIRM WIPE') {
      toast.error('You must type CONFIRM WIPE to proceed.');
      return;
    }

    if (!window.confirm("CRITICAL WARNING: This will permanently delete ALL operational data in the database. Are you absolutely sure?")) return;

    const toastId = toast.loading("Executing Master Wipe sequence...");
    setWipingModule('ALL');
    try {
      const { error } = await supabase.rpc('reset_all_operational_data', { caller_id: user.id });
      if (error) throw error;
      toast.success(`ALL OPERATIONAL DATA SUCCESSFULLY WIPED! System is ready for live use.`, { id: toastId, duration: 8000 });
      setConfirmText('');
    } catch (err) {
      toast.error(`Master Wipe failed: ${err.message}`, { id: toastId, duration: 8000 });
    } finally {
      setWipingModule(null);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-64 border border-rose-500/20 bg-rose-500/5 rounded-xl text-rose-500 font-bold">
        <ShieldAlert size={24} className="mr-3" />
        UNAUTHORIZED ACCESS. Only the Super Admin can view this page.
      </div>
    );
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 text-red-500/10 rotate-12">
          <AlertOctagon size={160} />
        </div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-red-500 flex items-center gap-3 mb-2">
            <AlertOctagon size={28} />
            DANGER ZONE: System Wipe & Live Reset
          </h3>
          <p className="text-red-400 font-medium">
            Warning: The actions below will permanently delete operational data from the database. This is intended to clear test data before a live deployment. Your configurations (Rooms, Services, Pricing, Halls) will be preserved. This action CANNOT BE UNDONE.
          </p>
        </div>
      </div>

      <div className="bg-dark-900 border border-dark-700 p-6 rounded-2xl mb-8">
        <label className="block text-sm font-bold text-gray-300 mb-2">Verification Required</label>
        <p className="text-xs text-gray-500 mb-4">To execute any wipe command below, you must type <strong className="text-white bg-dark-700 px-1 py-0.5 rounded select-all">CONFIRM WIPE</strong> in the box below.</p>
        <input 
          type="text" 
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type CONFIRM WIPE here"
          className="w-full bg-dark-950 border border-dark-700 focus:border-red-500 rounded p-4 text-white uppercase text-center tracking-widest font-mono font-bold"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {wipeModules.map((module) => (
          <div key={module.id} className={`bg-dark-900 border ${module.color} p-5 rounded-2xl flex flex-col h-full`}>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <Database size={18} className="text-gray-400" />
                {module.name}
              </h4>
              <p className="text-xs text-gray-400 mb-6">{module.desc}</p>
            </div>
            <button 
              onClick={() => handleWipe(module)}
              disabled={confirmText !== 'CONFIRM WIPE' || wipingModule !== null}
              className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-colors ${
                confirmText === 'CONFIRM WIPE' && wipingModule !== module.id
                  ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/50' 
                  : 'bg-dark-800 text-gray-500 border border-dark-700 cursor-not-allowed'
              }`}
            >
              {wipingModule === module.id ? (
                <span className="animate-pulse">Wiping Data...</span>
              ) : (
                <>
                  <Trash2 size={16} /> Reset {module.name}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-red-500 border border-red-600 rounded-2xl p-8 text-center">
        <h4 className="text-2xl font-black text-white mb-2">MASTER RESET</h4>
        <p className="text-red-200 mb-6 max-w-2xl mx-auto">
          Execute all wipes simultaneously. This will completely clear the operational state of the hotel and reset room statuses to Available. ONLY click this if you are absolutely sure.
        </p>
        <button 
          onClick={handleWipeAll}
          disabled={confirmText !== 'CONFIRM WIPE' || wipingModule !== null}
          className={`px-10 py-4 rounded-xl font-black text-lg flex items-center justify-center gap-3 mx-auto transition-all ${
            confirmText === 'CONFIRM WIPE' 
              ? 'bg-white text-red-600 hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.3)]' 
              : 'bg-red-700 text-red-400 cursor-not-allowed'
          }`}
        >
          {wipingModule === 'ALL' ? (
            <span className="animate-pulse flex items-center gap-2"><Database size={24} /> NUKING DATABASE...</span>
          ) : (
            <><AlertOctagon size={24} /> WIPE ALL OPERATIONAL DATA</>
          )}
        </button>
      </div>
    </div>
  );
};

export default SystemWipeTab;

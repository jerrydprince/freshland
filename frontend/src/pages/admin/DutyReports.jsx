import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  ClipboardList, Plus, ClipboardCheck, AlertTriangle, 
  RefreshCw, Eye, Calendar, Clock, User, X, FileText, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

const DutyReports = () => {
  const { profile, hasAccess } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    shift_type: 'morning',
    attendance_notes: '',
    incidents_summary: '',
    handover_notes: '',
    checklist: {
      night_audit_run: false,
      pos_reconciled: false,
      safe_locked: false,
      keys_handed_over: false,
      cleanliness_inspected: false,
      security_patrolled: false
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('duty_reports')
        .select(`
          *,
          profiles:manager_id (first_name, last_name, email)
        `)
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load duty manager logs');
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistChange = (key) => {
    setFormData(prev => ({
      ...prev,
      checklist: {
        ...prev.checklist,
        [key]: !prev.checklist[key]
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.shift_type) return toast.error('Please choose a shift type.');

    setIsSubmitting(true);
    const toastId = toast.loading('Saving shift duty report...');

    try {
      const payload = {
        manager_id: profile?.id,
        report_date: new Date().toISOString().split('T')[0],
        shift_type: formData.shift_type,
        attendance_notes: formData.attendance_notes,
        incidents_summary: formData.incidents_summary,
        handover_notes: formData.handover_notes,
        checklist_completed: formData.checklist
      };

      const { error } = await supabase.from('duty_reports').insert([payload]);
      if (error) throw error;

      // Log system audit log
      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Submitted Duty Manager Shift Report for ${formData.shift_type === 'morning' ? 'Morning/Afternoon' : 'Night'} shift`,
          module: 'Settings'
        });
      } catch (lErr) {
        console.error(lErr);
      }

      toast.success('✓ Duty Manager report submitted successfully!', { id: toastId });
      setShowAddForm(false);
      setFormData({
        shift_type: 'morning',
        attendance_notes: '',
        incidents_summary: '',
        handover_notes: '',
        checklist: {
          night_audit_run: false,
          pos_reconciled: false,
          safe_locked: false,
          keys_handed_over: false,
          cleanliness_inspected: false,
          security_patrolled: false
        }
      });
      fetchReports();
    } catch (err) {
      console.error(err);
      toast.error(`Submission failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasAccess('Duty Logs')) {
    return <div className="p-8 text-center text-gray-300">You do not have permission to view Duty Manager Logs.</div>;
  }

  return (
    <div className="space-y-6 pb-20 text-white select-none">
      
      {/* Header */}
      <div className="bg-dark-800 border border-dark-700 p-6 flex flex-col md:flex-row justify-between items-center rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-lg flex items-center justify-center text-white shadow-md">
            <ClipboardList size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Duty Manager Reports</h1>
            <p className="text-gray-200 mt-1">Record shift handovers, daily attendance summaries, incident tracking, and NIGHT audits.</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-5 rounded-lg flex items-center gap-2 transition-all shadow-lg"
          >
            <Plus size={18} /> New Shift Log
          </button>
          <button 
            onClick={fetchReports}
            className="bg-dark-700 hover:bg-dark-600 border border-dark-600 py-2.5 px-4 rounded-lg text-gray-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <RefreshCw size={16} /> Sync
          </button>
        </div>
      </div>

      {/* Main Body */}
      {loading ? (
        <div className="text-center py-20 text-gray-300 flex flex-col items-center justify-center gap-3 bg-dark-800 border border-dark-700 rounded-xl">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Syncing manager shift logs...</p>
        </div>
      ) : (
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg">
          <div className="p-5 border-b border-dark-700 bg-dark-900/50 flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest">Chronological Shift logs</h2>
            <span className="bg-dark-900 border border-dark-700 px-3 py-1 rounded text-xs font-mono font-bold text-brand-400">
              Total logs: {reports.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-dark-900 border-b border-dark-700 text-gray-200 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-4">Log Date</th>
                  <th className="p-4">Shift Type</th>
                  <th className="p-4">Logged By</th>
                  <th className="p-4">Handovers / Audits checklist</th>
                  <th className="p-4">Incident Log Status</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/60">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-gray-300 italic">No shift duty reports logged yet. Click "New Shift Log" to register today's handover.</td>
                  </tr>
                ) : (
                  reports.map(report => {
                    const managerName = report.profiles 
                      ? `${report.profiles.first_name} ${report.profiles.last_name}`
                      : 'Unknown Manager';
                    const listChecked = Object.values(report.checklist_completed || {}).filter(Boolean).length;
                    const listTotal = Object.keys(report.checklist_completed || {}).length;

                    return (
                      <tr key={report.id} className="hover:bg-dark-700/35 transition-colors">
                        <td className="p-4 font-black text-brand-400 flex items-center gap-2 text-sm">
                          <Calendar size={14} /> {report.report_date}
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                            report.shift_type === 'morning' 
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' 
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}>
                            {report.shift_type === 'morning' ? '☀️ Morning/Afternoon' : '🌙 Night Audit'}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-white flex-col">
                          <p>{managerName}</p>
                          <span className="text-[10px] text-gray-300 block font-mono mt-0.5">{report.profiles?.email || ''}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-dark-900 h-2.5 rounded-full overflow-hidden border border-dark-700">
                              <div 
                                className="bg-emerald-500 h-full transition-all duration-500" 
                                style={{ width: `${listTotal > 0 ? (listChecked / listTotal) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-gray-200 font-bold">{listChecked}/{listTotal} items</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {report.incidents_summary?.trim() ? (
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-extrabold uppercase px-2 py-1 rounded flex items-center gap-1.5 w-fit">
                              <AlertTriangle size={12} /> Incidents Logged
                            </span>
                          ) : (
                            <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-extrabold uppercase px-2 py-1 rounded flex items-center gap-1.5 w-fit">
                              <CheckCircle2 size={12} /> Calm Shift
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => setSelectedReport(report)}
                            className="bg-dark-700 hover:bg-dark-600 border border-dark-600 py-1.5 px-3 rounded text-xs text-brand-400 hover:text-white transition-all inline-flex items-center gap-1 font-bold"
                          >
                            <Eye size={13} /> View Log
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL: NEW SHIFT LOG FORM --- */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-dark-700 flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="text-brand-500" /> Log Shift Duty Manager Report
              </h2>
              <button 
                onClick={() => setShowAddForm(false)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5 custom-scrollbar">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Shift Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Active Duty Shift *</label>
                  <select 
                    value={formData.shift_type}
                    onChange={e => setFormData({ ...formData, shift_type: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
                  >
                    <option value="morning">☀️ Morning / Afternoon Shift</option>
                    <option value="night">🌙 Night Audit / Handover Shift</option>
                  </select>
                </div>
                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Logging Date</label>
                  <div className="bg-dark-900/60 border border-dark-700 text-gray-200 px-4 py-2.5 rounded-lg text-sm font-semibold select-none flex items-center gap-2">
                    <Calendar size={16} /> {format(new Date(), 'yyyy-MM-dd')}
                  </div>
                </div>
              </div>

              {/* Handover Checklist Grid */}
              <div className="bg-dark-900 border border-dark-700 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-1">Shift Handover Operations Checklist</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center space-x-3 p-2 bg-dark-800/40 rounded border border-dark-700/50 cursor-pointer hover:bg-dark-900 transition-colors select-none text-xs">
                    <input 
                      type="checkbox"
                      checked={formData.checklist.pos_reconciled}
                      onChange={() => handleChecklistChange('pos_reconciled')}
                      className="w-4 h-4 accent-brand-500"
                    />
                    <span className="text-white">POS Cash & Tills Reconciled</span>
                  </label>
                  <label className="flex items-center space-x-3 p-2 bg-dark-800/40 rounded border border-dark-700/50 cursor-pointer hover:bg-dark-900 transition-colors select-none text-xs">
                    <input 
                      type="checkbox"
                      checked={formData.checklist.safe_locked}
                      onChange={() => handleChecklistChange('safe_locked')}
                      className="w-4 h-4 accent-brand-500"
                    />
                    <span className="text-white">Foyer Vault/Safe Locked</span>
                  </label>
                  <label className="flex items-center space-x-3 p-2 bg-dark-800/40 rounded border border-dark-700/50 cursor-pointer hover:bg-dark-900 transition-colors select-none text-xs">
                    <input 
                      type="checkbox"
                      checked={formData.checklist.keys_handed_over}
                      onChange={() => handleChecklistChange('keys_handed_over')}
                      className="w-4 h-4 accent-brand-500"
                    />
                    <span className="text-white">Property Keys Accounted / Handed Over</span>
                  </label>
                  <label className="flex items-center space-x-3 p-2 bg-dark-800/40 rounded border border-dark-700/50 cursor-pointer hover:bg-dark-900 transition-colors select-none text-xs">
                    <input 
                      type="checkbox"
                      checked={formData.checklist.cleanliness_inspected}
                      onChange={() => handleChecklistChange('cleanliness_inspected')}
                      className="w-4 h-4 accent-brand-500"
                    />
                    <span className="text-white">Lobby & Public Areas Cleanliness Checked</span>
                  </label>
                  <label className="flex items-center space-x-3 p-2 bg-dark-800/40 rounded border border-dark-700/50 cursor-pointer hover:bg-dark-900 transition-colors select-none text-xs">
                    <input 
                      type="checkbox"
                      checked={formData.checklist.security_patrolled}
                      onChange={() => handleChecklistChange('security_patrolled')}
                      className="w-4 h-4 accent-brand-500"
                    />
                    <span className="text-white">Security Guards & Entrance Patrolled</span>
                  </label>
                  <label className="flex items-center space-x-3 p-2 bg-dark-800/40 rounded border border-dark-700/50 cursor-pointer hover:bg-dark-900 transition-colors select-none text-xs">
                    <input 
                      type="checkbox"
                      checked={formData.checklist.night_audit_run}
                      onChange={() => handleChecklistChange('night_audit_run')}
                      className="w-4 h-4 accent-brand-500"
                    />
                    <span className="text-white">Shift Transaction / Night Audit Executed</span>
                  </label>
                </div>
              </div>

              {/* Attendance Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-200 mb-1">Staff Shift Attendance Updates</label>
                <textarea 
                  value={formData.attendance_notes}
                  onChange={e => setFormData({ ...formData, attendance_notes: e.target.value })}
                  placeholder="e.g. All staff present. Housekeeping clocked in punctually. Reception shifts transitioned cleanly..."
                  className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-3 text-xs outline-none focus:border-brand-500 min-h-[60px]"
                />
              </div>

              {/* Incident Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-200 mb-1 text-red-400 flex items-center gap-1">
                  <AlertTriangle size={14} /> Incidents & Utility Discrepancies Log (Leave blank if calm)
                </label>
                <textarea 
                  value={formData.incidents_summary}
                  onChange={e => setFormData({ ...formData, incidents_summary: e.target.value })}
                  placeholder="e.g. Generator minor fuel leakage reported. Solved by maintenance at 3:00 PM. No other incidents..."
                  className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-3 text-xs outline-none focus:border-brand-500 min-h-[60px]"
                />
              </div>

              {/* General Handover Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-200 mb-1">General Shift Handover Notes</label>
                <textarea 
                  value={formData.handover_notes}
                  onChange={e => setFormData({ ...formData, handover_notes: e.target.value })}
                  placeholder="e.g. Inflow balances deposited in safe drawer. Keycard encoder fully functional for incoming night desk..."
                  className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-3 text-xs outline-none focus:border-brand-500 min-h-[80px]"
                />
              </div>

              <div className="p-6 border-t border-dark-700 bg-dark-900/50 flex justify-end gap-3 rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-200 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs py-2 px-5 rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Saving report...' : 'Commit Shift Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: DETAILED REPORT VIEW --- */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="text-brand-400" /> Shift Log Details [{selectedReport.report_date}]
              </h2>
              <button 
                onClick={() => setSelectedReport(null)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar text-sm">
              <div className="grid grid-cols-2 gap-4 bg-dark-900/60 p-4 rounded-xl border border-dark-700 text-xs">
                <div>
                  <span className="text-gray-300 font-bold uppercase block">SHIFT TYPE:</span>
                  <span className="text-white font-black text-sm uppercase">{selectedReport.shift_type}</span>
                </div>
                <div>
                  <span className="text-gray-300 font-bold uppercase block">LOGGED BY:</span>
                  <span className="text-white font-bold">{selectedReport.profiles ? `${selectedReport.profiles.first_name} ${selectedReport.profiles.last_name}` : 'Unknown Manager'}</span>
                </div>
              </div>

              {/* Checklist details */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest">Handover Status Checklist</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(selectedReport.checklist_completed || {}).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 p-2 bg-dark-900 rounded border border-dark-700/50">
                      <span className={`w-2.5 h-2.5 rounded-full ${val ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`} />
                      <span className="capitalize text-gray-300">{key.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance text */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-300 uppercase">Staff Shifts Attendance</h3>
                <div className="bg-dark-900 p-3 rounded text-gray-300 text-xs min-h-[50px] leading-relaxed whitespace-pre-wrap">
                  {selectedReport.attendance_notes || 'No attendance remarks recorded.'}
                </div>
              </div>

              {/* Incident report */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-red-400 uppercase flex items-center gap-1">
                  <AlertTriangle size={13} /> Incidents & Utility Discrepancies
                </h3>
                <div className={`p-3 rounded text-xs min-h-[50px] leading-relaxed whitespace-pre-wrap ${
                  selectedReport.incidents_summary?.trim() 
                    ? 'bg-red-500/5 border border-red-500/20 text-red-300' 
                    : 'bg-dark-900 text-gray-200 italic'
                }`}>
                  {selectedReport.incidents_summary || '✓ All operations calm. Zero utility issues logged.'}
                </div>
              </div>

              {/* General handovers */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-300 uppercase">General Handover Notes</h3>
                <div className="bg-dark-900 p-3 rounded text-gray-300 text-xs min-h-[60px] leading-relaxed whitespace-pre-wrap">
                  {selectedReport.handover_notes || 'No handover details logged.'}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-dark-700 bg-dark-900/50 flex justify-end rounded-b-2xl">
              <button 
                onClick={() => setSelectedReport(null)}
                className="bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs py-2 px-6 rounded-lg shadow-md transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DutyReports;

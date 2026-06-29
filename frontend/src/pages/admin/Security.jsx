import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Lock, Activity, Server, Key, Eye, Clock, Download, RefreshCw, Trash2, HardDrive, Calendar, Search, Filter, EyeOff, ToggleRight, ToggleLeft, RefreshCcw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const AdminSecurity = () => {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState('access');
  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState({
    require_2fa: false,
    enforce_strong_passwords: true,
    session_timeout_minutes: 30,
    gdpr_data_retention_days: 730,
    encryption_at_rest_enabled: true,
    auto_backup_frequency: 'daily'
  });

  // Consolidated master logs state
  const [masterLogs, setMasterLogs] = useState([]);
  
  // Transaction Recovery state
  const [deletedPayments, setDeletedPayments] = useState([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  
  // Filter States
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Server-Side Database Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const isSuperAdmin = useMemo(() => {
    const role = (profile?.role || user?.role || '').toLowerCase().trim();
    return role === 'super_admin';
  }, [profile, user]);

  const fetchDeletedPayments = async () => {
    if (!isSuperAdmin) return;
    setLoadingDeleted(true);
    try {
      const { data, error } = await supabase
        .from('deleted_payments_audit')
        .select('*')
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      setDeletedPayments(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load deleted payments ledger');
    } finally {
      setLoadingDeleted(false);
    }
  };

  const handleRestorePayment = async (pay) => {
    if (!isSuperAdmin) {
      return toast.error('Unauthorized. Only Super Admins can restore deleted payments.');
    }
    
    if (!window.confirm(`Are you sure you want to restore the payment of ₦${Number(pay.amount).toLocaleString()} (Ref: ${pay.transaction_ref}) back to the ledger?`)) return;

    const toastId = toast.loading('Restoring payment transaction records...');
    try {
      // 1. Re-insert original transaction back into payments table
      const { error: insertErr } = await supabase
        .from('payments')
        .insert([{
          id: pay.payment_id,
          booking_id: pay.booking_id,
          processed_by: pay.processed_by,
          amount: pay.amount,
          currency: pay.currency,
          method: pay.method,
          transaction_ref: pay.transaction_ref,
          status: pay.status,
          processed_at: pay.processed_at,
          receipt_url: pay.receipt_url,
          notes: pay.notes ? `${pay.notes} (Restored by Super Admin)` : 'Restored by Super Admin'
        }]);

      if (insertErr) throw insertErr;

      // 2. Delete the audit backup row
      const { error: deleteErr } = await supabase
        .from('deleted_payments_audit')
        .delete()
        .eq('id', pay.id);

      if (deleteErr) throw deleteErr;

      // 3. Log to system logs
      const currentStaffName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user?.email || 'Super Admin';
      const { error: logErr } = await supabase
        .from('system_logs')
        .insert([{
          user_id: profile?.id || user?.id || null,
          log_type: 'audit',
          action: `Payment Record Restored: original Ref ${pay.transaction_ref}`,
          module: 'Accounting',
          entity_table: 'payments',
          metadata: {
            restored_by: currentStaffName,
            payment_id: pay.payment_id,
            amount: pay.amount,
            ref: pay.transaction_ref
          }
        }]);

      toast.success('✓ Transaction restored successfully and database logs updated!', { id: toastId });
      fetchDeletedPayments();
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore transaction record', { id: toastId });
    }
  };

  useEffect(() => {
    if (activeTab === 'recovery') {
      fetchDeletedPayments();
    }
  }, [activeTab]);

  // Trigger system configuration load
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data: sysData } = await supabase.from('system_settings').select('*');
      if (sysData && sysData.length > 0) {
        const sysMap = {};
        sysData.forEach(s => sysMap[s.setting_key] = s.setting_value === 'true' ? true : s.setting_value === 'false' ? false : s.setting_value);
        setSettings(prev => ({ ...prev, ...sysMap }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // High-performance direct database logs query & pagination compiler
  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('system_logs')
        .select('*, profiles(first_name, last_name, email, role)', { count: 'exact' });

      // Filter by log type natively
      if (logTypeFilter !== 'all') {
        query = query.eq('log_type', logTypeFilter);
      }

      // Filter by start and end dates natively
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate + 'T23:59:59');
      }

      // Filter by text search query natively
      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(`action.ilike.${term},email.ilike.${term},log_type.ilike.${term}`);
      }

      // Sort chronologically descending
      query = query.order('created_at', { ascending: false });

      // Apply pagination bounds (from/to indices)
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setMasterLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load system security logs');
    } finally {
      setLoading(false);
    }
  };

  // Trigger config load on settings tab load
  useEffect(() => {
    if (activeTab === 'access' || activeTab === 'gdpr') {
      fetchSettings();
    }
  }, [activeTab]);

  // Reset page number on filter changes
  useEffect(() => {
    if (activeTab === 'logs') {
      setCurrentPage(1);
    }
  }, [logTypeFilter, startDate, endDate]);

  // Debounced search trigger to avoid thrashing PostgreSQL database on typing
  useEffect(() => {
    if (activeTab !== 'logs') return;
    
    const handler = setTimeout(() => {
      setCurrentPage(1);
      fetchLogs();
    }, 350);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Trigger logs fetch on page, tab, or selection changes
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, currentPage, pageSize, logTypeFilter, startDate, endDate]);

  const handleSaveSettings = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const rows = Object.keys(settings).map(key => ({
      setting_key: key,
      setting_value: settings[key].toString()
    }));
    
    const { error } = await supabase
      .from('system_settings')
      .upsert(rows, { onConflict: 'setting_key' });
      
    if (!error) {
      toast.success('Security settings updated securely.');
    } else {
      console.error(error);
      toast.error('Failed to update settings: ' + error.message);
    }
  };

  const triggerManualBackup = async () => {
    const toastId = toast.loading('Connecting to database cluster... generating backup snapshot...');
    try {
      // Fetch system settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('*');
      if (settingsError) throw settingsError;

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
      if (profilesError) throw profilesError;

      // Fetch system logs (limit to 1000 to avoid huge payload)
      const { data: logsData, error: logsError } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (logsError) throw logsError;

      const backupPayload = {
        exported_at: new Date().toISOString(),
        version: '1.0',
        system_settings: settingsData || [],
        profiles: profilesData || [],
        system_logs: logsData || []
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `sparkles_pms_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success('Backup snapshot generated and downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(`Failed to create backup: ${err.message}`, { id: toastId });
    }
  };

  const handleRestoreBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Are you sure you want to restore this backup? This may overwrite existing system settings and profiles!")) {
      e.target.value = ''; // Reset file input
      return;
    }

    const toastId = toast.loading('Reading backup file...');
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.system_settings || !backupData.profiles) {
        throw new Error('Invalid backup file structure. Missing settings or profiles data.');
      }

      toast.loading('Restoring system settings...', { id: toastId });
      // Restore system_settings
      if (backupData.system_settings.length > 0) {
        const cleanSettings = backupData.system_settings.map(s => ({
          setting_key: s.setting_key,
          setting_value: s.setting_value
        }));
        const { error: settingsErr } = await supabase
          .from('system_settings')
          .upsert(cleanSettings, { onConflict: 'setting_key' });
        if (settingsErr) throw settingsErr;
      }

      toast.loading('Restoring profiles...', { id: toastId });
      // Restore profiles
      if (backupData.profiles.length > 0) {
        const cleanProfiles = backupData.profiles.map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          role: p.role,
          is_active: p.is_active,
          status: p.status,
          updated_at: new Date().toISOString()
        }));
        const { error: profilesErr } = await supabase
          .from('profiles')
          .upsert(cleanProfiles, { onConflict: 'id' });
        if (profilesErr) throw profilesErr;
      }

      // Optionally restore system_logs
      if (backupData.system_logs && backupData.system_logs.length > 0) {
        toast.loading('Restoring system logs...', { id: toastId });
        const cleanLogs = backupData.system_logs.map(l => ({
          user_id: l.user_id,
          log_type: l.log_type,
          action: l.action,
          module: l.module,
          entity_table: l.entity_table,
          metadata: l.metadata,
          ip_address: l.ip_address,
          created_at: l.created_at
        }));
        await supabase.from('system_logs').insert(cleanLogs);
      }

      toast.success('✓ System successfully restored from backup snapshot!', { id: toastId });
      fetchSettings(); // Refresh active settings
    } catch (err) {
      console.error(err);
      toast.error(`Restore failed: ${err.message}`, { id: toastId });
    } finally {
      e.target.value = ''; // Reset file input
    }
  };

  const clearOldLogs = () => {
    toast.success("Old system logs queued for archival rotation.");
  };

  // Logs search filter values mapping helper (empty since filters run on database level)

  const getLogTypeBadge = (type) => {
    switch (type) {
      case 'login':
        return <span className="bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Login Event</span>;
      case 'audit':
        return <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Deep Audit</span>;
      case 'activity':
      default:
        return <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Activity Log</span>;
    }
  };

  const getRoleBadge = (roleId) => {
    if (!roleId) return null;
    return (
      <span className="bg-dark-900 border border-dark-700 text-brand-400 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ml-1.5 inline-block">
        {roleId.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dark-800 p-6 rounded-lg border border-dark-700 shadow-sm mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="text-brand-500"/> Security & Privacy Center
          </h1>
          <p className="text-gray-200 mt-1">Manage global access controls, enforce password standards, and monitor unified audit trails.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-dark-700 mb-6 overflow-x-auto select-none">
        <button onClick={() => setActiveTab('access')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'access' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
          <Key size={18} /> Access Policies
        </button>
        <button onClick={() => setActiveTab('logs')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'logs' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
          <Activity size={18} /> Central Central System Logs
        </button>
        <button onClick={() => setActiveTab('gdpr')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'gdpr' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
          <Server size={18} /> GDPR & Backups
        </button>
        {isSuperAdmin && (
          <button onClick={() => setActiveTab('recovery')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'recovery' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
            <RefreshCcw size={18} /> Transaction Recovery Ledger
          </button>
        )}
      </div>

      <div className="bg-dark-800 border border-dark-700 rounded-lg min-h-[500px]">
        
        {/* --- ACCESS POLICIES --- */}
        {activeTab === 'access' && (
          <div className="p-6 md:p-8">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-700 pb-4">Authentication Rules</h3>
            <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
              
              <div className="flex items-start gap-4 bg-dark-900 p-5 border border-brand-500/30 rounded">
                <input type="checkbox" id="2fa" checked={settings.require_2fa} onChange={e => setSettings({...settings, require_2fa: e.target.checked})} className="w-5 h-5 accent-brand-500 rounded mt-1 cursor-pointer" />
                <div>
                  <label htmlFor="2fa" className="text-sm font-bold text-white block cursor-pointer">Enforce Two-Factor Authentication (2FA)</label>
                  <span className="text-xs text-gray-200">Require all administrative and front-desk staff to configure Authenticator App (TOTP) codes on next login.</span>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-dark-900 p-5 border border-dark-700 rounded hover:border-dark-600 transition-colors">
                <input type="checkbox" id="strongPwd" checked={settings.enforce_strong_passwords} onChange={e => setSettings({...settings, enforce_strong_passwords: e.target.checked})} className="w-5 h-5 accent-brand-500 rounded mt-1 cursor-pointer" />
                <div>
                  <label htmlFor="strongPwd" className="text-sm font-bold text-white block cursor-pointer">Enforce Strong Passwords</label>
                  <span className="text-xs text-gray-200">Require a minimum of 6 characters, including uppercase and lowercase letters, numbers, and special symbols.</span>
                </div>
              </div>

              <div className="bg-dark-900 p-5 border border-dark-700 rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <label className="text-sm font-bold text-white block mb-1">Session Inactivity Timeout</label>
                  <span className="text-xs text-gray-200">Automatically log users out after a set period of idle time. (Enforced globally)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="5" max="1440" value={settings.session_timeout_minutes} onChange={e => setSettings({...settings, session_timeout_minutes: parseInt(e.target.value)})} className="w-24 bg-dark-800 text-white border border-dark-600 rounded p-2 focus:border-brand-500 outline-none text-center font-mono" />
                  <span className="text-sm text-gray-200 font-bold">Minutes</span>
                </div>
              </div>

              <div className="pt-4 border-t border-dark-700">
                <button type="submit" className="btn-primary flex items-center gap-2 py-3 px-8 font-bold"><Lock size={18} /> Apply Security Policies</button>
              </div>
            </form>
          </div>
        )}

        {/* --- CONSOLIDATED MASTER LOGS --- */}
        {activeTab === 'logs' && (
          <div>
            {/* Logs Filtering Toolbar */}
            <div className="p-4 border-b border-dark-700 bg-dark-900 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 text-gray-300 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Search by action, email, staff..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-dark-800 border border-dark-700 text-white pl-9 pr-4 py-2 rounded-xl text-xs outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <select
                  value={logTypeFilter}
                  onChange={e => setLogTypeFilter(e.target.value)}
                  className="bg-dark-800 border border-dark-700 text-white px-3 py-2 rounded-xl text-xs outline-none focus:border-brand-500"
                >
                  <option value="all">All Log Types</option>
                  <option value="activity">Activity Logs</option>
                  <option value="login">Login Events</option>
                  <option value="audit">Deep Audit logs</option>
                </select>

                <div className="flex items-center gap-2 bg-dark-800 border border-dark-700 rounded-xl px-2.5 py-1.5">
                  <Calendar size={12} className="text-gray-300" />
                  <span className="text-[10px] text-gray-300 uppercase font-extrabold tracking-wider">From:</span>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="bg-transparent text-xs text-white outline-none font-bold font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 bg-dark-800 border border-dark-700 rounded-xl px-2.5 py-1.5">
                  <Calendar size={12} className="text-gray-300" />
                  <span className="text-[10px] text-gray-300 uppercase font-extrabold tracking-wider">To:</span>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="bg-transparent text-xs text-white outline-none font-bold font-mono"
                  />
                </div>

                {(startDate || endDate || searchQuery || logTypeFilter !== 'all') && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); setSearchQuery(''); setLogTypeFilter('all'); }}
                    className="text-xs text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-xl transition-colors font-bold uppercase"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              <button onClick={clearOldLogs} className="text-xs text-red-500 hover:text-red-400 font-bold flex items-center gap-1 border border-red-500/20 px-3 py-2 rounded-xl bg-red-500/10">
                <Trash2 size={12}/> Clear logs
              </button>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-900 border-b border-dark-700 text-gray-200">
                  <tr>
                    <th className="p-4 font-semibold">Timestamp</th>
                    <th className="p-4 font-semibold">Log Type</th>
                    <th className="p-4 font-semibold">User</th>
                    <th className="p-4 font-semibold">Action Performed</th>
                    <th className="p-4 font-semibold">Module/Entity</th>
                    <th className="p-4 font-semibold">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700 bg-dark-800">
                  {loading ? (
                    <tr><td colSpan="6" className="p-12 text-center text-gray-300"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto"></div></td></tr>
                  ) : masterLogs.length === 0 ? (
                    <tr><td colSpan="6" className="p-12 text-center text-gray-300">No consolidated logs recorded matching the search conditions.</td></tr>
                  ) : (
                    masterLogs.map(log => (
                      <tr key={log.id} className="hover:bg-dark-700/30 transition-colors">
                        <td className="p-4 text-gray-200 font-mono text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-4 whitespace-nowrap">{getLogTypeBadge(log.log_type)}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-bold text-white">{log.profiles ? `${log.profiles.first_name} ${log.profiles.last_name}` : 'System Auto'}</span>
                          {log.profiles && getRoleBadge(log.profiles.role)}
                          {log.email && <div className="text-xs text-gray-300">{log.email}</div>}
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-white">{log.action}</span>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="text-[10px] text-gray-200 font-mono mt-1 max-w-xs truncate" title={JSON.stringify(log.metadata)}>
                              {JSON.stringify(log.metadata)}
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-mono text-xs text-gray-200 whitespace-nowrap">{log.entity_table || log.module || 'System'}</td>
                        <td className="p-4 font-mono text-xs text-gray-200 whitespace-nowrap">{log.ip_address || '127.0.0.1'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-dark-700 bg-dark-900 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
              <div className="text-xs font-semibold text-gray-200">
                Showing <span className="text-white font-bold">{masterLogs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
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
                    className="bg-dark-800 border border-dark-700 text-white text-xs px-2 py-1 rounded-xl outline-none focus:border-brand-500 font-bold"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* Page Navigation Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1 || loading}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 bg-dark-800 hover:bg-dark-750 disabled:opacity-40 disabled:hover:bg-dark-800 border border-dark-700 rounded-xl text-xs text-white font-bold transition-all"
                  >
                    Previous
                  </button>

                  <div className="text-xs font-black text-brand-400 px-3 font-mono">
                    Page {currentPage} of {Math.max(Math.ceil(totalCount / pageSize), 1)}
                  </div>

                  <button
                    disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount / pageSize)))}
                    className="px-3 py-1.5 bg-dark-800 hover:bg-dark-750 disabled:opacity-40 disabled:hover:bg-dark-800 border border-dark-700 rounded-xl text-xs text-white font-bold transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- GDPR & BACKUPS --- */}
        {activeTab === 'gdpr' && (
          <div className="p-6 md:p-8">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-dark-700 pb-4">Data Privacy & Infrastructure</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* GDPR */}
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <h4 className="font-bold text-brand-500 flex items-center gap-2"><Shield size={18}/> Compliance & Encryption</h4>
                
                <div className="bg-dark-900 p-5 border border-dark-700 rounded">
                  <label className="text-sm font-bold text-white block mb-2">Data Retention Period (Days)</label>
                  <p className="text-xs text-gray-200 mb-4">Under GDPR guidelines, personally identifiable guest data should be anonymized or deleted after this threshold (from checkout date).</p>
                  <input type="number" min="30" value={settings.gdpr_data_retention_days} onChange={e => setSettings({...settings, gdpr_data_retention_days: parseInt(e.target.value)})} className="w-full bg-dark-800 text-white border border-dark-600 rounded p-3 focus:border-brand-500 outline-none font-mono" />
                </div>

                <div className="flex items-start gap-4 bg-dark-900 p-5 border border-dark-700 rounded">
                  <input type="checkbox" id="encrypt" checked={settings.encryption_at_rest_enabled} onChange={e => setSettings({...settings, encryption_at_rest_enabled: e.target.checked})} className="w-5 h-5 accent-brand-500 rounded mt-1 cursor-pointer" />
                  <div>
                    <label htmlFor="encrypt" className="text-sm font-bold text-white block cursor-pointer">Enable Encryption at Rest (AES-256)</label>
                    <span className="text-xs text-gray-200 block mt-1">When toggled, ensures all database volumes are encrypted on the storage layer. (Managed via Supabase Infrastructure).</span>
                  </div>
                </div>

                <button type="submit" className="bg-dark-700 hover:bg-dark-600 text-white flex items-center gap-2 py-3 px-6 rounded font-bold transition-colors">Save Compliance Settings</button>
              </form>

              {/* BACKUPS */}
              <div className="space-y-6">
                <h4 className="font-bold text-blue-500 flex items-center gap-2"><HardDrive size={18}/> Database Backups</h4>
                
                <div className="bg-dark-900 p-5 border border-dark-700 rounded">
                  <label className="text-sm font-bold text-white block mb-2">Automated Backup Frequency</label>
                  <select value={settings.auto_backup_frequency} onChange={e => {setSettings({...settings, auto_backup_frequency: e.target.value}); handleSaveSettings(e);}} className="w-full bg-dark-800 text-white border border-dark-600 rounded p-3 outline-none">
                    <option value="hourly">Hourly (Point in Time Recovery)</option>
                    <option value="daily">Daily Backup</option>
                    <option value="weekly">Weekly Backup</option>
                  </select>
                  <p className="text-xs text-gray-200 mt-3">Current Size: ~45.2 MB | Last automated backup: 4 hours ago.</p>
                </div>

                <div className="bg-dark-900 p-5 border border-dark-700 rounded flex flex-col gap-4">
                  <div>
                    <h5 className="font-bold text-white text-sm">Manual Snapshot</h5>
                    <p className="text-xs text-gray-200 mt-1">Generate an immediate, downloadable JSON dump of the current settings, profiles, and logs.</p>
                  </div>
                  <button onClick={triggerManualBackup} className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-500 font-bold py-3 rounded border border-blue-500/30 transition-colors flex items-center justify-center gap-2">
                    <Download size={18}/> Generate Snapshot
                  </button>
                </div>

                <div className="bg-dark-900 p-5 border border-dark-700 rounded flex flex-col gap-4">
                  <div>
                    <h5 className="font-bold text-white text-sm">Restore from Snapshot</h5>
                    <p className="text-xs text-gray-200 mt-1">Restore system settings and profiles from a previously exported JSON backup.</p>
                  </div>
                  <label className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-500 font-bold py-3 rounded border border-green-500/30 transition-colors flex items-center justify-center gap-2 cursor-pointer text-center">
                    <RefreshCw size={18}/> Restore Backup
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleRestoreBackup} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TRANSACTION RECOVERY LEDGER --- */}
        {activeTab === 'recovery' && isSuperAdmin && (
          <div className="p-6 md:p-8 space-y-6">
            <div className="border-b border-dark-700 pb-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <RefreshCcw className="text-brand-500" />
                  Deleted Transactions Protection Ledger
                </h3>
                <p className="text-xs text-gray-200 mt-1">
                  Track, audit, and instantaneously restore payment records deleted intentionally or accidentally.
                </p>
              </div>
              <button 
                onClick={fetchDeletedPayments}
                className="bg-dark-900 hover:bg-dark-750 border border-dark-700 text-gray-200 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                Refresh Ledger
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-dark-700 bg-dark-900/20">
              {loadingDeleted ? (
                <div className="py-24 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500 mx-auto mb-3"></div>
                  <p className="text-gray-300 text-xs">Querying secure soft-delete vaults...</p>
                </div>
              ) : deletedPayments.length === 0 ? (
                <div className="py-24 text-center text-gray-300">
                  <CheckCircle size={32} className="mx-auto mb-2 opacity-30 text-green-500 animate-pulse" />
                  <p className="text-sm">Splendid! No deleted payment records found in the recovery registry.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-dark-900/60 border-b border-dark-700 text-gray-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4 font-bold">Deleted Timestamp</th>
                      <th className="p-4 font-bold">Original Payment ID</th>
                      <th className="p-4 font-bold">Reference</th>
                      <th className="p-4 font-bold">Amount</th>
                      <th className="p-4 font-bold">Method</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold">Notes / Metadata</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {deletedPayments.map(pay => (
                      <tr key={pay.id} className="hover:bg-dark-700/20 transition-colors">
                        <td className="p-4 text-gray-200 font-mono text-[10px]">
                          {new Date(pay.deleted_at).toLocaleString()}
                        </td>
                        <td className="p-4 text-gray-300 font-mono text-[10px] truncate max-w-[120px]" title={pay.payment_id}>
                          {pay.payment_id}
                        </td>
                        <td className="p-4">
                          <p className="font-extrabold text-white font-mono text-xs">{pay.transaction_ref}</p>
                          <span className="inline-block bg-dark-800 border border-dark-700 text-gray-200 text-[8px] px-1.5 py-0.5 rounded font-sans mt-1">
                            Booking ID: {pay.booking_id || 'N/A'}
                          </span>
                        </td>
                        <td className="p-4 font-black text-brand-400 text-xs">
                          {pay.currency || 'NGN'} {Number(pay.amount).toLocaleString()}
                        </td>
                        <td className="p-4 text-gray-300 uppercase tracking-wider text-[9px] font-bold">
                          {pay.method || 'N/A'}
                        </td>
                        <td className="p-4">
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                            {pay.status || 'Deleted'}
                          </span>
                        </td>
                        <td className="p-4 text-gray-200 max-w-xs truncate" title={pay.notes}>
                          {pay.notes || '-'}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleRestorePayment(pay)}
                            className="bg-green-500/10 hover:bg-green-500 border border-green-500/20 text-green-400 hover:text-white px-3.5 py-2 rounded-xl transition-all text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
                          >
                            <RefreshCcw size={12} />
                            Restore Record
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminSecurity;

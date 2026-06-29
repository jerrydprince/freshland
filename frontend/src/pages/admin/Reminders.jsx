import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  CalendarClock, Plus, BellRing, CreditCard, 
  Trash2, X, Calendar, RefreshCw, Clock, ShieldCheck,
  LayoutGrid, List, SendHorizonal
} from 'lucide-react';
import { format } from 'date-fns';

const Reminders = () => {
  const { profile, hasAccess } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    amount_ngn: '',
    recurrence: 'none',
    category: 'Subscription'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [filterStatus, setFilterStatus] = useState('pending');

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setReminders(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to retrieve reminders & subscription schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    const { title, due_date } = formData;
    if (!title || !due_date) {
      return toast.error('Please enter a Title and Due Date.');
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Registering subscription reminder...');

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        due_date: formData.due_date,
        amount_ngn: formData.amount_ngn ? Number(formData.amount_ngn) : null,
        recurrence: formData.recurrence,
        category: formData.category,
        status: 'pending',
        assigned_to: profile?.id
      };

      const { error } = await supabase.from('reminders').insert([payload]);
      if (error) throw error;

      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Registered utility subscription schedule reminder: ${formData.title} due on ${formData.due_date}`,
          module: 'Reminders'
        });
      } catch (lErr) { console.error(lErr); }

      toast.success('✓ Reminder registered successfully!', { id: toastId });
      setShowAddForm(false);
      setFormData({ title: '', description: '', due_date: '', amount_ngn: '', recurrence: 'none', category: 'Subscription' });
      fetchReminders();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to register: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Settle Pay: marks reminder as 'approved' → routes to Folios & Billings for final confirmation
  const handleSettlePayment = async (reminder) => {
    if (!window.confirm(`Submit "${reminder.title}" to Accounts for payment approval?`)) return;

    const toastId = toast.loading('Submitting for accounts approval...');
    try {
      // 1. Mark reminder as 'approved' — pending billing confirmation
      const { error: payErr } = await supabase
        .from('reminders')
        .update({ status: 'approved' })
        .eq('id', reminder.id);

      if (payErr) throw payErr;

      // 2. Log a PENDING expense entry for the Expense Tracker
      let propertyId = null;
      try {
        const { data: propData } = await supabase.from('properties').select('id').limit(1);
        if (propData && propData.length > 0) propertyId = propData[0].id;
      } catch (propErr) {
        console.warn('Failed to retrieve property_id:', propErr);
      }

      const categoryMapping = {
        'Subscription': 'Utilities', 'Utility': 'Utilities',
        'Maintenance': 'Maintenance', 'Tax': 'Taxes', 'License': 'Utilities'
      };

      const expensePayload = {
        property_id: propertyId,
        amount: Number(reminder.amount_ngn || 0),
        category: categoryMapping[reminder.category] || 'Other',
        description: `[PENDING CONFIRMATION] Schedule: ${reminder.title}${reminder.description ? ` - ${reminder.description}` : ''}`,
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        paid_to: reminder.title,
        payment_method: 'bank_transfer',
        status: 'pending',
        reminder_id: reminder.id
      };

      try {
        const { error: expInsertErr } = await supabase.from('expenses').insert([expensePayload]);
        if (expInsertErr) console.error('Failed to register pending expense:', expInsertErr);
      } catch (dbExpErr) {
        console.error('Failed to write pending expense:', dbExpErr);
      }

      // 3. Audit log
      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Approved utility payment for: ${reminder.title} (NGN ${Number(reminder.amount_ngn || 0).toLocaleString()}) — awaiting accounts confirmation`,
          module: 'Reminders'
        });
      } catch (lErr) { console.error(lErr); }

      toast.success('✓ Payment submitted to Folios & Billings for accounts confirmation!', { id: toastId });
      fetchReminders();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve payment', { id: toastId });
    }
  };

  const handleDeleteReminder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this reminder? This cannot be undone.')) return;
    
    const loadingToast = toast.loading('Removing reminder...');
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', id);
      if (error) throw error;
      toast.success('Reminder removed successfully!', { id: loadingToast });
      fetchReminders();
    } catch (err) {
      toast.error('Failed to delete', { id: loadingToast });
    }
  };

  // Filter list
  const filteredReminders = useMemo(() => {
    let result = reminders;
    if (filterCategory !== 'all') {
      result = result.filter(r => r.category === filterCategory);
    }
    if (filterStatus === 'pending') {
      result = result.filter(r => r.status === 'pending');
    } else if (filterStatus === 'approved') {
      result = result.filter(r => r.status === 'approved');
    } else if (filterStatus === 'paid') {
      result = result.filter(r => r.status === 'paid');
    }
    // 'all' returns all
    return result;
  }, [reminders, filterCategory, filterStatus]);

  // Urgent reminders (due within 7 days, still pending)
  const urgentReminders = useMemo(() => {
    const today = new Date();
    return reminders.filter(r => {
      if (r.status !== 'pending') return false;
      const dueDate = new Date(r.due_date);
      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    });
  }, [reminders]);

  const isSettleAllowed = (dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  const getStatusBadge = (status) => {
    if (status === 'pending') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (status === 'approved') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (status === 'paid') return 'bg-green-500/10 text-green-400 border-green-500/20';
    return 'bg-gray-500/10 text-gray-200 border-gray-500/20';
  };

  if (!hasAccess('Reminders')) {
    return <div className="p-8 text-center text-gray-300">You do not have permission to view Reminders & Schedules.</div>;
  }

  return (
    <div className="space-y-6 pb-20 text-white select-none">

      {/* Header */}
      <div className="bg-dark-800 border border-dark-700 p-6 flex flex-col md:flex-row justify-between items-center rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-orange-600 to-orange-400 rounded-lg flex items-center justify-center text-white shadow-md animate-pulse">
            <CalendarClock size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Schedules & Reminders</h1>
            <p className="text-gray-200 mt-1">Manage recurrences for Fibre Internet subscriptions, DSTV cable, property lease covenants, and tax audits.</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-5 rounded-lg flex items-center gap-2 transition-all shadow-lg"
          >
            <Plus size={18} /> Add Schedule
          </button>
          <button 
            onClick={fetchReminders}
            className="bg-dark-700 hover:bg-dark-600 border border-dark-600 py-2.5 px-4 rounded-lg text-gray-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <RefreshCw size={16} /> Sync
          </button>
        </div>
      </div>

      {/* Urgent Alerts Block */}
      {urgentReminders.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-xl space-y-3 shadow-md animate-pulse">
          <h2 className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
            <BellRing size={16} className="text-red-400" /> Critical Subscription Deadlines (Due within 7 Days)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {urgentReminders.map(rem => (
              <div key={rem.id} className="bg-dark-900/60 border border-red-500/20 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-sm">{rem.title}</h3>
                  <p className="text-xs text-red-300/80 font-semibold mt-1">
                    ⏰ Due: {rem.due_date} ({rem.recurrence !== 'none' ? `Recurrent: ${rem.recurrence}` : 'One-time'})
                  </p>
                </div>
                <button 
                  onClick={() => handleSettlePayment(rem)}
                  className="bg-red-500 hover:bg-red-600 text-white font-black text-xs py-2 px-4 rounded shadow-lg transition-all flex items-center gap-1.5"
                >
                  <SendHorizonal size={13} /> Settle Pay
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-dark-700 pb-3">
        <div className="flex gap-2 overflow-x-auto select-none w-full sm:w-auto">
          {['all', 'Subscription', 'Utility', 'Maintenance', 'Tax', 'License'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-xs font-bold px-4 py-2 rounded-lg border transition-all uppercase tracking-wider whitespace-nowrap ${
                filterCategory === cat 
                  ? 'bg-orange-500/15 border-orange-500/30 text-orange-400 font-extrabold' 
                  : 'bg-dark-900 border-dark-700 text-gray-200 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        
        {/* Grid/List Toggle Switch */}
        <div className="flex items-center gap-1 bg-dark-900/60 border border-dark-750 p-1 rounded-lg self-end sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${
              viewMode === 'grid'
                ? 'bg-orange-500 text-dark-950 shadow-md font-black'
                : 'text-gray-200 hover:text-white'
            }`}
            title="Grid Layout"
          >
            <LayoutGrid size={13} /> Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${
              viewMode === 'list'
                ? 'bg-orange-500 text-dark-950 shadow-md font-black'
                : 'text-gray-200 hover:text-white'
            }`}
            title="List Layout"
          >
            <List size={13} /> List
          </button>
        </div>
      </div>

      {/* Status Selector Tab Bar */}
      <div className="flex justify-between items-center bg-dark-900/40 border border-dark-750/60 p-1.5 rounded-xl">
        <div className="flex gap-1.5 select-none flex-wrap">
          {[
            { id: 'pending', label: 'Pending Schedules', count: reminders.filter(r => r.status === 'pending').length },
            { id: 'approved', label: 'Awaiting Accounts', count: reminders.filter(r => r.status === 'approved').length },
            { id: 'paid', label: 'Settled Payments', count: reminders.filter(r => r.status === 'paid').length },
            { id: 'all', label: 'All Records', count: reminders.length }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                filterStatus === tab.id
                  ? 'bg-orange-500 text-dark-950 shadow-md font-black'
                  : 'text-gray-200 hover:text-white hover:bg-dark-800/50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                filterStatus === tab.id
                  ? 'bg-dark-950/20 text-dark-950'
                  : 'bg-dark-900 text-gray-200'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Reminders list */}
      {loading ? (
        <div className="text-center py-20 text-gray-300 flex flex-col items-center justify-center gap-3 bg-dark-800 border border-dark-700 rounded-xl shadow-lg">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Syncing utility calendars...</p>
        </div>
      ) : (
        <>
          {filteredReminders.length === 0 ? (
            <div className="text-center py-16 text-gray-300 italic bg-dark-800 border border-dark-700 rounded-xl shadow-lg">
              No reminders registered in this category. Click "Add Schedule" to configure.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredReminders.map(rem => (
                <div 
                  key={rem.id} 
                  className={`bg-dark-800 border rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:translate-y-[-4px] transition-all duration-300 ${
                    rem.status === 'pending' 
                      ? 'border-dark-700 border-t-4 border-t-orange-500' 
                      : rem.status === 'approved'
                        ? 'border-dark-700 border-t-4 border-t-blue-500'
                        : 'border-dark-700/60 border-t-4 border-t-emerald-500 opacity-60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black text-gray-200 uppercase tracking-widest bg-dark-900 border border-dark-750 px-2 py-0.5 rounded">
                        {rem.category}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${getStatusBadge(rem.status)}`}>
                        {rem.status === 'approved' ? 'Awaiting Accounts' : rem.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base select-text">{rem.title}</h3>
                    {rem.description && <p className="text-xs text-gray-200 leading-relaxed select-text min-h-[40px]">{rem.description}</p>}
                  </div>

                  <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-700/80 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-300 font-bold uppercase text-[10px] tracking-wide">
                      <span>Due Date:</span>
                      <span className="text-white font-mono flex items-center gap-1"><Clock size={12} /> {rem.due_date}</span>
                    </div>
                    <div className="flex justify-between text-gray-300 font-bold uppercase text-[10px] tracking-wide">
                      <span>Amount:</span>
                      <span className="text-emerald-400 font-bold">₦{Number(rem.amount_ngn || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-300 font-bold uppercase text-[10px] tracking-wide">
                      <span>Recurrence:</span>
                      <span className="text-white font-bold capitalize">{rem.recurrence}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {rem.status === 'pending' ? (
                      <button 
                        onClick={() => handleSettlePayment(rem)}
                        disabled={!isSettleAllowed(rem.due_date)}
                        className={`flex-1 font-black text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-md transition-all ${
                          isSettleAllowed(rem.due_date)
                            ? 'bg-orange-500 hover:bg-orange-600 text-dark-950'
                            : 'bg-dark-900 border border-dark-750 text-gray-300 cursor-not-allowed opacity-50'
                        }`}
                        title={isSettleAllowed(rem.due_date) ? 'Settle Pay — Submit to Accounts' : 'Settle locked (Active from 7 days to renewal)'}
                      >
                        <SendHorizonal size={14} /> Settle Pay
                      </button>
                    ) : rem.status === 'approved' ? (
                      <div className="flex-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs py-2 rounded-lg flex items-center justify-center gap-1 font-bold">
                        <Clock size={14} /> Awaiting Accounts
                      </div>
                    ) : (
                      <div className="flex-1 bg-dark-900 border border-dark-700 text-emerald-400 text-xs py-2 rounded-lg flex items-center justify-center gap-1 font-bold">
                        <ShieldCheck size={14} /> Settled & Paid
                      </div>
                    )}
                    <button 
                      onClick={() => handleDeleteReminder(rem.id)}
                      className="p-2 bg-dark-900 hover:bg-red-500/25 text-gray-300 hover:text-red-400 rounded-lg border border-dark-750 hover:border-red-500/20 transition-all"
                      title="Delete reminder"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReminders.map(rem => (
                <div
                  key={rem.id}
                  className={`bg-dark-800 border rounded-xl p-4 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 hover:translate-x-1 transition-all duration-300 ${
                    rem.status === 'pending'
                      ? 'border-dark-700 border-l-4 border-l-orange-500'
                      : rem.status === 'approved'
                        ? 'border-dark-700 border-l-4 border-l-blue-500'
                        : 'border-dark-700/60 border-l-4 border-l-emerald-500 opacity-65'
                  }`}
                >
                  {/* Left: Details */}
                  <div className="flex-1 min-w-[200px] space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-gray-200 uppercase tracking-widest bg-dark-900 border border-dark-750 px-2 py-0.5 rounded">
                        {rem.category}
                      </span>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${getStatusBadge(rem.status)}`}>
                        {rem.status === 'approved' ? 'Awaiting Accounts' : rem.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base select-text">{rem.title}</h3>
                    {rem.description && (
                      <p className="text-xs text-gray-200 leading-relaxed select-text line-clamp-1">{rem.description}</p>
                    )}
                  </div>

                  {/* Middle: Metadata */}
                  <div className="grid grid-cols-3 gap-6 text-xs min-w-[320px] w-full lg:w-auto">
                    <div>
                      <span className="block text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-0.5">Due Date</span>
                      <span className="text-white font-mono flex items-center gap-1"><Clock size={12} /> {rem.due_date}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-0.5">Amount</span>
                      <span className="text-emerald-400 font-bold">₦{Number(rem.amount_ngn || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-0.5">Recurrence</span>
                      <span className="text-white font-bold capitalize">{rem.recurrence}</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full lg:w-auto self-stretch lg:self-auto justify-end">
                    {rem.status === 'pending' ? (
                      <button
                        onClick={() => handleSettlePayment(rem)}
                        disabled={!isSettleAllowed(rem.due_date)}
                        className={`flex-grow lg:flex-grow-0 font-black text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-md transition-all whitespace-nowrap ${
                          isSettleAllowed(rem.due_date)
                            ? 'bg-orange-500 hover:bg-orange-600 text-dark-950'
                            : 'bg-dark-900 border border-dark-750 text-gray-300 cursor-not-allowed opacity-50'
                        }`}
                        title={isSettleAllowed(rem.due_date) ? 'Settle Pay — Submit to Accounts' : 'Settle locked (Active from 7 days to renewal)'}
                      >
                        <SendHorizonal size={14} /> Settle Pay
                      </button>
                    ) : rem.status === 'approved' ? (
                      <div className="flex-grow lg:flex-grow-0 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1 font-bold whitespace-nowrap">
                        <Clock size={14} /> Awaiting Accounts
                      </div>
                    ) : (
                      <div className="flex-grow lg:flex-grow-0 bg-dark-900 border border-dark-700 text-emerald-400 text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1 font-bold whitespace-nowrap">
                        <ShieldCheck size={14} /> Settled & Paid
                      </div>
                    )}
                    <button
                      onClick={() => handleDeleteReminder(rem.id)}
                      className="p-2 bg-dark-900 hover:bg-red-500/25 text-gray-300 hover:text-red-400 rounded-lg border border-dark-750 hover:border-red-500/20 transition-all"
                      title="Delete reminder"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- MODAL: CREATE REMINDER --- */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarClock className="text-orange-500" /> Create Subscription Schedule
              </h2>
              <button 
                onClick={() => setShowAddForm(false)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleCreateReminder}>
              <div className="p-6 space-y-4">
                
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Schedule Title *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. DSTV Premium Multi-Room, Fibre Office Internet"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-200 mb-1">Service Description / Account details</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. Card No: 1047285. Premium package. Fibre Router IP: 192.168.1.1..."
                    className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-3 text-xs outline-none focus:border-orange-500 min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-200 mb-1">Classification Category</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2.5 rounded-lg text-xs outline-none focus:border-orange-500"
                    >
                      <option value="Subscription">Cable/Internet Subscription</option>
                      <option value="Utility">Water / Electricity Utility</option>
                      <option value="Maintenance">Physical Facility Maintenance</option>
                      <option value="Tax">Government Tax Audit</option>
                      <option value="License">Commercial PMS Software License</option>
                    </select>
                  </div>

                  {/* Recurrence */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-200 mb-1">Recurrence Roll-over</label>
                    <select
                      value={formData.recurrence}
                      onChange={e => setFormData({ ...formData, recurrence: e.target.value })}
                      className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2.5 rounded-lg text-xs outline-none focus:border-orange-500"
                    >
                      <option value="none">One-Time alert (No Recurrence)</option>
                      <option value="monthly">Every Month (Rollover Monthly)</option>
                      <option value="yearly">Every Year (Rollover Annually)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Due Date */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-200 mb-1">Payment Due Date *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                      <input 
                        type="date"
                        required
                        value={formData.due_date}
                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                        className="w-full bg-dark-900 border border-dark-700 text-white pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Amount NGN */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-200 mb-1">Subscription Price (₦) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 font-bold">₦</span>
                      <input 
                        type="number"
                        placeholder="e.g. 24500"
                        value={formData.amount_ngn}
                        onChange={e => setFormData({ ...formData, amount_ngn: e.target.value })}
                        className="w-full bg-dark-900 border border-dark-700 text-white pl-8 pr-3 py-2.5 rounded-lg text-xs font-semibold outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-lg flex items-start gap-2.5 text-[11px] text-gray-200 leading-relaxed">
                  <ShieldCheck className="text-orange-400 w-5 h-5 flex-shrink-0" />
                  <p>💡 When you click <strong>Settle Pay</strong>, the payment is routed to Folios & Billings for accounts confirmation. Upon confirmation, the general ledger is updated and a receipt is generated. Recurring reminders auto-rollover after accounts confirms payment.</p>
                </div>
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
                  className="bg-orange-500 hover:bg-orange-600 text-dark-950 font-extrabold text-xs py-2 px-5 rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Registering...' : 'Register Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Reminders;

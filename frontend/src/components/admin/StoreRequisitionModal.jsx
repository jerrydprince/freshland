import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { X, Archive, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const StoreRequisitionModal = ({ isOpen, onClose, department = 'housekeeping', onSuccess }) => {
  const { user, profile } = useAuth();
  
  // States
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Requisition metadata form
  const [form, setForm] = useState({
    department: department,
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm')
  });

  // Requisition items array
  const [requestedItems, setRequestedItems] = useState([
    { itemId: '', quantity: 1 }
  ]);

  // Keep form department updated if the prop changes
  useEffect(() => {
    setForm(f => ({ ...f, department }));
  }, [department]);

  // Current logged in user name for Receiver
  const currentStaffName = useMemo(() => {
    if (profile?.first_name) {
      return `${profile.first_name} ${profile.last_name || ''}`.trim();
    }
    return user?.name || user?.email || 'Staff';
  }, [user, profile]);

  const isAdminOrManager = useMemo(() => {
    return ['super_admin', 'hotel_owner', 'hotel_manager', 'admin', 'finance_manager', 'accountant'].includes(profile?.role);
  }, [profile?.role]);

  const DEPARTMENTS = [
    { value: 'front office', label: 'Front Office / Reception' },
    { value: 'accounts', label: 'Finance & Accounts' },
    { value: 'kitchen', label: 'Kitchen / Room Service' },
    { value: 'housekeeping', label: 'Housekeeping' },
    { value: 'bar', label: 'Lounge & Bar' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'maintenance', label: 'Maintenance & Utility' }
  ];

  // Fetch available store items
  useEffect(() => {
    if (isOpen) {
      fetchAvailableItems();
      // Reset items list on open
      setRequestedItems([{ itemId: '', quantity: 1 }]);
    }
  }, [isOpen]);

  const fetchAvailableItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_items')
        .select('*')
        .order('category')
        .order('name');
        
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching inventory items:', err);
      toast.error('Failed to load store inventory catalog');
    } finally {
      setLoading(false);
    }
  };

  // Grid Actions
  const handleAddItemRow = () => {
    setRequestedItems([...requestedItems, { itemId: '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (requestedItems.length === 1) return;
    const list = [...requestedItems];
    list.splice(index, 1);
    setRequestedItems(list);
  };

  const handleRowChange = (index, field, value) => {
    const list = [...requestedItems];
    list[index][field] = value;
    setRequestedItems(list);
  };

  // Helper: check row active stock level
  const getRowStockDetails = (rowId) => {
    return items.find(i => i.id === rowId);
  };

  // Handle Form Submit (Group consolidated batch insertion)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validation: check that all rows have selected items
    const hasEmptyRow = requestedItems.some(row => !row.itemId || Number(row.quantity) <= 0);
    if (hasEmptyRow) {
      return toast.error('Please select a valid item and quantity for all rows.');
    }

    // 2. Validation: check for duplicate items
    const selectedItemIds = requestedItems.map(r => r.itemId);
    const hasDuplicates = selectedItemIds.some((item, index) => selectedItemIds.indexOf(item) !== index);
    if (hasDuplicates) {
      return toast.error('Duplicate items selected. Please combine them into a single row.');
    }

    // 3. Validation: check that requested stock doesn't exceed warehouse availability
    for (const row of requestedItems) {
      const stock = getRowStockDetails(row.itemId);
      if (!stock) return toast.error('Invalid item selection detected.');
      if (Number(row.quantity) > stock.quantity) {
        return toast.error(`Stock exceeded for "${stock.name}". Only ${stock.quantity} units currently available in stock.`);
      }
    }

    setSubmitting(true);
    try {
      const transDate = new Date(`${form.date}T${form.time}`).toISOString();
      
      // Build batch logs array
      const payloads = requestedItems.map(row => {
        const stock = getRowStockDetails(row.itemId);
        return {
          item_id: row.itemId,
          log_type: 'outgoing',
          quantity: Number(row.quantity),
          price_at_transaction: Number(stock.unit_price_ngn),
          giver_name: 'PMS Portal',
          receiver_name: currentStaffName,
          department: form.department,
          notes: form.notes || `${form.department.toUpperCase()} Store Requisition.`,
          status: 'pending_approval', // Routed directly to General Manager release queue
          transaction_date: transDate
        };
      });

      const { error } = await supabase
        .from('store_logs')
        .insert(payloads);

      if (error) throw error;

      toast.success(`✓ Store requisition submitted successfully! Awaiting Manager approval.`);
      
      // Reset
      setForm(f => ({
        ...f,
        notes: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm')
      }));
      setRequestedItems([{ itemId: '', quantity: 1 }]);

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error submitting batch store requisition:', err);
      toast.error('Failed to submit store request ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:hidden">
      <div className="glass-panel max-w-2xl w-full border border-dark-700/80 p-6 rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 bg-dark-800 hover:bg-dark-700 text-gray-200 hover:text-white rounded-full transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="border-b border-dark-700/60 pb-4 mb-5 shrink-0">
          <h2 className="text-xl font-black text-white flex items-center gap-2 font-serif">
            <Archive className="text-brand-500 animate-pulse" size={24} />
            Consolidated Store Requisition
          </h2>
          <p className="text-gray-200 text-xs mt-1">
            Select one or more warehouse items, quantities, and submit a single consolidated ticket for Manager authorization.
          </p>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="animate-spin text-brand-500 mx-auto mb-3" size={36} />
            <p className="text-gray-300 text-xs">Syncing available warehouse inventory items...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden space-y-4 text-xs">
            
            {/* Requester & Department Settings block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-dark-900/50 border border-dark-700/50 rounded-2xl p-4 shrink-0">
              <div className="flex flex-col justify-center">
                <span className="text-[10px] text-gray-300 uppercase font-bold tracking-wider">Requester Account</span>
                <span className="text-white font-extrabold text-sm mt-0.5">{currentStaffName}</span>
              </div>
              <div>
                <label className="block text-[10px] text-gray-300 font-bold mb-1 uppercase tracking-wider">Billing Department</label>
                {isAdminOrManager ? (
                  <select
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-semibold text-xs cursor-pointer"
                  >
                    {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                ) : (
                  <div className="w-full bg-dark-900 border border-dark-850 rounded-xl p-2.5 text-brand-400 font-extrabold text-xs select-none">
                    {DEPARTMENTS.find(d => d.value === form.department)?.label || form.department?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Multi-Item Rows Selector Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-[150px]">
              <div className="flex items-center justify-between border-b border-dark-700/60 pb-2">
                <span className="font-bold text-gray-300 uppercase tracking-wider text-[10px]">Requisition Items Catalog</span>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white px-3 py-1.5 rounded-lg border border-brand-500/20 text-[10px] font-black transition-all flex items-center gap-1 shadow-sm"
                >
                  <Plus size={12} />
                  Add Another Item
                </button>
              </div>

              {requestedItems.map((row, index) => {
                const stock = getRowStockDetails(row.itemId);
                return (
                  <div 
                    key={index} 
                    className="bg-dark-900/30 border border-dark-700/40 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-start md:items-center relative group"
                  >
                    {/* Item selector */}
                    <div className="flex-1 w-full">
                      <select
                        required
                        value={row.itemId}
                        onChange={e => handleRowChange(index, 'itemId', e.target.value)}
                        className="w-full bg-dark-850 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-semibold"
                      >
                        <option value="">-- Select Store Item --</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id} disabled={item.quantity <= 0}>
                            {item.name} ({item.quantity} available)
                          </option>
                        ))}
                      </select>
                      {stock && (
                        <p className="mt-1 text-[9px] text-gray-300 flex justify-between px-1">
                          <span>Stock: <strong className="text-white">{stock.quantity} Units</strong> | Value: <strong className="text-brand-400">₦{Number(stock.unit_price_ngn).toLocaleString()}</strong></span>
                          {stock.quantity < 10 && <span className="text-red-400 font-bold uppercase animate-pulse">Low Stock</span>}
                        </p>
                      )}
                    </div>

                    {/* Quantity Selector */}
                    <div className="w-full md:w-32">
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={e => handleRowChange(index, 'quantity', Math.max(1, Number(e.target.value)))}
                        className="w-full bg-dark-850 border border-dark-700 rounded-xl p-3 text-white text-center focus:border-brand-500 outline-none font-bold font-mono"
                      />
                    </div>

                    {/* Delete action */}
                    {requestedItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        className="p-3 bg-dark-850 hover:bg-red-500/10 text-gray-300 hover:text-red-400 rounded-xl border border-dark-700 hover:border-red-500/20 transition-all self-end md:self-center"
                        title="Remove row"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Date/Time and General Purpose block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0 pt-2 border-t border-dark-700/60">
              <div>
                <label className="block text-gray-200 font-bold mb-1.5 uppercase">Requisition Purpose / Notes</label>
                <textarea
                  rows="2"
                  placeholder="Describe material usage details..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-200 font-bold mb-1.5 uppercase">Request Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-200 font-bold mb-1.5 uppercase">Request Time</label>
                  <input
                    type="time"
                    required
                    value={form.time}
                    onChange={e => setForm({ ...form, time: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Modal Control Actions */}
            <div className="flex gap-3 pt-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-dark-800 hover:bg-dark-700 text-gray-200 hover:text-white font-bold py-3 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 disabled:from-dark-800 disabled:to-dark-800 disabled:text-gray-300 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <>
                    <Send size={14} />
                    <span>Submit Consolidated Requisition</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default StoreRequisitionModal;

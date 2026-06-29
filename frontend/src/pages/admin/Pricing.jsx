import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, X, TrendingUp, TrendingDown, CalendarDays, DollarSign, Tag, Settings, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays } from 'date-fns';

const AdminPricing = () => {
  const [activeTab, setActiveTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [ratePlans, setRatePlans] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);

  // Form States
  const [newRule, setNewRule] = useState({ name: '', room_id: '', type: 'seasonal', start_date: '', end_date: '', adjustment_percentage: 0, is_active: true });
  const [newPlan, setNewPlan] = useState({ name: '', description: '', type: 'refundable', price_adjustment_percentage: 0, cancellation_policy: '', is_active: true });
  const [newCoupon, setNewCoupon] = useState({ code: '', discount_type: 'percentage', discount_value: 0, valid_from: '', valid_until: '', usage_limit: '', is_active: true });

  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesRes, plansRes, couponsRes, roomsRes] = await Promise.all([
        supabase.from('pricing_rules').select('*').order('start_date', { ascending: true }),
        supabase.from('rate_plans').select('*').order('created_at', { ascending: false }),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('rooms').select('id, name, room_number, base_price_ngn')
      ]);

      if (rulesRes.data) setRules(rulesRes.data);
      if (plansRes.data) setRatePlans(plansRes.data);
      if (couponsRes.data) setCoupons(couponsRes.data);
      if (roomsRes.data) setRooms(roomsRes.data);
      setLoading(false);
    } catch (err) {
      setHasError(true);
      setErrorMsg(err.message);
    }
  };

  // --- DELETE HANDLERS ---
  const handleDelete = async (table, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${table}?`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted successfully');
      fetchData();
    }
  };

  // --- SAVE HANDLERS ---
  const handleSaveRule = async (e) => {
    e.preventDefault();
    const data = { ...newRule, room_id: newRule.room_id || null, adjustment_percentage: parseFloat(newRule.adjustment_percentage) };
    if (isEdit) await supabase.from('pricing_rules').update(data).eq('id', currentItem.id);
    else await supabase.from('pricing_rules').insert([data]);
    setIsRuleModalOpen(false); fetchData(); toast.success('Saved!');
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    const data = { ...newPlan, price_adjustment_percentage: parseFloat(newPlan.price_adjustment_percentage) };
    if (isEdit) await supabase.from('rate_plans').update(data).eq('id', currentItem.id);
    else await supabase.from('rate_plans').insert([data]);
    setIsPlanModalOpen(false); fetchData(); toast.success('Saved!');
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    const data = { 
      ...newCoupon, 
      code: newCoupon.code.toUpperCase(),
      discount_value: parseFloat(newCoupon.discount_value),
      usage_limit: newCoupon.usage_limit ? parseInt(newCoupon.usage_limit) : null
    };
    if (isEdit) await supabase.from('coupons').update(data).eq('id', currentItem.id);
    else await supabase.from('coupons').insert([data]);
    setIsCouponModalOpen(false); fetchData(); toast.success('Saved!');
  };

  // --- OPEN MODAL HELPERS ---
  const openRuleModal = (rule = null) => {
    setIsEdit(!!rule); setCurrentItem(rule);
    setNewRule(rule || { name: '', room_id: '', type: 'seasonal', start_date: '', end_date: '', adjustment_percentage: 0, is_active: true });
    setIsRuleModalOpen(true);
  };

  const openPlanModal = (plan = null) => {
    setIsEdit(!!plan); setCurrentItem(plan);
    setNewPlan(plan || { name: '', description: '', type: 'refundable', price_adjustment_percentage: 0, cancellation_policy: '', is_active: true });
    setIsPlanModalOpen(true);
  };

  const openCouponModal = (coupon = null) => {
    setIsEdit(!!coupon); setCurrentItem(coupon);
    setNewCoupon(coupon || { code: '', discount_type: 'percentage', discount_value: 0, valid_from: '', valid_until: '', usage_limit: '', is_active: true });
    setIsCouponModalOpen(true);
  };

  if (hasError) {
    return <div className="p-8 text-red-500 font-bold bg-dark-800">Error rendering component: {errorMsg}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Management</h1>
          <p className="text-gray-200 mt-1">Manage dynamic pricing, rate plans, and promotional codes.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-6 border-b border-dark-700">
        <button onClick={() => setActiveTab('rules')} className={`pb-3 font-medium text-sm transition-colors relative ${activeTab === 'rules' ? 'text-brand-500' : 'text-gray-200 hover:text-white'}`}>
          Dynamic Rules {activeTab === 'rules' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500 rounded-t-md"></span>}
        </button>
        <button onClick={() => setActiveTab('plans')} className={`pb-3 font-medium text-sm transition-colors relative ${activeTab === 'plans' ? 'text-brand-500' : 'text-gray-200 hover:text-white'}`}>
          Rate Plans {activeTab === 'plans' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500 rounded-t-md"></span>}
        </button>
        <button onClick={() => setActiveTab('coupons')} className={`pb-3 font-medium text-sm transition-colors relative ${activeTab === 'coupons' ? 'text-brand-500' : 'text-gray-200 hover:text-white'}`}>
          Coupons {activeTab === 'coupons' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500 rounded-t-md"></span>}
        </button>
        <button onClick={() => setActiveTab('bulk')} className={`pb-3 font-medium text-sm transition-colors relative ${activeTab === 'bulk' ? 'text-brand-500' : 'text-gray-200 hover:text-white'}`}>
          Bulk Calendar {activeTab === 'bulk' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500 rounded-t-md"></span>}
        </button>
      </div>

      {/* CONTENT: RULES */}
      {activeTab === 'rules' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => openRuleModal()} className="btn-primary py-2 px-4 flex items-center gap-2"><Plus size={18}/> Add Rule</button>
          </div>
          <div className="bg-dark-800 border border-dark-700 shadow-sm overflow-hidden rounded-lg">
            <table className="w-full text-left">
              <thead className="bg-dark-900 border-b border-dark-700 text-xs uppercase text-gray-300">
                <tr><th className="p-4">Name</th><th className="p-4">Target</th><th className="p-4">Type</th><th className="p-4">Dates</th><th className="p-4">Adjustment</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-dark-700 text-sm">
                {rules && rules.map(rule => (
                  <tr key={rule.id} className="hover:bg-dark-700 transition-colors">
                    <td className="p-4 font-medium text-white">{rule.name}</td>
                    <td className="p-4 text-gray-200">{rooms && rooms.find(r => r.id === rule.room_id)?.name || 'All Rooms'}</td>
                    <td className="p-4 capitalize text-gray-200">{rule.type && rule.type.replace('_', ' ')}</td>
                    <td className="p-4 text-gray-200">{rule.start_date && new Date(rule.start_date).toLocaleDateString()} - {rule.end_date && new Date(rule.end_date).toLocaleDateString()}</td>
                    <td className="p-4 font-medium text-white">{rule.adjustment_percentage > 0 ? '+' : ''}{rule.adjustment_percentage}%</td>
                    <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${rule.is_active ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-gray-200'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="p-4 text-right">
                      <button onClick={() => openRuleModal(rule)} className="text-gray-300 hover:text-brand-500 mr-3"><Edit size={16}/></button>
                      <button onClick={() => handleDelete('pricing_rules', rule.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENT: RATE PLANS */}
      {activeTab === 'plans' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => openPlanModal()} className="btn-primary py-2 px-4 flex items-center gap-2"><Plus size={18}/> Add Rate Plan</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ratePlans && ratePlans.map(plan => (
              <div key={plan.id} className="bg-dark-800 border border-dark-700 rounded-lg p-5 shadow-sm relative group">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openPlanModal(plan)} className="p-1.5 bg-dark-700 hover:bg-dark-600 rounded text-gray-300"><Edit size={14}/></button>
                  <button onClick={() => handleDelete('rate_plans', plan.id)} className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-500"><Trash2 size={14}/></button>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${plan.price_adjustment_percentage < 0 ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    <Tag size={20} />
                  </div>
                  <h3 className="font-bold text-white">{plan.name}</h3>
                </div>
                <p className="text-sm text-gray-200 mb-4 h-10 overflow-hidden">{plan.description}</p>
                <div className="bg-dark-900 border border-dark-700 rounded p-3 flex justify-between items-center text-sm mb-3">
                  <span className="text-gray-200">Price Modifier:</span>
                  <span className="font-bold text-white">{plan.price_adjustment_percentage > 0 ? '+' : ''}{plan.price_adjustment_percentage}%</span>
                </div>
                <p className="text-xs text-gray-200"><span className="font-medium text-gray-300">Policy:</span> {plan.cancellation_policy}</p>
                {!plan.is_active && <span className="absolute top-4 left-4 bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded font-medium">Inactive</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENT: COUPONS */}
      {activeTab === 'coupons' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => openCouponModal()} className="btn-primary py-2 px-4 flex items-center gap-2"><Plus size={18}/> Generate Coupon</button>
          </div>
          <div className="bg-dark-800 border border-dark-700 shadow-sm overflow-hidden rounded-lg">
            <table className="w-full text-left">
              <thead className="bg-dark-900 border-b border-dark-700 text-xs uppercase text-gray-300">
                <tr><th className="p-4">Code</th><th className="p-4">Discount</th><th className="p-4">Validity</th><th className="p-4">Usage</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-dark-700 text-sm">
                {coupons && coupons.map(coupon => (
                  <tr key={coupon.id} className="hover:bg-dark-700 transition-colors">
                    <td className="p-4 font-bold text-white tracking-wider">{coupon.code}</td>
                    <td className="p-4 text-brand-400 font-medium">{coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₦${coupon.discount_value.toLocaleString()}`}</td>
                    <td className="p-4 text-gray-200">{coupon.valid_from && new Date(coupon.valid_from).toLocaleDateString()} - {coupon.valid_until && new Date(coupon.valid_until).toLocaleDateString()}</td>
                    <td className="p-4 text-gray-200">{coupon.times_used} / {coupon.usage_limit || '∞'}</td>
                    <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${coupon.is_active ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-gray-200'}`}>{coupon.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="p-4 text-right">
                      <button onClick={() => openCouponModal(coupon)} className="text-gray-300 hover:text-brand-500 mr-3"><Edit size={16}/></button>
                      <button onClick={() => handleDelete('coupons', coupon.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENT: BULK CALENDAR */}
      {activeTab === 'bulk' && (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 shadow-sm flex flex-col items-center justify-center text-center h-96">
          <CalendarIcon size={48} className="text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Bulk Pricing Calendar</h3>
          <p className="text-gray-200 max-w-md">The bulk update calendar allows you to select date ranges and apply overrides or rules across multiple rooms simultaneously. This feature is currently in preview.</p>
        </div>
      )}

      {/* MODAL: RULES */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-xl font-bold text-white">{isEdit ? 'Edit Rule' : 'Create Rule'}</h2>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-gray-300 hover:text-white transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveRule} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-200 mb-1">Rule Name</label>
                  <input required type="text" value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="e.g. Early Bird Summer" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Target Room</label>
                  <select value={newRule.room_id} onChange={e => setNewRule({...newRule, room_id: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                    <option value="">All Rooms</option>
                    {rooms && rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.room_number})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Trigger Type</label>
                  <select value={newRule.type} onChange={e => setNewRule({...newRule, type: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                    <option value="seasonal">Seasonal</option>
                    <option value="weekend">Weekend</option>
                    <option value="holiday">Holiday</option>
                    <option value="occupancy">Occupancy</option>
                    <option value="early_bird">Early Bird</option>
                    <option value="last_minute">Last Minute</option>
                    <option value="promotional">Promotional</option>
                    <option value="long_stay">Long Stay</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Valid From</label>
                  <input required type="date" value={newRule.start_date} onChange={e => setNewRule({...newRule, start_date: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Valid Until</label>
                  <input required type="date" value={newRule.end_date} onChange={e => setNewRule({...newRule, end_date: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-200 mb-1">Price Adjustment (%)</label>
                  <input required type="number" step="0.01" value={newRule.adjustment_percentage} onChange={e => setNewRule({...newRule, adjustment_percentage: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="-10 for 10% discount" />
                </div>
                <div className="col-span-2 flex items-center gap-2 mt-2">
                  <input type="checkbox" id="ruleActive" checked={newRule.is_active} onChange={e => setNewRule({...newRule, is_active: e.target.checked})} className="w-4 h-4 text-brand-500 bg-dark-900 border-dark-700 rounded focus:ring-brand-500" />
                  <label htmlFor="ruleActive" className="text-sm text-gray-300">Rule is Active</label>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" className="btn-primary py-2 px-6">Save Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RATE PLAN */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-xl font-bold text-white">{isEdit ? 'Edit Rate Plan' : 'Create Rate Plan'}</h2>
              <button onClick={() => setIsPlanModalOpen(false)} className="text-gray-300 hover:text-white transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleSavePlan} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Plan Name</label>
                <input required type="text" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="e.g. Standard Flexible" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Description</label>
                <textarea rows="2" value={newPlan.description} onChange={e => setNewPlan({...newPlan, description: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="Brief marketing description..."></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Plan Type</label>
                  <select value={newPlan.type} onChange={e => setNewPlan({...newPlan, type: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                    <option value="refundable">Refundable</option>
                    <option value="non_refundable">Non-Refundable</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Price Modifier (%)</label>
                  <input required type="number" step="0.01" value={newPlan.price_adjustment_percentage} onChange={e => setNewPlan({...newPlan, price_adjustment_percentage: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="-10" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Cancellation Policy</label>
                <input required type="text" value={newPlan.cancellation_policy} onChange={e => setNewPlan({...newPlan, cancellation_policy: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="e.g. Free cancellation up to 48 hours" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="planActive" checked={newPlan.is_active} onChange={e => setNewPlan({...newPlan, is_active: e.target.checked})} className="w-4 h-4 text-brand-500 bg-dark-900 border-dark-700 rounded focus:ring-brand-500" />
                <label htmlFor="planActive" className="text-sm text-gray-300">Plan is Active</label>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" className="btn-primary py-2 px-6">Save Rate Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COUPON */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-xl font-bold text-white">{isEdit ? 'Edit Coupon' : 'Create Coupon'}</h2>
              <button onClick={() => setIsCouponModalOpen(false)} className="text-gray-300 hover:text-white transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveCoupon} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-200 mb-1">Coupon Code</label>
                  <input required type="text" value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 font-mono transition-colors" placeholder="SUMMER2026" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Discount Type</label>
                  <select value={newCoupon.discount_type} onChange={e => setNewCoupon({...newCoupon, discount_type: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors">
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₦)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Discount Value</label>
                  <input required type="number" step="0.01" value={newCoupon.discount_value} onChange={e => setNewCoupon({...newCoupon, discount_value: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Valid From</label>
                  <input required type="date" value={newCoupon.valid_from} onChange={e => setNewCoupon({...newCoupon, valid_from: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Valid Until</label>
                  <input required type="date" value={newCoupon.valid_until} onChange={e => setNewCoupon({...newCoupon, valid_until: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-200 mb-1">Usage Limit (Optional)</label>
                  <input type="number" value={newCoupon.usage_limit || ''} onChange={e => setNewCoupon({...newCoupon, usage_limit: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-md p-2.5 text-white outline-none focus:border-brand-500 transition-colors" placeholder="e.g. 50 (Leave blank for unlimited)" />
                </div>
                <div className="col-span-2 flex items-center gap-2 mt-2">
                  <input type="checkbox" id="couponActive" checked={newCoupon.is_active} onChange={e => setNewCoupon({...newCoupon, is_active: e.target.checked})} className="w-4 h-4 text-brand-500 bg-dark-900 border-dark-700 rounded focus:ring-brand-500" />
                  <label htmlFor="couponActive" className="text-sm text-gray-300">Coupon is Active</label>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" className="btn-primary py-2 px-6">Save Coupon</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPricing;

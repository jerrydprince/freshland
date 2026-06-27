import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Package, Plus, Edit2, Trash2, CheckCircle, XCircle, 
  Settings, Save, X, Search, Filter, Image as ImageIcon, 
  Clock, Users, DollarSign 
} from 'lucide-react';

const GuestServices = () => {
  const { hasAccess } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const defaultForm = {
    name: '',
    description: '',
    category: 'Room Add-ons',
    code: '',
    base_price_ngn: 0,
    pricing_type: 'fixed',
    icon_name: 'Package',
    scheduling_required: false,
    quantity_selector: false,
    tax_inclusive: true,
    is_active: true,
    internal_notes: ''
  };
  
  const [formData, setFormData] = useState(defaultForm);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const CATEGORIES = [
    'Transportation', 'Food & Beverage', 'Housekeeping', 
    'Laundry', 'Wellness', 'Business Services', 
    'Entertainment', 'Room Add-ons', 'Events', 
    'Concierge', 'Security', 'Tours'
  ];

  const PRICING_TYPES = [
    { value: 'fixed', label: 'Fixed Price' },
    { value: 'per_person', label: 'Per Person' },
    { value: 'per_day', label: 'Per Day' },
    { value: 'per_night', label: 'Per Night' },
    { value: 'per_booking', label: 'Per Booking' },
    { value: 'quantity_based', label: 'Quantity Based (e.g. per item)' },
    { value: 'time_based', label: 'Time Based (e.g. per hour)' }
  ];

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category')
        .order('name');
        
      if (error) throw error;
      const nonPosServices = (data || []).filter(s => 
        !['bar', 'restaurant', 'kitchen'].includes(s.internal_notes?.toLowerCase().trim() || '')
      );
      setServices(nonPosServices);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (service = null) => {
    if (service) {
      setFormData(service);
      setIsEditing(true);
    } else {
      setFormData(defaultForm);
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(defaultForm);
    setIsEditing(false);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.base_price_ngn < 0) {
      return toast.error("Please provide valid name and price.");
    }
    
    const toastId = toast.loading(isEditing ? 'Updating service...' : 'Creating service...');
    
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('services')
          .update(formData)
          .eq('id', formData.id);
        if (error) throw error;
        toast.success('Service updated successfully!', { id: toastId });
      } else {
        const { error } = await supabase
          .from('services')
          .insert([formData]);
        if (error) throw error;
        toast.success('Service created successfully!', { id: toastId });
      }
      handleCloseModal();
      fetchServices();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(`Error: ${error.message}`, { id: toastId });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this service? This cannot be undone.")) return;
    
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      toast.success('Service deleted');
      fetchServices();
    } catch (error) {
      toast.error('Failed to delete service. It may be linked to existing bookings.');
    }
  };

  const toggleStatus = async (service) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !service.is_active })
        .eq('id', service.id);
      if (error) throw error;
      fetchServices();
      toast.success(`Service ${service.is_active ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const formatPriceType = (type) => {
    return PRICING_TYPES.find(p => p.value === type)?.label || type;
  };

  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'All' || s.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (!hasAccess('Guest Services')) {
    return <div className="p-8 text-center text-gray-500">You do not have permission to access Guest Services.</div>;
  }

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dark-800 p-6 rounded-lg border border-dark-700 shadow-sm mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="text-brand-500"/> Guest Services & Add-ons
          </h1>
          <p className="text-gray-400 mt-1">Create and manage optional paid services for guests during booking or stay.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2 mt-4 md:mt-0 py-2.5 px-5 text-sm">
          <Plus size={18} /> New Service
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18}/>
          <input 
            type="text" 
            placeholder="Search services by name or code..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-dark-800 border border-dark-700 text-white pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="relative w-full md:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18}/>
          <select 
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full bg-dark-800 border border-dark-700 text-white pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500 appearance-none"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="py-20 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div></div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No services found</h3>
          <p className="text-gray-400 mb-6">Get started by creating your first guest service.</p>
          <button onClick={() => handleOpenModal()} className="btn-primary inline-flex items-center gap-2">
            <Plus size={18} /> Create Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map(service => (
            <div key={service.id} className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden hover:border-dark-600 transition-colors flex flex-col h-full">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-dark-900 border border-dark-700 rounded-lg flex items-center justify-center text-brand-500">
                      <Package size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg leading-tight">{service.name}</h3>
                      <span className="text-xs text-gray-400 bg-dark-900 px-2 py-0.5 rounded-full border border-dark-700">{service.category}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleStatus(service)}
                    className={`text-xs px-2 py-1 rounded-full border font-medium ${service.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}
                  >
                    {service.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{service.description || 'No description provided.'}</p>
                
                <div className="bg-dark-900/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><DollarSign size={14}/> Base Price</span>
                    <span className="text-sm font-bold text-white">₦{Number(service.base_price_ngn).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Settings size={14}/> Pricing Model</span>
                    <span className="text-xs font-medium text-brand-400 capitalize">{formatPriceType(service.pricing_type)}</span>
                  </div>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-dark-700">
                    {service.scheduling_required && <span className="text-[10px] uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded flex items-center gap-1"><Clock size={10}/> Scheduled</span>}
                    {service.quantity_selector && <span className="text-[10px] uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded flex items-center gap-1"><Plus size={10}/> Quantifiable</span>}
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${service.tax_inclusive ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {service.tax_inclusive ? 'Taxable (7.5%)' : 'No Tax'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-dark-700 bg-dark-900/50 p-3 flex justify-between">
                <button onClick={() => handleOpenModal(service)} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 px-2 py-1 transition-colors">
                  <Edit2 size={14} /> Edit
                </button>
                <button onClick={() => handleDelete(service.id)} className="text-sm text-gray-500 hover:text-red-400 flex items-center gap-1 px-2 py-1 transition-colors">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {isEditing ? <Edit2 size={20} className="text-brand-500"/> : <Plus size={20} className="text-brand-500"/>} 
                {isEditing ? 'Edit Service' : 'Create New Service'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <form id="serviceForm" onSubmit={handleSaveService} className="space-y-6">
                
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-brand-500 uppercase tracking-wider mb-2">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Service Name *</label>
                      <input 
                        type="text" required
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500"
                        placeholder="e.g. Airport Pickup"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Category *</label>
                      <select 
                        value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Internal Code (Optional)</label>
                      <input 
                        type="text" 
                        value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500"
                        placeholder="e.g. TRN-APT-01"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                      <textarea 
                        value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500 min-h-[80px]"
                        placeholder="Describe the service to the guest..."
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-dark-700" />

                {/* Pricing Configuration */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-brand-500 uppercase tracking-wider mb-2">Pricing & Rules</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Base Price (₦) *</label>
                      <input 
                        type="number" required min="0"
                        value={formData.base_price_ngn} onChange={e => setFormData({...formData, base_price_ngn: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Pricing Model *</label>
                      <select 
                        value={formData.pricing_type} onChange={e => setFormData({...formData, pricing_type: e.target.value})}
                        className="w-full bg-dark-900 border border-dark-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-brand-500"
                      >
                        {PRICING_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <hr className="border-dark-700" />

                {/* Booking Options */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-brand-500 uppercase tracking-wider mb-2">Guest Booking Options</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center space-x-3 p-4 border border-dark-700 rounded-lg bg-dark-900/50 cursor-pointer hover:bg-dark-900 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={formData.scheduling_required} 
                        onChange={e => setFormData({...formData, scheduling_required: e.target.checked})}
                        className="w-5 h-5 accent-brand-500 bg-dark-700 border-dark-600 rounded"
                      />
                      <div>
                        <span className="block text-white font-medium">Requires Scheduling</span>
                        <span className="block text-xs text-gray-400">Guest must select Date & Time (e.g. Spa)</span>
                      </div>
                    </label>
                    
                    <label className="flex items-center space-x-3 p-4 border border-dark-700 rounded-lg bg-dark-900/50 cursor-pointer hover:bg-dark-900 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={formData.quantity_selector} 
                        onChange={e => setFormData({...formData, quantity_selector: e.target.checked})}
                        className="w-5 h-5 accent-brand-500 bg-dark-700 border-dark-600 rounded"
                      />
                      <div>
                        <span className="block text-white font-medium">Enable Quantity</span>
                        <span className="block text-xs text-gray-400">Guest can select amount (e.g. Laundry items)</span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 p-4 border border-dark-700 rounded-lg bg-dark-900/50 cursor-pointer hover:bg-dark-900 transition-colors md:col-span-2">
                      <input 
                        type="checkbox" 
                        checked={formData.tax_inclusive} 
                        onChange={e => setFormData({...formData, tax_inclusive: e.target.checked})}
                        className="w-5 h-5 accent-brand-500 bg-dark-700 border-dark-600 rounded"
                      />
                      <div>
                        <span className="block text-white font-medium">Charge 7.5% VAT / Tax</span>
                        <span className="block text-xs text-gray-400">Apply standard VAT to transactions of this service</span>
                      </div>
                    </label>
                  </div>
                </div>

              </form>
            </div>
            
            <div className="p-6 border-t border-dark-700 bg-dark-900/50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={handleCloseModal} className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" form="serviceForm" className="btn-primary py-2.5 px-6 flex items-center gap-2">
                <Save size={18} /> {isEditing ? 'Save Changes' : 'Create Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestServices;

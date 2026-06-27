import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  ChefHat, Utensils, Clock, CheckCircle, AlertCircle, AlertTriangle,
  Users, DollarSign, Search, X, Check, ArrowRight, BookOpen, ShoppingBag, Plus,
  Coffee
} from 'lucide-react';

const MENU_SEGMENTS = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Drinks', 'Appetizers'];

const parseDescription = (desc) => {
  if (!desc) return { segment: 'Lunch', text: '' };
  const delimiterIndex = desc.indexOf(' | ');
  if (delimiterIndex !== -1) {
    const segment = desc.substring(0, delimiterIndex).trim();
    const text = desc.substring(delimiterIndex + 3).trim();
    if (MENU_SEGMENTS.includes(segment)) {
      return { segment, text };
    }
  }
  return { segment: 'Lunch', text: desc };
};

const RestaurantKitchen = () => {
  const { user, profile, hasAccess } = useAuth();
  
  const canAccessRestaurantDesk = hasAccess('Restaurant Desk') || user?.role === 'super_admin';
  const canAccessKitchenDesk = hasAccess('Kitchen Desk') || user?.role === 'super_admin';
  const canAccessOrderHistory = hasAccess('Order History') || user?.role === 'super_admin';

  // Dashboard view tabs: 'restaurant', 'kitchen', 'history'
  const [viewMode, setViewMode] = useState(() => {
    if (canAccessRestaurantDesk) return 'restaurant';
    if (canAccessKitchenDesk) return 'kitchen';
    if (canAccessOrderHistory) return 'history';
    return '';
  }); 
  
  // Restaurant sub-tabs: 'pending', 'prep', 'ready'
  const [restaurantTab, setRestaurantTab] = useState('pending');
  
  // Loading & states
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  
  // Prep form inputs (Kitchen)
  const [chefPrice, setChefPrice] = useState('');
  const [chefNotes, setChefNotes] = useState('');
  const [isSubmittingPrep, setIsSubmittingPrep] = useState(false);
  
  const [billingOption, setBillingOption] = useState('room'); // 'room' or 'group'
  const [isSubmittingBilling, setIsSubmittingBilling] = useState(false);
  const [guestWalletProfile, setGuestWalletProfile] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  // Close of Day states
  const [departmentalClosures, setDepartmentalClosures] = useState([]);
  const [isCloseOfDayModalOpen, setIsCloseOfDayModalOpen] = useState(false);
  const [closeOfDayReport, setCloseOfDayReport] = useState(null);
  const [isCompilingCloseOfDay, setIsCompilingCloseOfDay] = useState(false);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const isRestaurantClosed = useMemo(() => {
    return departmentalClosures.some(c => c.department === 'restaurant' && c.business_date === todayStr);
  }, [departmentalClosures, todayStr]);

  const [cateringMeals, setCateringMeals] = useState([]);
  const [cateringLoading, setCateringLoading] = useState(false);
  const [cateringTab, setCateringTab] = useState('pending');

  const fetchCateringMeals = async () => {
    setCateringLoading(true);
    try {
      const { data, error } = await supabase
        .from('hall_booking_meals')
        .select(`
          *,
          hall_bookings (
            id,
            booking_reference,
            guest_name,
            organization_name,
            halls (name)
          ),
          hall_meal_options (
            id,
            name,
            course_type,
            combination_items
          )
        `)
        .order('serving_date', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCateringMeals(data || []);
    } catch (err) {
      console.error('Error fetching catering meals:', err);
      toast.error('Failed to load catering meals');
    } finally {
      setCateringLoading(false);
    }
  };

  const handleUpdateCateringStatus = async (mealId, newStatus) => {
    if (isRestaurantClosed) {
      return toast.error("Restaurant operations are locked due to daily ledger closure.");
    }
    const toastId = toast.loading(`Updating catering status to ${newStatus}...`);
    try {
      const { error } = await supabase
        .from('hall_booking_meals')
        .update({ status: newStatus })
        .eq('id', mealId);

      if (error) throw error;
      toast.success(`Catering status updated to ${newStatus}`, { id: toastId });
      fetchCateringMeals();
    } catch (err) {
      console.error("Failed to update catering status:", err);
      toast.error("Failed to update status: " + err.message, { id: toastId });
    }
  };

  useRealtimeSync(['booking_services', 'system_settings', 'hall_bookings', 'hall_booking_meals', 'hall_meal_options'], (table) => {
    fetchOrders();
    fetchCateringMeals();
    if (table === 'hall_meal_options') {
      fetchMealOptions();
    }
    if (table === 'system_settings') {
      fetchClosures();
    }
  });

  // Food Menu Management state
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    base_price_ngn: '',
    is_active: true,
    segment: 'Lunch'
  });
  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [activeMenuSegment, setActiveMenuSegment] = useState('All');

  // Hall Meal Packages state (Catering Packages)
  const [mealOptions, setMealOptions] = useState([]);
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [mealForm, setMealForm] = useState({
    name: '',
    course_type: 'Breakfast Tea',
    combination_items: '',
    price_per_participant_ngn: 5000,
    is_active: true
  });
  const [isSavingMeal, setIsSavingMeal] = useState(false);

  if (!canAccessRestaurantDesk && !canAccessKitchenDesk && !canAccessOrderHistory) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel max-w-md w-full p-8 border border-red-500/20 rounded-3xl shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Access Restricted</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            You do not have permissions to access the Restaurant Desk, Kitchen Desk, or Order History.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchOrders();
    fetchClosures();
    fetchCateringMeals();
  }, []);

  useEffect(() => {
    if (viewMode === 'menu') {
      fetchMenu();
    } else if (viewMode === 'catering_meals') {
      fetchMealOptions();
    }
  }, [viewMode]);

  const fetchMealOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('hall_meal_options')
        .select('*')
        .order('name');
      if (error) throw error;
      setMealOptions(data || []);
    } catch (err) {
      console.error("Failed to fetch meal options:", err);
      toast.error("Failed to load catering options.");
    }
  };

  const handleSaveMeal = async (e) => {
    e.preventDefault();
    if (isRestaurantClosed) {
      return toast.error("Restaurant operations are locked due to daily ledger closure.");
    }
    if (!mealForm.name.trim()) return toast.error("Please enter a name for the meal option.");
    
    setIsSavingMeal(true);
    const toastId = toast.loading("Saving meal package...");
    try {
      const payload = {
        name: mealForm.name.trim(),
        course_type: mealForm.course_type,
        combination_items: mealForm.combination_items.split(',').map(c => c.trim()).filter(Boolean),
        price_per_participant_ngn: Number(mealForm.price_per_participant_ngn),
        is_active: mealForm.is_active
      };

      let error;
      if (editingMeal) {
        ({ error } = await supabase.from('hall_meal_options').update(payload).eq('id', editingMeal.id));
      } else {
        ({ error } = await supabase.from('hall_meal_options').insert([payload]));
      }

      if (error) throw error;
      toast.success(editingMeal ? "Meal option updated!" : "New Meal Option created!", { id: toastId });
      setIsMealModalOpen(false);
      setEditingMeal(null);
      fetchMealOptions();
    } catch (err) {
      console.error(err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSavingMeal(false);
    }
  };

  const handleDeleteMeal = async (id) => {
    if (isRestaurantClosed) {
      return toast.error("Restaurant operations are locked.");
    }
    if (!window.confirm("Are you sure you want to delete this meal option?")) return;
    try {
      const { error } = await supabase.from('hall_meal_options').delete().eq('id', id);
      if (error) throw error;
      toast.success("Meal option deleted.");
      fetchMealOptions();
    } catch (err) {
      toast.error("Failed to delete meal option.");
    }
  };

  const fetchMenu = async () => {
    setMenuLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('category', 'Food & Beverage')
        .eq('internal_notes', 'restaurant')
        .order('name');
      
      if (error) throw error;
      setMenuItems(data || []);
    } catch (err) {
      console.error("Failed to fetch food menu:", err);
      toast.error("Failed to load restaurant food menu.");
    } finally {
      setMenuLoading(false);
    }
  };

  const handleSaveMenuItem = async (e) => {
    e.preventDefault();
    if (isRestaurantClosed) {
      return toast.error("Restaurant & Kitchen operations are locked due to daily ledger closure.");
    }
    if (!menuForm.name.trim() || !menuForm.base_price_ngn) {
      return toast.error("Please enter a name and base price.");
    }
    
    setIsSavingMenu(true);
    const toastId = toast.loading("Saving menu item...");
    
    try {
      const payload = {
        name: menuForm.name.trim(),
        description: `${menuForm.segment} | ${menuForm.description.trim()}`,
        base_price_ngn: Number(menuForm.base_price_ngn),
        is_active: menuForm.is_active,
        category: 'Food & Beverage',
        internal_notes: 'restaurant',
        pricing_type: 'fixed',
        icon_name: 'Utensils'
      };
      
      if (editingMenuItem) {
        // Update
        const { error } = await supabase
          .from('services')
          .update(payload)
          .eq('id', editingMenuItem.id);
          
        if (error) throw error;
        toast.success(`✓ Menu item "${payload.name}" updated successfully!`, { id: toastId });
      } else {
        // Create
        const code = `FNB-MEAL-${payload.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
        payload.code = code;
        
        const { error } = await supabase
          .from('services')
          .insert([payload]);
          
        if (error) throw error;
        toast.success(`✓ Menu item "${payload.name}" created successfully!`, { id: toastId });
      }
      
      setIsMenuModalOpen(false);
      setMenuForm({ name: '', description: '', base_price_ngn: '', is_active: true, segment: 'Lunch' });
      setEditingMenuItem(null);
      fetchMenu();
    } catch (err) {
      console.error("Failed to save menu item:", err);
      toast.error(`Error: ${err.message || 'Failed to save menu item'}`, { id: toastId });
    } finally {
      setIsSavingMenu(false);
    }
  };

  const handleToggleMenuStatus = async (item) => {
    if (isRestaurantClosed) {
      return toast.error("Restaurant & Kitchen operations are locked due to daily ledger closure.");
    }
    const newStatus = !item.is_active;
    const toastId = toast.loading(`${newStatus ? 'Activating' : 'Deactivating'} "${item.name}"...`);
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: newStatus })
        .eq('id', item.id);
      
      if (error) throw error;
      toast.success(`✓ "${item.name}" is now ${newStatus ? 'active' : 'inactive'}.`, { id: toastId });
      fetchMenu();
    } catch (err) {
      console.error(err);
      toast.error('Failed to change status', { id: toastId });
    }
  };

  const fetchClosures = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'departmental_closures')
        .maybeSingle();
      if (data && data.setting_value) {
        setDepartmentalClosures(typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value);
      }
    } catch (err) {
      console.warn("Failed to fetch closures:", err);
    }
  };

  const handleCompileCloseOfDayRestaurant = async () => {
    setIsCompilingCloseOfDay(true);
    const toastId = toast.loading("Compiling today's Restaurant/Kitchen transactions...");
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // 1. Fetch payments for today
      const { data: payments, error: payErr } = await supabase.from('payments').select('*');
      if (payErr) throw payErr;

      // 2. Fetch completed booking services for today
      const { data: bs, error: bsErr } = await supabase
        .from('booking_services')
        .select('*, bookings(rooms(room_number), guest_name, booking_reference), services(name, category, internal_notes)')
        .eq('status', 'completed');
      if (bsErr) throw bsErr;

      // 3. Filter Restaurant POS payments & charges
      const restaurantPosPayments = (payments || []).filter(p => {
        const dStr = format(new Date(p.processed_at || p.created_at), 'yyyy-MM-dd');
        return dStr === todayStr && (p.transaction_ref?.startsWith('POS-RESTAURANT-') || p.notes?.toLowerCase().includes('pos walk-in sale - restaurant'));
      }).map(p => ({
        time: format(new Date(p.processed_at || p.created_at), 'HH:mm'),
        ref: p.transaction_ref,
        description: p.notes || 'POS Walk-in Restaurant Sale',
        amount: Number(p.amount),
        method: p.method
      }));

      const restaurantPosCharges = (bs || []).filter(item => {
        const dStr = format(new Date(item.updated_at || item.created_at), 'yyyy-MM-dd');
        return dStr === todayStr && item.services?.internal_notes?.toLowerCase() === 'restaurant' && (item.notes === 'pos_charge' || item.notes === 'pos_charge_group');
      }).map(i => ({
        time: format(new Date(i.updated_at), 'HH:mm'),
        ref: i.bookings?.booking_reference || 'IN-HOUSE',
        description: `Room ${i.bookings?.rooms?.room_number || 'N/A'} Folio Charge - ${i.services?.name} (x${i.quantity})`,
        amount: Number(i.total_price_ngn),
        method: i.payment_status === 'paid' ? 'corporate_billed' : 'room_charge'
      }));

      const restaurantPosTxns = [...restaurantPosPayments, ...restaurantPosCharges];

      // 4. Filter Kitchen Order payments & charges (Clearly Separated)
      const kitchenPayments = (payments || []).filter(p => {
        const dStr = format(new Date(p.processed_at || p.created_at), 'yyyy-MM-dd');
        return dStr === todayStr && (p.transaction_ref?.startsWith('REST-') || p.notes?.toLowerCase().includes('restaurant direct payment'));
      }).map(p => ({
        time: format(new Date(p.processed_at || p.created_at), 'HH:mm'),
        ref: p.transaction_ref,
        description: p.notes || 'Kitchen Order Direct Payment',
        amount: Number(p.amount),
        method: p.method
      }));

      const kitchenCharges = (bs || []).filter(item => {
        const dStr = format(new Date(item.updated_at || item.created_at), 'yyyy-MM-dd');
        return dStr === todayStr && (item.notes?.startsWith('restaurant_order:') || (item.services?.internal_notes?.toLowerCase() === 'restaurant' && !item.notes?.includes('pos_charge')));
      }).map(i => ({
        time: format(new Date(i.updated_at), 'HH:mm'),
        ref: i.bookings?.booking_reference || 'IN-HOUSE',
        description: `Room ${i.bookings?.rooms?.room_number || 'N/A'} Folio Charge - ${i.services?.name} (x${i.quantity})`,
        amount: Number(i.total_price_ngn),
        method: i.payment_status === 'paid' ? 'corporate_billed' : 'room_charge'
      }));

      const kitchenTxns = [...kitchenPayments, ...kitchenCharges];

      const totalRestaurantRev = restaurantPosTxns.reduce((sum, t) => sum + t.amount, 0);
      const totalKitchenRev = kitchenTxns.reduce((sum, t) => sum + t.amount, 0);

      setCloseOfDayReport({
        business_date: todayStr,
        restaurant_pos_txns: restaurantPosTxns,
        kitchen_txns: kitchenTxns,
        total_restaurant_revenue: totalRestaurantRev,
        total_kitchen_revenue: totalKitchenRev,
        total_revenue: totalRestaurantRev + totalKitchenRev,
        restaurant_count: restaurantPosTxns.length,
        kitchen_count: kitchenTxns.length,
        total_count: restaurantPosTxns.length + kitchenTxns.length
      });

      toast.dismiss(toastId);
      setIsCloseOfDayModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to compile Close of Day metrics: " + err.message, { id: toastId });
    } finally {
      setIsCompilingCloseOfDay(false);
    }
  };

  const handleConfirmCloseOfDayRestaurant = async () => {
    if (!closeOfDayReport) return;
    const toastId = toast.loading("Closing day and saving reports...");
    try {
      const todayStr = closeOfDayReport.business_date;

      // 1. Save closure state
      const closureRecord = {
        department: 'restaurant',
        business_date: todayStr,
        staff_id: profile?.id || 'unknown',
        staff_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        revenue: closeOfDayReport.total_revenue,
        transactions_count: closeOfDayReport.total_count,
        closed_at: new Date().toISOString()
      };

      let currentClosures = [];
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'departmental_closures').maybeSingle();
        if (data && data.setting_value) {
          currentClosures = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        }
      } catch {}

      const updatedClosures = [...currentClosures, closureRecord];

      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_closures',
        setting_value: updatedClosures
      }, { onConflict: 'setting_key' });

      // 2. Save detailed reports
      const reportRecord = {
        id: `dept_close_restaurant_${todayStr}`,
        department: 'restaurant',
        business_date: todayStr,
        staff_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        closed_at: new Date().toISOString(),
        total_revenue: closeOfDayReport.total_revenue,
        transactions_count: closeOfDayReport.total_count,
        details: {
          restaurant_revenue: closeOfDayReport.total_restaurant_revenue,
          kitchen_revenue: closeOfDayReport.total_kitchen_revenue,
          restaurant_count: closeOfDayReport.restaurant_count,
          kitchen_count: closeOfDayReport.kitchen_count
        },
        transactions: [
          ...closeOfDayReport.restaurant_pos_txns.map(t => ({ ...t, type: 'Restaurant POS' })),
          ...closeOfDayReport.kitchen_txns.map(t => ({ ...t, type: 'Kitchen Order' }))
        ]
      };

      let currentReports = [];
      try {
        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'departmental_close_reports').maybeSingle();
        if (data && data.setting_value) {
          currentReports = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        }
      } catch {}

      const updatedReports = [reportRecord, ...currentReports];

      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_close_reports',
        setting_value: updatedReports
      }, { onConflict: 'setting_key' });

      await supabase.from('system_logs').insert({
        user_id: profile?.id,
        log_type: 'activity',
        action: `Closed departmental ledger for RESTAURANT (including Kitchen) on date ${todayStr}. Revenue: ₦${closeOfDayReport.total_revenue.toLocaleString()}`,
        module: 'Accounting'
      });

      toast.success("✓ Restaurant & Kitchen close of day completed successfully!", { id: toastId });
      setIsCloseOfDayModalOpen(false);
      setDepartmentalClosures(updatedClosures);
    } catch (err) {
      console.error(err);
      toast.error("Failed to close business day: " + err.message, { id: toastId });
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('booking_services')
        .select(`
          *,
          bookings (
            id,
            booking_reference,
            guest_name,
            guest_email,
            crm_guest_id,
            status,
            group_account_id,
            rooms (room_number, name),
            group_accounts (id, name, outstanding_balance)
          ),
          services (
            id,
            name,
            category,
            base_price_ngn,
            internal_notes
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter to restaurant services orders
      const filtered = (data || []).filter(item => 
        item.services?.internal_notes?.toLowerCase() === 'restaurant' ||
        item.services?.name?.toLowerCase().includes('breakfast')
      );

      setOrders(filtered);
    } catch (err) {
      console.error('Error fetching restaurant orders:', err);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Status handlers
  const handlePostToKitchen = async (orderId) => {
    if (isRestaurantClosed) {
      return toast.error("Restaurant & Kitchen operations are locked due to daily ledger closure.");
    }
    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ status: 'scheduled' })
        .eq('id', orderId);

      if (error) throw error;
      toast.success('Order dispatched to Kitchen queue!');
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('Failed to dispatch order');
    }
  };

  // Open Kitchen preparation modal
  const openPrepModal = (order) => {
    setSelectedOrder(order);
    setChefPrice(order.unit_price_ngn || order.services?.base_price_ngn || '');
    setChefNotes('');
    setIsPrepModalOpen(true);
  };

  // Submit ready status from kitchen
  const handleMarkReady = async (e) => {
    e.preventDefault();
    if (isRestaurantClosed) {
      return toast.error("Restaurant & Kitchen operations are locked due to daily ledger closure.");
    }
    if (!chefPrice || Number(chefPrice) <= 0) {
      return toast.error('Please enter a valid final meal price');
    }

    setIsSubmittingPrep(true);
    try {
      const finalPrice = Number(chefPrice);
      const quantity = selectedOrder.quantity || 1;
      const totalPrice = finalPrice * quantity;
      
      // Update booking service with ready info
      // Keep restaurant_order prefix but append chef notes inside comments
      const updatedNotes = `${selectedOrder.notes} | chef_notes: ${chefNotes || 'Prepared by chef'}`;

      const { error } = await supabase
        .from('booking_services')
        .update({
          status: 'in_progress', // Ready / Notified
          unit_price_ngn: finalPrice,
          total_price_ngn: totalPrice,
          notes: updatedNotes
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;
      toast.success('Meal marked as ready! Restaurant desk notified.');
      setIsPrepModalOpen(false);
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update kitchen order');
    } finally {
      setIsSubmittingPrep(false);
    }
  };

  // Open billing confirmation modal
  const openBillingModal = async (order) => {
    setSelectedOrder(order);
    setBillingOption('room');
    setIsBillingModalOpen(true);
    setGuestWalletProfile(null);
    
    const crmGuestId = order.bookings?.crm_guest_id;
    const guestEmail = order.bookings?.guest_email;
    
    if (crmGuestId || guestEmail) {
      setLoadingWallet(true);
      try {
        let profile = null;
        if (crmGuestId) {
          const { data } = await supabase.from('crm_guests').select('*').eq('id', crmGuestId).maybeSingle();
          profile = data;
        } else if (guestEmail) {
          const { data } = await supabase.from('crm_guests').select('*').eq('email', guestEmail.toLowerCase()).maybeSingle();
          profile = data;
        }
        setGuestWalletProfile(profile);
      } catch (err) {
        console.warn("Failed to fetch guest wallet profile for restaurant billing:", err);
      } finally {
        setLoadingWallet(false);
      }
    }
  };

  // Deliver and process billing
  const handleConfirmDelivery = async () => {
    if (isRestaurantClosed) {
      return toast.error("Restaurant & Kitchen operations are locked due to daily ledger closure.");
    }
    setIsSubmittingBilling(true);
    try {
      const booking = selectedOrder.bookings;
      const finalPriceTotal = Number(selectedOrder.total_price_ngn || 0);

      if (billingOption === 'group') {
        const groupAccountId = booking.group_account_id;
        const groupAccountName = booking.group_accounts?.name || 'Corporate Group';
        
        // 1. Fetch current balance
        const { data: groupAcc, error: accErr } = await supabase
          .from('group_accounts')
          .select('outstanding_balance')
          .eq('id', groupAccountId)
          .single();
        
        if (accErr) throw accErr;
        const currentOutstanding = Number(groupAcc?.outstanding_balance || 0);

        // 2. Increment group outstanding balance
        const { error: updErr } = await supabase
          .from('group_accounts')
          .update({ outstanding_balance: currentOutstanding + finalPriceTotal })
          .eq('id', groupAccountId);
        
        if (updErr) throw updErr;

        // 3. Log payment transaction inside 'payments'
        const txnRef = `CORP-CHG-REST-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const { error: payErr } = await supabase.from('payments').insert([{
          booking_id: booking.id,
          amount: finalPriceTotal,
          method: 'corporate_billed',
          status: 'completed',
          notes: `Restaurant Room Service - Corporate Charge | Billed to Group: ${groupAccountName} | Room ${booking.rooms?.room_number} | Meal: ${selectedOrder.services?.name} x${selectedOrder.quantity}`,
          transaction_ref: txnRef
        }]);

        if (payErr) throw payErr;

        // 4. Set service status to completed & paid
        const { error: srvErr } = await supabase
          .from('booking_services')
          .update({ 
            status: 'completed', 
            payment_status: 'paid' 
          })
          .eq('id', selectedOrder.id);
        
        if (srvErr) throw srvErr;

        toast.success(`✓ Order delivered! Billed ₦${finalPriceTotal.toLocaleString()} successfully to Corporate Group Account.`);
      } else if (billingOption === 'ar') {
        if (!guestWalletProfile) {
          toast.error("CRM Guest Profile not found. Cannot charge to AR Prepayment Wallet.");
          setIsSubmittingBilling(false);
          return;
        }

        const walletBal = Number(guestWalletProfile.wallet_balance || 0);
        if (walletBal < finalPriceTotal) {
          toast.error(`Insufficient AR prepayment wallet balance. Available: ₦${walletBal.toLocaleString()}`);
          setIsSubmittingBilling(false);
          return;
        }

        const newWalletBalance = walletBal - finalPriceTotal;

        // 1. Deduct balance from crm_guests
        const { error: walletErr } = await supabase
          .from('crm_guests')
          .update({ wallet_balance: newWalletBalance })
          .eq('id', guestWalletProfile.id);

        if (walletErr) throw walletErr;

        // 2. Synchronize ar_accounts balance
        let arAccountsList = [];
        try {
          const { data } = await supabase.from('ar_accounts').select('*');
          if (data) arAccountsList = data;
        } catch {}
        
        const existingAr = arAccountsList.find(a => a.guest_id === guestWalletProfile.id);
        const updatedArRecord = {
          id: existingAr ? existingAr.id : `ar_` + Math.random().toString(36).substring(2, 9).toUpperCase(),
          guest_id: guestWalletProfile.id,
          guest_name: `${guestWalletProfile.first_name || ''} ${guestWalletProfile.last_name || ''}`.trim() || guestWalletProfile.guest_name || 'Unnamed Guest',
          guest_email: guestWalletProfile.email || 'N/A',
          balance: newWalletBalance,
          status: 'active',
          created_at: existingAr ? existingAr.created_at : new Date().toISOString()
        };

        try {
          await supabase.from('ar_accounts').upsert([updatedArRecord]);
        } catch (err) {
          console.warn("ar_accounts upsert fallback in restaurant billing", err);
        }

        // 3. Increment booking paid amount in bookings table
        const { data: bookingData, error: bookErr } = await supabase
          .from('bookings')
          .select('amount_paid_ngn')
          .eq('id', booking.id)
          .single();

        if (bookErr) throw bookErr;
        const currentPaid = Number(bookingData.amount_paid_ngn || 0);
        const newPaid = currentPaid + finalPriceTotal;

        const { error: bUpdateErr } = await supabase
          .from('bookings')
          .update({ amount_paid_ngn: newPaid })
          .eq('id', booking.id);

        if (bUpdateErr) throw bUpdateErr;

        // 4. Log payment transaction inside 'payments' (use method: 'cash' and notes containing 'AR Prepayment Wallet')
        const txnRef = `AR-BK-REST-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const { error: payErr } = await supabase.from('payments').insert([{
          booking_id: booking.id,
          amount: finalPriceTotal,
          method: 'cash',
          status: 'completed',
          notes: `Paid from Guest AR Prepayment Wallet for Restaurant Room Service | Room ${booking.rooms?.room_number} | Meal: ${selectedOrder.services?.name} x${selectedOrder.quantity} for guest: ${guestWalletProfile.first_name} ${guestWalletProfile.last_name} (${guestWalletProfile.email || 'N/A'})`,
          transaction_ref: txnRef
        }]);

        if (payErr) throw payErr;

        // 5. Set service status to completed & paid
        const { error: srvErr } = await supabase
          .from('booking_services')
          .update({ 
            status: 'completed', 
            payment_status: 'paid' 
          })
          .eq('id', selectedOrder.id);
        
        if (srvErr) throw srvErr;

        toast.success(`✓ Order delivered! Deducted ₦${finalPriceTotal.toLocaleString()} successfully from Guest AR Prepayment Wallet.`);
      } else if (['cash', 'pos', 'bank_transfer'].includes(billingOption)) {
        // Direct cash, pos, or bank transfer payment at delivery
        // 1. Insert payment record into 'payments' table
        const txnRef = `REST-${billingOption.toUpperCase().slice(0,3)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const { error: payErr } = await supabase.from('payments').insert([{
          booking_id: booking.id,
          amount: finalPriceTotal,
          method: billingOption,
          status: 'completed',
          notes: `Restaurant Direct Payment [${billingOption.toUpperCase()}] | Room ${booking.rooms?.room_number} | Meal: ${selectedOrder.services?.name} x${selectedOrder.quantity} | outlet: restaurant`,
          transaction_ref: txnRef
        }]);

        if (payErr) throw payErr;

        // 2. Set service status to completed & paid
        const { error: srvErr } = await supabase
          .from('booking_services')
          .update({ 
            status: 'completed', 
            payment_status: 'paid' 
          })
          .eq('id', selectedOrder.id);
        
        if (srvErr) throw srvErr;

        toast.success(`✓ Order delivered! Received ₦${finalPriceTotal.toLocaleString()} successfully via ${billingOption.toUpperCase()}.`);
      } else {
        // Individual room stay folio charge
        // Setting status to 'completed' and 'unpaid' triggers auto-update on stay folio invoices via DB trigger
        const { error: srvErr } = await supabase
          .from('booking_services')
          .update({ 
            status: 'completed', 
            payment_status: 'unpaid' 
          })
          .eq('id', selectedOrder.id);
        
        if (srvErr) throw srvErr;

        toast.success(`✓ Order delivered! Charged ₦${finalPriceTotal.toLocaleString()} to Room ${booking.rooms?.room_number} Folio.`);
      }

      setIsBillingModalOpen(false);
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error('Failed to complete delivery billing');
    } finally {
      setIsSubmittingBilling(false);
    }
  };

  // Filters
  const filteredOrders = orders.filter(o => {
    // Only show orders for guests that have actually checked in
    if (o.bookings?.status !== 'checked_in') return false;

    const guestName = o.bookings?.guest_name || '';
    const roomNum = o.bookings?.rooms?.room_number || '';
    const mealName = o.services?.name || '';
    const query = searchQuery.toLowerCase();
    
    return guestName.toLowerCase().includes(query) || 
           roomNum.toLowerCase().includes(query) ||
           mealName.toLowerCase().includes(query);
  });

  const pendingOrders = filteredOrders.filter(o => o.status === 'confirmed' || o.status === 'pending');
  const prepOrders = filteredOrders.filter(o => o.status === 'scheduled');
  const readyOrders = filteredOrders.filter(o => o.status === 'in_progress');
  const completedOrders = filteredOrders.filter(o => o.status === 'completed');

  // Parse notes to display guest special instructions
  const parseNotes = (notesStr, type) => {
    if (!notesStr) return '';
    if (type === 'guest') {
      const parts = notesStr.split('|');
      const guestPart = parts[0].replace('restaurant_order:', '').trim();
      return guestPart || 'None';
    } else if (type === 'chef') {
      const parts = notesStr.split('|');
      if (parts.length > 1) {
        return parts[1].replace('chef_notes:', '').trim();
      }
      return '';
    }
    return notesStr;
  };

  return (
    <div className="min-h-screen pb-12 text-white">
      {isRestaurantClosed && (
        <div className="bg-red-500/10 border-2 border-red-500/35 text-red-200 p-4 rounded-xl flex items-center gap-4 shadow-lg shadow-red-500/5 animate-pulse mb-6">
          <AlertTriangle size={24} className="text-red-500 animate-bounce flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-white">Restaurant & Kitchen Operations Locked</h4>
            <p className="text-xs text-red-300/95 mt-0.5 font-medium">
              All restaurant and kitchen operations including kitchen ticket completions, order preparations dispatches, status checkmarks, cooking progress checks, and food catalog configuration adjustments are locked. Contact an authorized manager to re-open the ledger.
            </p>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <ChefHat className="text-brand-500 w-9 h-9" />
            Restaurant & Kitchen Operations
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage guest room-service orders, coordinate kitchen meal preparations, and handle corporate or guest folio billing.
          </p>
        </div>

        {/* Operational Desks Selector */}
        <div className="flex items-center gap-3">
          {(() => {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const closure = departmentalClosures.find(c => c.department === 'restaurant' && c.business_date === todayStr);
            return closure ? (
              <div className="bg-green-500/10 text-green-400 border border-green-500/25 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                <span>Closed today by {closure.staff_name}</span>
              </div>
            ) : (
              <button 
                onClick={handleCompileCloseOfDayRestaurant}
                disabled={isCompilingCloseOfDay}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-dark-950 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Clock size={14} />
                <span>Close of Day</span>
              </button>
            );
          })()}

          <div className="flex bg-dark-800 p-1.5 rounded-2xl border border-dark-700/60 shadow-lg">
          {canAccessRestaurantDesk && (
            <button 
              onClick={() => setViewMode('restaurant')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewMode === 'restaurant' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <Utensils size={14} />
              <span>Restaurant Desk</span>
            </button>
          )}
          {canAccessKitchenDesk && (
            <button 
              onClick={() => setViewMode('kitchen')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewMode === 'kitchen' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <ChefHat size={14} />
              <span>Kitchen Desk</span>
            </button>
          )}
          {(canAccessRestaurantDesk || canAccessKitchenDesk || user?.role === 'super_admin') && (
            <button 
              onClick={() => setViewMode('catering')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewMode === 'catering' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <ChefHat size={14} />
              <span>Hall Catering</span>
            </button>
          )}
          {canAccessOrderHistory && (
            <button 
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewMode === 'history' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <Clock size={14} />
              <span>Orders History</span>
            </button>
          )}
          {canAccessRestaurantDesk && (
            <button 
              onClick={() => setViewMode('menu')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewMode === 'menu' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <BookOpen size={14} />
              <span>Menu Management</span>
            </button>
          )}
          {canAccessRestaurantDesk && (
            <button 
              onClick={() => setViewMode('catering_meals')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${viewMode === 'catering_meals' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <Coffee size={14} />
              <span>Hall Meal Packages</span>
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Main operational sections */}
      {viewMode === 'catering_meals' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white text-left">Separate Catering Menu for Halls</h3>
              <p className="text-gray-400 text-xs mt-1 text-left">Define and manage specific meal courses and packages charged per participant for hall events.</p>
            </div>
            <button 
              onClick={() => {
                setEditingMeal(null);
                setMealForm({
                  name: '', course_type: 'Breakfast Tea', combination_items: '',
                  price_per_participant_ngn: 5000, is_active: true
                });
                setIsMealModalOpen(true);
              }}
              disabled={isRestaurantClosed}
              className="bg-brand-600 hover:bg-brand-500 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all text-white border-0 cursor-pointer disabled:opacity-50"
            >
              <Plus size={16} /> Add Catering Package
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-dark-700/50">
            <table className="w-full text-left text-sm">
              <thead className="bg-dark-900 text-gray-400 uppercase tracking-wider text-xs border-b border-dark-700">
                <tr>
                  <th className="p-4">Package Name</th>
                  <th className="p-4">Course Segment</th>
                  <th className="p-4">Combination Items</th>
                  <th className="p-4">Price Per pax / Day</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {mealOptions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">No catering packages defined yet.</td>
                  </tr>
                )}
                {mealOptions.map(meal => (
                  <tr key={meal.id} className="hover:bg-dark-700/35 transition-colors">
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      <Utensils size={16} className="text-amber-500" /> {meal.name}
                    </td>
                    <td className="p-4 font-semibold text-brand-400">{meal.course_type}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {meal.combination_items?.map((item, idx) => (
                          <span key={idx} className="bg-dark-900 border border-dark-750 px-2 py-0.5 text-xs text-gray-300 rounded-lg">{item}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-gold-500 font-mono">₦{Number(meal.price_per_participant_ngn).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs border ${meal.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {meal.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button 
                        onClick={() => {
                          setEditingMeal(meal);
                          setMealForm({
                            name: meal.name,
                            course_type: meal.course_type,
                            combination_items: meal.combination_items?.join(', ') || '',
                            price_per_participant_ngn: meal.price_per_participant_ngn,
                            is_active: meal.is_active
                          });
                          setIsMealModalOpen(true);
                        }}
                        className="text-gold-500 hover:text-gold-400 font-bold text-xs cursor-pointer bg-transparent border-0"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteMeal(meal.id)}
                        className="text-red-500 hover:text-red-400 font-bold text-xs cursor-pointer bg-transparent border-0"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main operational sections */}
      {viewMode === 'restaurant' && (
        <div className="space-y-6">
          {/* Restaurant Sub-tabs navigation */}
          <div className="flex items-center justify-between border-b border-dark-700/50 pb-3">
            <div className="flex gap-2">
              {[
                { id: 'pending', label: 'Pending Orders', count: pendingOrders.length, color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
                { id: 'prep', label: 'In Kitchen Preparation', count: prepOrders.length, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                { id: 'ready', label: 'Ready Meals', count: readyOrders.length, color: 'bg-green-500/10 text-green-400 border-green-500/20' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRestaurantTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all ${
                    restaurantTab === tab.id 
                      ? 'bg-brand-500/15 border-brand-500/35 text-white' 
                      : 'border-transparent text-gray-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-lg border font-black ${tab.color}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick search input */}
            <div className="relative w-72">
              <Search className="absolute left-3.5 top-2.5 text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search orders, rooms..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700/60 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-brand-500 transition-all text-white"
              />
            </div>
          </div>

          {/* Tab contents */}
          {loading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500 mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Synchronizing operations feeds...</p>
            </div>
          ) : (
            <>
              {/* PENDING ORDERS VIEW */}
              {restaurantTab === 'pending' && (
                pendingOrders.length === 0 ? (
                  <div className="glass-panel p-16 text-center rounded-3xl border border-dark-700/50">
                    <ShoppingBag className="mx-auto mb-3 opacity-30 text-gray-500" size={36} />
                    <h3 className="text-lg font-bold text-white mb-1">No pending orders</h3>
                    <p className="text-gray-500 text-xs">New guest room orders will show up here in real-time.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingOrders.map(order => (
                      <div key={order.id} className="glass-panel border border-dark-700/50 p-5 rounded-2xl flex flex-col justify-between h-fit relative">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                              Order Received
                            </span>
                            <h4 className="text-base font-extrabold text-white mt-2 leading-tight">{order.services?.name}</h4>
                            <p className="text-xs text-gray-400 mt-1">Quantity: <span className="font-bold text-white">{order.quantity}</span></p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500 block font-mono">Room {order.bookings?.rooms?.room_number}</span>
                            <span className="text-[10px] text-gray-400 font-semibold block truncate max-w-[120px]">{order.bookings?.guest_name}</span>
                          </div>
                        </div>

                        <div className="bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs text-gray-400 space-y-1.5 mb-4">
                          <p className="font-medium text-gray-300">Guest Instructions:</p>
                          <p className="italic leading-normal text-gray-400">"{parseNotes(order.notes, 'guest')}"</p>
                        </div>

                        <div className="border-t border-dark-750 pt-4 flex justify-between items-center">
                          <div>
                            <span className="text-xs text-gray-500 block">Est. Price</span>
                            <span className="text-base font-black text-white">₦{Number(order.unit_price_ngn || order.services?.base_price_ngn || 0).toLocaleString()}</span>
                          </div>

                          <button
                            onClick={() => handlePostToKitchen(order.id)}
                            disabled={isRestaurantClosed}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${isRestaurantClosed ? 'bg-dark-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-brand-500 hover:bg-brand-600 text-dark-950 active:scale-95'}`}
                          >
                            <span>Post to Kitchen</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ACTIVE PREPARATION VIEW */}
              {restaurantTab === 'prep' && (
                prepOrders.length === 0 ? (
                  <div className="glass-panel p-16 text-center rounded-3xl border border-dark-700/50">
                    <ChefHat className="mx-auto mb-3 opacity-30 text-gray-500 animate-pulse" size={36} />
                    <h3 className="text-lg font-bold text-white mb-1">Kitchen queue is empty</h3>
                    <p className="text-gray-500 text-xs">No orders are currently in active chef preparation.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {prepOrders.map(order => (
                      <div key={order.id} className="glass-panel border border-dark-700/50 p-5 rounded-2xl flex flex-col justify-between h-fit relative">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
                              <Clock size={10} className="animate-spin" />
                              Preparing...
                            </span>
                            <h4 className="text-base font-extrabold text-white mt-2 leading-tight">{order.services?.name}</h4>
                            <p className="text-xs text-gray-400 mt-1">Quantity: <span className="font-bold text-white">{order.quantity}</span></p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500 block font-mono">Room {order.bookings?.rooms?.room_number}</span>
                            <span className="text-[10px] text-gray-400 font-semibold block truncate max-w-[120px]">{order.bookings?.guest_name}</span>
                          </div>
                        </div>

                        <div className="bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs text-gray-400 space-y-1.5 mb-4">
                          <p className="font-medium text-gray-300">Guest Instructions:</p>
                          <p className="italic leading-normal text-gray-400">"{parseNotes(order.notes, 'guest')}"</p>
                        </div>

                        <div className="border-t border-dark-750 pt-4 flex justify-between items-center text-xs text-gray-500">
                          <span>Dispatched to chef</span>
                          <span className="font-mono">{format(new Date(order.updated_at || order.created_at), 'HH:mm (MMM dd)')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* READY MEALS / NOTIFIED VIEW */}
              {restaurantTab === 'ready' && (
                readyOrders.length === 0 ? (
                  <div className="glass-panel p-16 text-center rounded-3xl border border-dark-700/50">
                    <CheckCircle className="mx-auto mb-3 opacity-30 text-gray-500" size={36} />
                    <h3 className="text-lg font-bold text-white mb-1">No meals ready for delivery</h3>
                    <p className="text-gray-500 text-xs">Meals marked ready by the chef queue will appear here for checkout.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {readyOrders.map(order => (
                      <div key={order.id} className="glass-panel border border-brand-500/20 p-5 rounded-2xl flex flex-col justify-between h-fit relative shadow-[0_4px_20px_rgba(230,160,30,0.05)]">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 rounded-bl-full" />
                        
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                              Meal Ready / Waiter Notify
                            </span>
                            <h4 className="text-base font-extrabold text-white mt-2 leading-tight">{order.services?.name}</h4>
                            <p className="text-xs text-gray-400 mt-1">Quantity: <span className="font-bold text-white">{order.quantity}</span></p>
                          </div>
                          <div className="text-right z-10">
                            <span className="text-xs text-gray-500 block font-mono">Room {order.bookings?.rooms?.room_number}</span>
                            <span className="text-[10px] text-gray-400 font-semibold block truncate max-w-[120px]">{order.bookings?.guest_name}</span>
                          </div>
                        </div>

                        <div className="bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs space-y-1.5 mb-4">
                          <p className="font-bold text-brand-400">Chef Comments:</p>
                          <p className="italic leading-normal text-gray-300">"{parseNotes(order.notes, 'chef') || 'No chef comments.'}"</p>
                        </div>

                        <div className="border-t border-dark-750 pt-4 flex justify-between items-center">
                          <div>
                            <span className="text-xs text-gray-500 block">Final Price</span>
                            <span className="text-base font-black text-brand-400">₦{Number(order.total_price_ngn || 0).toLocaleString()}</span>
                          </div>

                          <button
                            onClick={() => openBillingModal(order)}
                            disabled={isRestaurantClosed}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${isRestaurantClosed ? 'bg-dark-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-green-500 hover:bg-green-600 text-dark-950 active:scale-95'}`}
                          >
                            <Check size={14} className="stroke-[3]" />
                            <span>Deliver & Charge</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {viewMode === 'kitchen' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-dark-700/50 pb-3">
            <div>
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <ChefHat className="text-brand-500" />
                Kitchen Preparation Queue
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">Manage live meal orders and submit prep outcomes back to front desk.</p>
            </div>
            
            {/* Quick search input */}
            <div className="relative w-72">
              <Search className="absolute left-3.5 top-2.5 text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search chef tickets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700/60 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-brand-500 transition-all text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500 mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Synchronizing chef queue...</p>
            </div>
          ) : prepOrders.length === 0 ? (
            <div className="glass-panel p-20 text-center rounded-3xl border border-dark-700/50 max-w-xl mx-auto mt-6">
              <ChefHat className="mx-auto mb-4 opacity-20 text-brand-500 animate-bounce" size={48} />
              <h3 className="text-xl font-bold text-white mb-2">Chef queue is cleared!</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Excellent. All dispatched orders have been prepared and logged. 
                Keep this window open to receive real-time chits as restaurant staff submits them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prepOrders.map(order => (
                <div key={order.id} className="glass-panel border border-brand-500/10 p-5 rounded-2xl flex flex-col justify-between h-fit relative">
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-mono text-gray-500 bg-dark-900 border border-dark-750 px-2 py-0.5 rounded">
                    <Clock size={10} />
                    <span>Dispatched {format(new Date(order.updated_at || order.created_at), 'HH:mm')}</span>
                  </div>

                  <div className="mb-4">
                    <span className="text-[9px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2.5 py-0.5 rounded font-black uppercase tracking-wider">
                      Chef Ticket
                    </span>
                    <h3 className="text-lg font-bold text-white mt-2 leading-tight">{order.services?.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">Quantity: <span className="font-bold text-white">{order.quantity}</span></p>
                  </div>

                  <div className="bg-dark-900 border border-dark-750 p-4 rounded-xl text-xs space-y-2 mb-6">
                    <p className="font-extrabold text-gray-300">Preparation & Dietary Instructions:</p>
                    <p className="italic text-brand-400/90 leading-relaxed font-medium">
                      "{parseNotes(order.notes, 'guest')}"
                    </p>
                  </div>

                  <div className="border-t border-dark-750 pt-4 flex justify-between items-center">
                    <div>
                      <span className="text-xs text-gray-500 block">Suite Suite</span>
                      <span className="text-sm font-bold text-white font-mono">Room {order.bookings?.rooms?.room_number}</span>
                    </div>

                    <button
                      onClick={() => openPrepModal(order)}
                      disabled={isRestaurantClosed}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${isRestaurantClosed ? 'bg-dark-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-brand-500 hover:bg-brand-600 text-dark-950 active:scale-95'}`}
                    >
                      <ChefHat size={14} />
                      <span>Prepare & Set Price</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'history' && (
        <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-dark-700/60 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Clock className="text-brand-500" />
                Historic Delivered Orders Log
              </h2>
              <p className="text-gray-500 text-xs mt-1">Review finalized meal checkouts and delivery history log.</p>
            </div>
            
            <button 
              onClick={fetchOrders} 
              className="bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white px-4 py-2 border border-brand-500/20 rounded-xl text-xs font-bold transition-all"
            >
              Refresh Log
            </button>
          </div>

          <div className="relative w-full max-w-sm mb-2">
            <Search className="absolute left-3.5 top-2.5 text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search historical records..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700/60 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-brand-500 transition-all text-white"
            />
          </div>

          {loading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500 mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Retrieving historic log...</p>
            </div>
          ) : completedOrders.length === 0 ? (
            <div className="py-24 text-center text-gray-500">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-30 animate-pulse" />
              <p className="text-sm">No meal services successfully delivered today.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-dark-700 bg-dark-900/20">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-900/60 border-b border-dark-700 text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-bold">Timestamp</th>
                    <th className="p-4 font-bold">Room / Guest</th>
                    <th className="p-4 font-bold">Meal Name</th>
                    <th className="p-4 font-bold">Qty</th>
                    <th className="p-4 font-bold">Price Details</th>
                    <th className="p-4 font-bold">Settlement</th>
                    <th className="p-4 font-bold">Chef Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700 text-xs">
                  {completedOrders.map(item => (
                    <tr key={item.id} className="hover:bg-dark-700/20 transition-colors">
                      <td className="p-4 text-gray-400 font-mono">
                        {format(new Date(item.updated_at || item.created_at), 'MMM dd, HH:mm')}
                      </td>
                      <td className="p-4">
                        <span className="text-white font-bold block">Room {item.bookings?.rooms?.room_number}</span>
                        <span className="text-gray-500 block text-[10px] max-w-[150px] truncate">{item.bookings?.guest_name}</span>
                      </td>
                      <td className="p-4 text-white font-extrabold">
                        {item.services?.name}
                      </td>
                      <td className="p-4 text-gray-300 font-bold">
                        {item.quantity}
                      </td>
                      <td className="p-4">
                        <span className="text-white font-bold block">₦{Number(item.total_price_ngn || 0).toLocaleString()}</span>
                        <span className="text-gray-500 block text-[10px]">₦{Number(item.unit_price_ngn || 0).toLocaleString()} /unit</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                          item.payment_status === 'paid' 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : 'bg-yellow-500/10 text-yellow-450 border border-yellow-500/20'
                        }`}>
                          {item.payment_status === 'paid' ? 'Corp Billed (Paid)' : 'Stay Folio (Unpaid)'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 italic max-w-[200px] truncate" title={parseNotes(item.notes, 'chef')}>
                        {parseNotes(item.notes, 'chef') || 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewMode === 'menu' && (
        <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-dark-700/60 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Utensils className="text-brand-500" />
                Food Menu Catalog Management
              </h2>
              <p className="text-gray-500 text-xs mt-1">Create, update, or deactivate items shown on guest menus and front desk folio panels.</p>
            </div>
            
            <button 
              onClick={() => {
                if (isRestaurantClosed) return toast.error("Restaurant & Kitchen operations are locked due to daily ledger closure.");
                setEditingMenuItem(null);
                setMenuForm({ name: '', description: '', base_price_ngn: '', is_active: true, segment: 'Lunch' });
                setIsMenuModalOpen(true);
              }} 
              disabled={isRestaurantClosed}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-brand-500/10 ${isRestaurantClosed ? 'bg-dark-700 text-gray-500 cursor-not-allowed opacity-50' : 'bg-brand-500 hover:bg-brand-600 text-dark-950'}`}
            >
              <Plus size={14} />
              Create Food Item
            </button>
          </div>

          {/* Segment Filter Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-dark-700/50 pb-3">
            {['All', ...MENU_SEGMENTS].map(seg => {
              const count = seg === 'All' 
                ? menuItems.length 
                : menuItems.filter(item => parseDescription(item.description).segment === seg).length;
              
              return (
                <button
                  key={seg}
                  onClick={() => setActiveMenuSegment(seg)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all ${
                    activeMenuSegment === seg 
                      ? 'bg-brand-500/15 border-brand-500/35 text-white' 
                      : 'border-transparent text-gray-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <span>{seg}</span>
                  <span className="px-1.5 py-0.2 text-[9px] rounded-md bg-dark-900 border border-dark-700 text-gray-400 font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {menuLoading ? (
            <div className="text-center py-20 text-gray-500 font-bold">Loading restaurant food menu...</div>
          ) : menuItems.length === 0 ? (
            <div className="text-center py-20 text-gray-500 border border-dashed border-dark-700 rounded-2xl bg-dark-900/30">
              <Utensils size={40} className="mx-auto text-gray-600 mb-3 animate-pulse" />
              <p className="text-xs">No food items defined in the restaurant menu.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {menuItems.filter(item => {
                if (activeMenuSegment === 'All') return true;
                return parseDescription(item.description).segment === activeMenuSegment;
              }).map(item => {
                const { segment, text } = parseDescription(item.description);
                return (
                  <div key={item.id} className="bg-dark-900/60 border border-dark-750 p-5 rounded-2xl shadow-md flex flex-col justify-between space-y-4 hover:border-brand-500/20 transition-all duration-350">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="font-extrabold text-white text-sm leading-snug">{item.name}</h3>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <span className="px-2 py-0.5 text-[8px] font-black rounded-full uppercase border bg-brand-500/10 text-brand-400 border-brand-500/20">
                            {segment}
                          </span>
                          <span className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase border ${
                            item.is_active 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      {text && <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{text}</p>}
                    </div>
                    <div className="flex justify-between items-center border-t border-dark-750 pt-3">
                      <span className="text-emerald-400 font-mono font-black text-sm">₦{Number(item.base_price_ngn).toLocaleString()}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (isRestaurantClosed) return toast.error("Restaurant & Kitchen operations are locked due to daily ledger closure.");
                            const { segment: itemSeg, text: itemText } = parseDescription(item.description);
                            setEditingMenuItem(item);
                            setMenuForm({
                              name: item.name,
                              description: itemText,
                              base_price_ngn: item.base_price_ngn,
                              is_active: item.is_active,
                              segment: itemSeg
                            });
                            setIsMenuModalOpen(true);
                          }}
                          disabled={isRestaurantClosed}
                          className={`text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all ${isRestaurantClosed ? 'bg-dark-800 text-gray-500 border-dark-700 opacity-50 cursor-not-allowed' : 'text-gray-300 hover:text-white bg-dark-800 hover:bg-dark-750 border-dark-700'}`}
                        >
                          Edit
                        </button>
                      <button
                        onClick={() => {
                          if (isRestaurantClosed) return toast.error("Restaurant & Kitchen operations are locked due to daily ledger closure.");
                          handleToggleMenuStatus(item);
                        }}
                        disabled={isRestaurantClosed}
                        className={`text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all ${
                          isRestaurantClosed 
                            ? 'bg-dark-800 text-gray-500 border-dark-700 opacity-50 cursor-not-allowed'
                            : item.is_active 
                              ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' 
                              : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                        }`}
                      >
                        {item.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}

      {viewMode === 'catering' && (
        <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-dark-700/60 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <ChefHat className="text-gold-500" />
                Hall Rental Catering & Group Feeding Calendar
              </h2>
              <p className="text-gray-500 text-xs mt-1">Manage serving schedules, preparations, and routing statuses for events and hall rental meals.</p>
            </div>
          </div>

          {/* Status Sub-Tabs */}
          <div className="flex bg-dark-900/50 p-1 rounded-xl border border-dark-800/80 max-w-md">
            {['pending', 'preparing', 'ready', 'served'].map((status) => {
              const count = cateringMeals.filter(m => m.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setCateringTab(status)}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg capitalize transition-all ${
                    cateringTab === status 
                      ? 'bg-gold-500 text-dark-950 shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {status} ({count})
                </button>
              );
            })}
          </div>

          {/* Catering Meals List */}
          {cateringLoading ? (
            <div className="text-center py-20 text-gray-500 font-bold">Loading catering schedule...</div>
          ) : (
            (() => {
              const filtered = cateringMeals.filter(m => m.status === cateringTab);
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-20 text-gray-550 border border-dashed border-dark-700 rounded-2xl bg-dark-900/30">
                    <Utensils size={40} className="mx-auto text-gray-600 mb-3 animate-pulse" />
                    <p className="font-bold text-sm text-gray-400">No {cateringTab} catering orders found.</p>
                    <p className="text-xs text-gray-600 mt-1">Catering orders will appear here day-by-day based on active hall bookings.</p>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map((meal) => {
                    const hallBookingObj = meal.hall_bookings || {};
                    const hallObj = hallBookingObj.halls || {};
                    const optionObj = meal.hall_meal_options || {};
                    
                    return (
                      <div key={meal.id} className="bg-dark-900/40 border border-dark-750 p-5 rounded-2xl flex flex-col justify-between hover:border-gray-500 transition-all duration-300 relative text-left">
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <span className="text-[10px] bg-gold-500/10 text-gold-500 px-2 py-0.5 rounded border border-gold-500/20 font-bold uppercase tracking-wider">
                                {meal.course_type}
                              </span>
                              <h4 className="text-white font-bold text-base mt-1.5">{optionObj.name || meal.course_type}</h4>
                            </div>
                            <span className="text-xs text-gray-400 font-mono font-bold bg-dark-800 px-2 py-1 border border-dark-700 rounded">
                              {format(new Date(meal.serving_date), 'MMM dd, yyyy')}
                            </span>
                          </div>

                          <div className="border-t border-dark-800 my-3 pt-3 space-y-2 text-xs text-gray-400">
                            <div className="flex justify-between">
                              <span>Venue / Hall:</span>
                              <span className="text-white font-semibold">{hallObj.name || 'Event Hall'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Booking Ref:</span>
                              <span className="text-brand-400 font-mono font-bold">{hallBookingObj.booking_reference}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Guest Name:</span>
                              <span className="text-white font-semibold">{hallBookingObj.guest_name}</span>
                            </div>
                            {hallBookingObj.organization_name && (
                              <div className="flex justify-between">
                                <span>Organization:</span>
                                <span className="text-gold-400 font-semibold">{hallBookingObj.organization_name}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Serving Pax:</span>
                              <span className="text-white font-black text-sm flex items-center gap-1">
                                <Users size={12} className="text-gold-500" />
                                {meal.number_of_participants} participants
                              </span>
                            </div>
                          </div>

                          <div className="bg-dark-950/40 p-3 rounded-xl border border-dark-850 mt-4">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Combination Items</p>
                            <div className="flex flex-wrap gap-1">
                              {optionObj.combination_items?.map((item, idx) => (
                                <span key={idx} className="text-xs bg-dark-800 text-gray-300 px-2.5 py-0.5 rounded-md border border-dark-700 font-medium">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-dark-800 flex gap-2">
                          {meal.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateCateringStatus(meal.id, 'preparing')}
                              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-dark-950 text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer border-0"
                            >
                              <ChefHat size={14} />
                              <span>Start Preparing</span>
                            </button>
                          )}
                          {meal.status === 'preparing' && (
                            <button
                              onClick={() => handleUpdateCateringStatus(meal.id, 'ready')}
                              className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer border-0"
                            >
                              <Check size={14} />
                              <span>Mark Ready</span>
                            </button>
                          )}
                          {meal.status === 'ready' && (
                            <button
                              onClick={() => handleUpdateCateringStatus(meal.id, 'served')}
                              className="w-full py-2 bg-green-500 hover:bg-green-600 text-dark-950 text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer border-0"
                            >
                              <CheckCircle size={14} />
                              <span>Mark Served</span>
                            </button>
                          )}
                          {meal.status === 'served' && (
                            <div className="w-full py-2 bg-dark-800 text-gray-500 text-xs font-bold rounded-xl border border-dark-750 flex items-center justify-center gap-1.5">
                              <CheckCircle size={14} className="text-green-500" />
                              <span>Served & Completed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* KITCHEN CHEF PREP MODAL */}
      {isPrepModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel border border-brand-500/20 max-w-md w-full p-6 rounded-3xl shadow-2xl relative">
            <button 
              onClick={() => setIsPrepModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 hover:bg-dark-800 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-dark-750 pb-3">
              <ChefHat className="text-brand-500" size={24} />
              <h3 className="text-lg font-black text-white">Kitchen Prep Confirmation</h3>
            </div>

            <form onSubmit={handleMarkReady} className="space-y-4">
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Suite Selection</span>
                <span className="text-sm text-white font-extrabold">Room {selectedOrder.bookings?.rooms?.room_number} — {selectedOrder.bookings?.guest_name}</span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Meal Ordered</span>
                <span className="text-base text-brand-400 font-black">{selectedOrder.services?.name} (x{selectedOrder.quantity})</span>
              </div>

              <div className="bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs text-gray-400 space-y-1">
                <p className="font-bold text-gray-300">Guest Customization Instructions:</p>
                <p className="italic">"{parseNotes(selectedOrder.notes, 'guest')}"</p>
              </div>

              <div>
                <label className="block text-[10px] text-gray-450 font-bold uppercase tracking-wider mb-1">Set Meal Final Unit Price (₦)</label>
                <input 
                  type="number"
                  required
                  value={chefPrice}
                  onChange={e => setChefPrice(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full bg-dark-800 border border-dark-700/60 rounded-xl px-4 py-2.5 text-white outline-none focus:border-brand-500 font-mono text-sm font-semibold"
                />
                <p className="text-[9px] text-gray-500 mt-1">Allows setting adjustments if chef adds extra toppings or requests special premium ingredients.</p>
              </div>

              <div>
                <label className="block text-[10px] text-gray-450 font-bold uppercase tracking-wider mb-1">Chef's Prep Comments</label>
                <textarea 
                  value={chefNotes}
                  onChange={e => setChefNotes(e.target.value)}
                  placeholder="e.g. Cooked medium-rare. Replaced plantain with extra potatoes as requested."
                  className="w-full bg-dark-800 border border-dark-700/60 rounded-xl p-3 text-xs outline-none focus:border-brand-500 min-h-[80px] resize-none text-white leading-normal"
                />
              </div>

              <div className="flex gap-3 border-t border-dark-750 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsPrepModalOpen(false)}
                  className="flex-1 bg-dark-800 hover:bg-dark-750 text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPrep}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 text-dark-950 py-2.5 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1 disabled:opacity-50"
                >
                  {isSubmittingPrep ? 'Updating...' : 'Mark Ready & Notify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTAURANT BILLING MODAL */}
      {isBillingModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel border border-brand-500/20 max-w-md w-full p-6 rounded-3xl shadow-2xl relative">
            <button 
              onClick={() => setIsBillingModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 hover:bg-dark-800 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-dark-750 pb-3">
              <DollarSign className="text-brand-500" size={24} />
              <h3 className="text-lg font-black text-white">Select Billing Option</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Guest & Suite details</span>
                <p className="text-sm text-white font-extrabold">Room {selectedOrder.bookings?.rooms?.room_number} — {selectedOrder.bookings?.guest_name}</p>
                {selectedOrder.bookings?.group_accounts?.name && (
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-black uppercase mt-1 inline-block">
                    Corporate Group: {selectedOrder.bookings.group_accounts.name}
                  </span>
                )}
              </div>

              <div className="border-t border-b border-dark-750/50 py-3 my-2 space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Meal Name:</span>
                  <span className="text-white font-bold">{selectedOrder.services?.name}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Quantity:</span>
                  <span className="text-white font-bold">{selectedOrder.quantity}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Chef Notes:</span>
                  <span className="text-white italic">"{parseNotes(selectedOrder.notes, 'chef') || 'None'}"</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-dark-750/40 pt-2 mt-2">
                  <span className="text-gray-300">Total Price:</span>
                  <span className="text-brand-400">₦{Number(selectedOrder.total_price_ngn || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] text-gray-450 font-bold uppercase tracking-wider mb-2">Billing Settlement Mode</label>
                
                <div className="space-y-2">
                  {/* Option 1: Room Folio */}
                  <label className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    billingOption === 'room' 
                      ? 'border-brand-500 bg-brand-500/5 text-white' 
                      : 'border-dark-700 bg-dark-900 text-gray-400 hover:text-white'
                  }`}>
                    <input 
                      type="radio" 
                      name="billingOption" 
                      value="room" 
                      checked={billingOption === 'room'}
                      onChange={() => setBillingOption('room')}
                      className="accent-brand-500"
                    />
                    <div>
                      <span className="text-xs font-black block">Charge Guest Room stay folio</span>
                      <span className="text-[10px] text-gray-500 mt-0.5 block leading-normal">
                        Adds unpaid fee to suite folio invoice. Guest settles checkout total upon departure.
                      </span>
                    </div>
                  </label>

                  {/* Option 2: Group Account (Disabled if not corporate booking) */}
                  <label className={`flex items-center gap-3 p-3.5 border rounded-2xl transition-all ${
                    !selectedOrder.bookings?.group_account_id 
                      ? 'opacity-40 cursor-not-allowed border-dark-850 bg-dark-950/40 text-gray-600' 
                      : billingOption === 'group'
                      ? 'border-brand-500 bg-brand-500/5 text-white cursor-pointer'
                      : 'border-dark-700 bg-dark-900 text-gray-400 hover:text-white cursor-pointer'
                  }`}>
                    <input 
                      type="radio" 
                      name="billingOption" 
                      value="group" 
                      disabled={!selectedOrder.bookings?.group_account_id}
                      checked={billingOption === 'group'}
                      onChange={() => setBillingOption('group')}
                      className="accent-brand-500 disabled:opacity-30"
                    />
                    <div>
                      <span className="text-xs font-black block flex items-center gap-1.5">
                        Charge Corporate Group Account
                        {!selectedOrder.bookings?.group_account_id && <span className="text-[8px] bg-dark-800 text-gray-500 border border-dark-700 px-1 rounded font-normal uppercase">Individual</span>}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-0.5 block leading-normal">
                        Bypasses stay folio lock checks. Charges the company group's outstanding corporate tab directly.
                      </span>
                    </div>
                  </label>

                  {/* Option 3: AR Prepayment Wallet */}
                  <label className={`flex items-center gap-3 p-3.5 border rounded-2xl transition-all ${
                    !guestWalletProfile
                      ? 'opacity-40 cursor-not-allowed border-dark-850 bg-dark-950/40 text-gray-600'
                      : billingOption === 'ar'
                      ? 'border-brand-500 bg-brand-500/5 text-white cursor-pointer'
                      : 'border-dark-700 bg-dark-900 text-gray-400 hover:text-white cursor-pointer'
                  }`}>
                    <input 
                      type="radio" 
                      name="billingOption" 
                      value="ar" 
                      disabled={!guestWalletProfile}
                      checked={billingOption === 'ar'}
                      onChange={() => setBillingOption('ar')}
                      className="accent-brand-500 disabled:opacity-30"
                    />
                    <div>
                      <span className="text-xs font-black block flex items-center gap-1.5">
                        Charge Guest AR Prepayment Wallet
                        {loadingWallet && <span className="text-[8px] text-gray-500 animate-pulse">Checking balance...</span>}
                        {guestWalletProfile && (
                          <span className="text-[9px] text-emerald-400 font-extrabold">
                            (Bal: ₦{Number(guestWalletProfile.wallet_balance || 0).toLocaleString()})
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-0.5 block leading-normal">
                        Deducts ₦{Number(selectedOrder.total_price_ngn || 0).toLocaleString()} directly from guest's prepayment ledger balance.
                      </span>
                    </div>
                  </label>

                  {/* Option 4: Direct Cash */}
                  <label className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    billingOption === 'cash' 
                      ? 'border-brand-500 bg-brand-500/5 text-white' 
                      : 'border-dark-700 bg-dark-900 text-gray-400 hover:text-white'
                  }`}>
                    <input 
                      type="radio" 
                      name="billingOption" 
                      value="cash" 
                      checked={billingOption === 'cash'}
                      onChange={() => setBillingOption('cash')}
                      className="accent-brand-500"
                    />
                    <div>
                      <span className="text-xs font-black block">Direct Cash Payment</span>
                      <span className="text-[10px] text-gray-500 mt-0.5 block leading-normal">
                        Receive physical cash at delivery.
                      </span>
                    </div>
                  </label>

                  {/* Option 5: Direct POS */}
                  <label className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    billingOption === 'pos' 
                      ? 'border-brand-500 bg-brand-500/5 text-white' 
                      : 'border-dark-700 bg-dark-900 text-gray-400 hover:text-white'
                  }`}>
                    <input 
                      type="radio" 
                      name="billingOption" 
                      value="pos" 
                      checked={billingOption === 'pos'}
                      onChange={() => setBillingOption('pos')}
                      className="accent-brand-500"
                    />
                    <div>
                      <span className="text-xs font-black block">Direct POS Terminal Payment</span>
                      <span className="text-[10px] text-gray-500 mt-0.5 block leading-normal">
                        Process payment on a card reader terminal at delivery.
                      </span>
                    </div>
                  </label>

                  {/* Option 6: Direct Bank Transfer */}
                  <label className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    billingOption === 'bank_transfer' 
                      ? 'border-brand-500 bg-brand-500/5 text-white' 
                      : 'border-dark-700 bg-dark-900 text-gray-400 hover:text-white'
                  }`}>
                    <input 
                      type="radio" 
                      name="billingOption" 
                      value="bank_transfer" 
                      checked={billingOption === 'bank_transfer'}
                      onChange={() => setBillingOption('bank_transfer')}
                      className="accent-brand-500"
                    />
                    <div>
                      <span className="text-xs font-black block">Direct Bank Transfer Payment</span>
                      <span className="text-[10px] text-gray-500 mt-0.5 block leading-normal">
                        Receive bank transfer directly.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 border-t border-dark-750 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsBillingModalOpen(false)}
                  className="flex-1 bg-dark-800 hover:bg-dark-750 text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelivery}
                  disabled={isSubmittingBilling}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-dark-950 py-2.5 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1 disabled:opacity-50"
                >
                  {isSubmittingBilling ? 'Settling...' : 'Confirm Delivery & Charge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / UPDATE FOOD ITEM --- */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-dark-700 bg-dark-900 rounded-t-2xl">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Utensils className="text-brand-500" size={16} />
                {editingMenuItem ? 'Update Menu Food Item' : 'Create New Food Item'}
              </h2>
              <button 
                onClick={() => setIsMenuModalOpen(false)} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem}>
              <div className="p-5 space-y-4">
                {/* Item Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Item Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Grilled Croaker Fish"
                    value={menuForm.name} 
                    onChange={e => setMenuForm({ ...menuForm, name: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-2.5 text-xs outline-none focus:border-brand-500 font-semibold"
                  />
                </div>

                {/* Base Price */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Base Menu Price (₦) *</label>
                  <input 
                    type="number" 
                    required 
                    min="100"
                    placeholder="e.g. 12000"
                    value={menuForm.base_price_ngn} 
                    onChange={e => setMenuForm({ ...menuForm, base_price_ngn: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-2.5 text-xs outline-none focus:border-brand-500 font-mono font-bold"
                  />
                </div>

                {/* Meal Segment */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Meal Segment *</label>
                  <select
                    required
                    value={menuForm.segment}
                    onChange={e => setMenuForm({ ...menuForm, segment: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-2.5 text-xs outline-none focus:border-brand-500 font-semibold cursor-pointer"
                  >
                    {MENU_SEGMENTS.map(seg => (
                      <option key={seg} value={seg}>{seg}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Menu Description</label>
                  <textarea 
                    value={menuForm.description} 
                    onChange={e => setMenuForm({ ...menuForm, description: e.target.value })}
                    placeholder="Describe the meal ingredients, serving details, side options..."
                    className="w-full bg-dark-900 border border-dark-700 text-white rounded-lg p-2.5 text-xs outline-none focus:border-brand-500 min-h-[80px]"
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between bg-dark-900/50 p-3 rounded-lg border border-dark-750">
                  <div>
                    <span className="text-xs font-bold text-white block">Active Status</span>
                    <span className="text-[10px] text-gray-500">Deactivated items cannot be ordered.</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={menuForm.is_active}
                    onChange={e => setMenuForm({ ...menuForm, is_active: e.target.checked })}
                    className="w-5 h-5 bg-dark-900 border border-dark-700 rounded text-brand-500 focus:ring-brand-500 cursor-pointer accent-brand-500"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-dark-700 bg-dark-900/50 flex justify-end gap-3 rounded-b-2xl">
                <button 
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingMenu}
                  className="bg-brand-500 hover:bg-brand-600 text-dark-950 font-black text-xs py-2 px-5 rounded-lg shadow-md transition-all"
                >
                  {isSavingMenu ? 'Saving...' : 'Save Food Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CLOSE OF DAY --- */}
      {isCloseOfDayModalOpen && closeOfDayReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-dark-800 rounded-3xl border border-dark-700 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center p-6 border-b border-dark-700 bg-dark-900 rounded-t-3xl">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Clock className="text-amber-500" size={20} />
                Restaurant & Kitchen - Close of Day Verification
              </h2>
              <button 
                onClick={() => setIsCloseOfDayModalOpen(false)} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-400 block mb-1">Consolidated Revenue</span>
                  <span className="text-2xl font-black text-white">₦{closeOfDayReport.total_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">{closeOfDayReport.total_count} total transactions</span>
                </div>
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-400 block mb-1">Restaurant POS Revenue</span>
                  <span className="text-2xl font-black text-brand-500">₦{closeOfDayReport.total_restaurant_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">{closeOfDayReport.restaurant_count} POS/walk-in transactions</span>
                </div>
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-400 block mb-1">Kitchen Orders Revenue</span>
                  <span className="text-2xl font-black text-blue-400">₦{closeOfDayReport.total_kitchen_revenue.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">{closeOfDayReport.kitchen_count} room service/guest orders</span>
                </div>
              </div>

              {/* Restaurant POS Transactions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-2 border-b border-dark-700 pb-2">
                  <Utensils size={14} />
                  Restaurant POS Transactions (Walk-ins & POS Sales)
                </h3>
                {closeOfDayReport.restaurant_pos_txns.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No Restaurant POS transactions recorded today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-dark-750 text-gray-400 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Reference / Guest</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750">
                        {closeOfDayReport.restaurant_pos_txns.map((t, idx) => (
                          <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                            <td className="py-2.5 px-3 font-mono text-gray-500">{t.time}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{t.ref}</td>
                            <td className="py-2.5 px-3">{t.description}</td>
                            <td className="py-2.5 px-3">
                              <span className="bg-dark-900 text-[10px] font-bold px-2 py-0.5 rounded border border-dark-700 uppercase">
                                {t.method?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">₦{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Kitchen Order Transactions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 border-b border-dark-700 pb-2">
                  <ChefHat size={14} />
                  Kitchen Orders & Room Charges (In-house Guests)
                </h3>
                {closeOfDayReport.kitchen_txns.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No Kitchen orders recorded today.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-dark-750 text-gray-400 text-[10px] uppercase font-bold">
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Reference / Room</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750">
                        {closeOfDayReport.kitchen_txns.map((t, idx) => (
                          <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                            <td className="py-2.5 px-3 font-mono text-gray-500">{t.time}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{t.ref}</td>
                            <td className="py-2.5 px-3">{t.description}</td>
                            <td className="py-2.5 px-3">
                              <span className="bg-dark-900 text-[10px] font-bold px-2 py-0.5 rounded border border-dark-700 uppercase">
                                {t.method?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-white">₦{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-dark-700 bg-dark-900 flex justify-end gap-3 rounded-b-3xl">
              <button 
                type="button"
                onClick={() => setIsCloseOfDayModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmCloseOfDayRestaurant}
                className="bg-amber-500 hover:bg-amber-600 text-dark-950 font-black text-xs py-2.5 px-6 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Confirm Close of Day
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE/EDIT MEAL OPTION --- */}
      {isMealModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-xl rounded-2xl shadow-2xl my-8 overflow-hidden text-left">
            <div className="bg-dark-900 p-5 border-b border-dark-700 flex justify-between items-center">
              <h3 className="text-md font-bold text-white">{editingMeal ? 'Edit Catering Package' : 'Create New Catering Package'}</h3>
              <button onClick={() => { setIsMealModalOpen(false); setEditingMeal(null); }} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>

            <form onSubmit={handleSaveMeal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Package Name *</label>
                <input 
                  type="text" 
                  required
                  value={mealForm.name}
                  onChange={e => setMealForm(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  placeholder="e.g. Standard Breakfast Tea"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Course Segment *</label>
                <select 
                  value={mealForm.course_type}
                  onChange={e => setMealForm(prev => ({ ...prev, course_type: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="Breakfast Tea" className="bg-dark-900">Breakfast Tea</option>
                  <option value="Breakfast" className="bg-dark-900">Breakfast</option>
                  <option value="Lunch" className="bg-dark-900">Lunch</option>
                  <option value="Dinner" className="bg-dark-900">Dinner</option>
                  <option value="Dessert" className="bg-dark-900">Dessert</option>
                  <option value="Drinks" className="bg-dark-900">Drinks</option>
                  <option value="Appetizers" className="bg-dark-900">Appetizers</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Combination Items (Comma separated) *</label>
                <input 
                  type="text" 
                  required
                  value={mealForm.combination_items}
                  onChange={e => setMealForm(prev => ({ ...prev, combination_items: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                  placeholder="e.g. Tea, Snacks, Fruits"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Price Per Participant (₦) *</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={mealForm.price_per_participant_ngn}
                  onChange={e => setMealForm(prev => ({ ...prev, price_per_participant_ngn: e.target.value }))}
                  className="bg-dark-900 border border-dark-700 w-full px-3 py-2.5 rounded-xl text-white outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="mealActive"
                  checked={mealForm.is_active}
                  onChange={e => setMealForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded bg-dark-900 border-dark-700 text-brand-500 focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="mealActive" className="text-xs text-gray-400 font-bold cursor-pointer">Package is Active & Orderable</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700 mt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsMealModalOpen(false); setEditingMeal(null); }}
                  className="px-4 py-2 border border-dark-700 text-gray-400 hover:text-white rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingMeal}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  {isSavingMeal ? 'Saving...' : 'Save Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantKitchen;

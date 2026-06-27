import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  Archive, Layers, PlusCircle, Search, ClipboardList, Clock, 
  User, ShieldCheck, CheckCircle, XCircle, ArrowUpRight, ArrowDownLeft, X, 
  AlertTriangle, Filter, DollarSign, ListOrdered, Check, ChevronDown, Calendar, Trash2
} from 'lucide-react';

const PaginationControl = ({ currentPage, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-dark-700 bg-dark-900/30 px-4 py-3 sm:px-6 mt-4 rounded-b-lg">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="relative inline-flex items-center rounded-md border border-dark-750 bg-dark-800 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="relative ml-3 inline-flex items-center rounded-md border border-dark-750 bg-dark-800 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-gray-400">
            Showing <span className="font-semibold text-white">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
            <span className="font-semibold text-white">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{' '}
            of <span className="font-semibold text-white">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-405 ring-1 ring-inset ring-dark-750 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="sr-only">Previous</span>
              &larr;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                type="button"
                key={page}
                onClick={() => onPageChange(page)}
                className={`relative inline-flex items-center px-3 py-2 text-xs font-bold ring-1 ring-inset ring-dark-750 cursor-pointer ${
                  page === currentPage
                    ? 'z-10 bg-brand-500 text-dark-950 focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 font-extrabold'
                    : 'text-gray-300 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-455 ring-1 ring-inset ring-dark-750 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="sr-only">Next</span>
              &rarr;
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

const StoreKeeping = () => {
  const { user, profile, hasAccess } = useAuth();
  
  const hasStoreKeepingAdmin = hasAccess('Store Keeping') || hasAccess('Store Keeping - Register & Restock Items') || hasAccess('Store Keeping - Approve Outgoing Material Releases');
  
  // Tab control: 'inventory', 'request', 'approvals', 'logs'
  const [activeTab, setActiveTab] = useState(() => {
    return (hasAccess('Store Keeping') || hasAccess('Store Keeping - Register & Restock Items') || hasAccess('Store Keeping - Approve Outgoing Material Releases')) ? 'inventory' : 'request';
  });

  useEffect(() => {
    if (user && !hasAccess('Store Keeping') && !hasAccess('Store Keeping - Register & Restock Items') && !hasAccess('Store Keeping - Approve Outgoing Material Releases')) {
      setActiveTab('request');
    }
  }, [user]);
  
  // Data States
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [logDeptFilter, setLogDeptFilter] = useState('all');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState('date'); // 'date', 'department', 'giver', 'receiver', 'approver'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

  const [currentPageItems, setCurrentPageItems] = useState(1);
  const [currentPageLogs, setCurrentPageLogs] = useState(1);
  const [currentPageApprovals, setCurrentPageApprovals] = useState(1);
  const [currentPageProcurement, setCurrentPageProcurement] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPageItems(1);
  }, [searchQuery, filterCategory]);

  useEffect(() => {
    setCurrentPageLogs(1);
  }, [logTypeFilter, logDeptFilter, logStartDate, logEndDate, sortField, sortDirection]);

  // Modals & Form States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  
  // Procurement / Purchase Request States
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [newPurchaseItems, setNewPurchaseItems] = useState([
    { itemId: '', itemName: '', quantity: 1, unitPrice: '' }
  ]);
  const [newPurchaseNotes, setNewPurchaseNotes] = useState('');
  
  // New Item State
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    quantity: 0,
    unit_price_ngn: '',
    category: 'linen'
  });

  // Restock State
  const [selectedRestockItem, setSelectedRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState(1);
  const [restockPrice, setRestockPrice] = useState('');
  const [restockGiver, setRestockGiver] = useState('');
  const [restockNotes, setRestockNotes] = useState('');

  // Outgoing Issuance State
  const [outgoingForm, setOutgoingForm] = useState({
    itemId: '',
    quantity: 1,
    receiverName: '',
    department: 'housekeeping',
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm')
  });

  // Role Access Memo
  const currentUserRole = useMemo(() => {
    return (user?.role || profile?.role || 'staff').toLowerCase().trim();
  }, [user, profile]);

  const DEPARTMENT_HEADS_MAP = useMemo(() => ({
    'front office': ['front_desk_lead', 'receptionist_manager'],
    'accounts': ['finance_manager'],
    'kitchen': ['head_chef', 'kitchen_manager'],
    'housekeeping': ['head_housekeeper', 'housekeeping_manager'],
    'bar': ['bar_manager', 'head_bartender'],
    'restaurant': ['restaurant_manager', 'f&b_manager'],
    'maintenance': ['maintenance_manager', 'head_maintenance']
  }), []);

  const isGlobalApprover = useMemo(() => {
    return ['super_admin', 'hotel_owner', 'hotel_manager', 'admin', 'manager'].includes(currentUserRole);
  }, [currentUserRole]);

  const isApprover = useMemo(() => {
    return hasAccess('Store Keeping - Approve Outgoing Material Releases');
  }, [hasAccess]);

  const approvedDepartments = useMemo(() => {
    if (isGlobalApprover) {
      return ['front office', 'accounts', 'kitchen', 'housekeeping', 'bar', 'restaurant', 'maintenance'];
    }
    const depts = [];
    Object.entries(DEPARTMENT_HEADS_MAP).forEach(([dept, heads]) => {
      if (heads.includes(currentUserRole)) {
        depts.push(dept);
      }
    });
    return depts;
  }, [currentUserRole, isGlobalApprover]);

  const isSuperAdminOrManager = useMemo(() => {
    return hasAccess('Store Keeping - Register & Restock Items');
  }, [hasAccess]);

  const isStoreOfficer = useMemo(() => {
    return ['super_admin', 'hotel_owner', 'hotel_manager', 'admin', 'manager', 'storekeeper', 'storekeeper_manager', 'store_keeper'].includes(currentUserRole) || isSuperAdminOrManager;
  }, [currentUserRole, isSuperAdminOrManager]);

  // Current logged in user name for Giver
  const currentStaffName = useMemo(() => {
    if (profile?.first_name) {
      return `${profile.first_name} ${profile.last_name || ''}`.trim();
    }
    return user?.name || user?.email || 'Storekeeper';
  }, [user, profile]);

  const DEPARTMENTS = [
    { value: 'front office', label: 'Front Office / Reception' },
    { value: 'accounts', label: 'Finance & Accounts' },
    { value: 'kitchen', label: 'Kitchen / Room Service' },
    { value: 'housekeeping', label: 'Housekeeping' },
    { value: 'bar', label: 'Lounge & Bar' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'maintenance', label: 'Maintenance & Utility' }
  ];

  const CATEGORIES = [
    { value: 'linen', label: 'Linens & Bedding' },
    { value: 'toiletries', label: 'Toiletries & Amenities' },
    { value: 'housekeeping', label: 'Cleaning & Housekeeping' },
    { value: 'stationery', label: 'Stationery & Office' },
    { value: 'beverages', label: 'F&B Beverages' },
    { value: 'other', label: 'Other Consumables' }
  ];

  useEffect(() => {
    fetchStoreData();
  }, []);

  useRealtimeSync(['store_items', 'store_logs', 'store_purchase_requests'], () => {
    fetchStoreData();
  });

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      // 1. Fetch store inventory items
      const { data: itemData, error: itemErr } = await supabase
        .from('store_items')
        .select('*')
        .order('category')
        .order('name');

      if (itemErr) throw itemErr;
      setItems(itemData || []);

      // 2. Fetch inventory audits
      const { data: logData, error: logErr } = await supabase
        .from('store_logs')
        .select('*, store_items(name, category)')
        .order('transaction_date', { ascending: false });

      if (logErr) throw logErr;
      setLogs(logData || []);

      // 3. Fetch store purchase requests
      const { data: purchaseData, error: purchaseErr } = await supabase
        .from('store_purchase_requests')
        .select('*, store_items(id, name, quantity, category)')
        .order('created_at', { ascending: false });

      if (purchaseErr) throw purchaseErr;
      setPurchaseRequests(purchaseData || []);

    } catch (err) {
      console.error("Error loading store inventory records:", err);
      toast.error("Failed to load store inventory database");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePurchaseRequest = async (e) => {
    e.preventDefault();
    
    // Validate all items
    for (const item of newPurchaseItems) {
      if (!item.itemName.trim() || Number(item.quantity) <= 0 || Number(item.unitPrice || 0) < 0) {
        return toast.error("Please ensure all items have a valid name, quantity, and unit price.");
      }
    }

    setIsProcessing(true);
    try {
      const insertPayload = newPurchaseItems.map(item => ({
        item_id: item.itemId || null,
        item_name: item.itemName.trim(),
        quantity: Number(item.quantity),
        estimated_cost: Number(item.quantity) * Number(item.unitPrice || 0),
        purchaser_id: profile?.id || user?.id || null,
        purchaser_name: currentStaffName,
        notes: newPurchaseNotes || '',
        status: 'pending_purchase'
      }));

      const { error } = await supabase
        .from('store_purchase_requests')
        .insert(insertPayload);

      if (error) throw error;
      
      toast.success(`✓ Logged ${newPurchaseItems.length} purchase requests successfully!`);
      setIsPurchaseModalOpen(false);
      setNewPurchaseItems([{ itemId: '', itemName: '', quantity: 1, unitPrice: '' }]);
      setNewPurchaseNotes('');
      fetchStoreData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit store purchase requests");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintPurchaseRequest = (req) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error("Failed to open print window. Please allow popups.");

    const htmlContent = `
      <html>
        <head>
          <title>Purchase Order / Procurement Requisition</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 40px; }
            .header { border-bottom: 2px dashed #df6853; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
            .brand-name { font-size: 26px; font-weight: 900; color: #df6853; text-transform: uppercase; margin: 0; }
            .title { font-size: 16px; font-weight: 700; color: #4b5563; margin-top: 5px; }
            .details { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 13px; }
            .details-col { background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #f3f4f6; }
            .details-title { font-weight: bold; text-transform: uppercase; font-size: 10px; color: #9ca3af; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; margin-top: 20px; }
            th { background-color: #df6853; color: white; padding: 12px 10px; font-weight: bold; text-transform: uppercase; font-size: 11px; }
            td { padding: 12px 10px; border-bottom: 1px solid #e5e7eb; }
            .total-row { font-weight: bold; font-size: 15px; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase; background: #def7ec; color: #03543f; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .footer { margin-top: 50px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="brand-name">Sparkles Luxury Apartments</h1>
              <div class="title">Procurement Requisition & Purchase Order</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #6b7280;">
              <p><b>Req Date:</b> ${format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</p>
              <p><b>Status:</b> <span class="status-badge ${req.status === 'pending_purchase' ? 'status-pending' : ''}">${req.status === 'pending_purchase' ? 'Pending' : 'Approved & Retired'}</span></p>
            </div>
          </div>
          
          <div class="details">
            <div class="details-col">
              <div class="details-title">Requested By</div>
              <p><b>Name:</b> ${req.purchaser_name}</p>
              <p><b>Profile ID:</b> ${req.purchaser_id || 'N/A'}</p>
            </div>
            <div class="details-col">
              <div class="details-title">Receiving & Fulfillment</div>
              <p><b>Retired At:</b> ${req.retired_at ? format(new Date(req.retired_at), 'yyyy-MM-dd HH:mm') : 'N/A'}</p>
              <p><b>Retired By:</b> ${req.retired_by || 'N/A'}</p>
            </div>
          </div>

          <h3 style="border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Requested Items</h3>
          <table>
            <thead>
              <tr>
                <th>Item Requested</th>
                <th>Item Type</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Estimated Unit Price</th>
                <th style="text-align: right;">Total Estimated Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>${req.item_name}</b></td>
                <td>${req.item_id ? 'Catalog Item' : 'Custom Item'}</td>
                <td style="text-align: center; font-weight: bold;">${req.quantity}</td>
                <td style="text-align: right;">₦${Number(req.estimated_cost / req.quantity).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="text-align: right; font-weight: bold; color: #df6853;">₦${Number(req.estimated_cost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            </tbody>
          </table>

          ${req.notes ? `
          <div style="margin-top: 30px; background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #f3f4f6;">
            <div class="details-title">Notes / Procurement Description</div>
            <p style="font-size: 13px; margin: 5px 0 0 0; color: #4b5563;">${req.notes}</p>
          </div>` : ''}

          <div style="margin-top: 50px; display: grid; grid-template-cols: 1fr 1fr; gap: 40px; text-align: center;">
            <div>
              <div style="border-bottom: 1px solid #9ca3af; height: 40px;"></div>
              <p style="font-size: 12px; margin-top: 5px; font-weight: bold; color: #4b5563;">Purchaser Signature</p>
            </div>
            <div>
              <div style="border-bottom: 1px solid #9ca3af; height: 40px;"></div>
              <p style="font-size: 12px; margin-top: 5px; font-weight: bold; color: #4b5563;">Authorized Officer Signature</p>
            </div>
          </div>

          <div class="footer">
            <p>This is an official document generated by the Sparkles Luxury Apartments PMS.</p>
            <p>© 2026 Sparkles Luxury Apartments. All rights reserved.</p>
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success("✓ Purchase Order slip sent to print!");
  };

  const handleRetirePurchase = async (req) => {
    if (!isStoreOfficer) {
      return toast.error("Access Restricted. Only Store Officers or Managers can retire purchase requests.");
    }
    if (!window.confirm(`Are you sure you have received these items and want to retire the request for "${req.item_name}"? This will automatically restock inventory.`)) return;

    const toastId = toast.loading('Retiring purchase request and restocking store items...');
    try {
      let targetItemId = req.item_id;

      // If it was a brand-new item (item_id is null), check if item name exists first, otherwise create it
      if (!targetItemId) {
        const { data: existingItems } = await supabase
          .from('store_items')
          .select('id, quantity')
          .ilike('name', req.item_name.trim());
        
        if (existingItems && existingItems.length > 0) {
          targetItemId = existingItems[0].id;
        } else {
          // Create new store item record
          const { data: newStoreItem, error: createItemErr } = await supabase
            .from('store_items')
            .insert([{
              name: req.item_name.trim(),
              description: req.notes || 'Procured via Store Purchase Request.',
              quantity: 0,
              unit_price_ngn: Number(req.estimated_cost / req.quantity),
              category: 'other'
            }])
            .select()
            .single();

          if (createItemErr) throw createItemErr;
          targetItemId = newStoreItem.id;
        }
      }

      // Increment store_items quantity
      const { data: itemData, error: fetchErr } = await supabase
        .from('store_items')
        .select('quantity, name, unit_price_ngn')
        .eq('id', targetItemId)
        .single();

      if (fetchErr) throw fetchErr;

      const newQty = itemData.quantity + req.quantity;
      const newUnitPrice = Number(req.estimated_cost / req.quantity);

      const { error: updateErr } = await supabase
        .from('store_items')
        .update({ 
          quantity: newQty,
          unit_price_ngn: newUnitPrice > 0 ? newUnitPrice : itemData.unit_price_ngn
        })
        .eq('id', targetItemId);

      if (updateErr) throw updateErr;

      // Log an incoming record in store_logs
      const { error: logErr } = await supabase
        .from('store_logs')
        .insert([{
          item_id: targetItemId,
          log_type: 'incoming',
          quantity: req.quantity,
          price_at_transaction: newUnitPrice > 0 ? newUnitPrice : itemData.unit_price_ngn,
          giver_name: currentStaffName,
          notes: `Procured items received & stocked from purchase request. Notes: ${req.notes || 'None'}`,
          status: 'approved'
        }]);

      if (logErr) throw logErr;

      // Update the purchase request status to 'completed_retired'
      const { error: retireErr } = await supabase
        .from('store_purchase_requests')
        .update({
          status: 'completed_retired',
          retired_at: new Date().toISOString(),
          retired_by: currentStaffName
        })
        .eq('id', req.id);

      if (retireErr) throw retireErr;

      // Sync to LocalStorage luxe_expenses fallback to guarantee it shows up in sandbox
      try {
        const expensePayload = {
          property_id: null,
          amount: Number(req.estimated_cost),
          category: 'Supplies',
          description: `Procurement fulfillment: Stocked ${req.quantity}x "${req.item_name}" into stores. Retired by ${currentStaffName}. Purchaser: ${req.purchaser_name}. Notes: ${req.notes || 'None'}`,
          expense_date: new Date().toISOString().split('T')[0],
          paid_to: `Procurement Vendor (Purchaser: ${req.purchaser_name})`,
          payment_method: 'bank_transfer',
          status: 'paid'
        };

        const currentLocal = JSON.parse(localStorage.getItem('luxe_expenses') || '[]');
        const newRecord = {
          id: `exp-proc-${Date.now()}`,
          ...expensePayload,
          created_at: new Date().toISOString()
        };
        localStorage.setItem('luxe_expenses', JSON.stringify([newRecord, ...currentLocal]));
      } catch (localErr) {
        console.error("Failed to update LocalStorage luxe_expenses:", localErr);
      }


      toast.success(`✓ Purchase Request Retired! ${req.quantity} units of "${req.item_name}" have been added to inventory.`, { id: toastId });
      fetchStoreData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to retire and restock purchase request", { id: toastId });
    }
  };

  // Add entirely new item to registry
  const handleAddNewItemSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdminOrManager) {
      return toast.error("Access Restricted. Only Store Manager or Hotel Manager can modify inventory catalog.");
    }
    if (!newItem.name || Number(newItem.unit_price_ngn) < 0 || Number(newItem.quantity) < 0) {
      return toast.error("Please provide valid name, price, and quantity");
    }

    setIsProcessing(true);
    try {
      // 1. Insert item
      const { data: inserted, error: insertErr } = await supabase
        .from('store_items')
        .insert([{
          name: newItem.name.trim(),
          description: newItem.description || 'Standard hotel store consumable.',
          quantity: Number(newItem.quantity),
          unit_price_ngn: Number(newItem.unit_price_ngn),
          category: newItem.category
        }])
        .select();

      if (insertErr) throw insertErr;

      // 2. If initial quantity > 0, log an incoming Restock transaction
      if (Number(newItem.quantity) > 0 && inserted && inserted.length > 0) {
        await supabase.from('store_logs').insert([{
          item_id: inserted[0].id,
          log_type: 'incoming',
          quantity: Number(newItem.quantity),
          price_at_transaction: Number(newItem.unit_price_ngn),
          giver_name: currentStaffName,
          notes: 'Initial stock seeding upon item creation.',
          status: 'approved'
        }]);
      }

      toast.success(`✓ "${newItem.name}" added to inventory registry!`);
      setIsAddModalOpen(false);
      setNewItem({ name: '', description: '', quantity: 0, unit_price_ngn: '', category: 'linen' });
      fetchStoreData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to register new store item");
    } finally {
      setIsProcessing(false);
    }
  };

  // Open restock incoming modal
  const handleOpenRestockModal = (item) => {
    setSelectedRestockItem(item);
    setRestockQty(1);
    setRestockPrice(item.unit_price_ngn);
    setRestockGiver(currentStaffName);
    setRestockNotes('');
    setIsRestockModalOpen(true);
  };

  // Handle incoming inventory restocking
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdminOrManager) {
      return toast.error("Unauthorized.");
    }

    setIsProcessing(true);
    try {
      const newQty = selectedRestockItem.quantity + Number(restockQty);
      
      // 1. Update store item count and price snapshot in register
      const { error: updateErr } = await supabase
        .from('store_items')
        .update({
          quantity: newQty,
          unit_price_ngn: Number(restockPrice)
        })
        .eq('id', selectedRestockItem.id);

      if (updateErr) throw updateErr;

      // 2. Log incoming audit transaction
      const { error: logErr } = await supabase
        .from('store_logs').insert([{
          item_id: selectedRestockItem.id,
          log_type: 'incoming',
          quantity: Number(restockQty),
          price_at_transaction: Number(restockPrice),
          giver_name: restockGiver || currentStaffName,
          notes: restockNotes || 'Inventory restock addition.',
          status: 'approved'
        }]);

      if (logErr) throw logErr;

      toast.success(`✓ Restocked ${restockQty} units of "${selectedRestockItem.name}"!`);
      setIsRestockModalOpen(false);
      setSelectedRestockItem(null);
      fetchStoreData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to execute incoming restock log");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle logging outgoing material requests (Locks as pending hotel manager approval)
  const handleOutgoingRequestSubmit = async (e) => {
    e.preventDefault();
    if (!outgoingForm.itemId || !outgoingForm.receiverName || Number(outgoingForm.quantity) <= 0) {
      return toast.error("Please fill in all required material release fields.");
    }

    const item = items.find(i => i.id === outgoingForm.itemId);
    if (!item) return toast.error("Selected item not found.");
    
    // Prevent request if quantity exceeds active stock
    if (Number(outgoingForm.quantity) > item.quantity) {
      return toast.error(`Cannot request ${outgoingForm.quantity} units. Only ${item.quantity} available in stock.`);
    }

    setIsProcessing(true);
    try {
      const transDate = new Date(`${outgoingForm.date}T${outgoingForm.time}`).toISOString();

      // Log outgoing request with 'pending_approval' status
      const { error: logErr } = await supabase
        .from('store_logs')
        .insert([{
          item_id: outgoingForm.itemId,
          log_type: 'outgoing',
          quantity: Number(outgoingForm.quantity),
          price_at_transaction: Number(item.unit_price_ngn),
          giver_name: currentStaffName,
          receiver_name: outgoingForm.receiverName.trim(),
          department: outgoingForm.department,
          notes: outgoingForm.notes || 'Departmental material request.',
          status: 'pending_approval', // Outgoing must be approved by Hotel Manager
          transaction_date: transDate
        }]);

      if (logErr) throw logErr;

      toast.success(`✓ Outgoing release request for ${outgoingForm.quantity}x "${item.name}" registered! Awaiting Hotel Manager approval.`);
      
      // Reset
      setOutgoingForm({
        itemId: '',
        quantity: 1,
        receiverName: '',
        department: 'housekeeping',
        notes: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm')
      });
      fetchStoreData();
      setActiveTab('logs'); // Show logs tab to see pending state
    } catch (err) {
      console.error(err);
      toast.error("Failed to log material release request");
    } finally {
      setIsProcessing(false);
    }
  };

  // Hotel Manager Action: Approve and Release Outgoing Material
  const handleApproveRelease = async (log) => {
    const logDept = (log.department || '').toLowerCase().trim();
    if (!isApprover || !approvedDepartments.includes(logDept)) {
      return toast.error("Access Restricted. You do not have permission to approve releases for this department.");
    }

    // Refresh stock check just in case
    const { data: latestItem, error: fetchErr } = await supabase
      .from('store_items')
      .select('quantity, name')
      .eq('id', log.item_id)
      .single();

    if (fetchErr || !latestItem) return toast.error("Item stock verification failed.");

    if (latestItem.quantity < log.quantity) {
      // Stock is currently lower than requested quantity
      return toast.error(`Insufficient Stock. Cannot release ${log.quantity} units. Only ${latestItem.quantity} left in stores.`);
    }

    const toastId = toast.loading('Releasing materials & updating inventory balances...');
    try {
      const remainingQty = latestItem.quantity - log.quantity;

      // 1. Decrement store inventory item quantity
      const { error: updateErr } = await supabase
        .from('store_items')
        .update({ quantity: remainingQty })
        .eq('id', log.item_id);

      if (updateErr) throw updateErr;

      // 2. Swings log status to 'approved_released' and registers approved_by
      const { error: logErr } = await supabase
        .from('store_logs')
        .update({
          status: 'approved_released',
          approved_by: currentStaffName
        })
        .eq('id', log.id);

      if (logErr) throw logErr;

      toast.success(`✓ Released ${log.quantity}x "${latestItem.name}" to ${log.receiver_name} (${log.department.toUpperCase()})!`, { id: toastId });
      fetchStoreData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to finalize material release", { id: toastId });
    }
  };

  // Hotel Manager Action: Decline Outgoing Material Release
  const handleDeclineRelease = async (log) => {
    const logDept = (log.department || '').toLowerCase().trim();
    if (!isApprover || !approvedDepartments.includes(logDept)) {
      return toast.error("Access Restricted. You do not have permission to reject releases for this department.");
    }

    if (!window.confirm(`Are you sure you want to decline this release request for ${log.quantity}x items?`)) return;

    const toastId = toast.loading('Updating request status...');
    try {
      // Swings log status to 'declined' and registers approved_by/declined_by
      const { error: logErr } = await supabase
        .from('store_logs')
        .update({
          status: 'declined',
          approved_by: currentStaffName
        })
        .eq('id', log.id);

      if (logErr) throw logErr;

      toast.success('Material release request declined.', { id: toastId });
      fetchStoreData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to decline request", { id: toastId });
    }
  };

  // Calculations
  const totalValuation = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price_ngn), 0);
  }, [items]);

  const lowStockCount = useMemo(() => {
    return items.filter(item => item.quantity < 10).length;
  }, [items]);

  // Filtered Products List
  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          i.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = filterCategory === 'all' || i.category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [items, searchQuery, filterCategory]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ▴' : ' ▾';
  };

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return toast.error("No transaction logs available to export.");
    
    const headers = ['Timestamp', 'Item Requested', 'Action Type', 'Quantity', 'Target Department', 'Giver (Staff)', 'Receiver', 'Status', 'Approver', 'Notes'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.transaction_date), 'yyyy-MM-dd HH:mm'),
      log.store_items?.name || 'Deleted Product',
      log.log_type,
      log.quantity,
      log.department || 'N/A',
      log.giver_name,
      log.receiver_name || 'N/A',
      log.status === 'approved_released' ? 'released' : log.status,
      log.approved_by || 'System Auto',
      (log.notes || '').replace(/"/g, '""') // escape double quotes
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Store_Audit_Logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("✓ CSV Audit file downloaded successfully!");
  };

  const exportToExcel = () => {
    if (filteredLogs.length === 0) return toast.error("No transaction logs available to export.");

    // Generate XML Spreadsheet 2003 format for high-fidelity Excel styling (including gridlines and headers)
    const headers = ['Timestamp', 'Item Requested', 'Action Type', 'Quantity', 'Target Department', 'Giver (Staff)', 'Receiver', 'Status', 'Approver', 'Notes'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.transaction_date), 'yyyy-MM-dd HH:mm'),
      log.store_items?.name || 'Deleted Product',
      log.log_type.toUpperCase(),
      log.quantity,
      (log.department || 'N/A').toUpperCase(),
      log.giver_name,
      log.receiver_name || 'N/A',
      (log.status === 'approved_released' ? 'released' : log.status).toUpperCase(),
      log.approved_by || 'System Auto',
      log.notes || ''
    ]);

    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:documentproperties">
  <Author>${currentStaffName}</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#DF6853" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Data">
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Inventory Audit History">
  <Table>
   <Row ss:Height="25">
`;
    
    // Add headers
    headers.forEach(h => {
      xml += `    <Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>\n`;
    });
    xml += `   </Row>\n`;

    // Add rows
    rows.forEach(r => {
      xml += `   <Row ss:Height="18">\n`;
      r.forEach((val, idx) => {
        const type = typeof val === 'number' ? 'Number' : 'String';
        xml += `    <Cell ss:StyleID="Data"><Data ss:Type="${type}">${val}</Data></Cell>\n`;
      });
      xml += `   </Row>\n`;
    });

    xml += `  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Store_Audit_Logs_${format(new Date(), 'yyyy-MM-dd')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("✓ Excel Spreadsheet downloaded successfully!");
  };

  const exportToPDF = () => {
    if (filteredLogs.length === 0) return toast.error("No transaction logs available to export.");

    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error("Failed to open print window. Please allow popups.");

    const rowsHTML = filteredLogs.map((log, idx) => {
      return `
        <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid;">
          <td style="padding: 10px; font-family: monospace; font-size: 10px;">${format(new Date(log.transaction_date), 'yyyy-MM-dd HH:mm')}</td>
          <td style="padding: 10px; font-weight: bold;">${log.store_items?.name || 'Deleted Product'}</td>
          <td style="padding: 10px; text-transform: uppercase; font-size: 10px;">
            <span style="padding: 3px 6px; border-radius: 4px; font-weight: bold; background-color: ${log.log_type === 'incoming' ? '#def7ec' : '#f3e8ff'}; color: ${log.log_type === 'incoming' ? '#03543f' : '#6b21a8'};">
              ${log.log_type}
            </span>
          </td>
          <td style="padding: 10px; font-weight: bold;">${log.quantity}</td>
          <td style="padding: 10px; text-transform: uppercase; font-size: 10px; color: #4b5563;">${log.department || 'N/A'}</td>
          <td style="padding: 10px; color: #4b5563;">${log.giver_name}</td>
          <td style="padding: 10px; font-weight: 500;">${log.receiver_name || 'N/A'}</td>
          <td style="padding: 10px; font-size: 10px;">
            <span style="padding: 3px 6px; border-radius: 4px; font-weight: bold; background-color: ${
              log.status === 'approved' || log.status === 'approved_released' ? '#def7ec' : log.status === 'pending_approval' ? '#fef3c7' : '#fde8e8'
            }; color: ${
              log.status === 'approved' || log.status === 'approved_released' ? '#03543f' : log.status === 'pending_approval' ? '#92400e' : '#9b1c1c'
            };">
              ${log.status === 'approved_released' ? 'released' : log.status}
            </span>
          </td>
          <td style="padding: 10px; font-style: italic; color: #6b7280;">${log.approved_by || 'System Auto'}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Warehouse Inventory Audit Ledger</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 20px; }
            .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #df6853; padding-bottom: 20px; margin-bottom: 20px; }
            .brand-name { font-size: 24px; font-weight: 900; color: #df6853; text-transform: uppercase; margin: 0; }
            .report-title { font-size: 14px; font-weight: 700; color: #4b5563; margin-top: 5px; }
            .metadata { text-align: right; font-size: 11px; color: #6b7280; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; text-align: left; font-size: 11px; margin-top: 10px; }
            th { background-color: #df6853; color: white; padding: 12px 10px; font-weight: bold; text-transform: uppercase; font-size: 10px; }
            @media print {
              body { padding: 0; }
              @page { size: A4 landscape; margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <h1 class="brand-name">Sparkles Luxury Apartments</h1>
              <div class="report-title">Warehouse Inventory Audit & Transactions Ledger</div>
            </div>
            <div class="metadata">
              <p><b>Date of Report:</b> ${format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
              <p><b>Exported By:</b> ${currentStaffName}</p>
              <p><b>Total Transactions:</b> ${filteredLogs.length}</p>
            </div>
          </div>
          
          <table border="1" cellpadding="10" style="border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Item Requested</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Dept</th>
                <th>Giver</th>
                <th>Receiver</th>
                <th>Status</th>
                <th>Approver</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success("✓ Official PDF Ledger opened in printing view!");
  };

  // Filtered and Sorted Log lists
  const filteredLogs = useMemo(() => {
    const filtered = logs.filter(l => {
      const matchType = logTypeFilter === 'all' || l.log_type === logTypeFilter;
      const matchDept = logDeptFilter === 'all' || l.department === logDeptFilter;
      
      let matchDate = true;
      if (logStartDate || logEndDate) {
        const transDate = new Date(l.transaction_date || l.created_at);
        if (logStartDate) {
          const start = new Date(logStartDate);
          start.setHours(0, 0, 0, 0);
          if (transDate < start) matchDate = false;
        }
        if (logEndDate) {
          const end = new Date(logEndDate);
          end.setHours(23, 59, 59, 999);
          if (transDate > end) matchDate = false;
        }
      }
      
      return matchType && matchDept && matchDate;
    });

    return [...filtered].sort((a, b) => {
      let valA, valB;
      
      switch (sortField) {
        case 'department':
          valA = a.department || '';
          valB = b.department || '';
          break;
        case 'giver':
          valA = a.giver_name || '';
          valB = b.giver_name || '';
          break;
        case 'receiver':
          valA = a.receiver_name || '';
          valB = b.receiver_name || '';
          break;
        case 'approver':
          valA = a.approved_by || '';
          valB = b.approved_by || '';
          break;
        case 'date':
        default:
          valA = new Date(a.transaction_date || a.created_at).getTime();
          valB = new Date(b.transaction_date || b.created_at).getTime();
          break;
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [logs, logTypeFilter, logDeptFilter, sortField, sortDirection]);

  // Pending Approvals Array
  const pendingApprovals = useMemo(() => {
    return logs.filter(l => l.status === 'pending_approval' && approvedDepartments.includes((l.department || '').toLowerCase().trim()));
  }, [logs, approvedDepartments]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPageItems - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPageItems]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPageLogs - 1) * pageSize;
    return filteredLogs.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, currentPageLogs]);

  const paginatedApprovals = useMemo(() => {
    const startIndex = (currentPageApprovals - 1) * pageSize;
    return pendingApprovals.slice(startIndex, startIndex + pageSize);
  }, [pendingApprovals, currentPageApprovals]);

  const paginatedProcurements = useMemo(() => {
    const startIndex = (currentPageProcurement - 1) * pageSize;
    return purchaseRequests.slice(startIndex, startIndex + pageSize);
  }, [purchaseRequests, currentPageProcurement]);

  return (
    <div className="min-h-screen pb-12">
      {/* 1. Header Area */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2 tracking-tight">
            <Archive className="text-brand-500" />
            Store Keeping & Inventory Control
          </h1>
          <p className="text-gray-400 text-sm">
            Manage material inventories, track restocks, and log departmental release authorizations.
          </p>
        </div>

        <div className="flex bg-dark-800 p-1.5 rounded-2xl border border-dark-700/60 shadow-lg select-none">
          {hasStoreKeepingAdmin && (
            <button 
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'inventory' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              <Layers size={14} />
              <span>Store Registry</span>
            </button>
          )}
          <button 
            onClick={() => setActiveTab('request')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'request' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <ArrowUpRight size={14} />
            <span>Material Request</span>
          </button>
          {hasStoreKeepingAdmin && (
            <>
              <button 
                onClick={() => setActiveTab('approvals')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 relative ${activeTab === 'approvals' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                <ShieldCheck size={14} />
                <span>Release Approvals</span>
                {pendingApprovals.length > 0 && (
                  <span className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-2 ring-dark-900 animate-pulse">
                    {pendingApprovals.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('procurement')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 relative ${activeTab === 'procurement' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                <ListOrdered size={14} />
                <span>Procurement Requests</span>
                {purchaseRequests.filter(r => r.status === 'pending_purchase').length > 0 && (
                  <span className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[8px] font-black text-dark-900 ring-2 ring-dark-900 animate-pulse">
                    {purchaseRequests.filter(r => r.status === 'pending_purchase').length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'logs' ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                <Clock size={14} />
                <span>Audit History</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. TAB CONTENT switches */}

      {/* TAB 1: STORE REGISTRY & LIVE MASTER INVENTORY */}
      {activeTab === 'inventory' && hasStoreKeepingAdmin && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-5 border border-dark-700/60 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-bl-full group-hover:bg-brand-500/10 transition-colors" />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Valuation</p>
              <h3 className="text-2xl font-black text-white mt-2 flex items-center">
                <DollarSign size={20} className="text-brand-400" />
                ₦{totalValuation.toLocaleString()}
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">Sum value of all active warehouse stock items.</p>
            </div>

            <div className="glass-panel p-5 border border-dark-700/60 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition-colors" />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Active Catalog Size</p>
              <h3 className="text-2xl font-black text-white mt-2">{items.length} Products</h3>
              <p className="text-[10px] text-gray-400 mt-1">Distinct items registered in inventory register.</p>
            </div>

            <div className="glass-panel p-5 border border-dark-700/60 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full group-hover:bg-red-500/10 transition-colors" />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Low Stock Warnings</p>
              <h3 className={`text-2xl font-black mt-2 ${lowStockCount > 0 ? 'text-red-400' : 'text-white'}`}>{lowStockCount} Items</h3>
              <p className="text-[10px] text-gray-400 mt-1">Registered products in store with quantity &lt; 10.</p>
            </div>
          </div>

          {/* Catalog Operations bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-dark-800 p-4 border border-dark-700/60 rounded-2xl shadow-md">
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-3 text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search store inventory by name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-brand-500 transition-all"
                />
              </div>

              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-dark-900 border border-dark-700/80 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand-500"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {isSuperAdminOrManager && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="w-full md:w-auto bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow"
              >
                <PlusCircle size={16} />
                Register New Stock Item
              </button>
            )}
          </div>

          {/* Master Table Grid */}
          <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl overflow-x-auto">
            {loading ? (
              <div className="py-24 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500 mx-auto mb-3"></div>
                <p className="text-gray-500 text-xs">Syncing store keeping registry...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-24 text-center text-gray-500">
                <Layers size={32} className="mx-auto mb-2 opacity-30 animate-pulse" />
                <p className="text-sm">No items found matching your filters in the store register.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-900/60 border-b border-dark-700 text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-bold">Item Name</th>
                    <th className="p-4 font-bold">Category</th>
                    <th className="p-4 font-bold">Description</th>
                    <th className="p-4 font-bold text-center">Quantity in Stock</th>
                    <th className="p-4 font-bold">Unit Price</th>
                    <th className="p-4 font-bold">Total valuation</th>
                    {isSuperAdminOrManager && <th className="p-4 font-bold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {paginatedItems.map(item => (
                    <tr key={item.id} className="hover:bg-dark-700/20 transition-colors">
                      <td className="p-4 font-extrabold text-white">{item.name}</td>
                      <td className="p-4">
                        <span className="bg-dark-800 border border-dark-700/60 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 max-w-xs truncate">{item.description}</td>
                      <td className="p-4 text-center font-bold font-mono">
                        <span className={`px-2.5 py-1 rounded ${item.quantity < 10 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                          {item.quantity} Units
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-gray-300">₦{Number(item.unit_price_ngn).toLocaleString()}</td>
                      <td className="p-4 font-black text-brand-400">₦{(item.quantity * item.unit_price_ngn).toLocaleString()}</td>
                      {isSuperAdminOrManager && (
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleOpenRestockModal(item)}
                            className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white px-3 py-1.5 rounded-lg transition-all text-[10px] font-extrabold shadow-sm inline-flex items-center gap-1"
                          >
                            <ArrowDownLeft size={10} />
                            Restock
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <PaginationControl
              currentPage={currentPageItems}
              totalItems={filteredItems.length}
              pageSize={pageSize}
              onPageChange={setCurrentPageItems}
            />
          </div>
        </div>
      )}

      {/* TAB 2: REQUEST RELEASE / LOG OUTGOING */}
      {activeTab === 'request' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
          {/* Outgoing Form Panel */}
          <div className="lg:col-span-2 glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl">
            <div className="border-b border-dark-700/60 pb-4 mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <ArrowUpRight size={20} className="text-purple-400" />
                Log Material Release Request
              </h2>
              <p className="text-gray-400 text-xs mt-1">
                Record material allocations requested by hotel staff. Needs approval from the Hotel Manager before release.
              </p>
            </div>

            <form onSubmit={handleOutgoingRequestSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Logged By (Giver)</label>
                  <div className="w-full bg-dark-900 border border-dark-700/80 rounded-xl p-3 text-gray-400 font-semibold flex items-center gap-2 select-none">
                    <User size={14} className="text-brand-500" />
                    <span>{currentStaffName}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Department of Receiver *</label>
                  <select
                    value={outgoingForm.department}
                    onChange={e => setOutgoingForm({ ...outgoingForm, department: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                  >
                    {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Receiver Name (Full Name) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chef Emeka, housekeeper Sarah"
                    value={outgoingForm.receiverName}
                    onChange={e => setOutgoingForm({ ...outgoingForm, receiverName: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Select Inventory Item *</label>
                  <select
                    required
                    value={outgoingForm.itemId}
                    onChange={e => setOutgoingForm({ ...outgoingForm, itemId: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-semibold"
                  >
                    <option value="">-- Choose item from stock --</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id} disabled={item.quantity <= 0}>
                        {item.name} ({item.quantity} available — ₦{Number(item.unit_price_ngn).toLocaleString()}/unit)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Quantity to Release *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={outgoingForm.quantity}
                    onChange={e => setOutgoingForm({ ...outgoingForm, quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Request Date *</label>
                  <input
                    type="date"
                    required
                    value={outgoingForm.date}
                    onChange={e => setOutgoingForm({ ...outgoingForm, date: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Request Time *</label>
                  <input
                    type="time"
                    required
                    value={outgoingForm.time}
                    onChange={e => setOutgoingForm({ ...outgoingForm, time: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1.5 uppercase">Reason / Notes (Optional)</label>
                <textarea
                  rows="3"
                  placeholder="Describe material usage or event, e.g. Guest linen replacements Room 102..."
                  value={outgoingForm.notes}
                  onChange={e => setOutgoingForm({ ...outgoingForm, notes: e.target.value })}
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing || !outgoingForm.itemId}
                className="w-full bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 disabled:from-dark-800 disabled:to-dark-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-xl mt-4 transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <ArrowUpRight size={16} />
                    <span>Log Release Request</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Stock Reference Panel */}
          <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl flex flex-col space-y-4">
            <h3 className="font-extrabold text-white flex items-center gap-1.5 text-sm border-b border-dark-700 pb-3">
              <ClipboardList className="text-brand-500" size={16} />
              Stock Availability Helper
            </h3>
            <p className="text-gray-400 text-[10px] leading-relaxed">
              Before submitting a request, verify that standard stores have sufficient stock. Requests exceeding physical balances cannot be processed.
            </p>
            <div className="overflow-y-auto max-h-[300px] space-y-2 pr-1 custom-scrollbar">
              {items.map(i => (
                <div key={i.id} className="bg-dark-900/60 border border-dark-700/40 p-2.5 rounded-xl flex justify-between items-center text-[10px]">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{i.name}</p>
                    <p className="text-gray-500 capitalize">{i.category}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold font-mono ${i.quantity < 10 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-dark-800 text-gray-300 border border-dark-700'}`}>
                    {i.quantity} Left
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RELEASE APPROVALS QUEUE */}
      {activeTab === 'approvals' && hasStoreKeepingAdmin && (
        <div className="space-y-6 animate-fade-in">
          {/* RLS/Role Restriction Warning if staff isn't Manager */}
          {!isApprover ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
              <div className="glass-panel max-w-md w-full p-8 border border-red-500/20 rounded-3xl shadow-2xl flex flex-col items-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 animate-pulse">
                  <ShieldCheck size={32} />
                </div>
                <h2 className="text-xl font-black text-white mb-2 font-serif">Approval Access Restricted</h2>
                <p className="text-gray-400 text-xs mb-4 leading-relaxed">
                  Only the **Hotel Manager**, **Super Admins**, or **Admins** have authority to authorize outgoing material releases from standard hotel stores.
                </p>
                <p className="text-[10px] text-gray-500">
                  Standard staff can submit release requests, but they must be reviewed by the General Manager before items leave standard inventory.
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl space-y-4">
              <div className="border-b border-dark-700/60 pb-4">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <ShieldCheck className="text-brand-500" />
                  General Manager Release Authorizations
                </h2>
                <p className="text-gray-400 text-xs mt-1">
                  Approve pending outgoing requests to update the physical store balances, or decline requests.
                </p>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="py-24 text-center text-gray-500">
                  <CheckCircle size={32} className="mx-auto mb-2 opacity-30 text-green-500 animate-pulse" />
                  <p className="text-sm">Excellent! No pending material release requests awaiting review.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-dark-700 bg-dark-900/20">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-dark-900/60 border-b border-dark-700 text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="p-4 font-bold">Request Date</th>
                        <th className="p-4 font-bold">Giver (Staff)</th>
                        <th className="p-4 font-bold">Receiver Account</th>
                        <th className="p-4 font-bold">Target Department</th>
                        <th className="p-4 font-bold">Item Requested</th>
                        <th className="p-4 font-bold text-center">Qty</th>
                        <th className="p-4 font-bold">Total Cost</th>
                        <th className="p-4 font-bold">Notes</th>
                        <th className="p-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {paginatedApprovals.map(log => {
                        const totalVal = log.quantity * log.price_at_transaction;
                        return (
                          <tr key={log.id} className="hover:bg-dark-700/20 transition-colors">
                            <td className="p-4 text-gray-400 font-mono text-[10px]">
                              {format(new Date(log.transaction_date), 'MMM dd, HH:mm')}
                            </td>
                            <td className="p-4 text-gray-300 font-medium">{log.giver_name}</td>
                            <td className="p-4 text-white font-extrabold">{log.receiver_name}</td>
                            <td className="p-4 text-gray-400 uppercase text-[9px] font-bold">
                              {log.department}
                            </td>
                            <td className="p-4">
                              <p className="font-extrabold text-white text-xs">{log.store_items?.name || 'F&B Item'}</p>
                              <span className="inline-block bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[9px] px-2 py-0.5 rounded-full font-bold mt-1 font-sans">
                                Qty: {log.quantity}
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-white font-mono">{log.quantity}</td>
                            <td className="p-4 font-black text-brand-400">₦{totalVal.toLocaleString()}</td>
                            <td className="p-4 text-gray-500 max-w-xs truncate" title={log.notes}>{log.notes}</td>
                            <td className="p-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button 
                                  onClick={() => handleDeclineRelease(log)}
                                  className="bg-dark-850 hover:bg-red-500/10 text-gray-500 hover:text-red-400 p-2 rounded-lg border border-dark-700 transition-all font-bold"
                                  title="Decline request"
                                >
                                  <XCircle size={14} />
                                </button>
                                <button 
                                  onClick={() => handleApproveRelease(log)}
                                  className="bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white px-3 py-2 rounded-lg border border-brand-500/20 transition-all font-bold flex items-center gap-1 text-[10px] shadow"
                                >
                                  <CheckCircle size={12} />
                                  Approve & Release
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <PaginationControl
                    currentPage={currentPageApprovals}
                    totalItems={pendingApprovals.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPageApprovals}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* TAB 5: PROCUREMENT WORKSPACE */}
      {activeTab === 'procurement' && hasStoreKeepingAdmin && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-5 border border-dark-700/60 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-bl-full group-hover:bg-yellow-500/10 transition-colors" />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Pending Procurements</p>
              <h3 className="text-2xl font-black text-white mt-2">
                {purchaseRequests.filter(r => r.status === 'pending_purchase').length} Requests
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">Active purchase orders currently outstanding.</p>
            </div>

            <div className="glass-panel p-5 border border-dark-700/60 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-bl-full group-hover:bg-green-500/10 transition-colors" />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Estimated Outlay</p>
              <h3 className="text-2xl font-black text-brand-400 mt-2">
                ₦{purchaseRequests
                  .filter(r => r.status === 'pending_purchase')
                  .reduce((sum, r) => sum + Number(r.estimated_cost || 0), 0)
                  .toLocaleString()}
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">Total estimated funds required for outstanding requests.</p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-dark-800 p-4 border border-dark-700/60 rounded-2xl shadow-md">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Procurement Registry</h3>
              <p className="text-gray-400 text-xs">Create new purchase requests and manage stock receipt operations.</p>
            </div>
            <button 
              onClick={() => setIsPurchaseModalOpen(true)}
              className="w-full md:w-auto bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow"
            >
              <PlusCircle size={16} />
              Create Purchase Request
            </button>
          </div>

          {/* Requests Table */}
          <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl overflow-x-auto">
            {purchaseRequests.length === 0 ? (
              <div className="py-24 text-center text-gray-500">
                <ListOrdered size={32} className="mx-auto mb-2 opacity-30 animate-pulse" />
                <p className="text-sm">No procurement purchase requests recorded yet.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-900/60 border-b border-dark-700 text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-bold">Date Requested</th>
                    <th className="p-4 font-bold">Requested Item</th>
                    <th className="p-4 font-bold text-center">Qty</th>
                    <th className="p-4 font-bold">Est. Cost</th>
                    <th className="p-4 font-bold">Purchaser</th>
                    <th className="p-4 font-bold">Notes / Reason</th>
                    <th className="p-4 font-bold text-center">Status</th>
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {paginatedProcurements.map(req => (
                    <tr key={req.id} className="hover:bg-dark-700/20 transition-colors">
                      <td className="p-4 text-gray-400 font-mono text-[10px]">
                        {format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td className="p-4">
                        <div className="font-extrabold text-white text-xs">{req.item_name}</div>
                        {req.item_id ? (
                          <span className="inline-block bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[8px] px-1.5 py-0.5 rounded-full font-bold mt-1 font-sans">
                            Registered Catalog Product
                          </span>
                        ) : (
                          <span className="inline-block bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[8px] px-1.5 py-0.5 rounded-full font-bold mt-1 font-sans">
                            New Custom Request
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-bold text-white font-mono">{req.quantity}</td>
                      <td className="p-4 font-black text-brand-400">₦{Number(req.estimated_cost || 0).toLocaleString()}</td>
                      <td className="p-4 text-gray-300 font-semibold">{req.purchaser_name}</td>
                      <td className="p-4 text-gray-400 max-w-xs truncate" title={req.notes}>{req.notes || '-'}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          req.status === 'completed_retired'
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse'
                        }`}>
                          {req.status === 'completed_retired' ? 'Retired / Bought' : 'Pending Purchase'}
                        </span>
                        {req.retired_at && (
                          <div className="text-[8px] text-gray-500 mt-1">
                            Retired by: {req.retired_by}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end items-center">
                          {req.status === 'pending_purchase' && (
                            isStoreOfficer ? (
                              <button
                                onClick={() => handleRetirePurchase(req)}
                                className="bg-green-500/10 hover:bg-green-500 border border-green-500/20 text-green-400 hover:text-white px-3 py-1.5 rounded-lg transition-all text-[10px] font-extrabold shadow-sm inline-flex items-center gap-1"
                              >
                                <CheckCircle size={10} />
                                Retire & Restock
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-500 font-bold italic">
                                Awaiting Officer
                              </span>
                            )
                          )}
                          {req.status === 'completed_retired' && (
                            <>
                              <span className="text-green-500 font-extrabold text-[10px] flex items-center gap-1 mr-1">
                                ✓ Restocked
                              </span>
                              <button
                                onClick={() => handlePrintPurchaseRequest(req)}
                                className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white px-2 py-1 rounded transition-all text-[10px] font-extrabold shadow-sm flex items-center gap-1"
                                title="Print Purchase Order Requisition Slip"
                              >
                                📥 Print Requisition
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <PaginationControl
              currentPage={currentPageProcurement}
              totalItems={purchaseRequests.length}
              pageSize={pageSize}
              onPageChange={setCurrentPageProcurement}
            />
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT HISTORY */}
      {activeTab === 'logs' && hasStoreKeepingAdmin && (
        <div className="space-y-6 animate-fade-in">
          {/* Auditing controls bar */}
          <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-dark-800 p-4 border border-dark-700/60 rounded-2xl shadow-md">
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="flex items-center gap-2 mr-1">
                <Filter size={14} className="text-gray-500" />
                <span className="text-xs text-gray-400 font-bold uppercase">Log Audits Filters</span>
              </div>

              <select
                value={logTypeFilter}
                onChange={e => setLogTypeFilter(e.target.value)}
                className="bg-dark-900 border border-dark-700/80 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand-500"
              >
                <option value="all">All Transactions</option>
                <option value="incoming">📥 Restocks (Incoming)</option>
                <option value="outgoing">📤 Releases (Outgoing)</option>
              </select>

              <select
                value={logDeptFilter}
                onChange={e => setLogDeptFilter(e.target.value)}
                className="bg-dark-900 border border-dark-700/80 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand-500"
              >
                <option value="all">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>

              <div className="flex items-center gap-2 bg-dark-900 border border-dark-700/80 rounded-xl px-2.5 py-1.5">
                <Calendar size={12} className="text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider">From:</span>
                <input 
                  type="date"
                  value={logStartDate}
                  onChange={e => setLogStartDate(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="bg-transparent text-xs text-white outline-none focus:text-brand-500 font-bold font-mono"
                />
              </div>

              <div className="flex items-center gap-2 bg-dark-900 border border-dark-700/80 rounded-xl px-2.5 py-1.5">
                <Calendar size={12} className="text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider">To:</span>
                <input 
                  type="date"
                  value={logEndDate}
                  onChange={e => setLogEndDate(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="bg-transparent text-xs text-white outline-none focus:text-brand-500 font-bold font-mono"
                />
              </div>

              {(logStartDate || logEndDate) && (
                <button
                  onClick={() => { setLogStartDate(''); setLogEndDate(''); }}
                  className="text-[10px] text-brand-400 hover:text-white bg-brand-500/10 hover:bg-brand-500/20 px-2 py-1 rounded transition-colors font-bold uppercase"
                >
                  Clear Date
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
              <div className="relative">
                <button 
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow"
                >
                  <span>Export Ledger</span>
                  <ChevronDown size={14} className={`transform transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isExportDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsExportDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-dark-900 border border-dark-700/80 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden animate-fade-in">
                      <button 
                        onClick={() => { exportToCSV(); setIsExportDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-dark-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <span>📥</span>
                        <span>Download CSV (.csv)</span>
                      </button>
                      <button 
                        onClick={() => { exportToExcel(); setIsExportDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-dark-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <span>📊</span>
                        <span>Excel Sheet (.xlsx)</span>
                      </button>
                      <button 
                        onClick={() => { exportToPDF(); setIsExportDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-dark-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <span>📄</span>
                        <span>Official PDF Report</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="h-6 w-px bg-dark-700 mx-1"></div>
              <button 
                onClick={fetchStoreData}
                className="bg-dark-900 hover:bg-dark-700 border border-dark-700 text-gray-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                Refresh Log
              </button>
            </div>
          </div>

          {/* Audit Logs list */}
          <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl overflow-x-auto">
            {filteredLogs.length === 0 ? (
              <div className="py-24 text-center text-gray-500">
                <Clock size={32} className="mx-auto mb-2 opacity-30 animate-pulse" />
                <p className="text-sm">No transaction log entries matching filter conditions.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-900/60 border-b border-dark-700 text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th onClick={() => handleSort('date')} className="p-4 font-bold cursor-pointer hover:text-white select-none transition-colors">
                      Timestamp{renderSortIndicator('date')}
                    </th>
                    <th className="p-4 font-bold select-none">Item</th>
                    <th className="p-4 font-bold select-none">Action/Type</th>
                    <th className="p-4 font-bold select-none">Quantity</th>
                    <th onClick={() => handleSort('department')} className="p-4 font-bold cursor-pointer hover:text-white select-none transition-colors">
                      Dept{renderSortIndicator('department')}
                    </th>
                    <th onClick={() => handleSort('giver')} className="p-4 font-bold cursor-pointer hover:text-white select-none transition-colors">
                      Giver (Staff){renderSortIndicator('giver')}
                    </th>
                    <th onClick={() => handleSort('receiver')} className="p-4 font-bold cursor-pointer hover:text-white select-none transition-colors">
                      Receiver{renderSortIndicator('receiver')}
                    </th>
                    <th className="p-4 font-bold select-none">Status</th>
                    <th onClick={() => handleSort('approver')} className="p-4 font-bold cursor-pointer hover:text-white select-none transition-colors">
                      Approver{renderSortIndicator('approver')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {paginatedLogs.map(log => (
                    <tr key={log.id} className="hover:bg-dark-700/20 transition-colors">
                      <td className="p-4 text-gray-400 font-mono text-[10px]">
                        {format(new Date(log.transaction_date), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td className="p-4">
                        <p className="font-extrabold text-white text-xs">{log.store_items?.name || 'Deleted Product'}</p>
                        <span className="inline-block bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[9px] px-1.5 py-0.5 rounded-md font-bold mt-1 font-sans">
                          Qty: {log.quantity}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${log.log_type === 'incoming' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                          {log.log_type === 'incoming' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                          {log.log_type}
                        </span>
                      </td>
                      <td className="p-4 font-black font-mono">
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider inline-block">
                          {log.quantity} Units
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 font-bold uppercase text-[9px]">{log.department || 'N/A'}</td>
                      <td className="p-4 text-gray-300">{log.giver_name}</td>
                      <td className="p-4 text-gray-300 font-bold">{log.receiver_name || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          log.status === 'approved' || log.status === 'approved_released'
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                            : log.status === 'pending_approval'
                              ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse'
                              : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {log.status === 'approved_released' ? 'released' : log.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 font-medium italic">{log.approved_by || 'System Auto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <PaginationControl
              currentPage={currentPageLogs}
              totalItems={filteredLogs.length}
              pageSize={pageSize}
              onPageChange={setCurrentPageLogs}
            />
          </div>
        </div>
      )}

      {/* 3. REGISTER NEW INVENTORY ITEM MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="glass-panel max-w-md w-full border border-dark-700/80 p-6 rounded-3xl shadow-2xl relative">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            
            <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
              <PlusCircle size={22} className="text-brand-500" />
              Register New Stock Item
            </h2>
            <p className="text-gray-400 text-xs mb-6">
              Create an entirely new physical item record in the master store registry database.
            </p>

            <form onSubmit={handleAddNewItemSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 font-bold mb-1.5 uppercase">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Toiletries Kits, High-Grade Towels"
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Price / Unit (NGN)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 5000"
                    value={newItem.unit_price_ngn}
                    onChange={e => setNewItem({ ...newItem, unit_price_ngn: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Select Category</label>
                  <select
                    value={newItem.category}
                    onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-semibold"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1.5 uppercase">Starting Stock Quantity</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="e.g. 50"
                  value={newItem.quantity}
                  onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1.5 uppercase">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Describe material type, dimensions, manufacturer, usage..."
                  value={newItem.description}
                  onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 text-white font-bold py-3 rounded-xl mt-4 transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <Check size={16} />
                    <span>Register New Stock Item</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. RESTOCK INCOMING INVENTORY MODAL */}
      {isRestockModalOpen && selectedRestockItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="glass-panel max-w-md w-full border border-dark-700/80 p-6 rounded-3xl shadow-2xl relative">
            <button 
              onClick={() => {
                setIsRestockModalOpen(false);
                setSelectedRestockItem(null);
              }}
              className="absolute right-4 top-4 p-1.5 bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            
            <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
              <ArrowDownLeft size={22} className="text-green-400" />
              Inventory Restock addition
            </h2>
            <p className="text-gray-400 text-xs mb-6">
              Log incoming stock updates for <strong className="text-white">"{selectedRestockItem.name}"</strong> to increase stores.
            </p>

            <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Quantity to Add</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={restockQty}
                    onChange={e => setRestockQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-bold mb-1.5 uppercase">Unit Price (NGN)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={restockPrice}
                    onChange={e => setRestockPrice(e.target.value)}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1.5 uppercase">Authorized Storekeeper (Giver)</label>
                <input
                  type="text"
                  required
                  placeholder="Full name of storekeeper"
                  value={restockGiver}
                  onChange={e => setRestockGiver(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1.5 uppercase">Notes (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Restock supplier, bulk purchase invoice details..."
                  value={restockNotes}
                  onChange={e => setRestockNotes(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-tr from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold py-3 rounded-xl mt-4 transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Confirm Restock log</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. CREATE PROCUREMENT PURCHASE REQUEST MODAL */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:hidden overflow-y-auto">
          <div className="glass-panel max-w-2xl w-full border border-dark-700/80 p-6 rounded-3xl shadow-2xl relative my-8">
            <button 
              onClick={() => setIsPurchaseModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            
            <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2">
              <ListOrdered size={22} className="text-brand-500" />
              Create Purchase Request
            </h2>
            <p className="text-gray-400 text-xs mb-6">
              Submit a procurement request for standard hotel store inventory consumables. Add multiple items in one batch.
            </p>

            <form onSubmit={handleCreatePurchaseRequest} className="space-y-6 text-xs">
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {newPurchaseItems.map((item, index) => (
                  <div key={index} className="bg-dark-900/60 border border-dark-700/40 p-4 rounded-2xl relative space-y-3">
                    {newPurchaseItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...newPurchaseItems];
                          updated.splice(index, 1);
                          setNewPurchaseItems(updated);
                        }}
                        className="absolute top-3 right-3 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 p-1.5 rounded-lg border border-red-500/10 transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-400 font-bold mb-1.5 uppercase">Item Type</label>
                        <select
                          value={item.itemId ? "existing" : "new"}
                          onChange={e => {
                            const isExisting = e.target.value === 'existing';
                            const updated = [...newPurchaseItems];
                            updated[index] = {
                              ...item,
                              itemId: isExisting && items.length > 0 ? items[0].id : '',
                              itemName: isExisting && items.length > 0 ? items[0].name : ''
                            };
                            setNewPurchaseItems(updated);
                          }}
                          className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-semibold"
                        >
                          <option value="new">🆕 Brand New Custom Item</option>
                          <option value="existing">📦 Restock Existing Catalog Item</option>
                        </select>
                      </div>

                      {item.itemId ? (
                        <div>
                          <label className="block text-gray-400 font-bold mb-1.5 uppercase">Select Catalog Item *</label>
                          <select
                            required
                            value={item.itemId}
                            onChange={e => {
                              const selected = items.find(i => i.id === e.target.value);
                              const updated = [...newPurchaseItems];
                              updated[index] = { ...item, itemId: e.target.value, itemName: selected ? selected.name : '' };
                              setNewPurchaseItems(updated);
                            }}
                            className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-semibold"
                          >
                            {items.map(catItem => (
                              <option key={catItem.id} value={catItem.id}>
                                {catItem.name} ({catItem.quantity} in stock)
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-gray-400 font-bold mb-1.5 uppercase">Custom Item Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Premium White Toilet Paper Rolls"
                            value={item.itemName}
                            onChange={e => {
                              const updated = [...newPurchaseItems];
                              updated[index] = { ...item, itemName: e.target.value };
                              setNewPurchaseItems(updated);
                            }}
                            className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-semibold"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-gray-400 font-bold mb-1.5 uppercase">Quantity Required *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={e => {
                            const updated = [...newPurchaseItems];
                            updated[index] = { ...item, quantity: Math.max(1, Number(e.target.value)) };
                            setNewPurchaseItems(updated);
                          }}
                          className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-bold font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 font-bold mb-1.5 uppercase">Unit Price (NGN) *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="e.g. 5000"
                          value={item.unitPrice}
                          onChange={e => {
                            const updated = [...newPurchaseItems];
                            updated[index] = { ...item, unitPrice: e.target.value };
                            setNewPurchaseItems(updated);
                          }}
                          className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-white focus:border-brand-500 outline-none font-bold font-mono"
                        />
                      </div>
                      <div>
                        <span className="block text-gray-500 font-bold mb-1.5 uppercase">Total Price</span>
                        <div className="w-full bg-dark-900 border border-dark-700/60 rounded-xl p-2.5 text-brand-400 font-black text-sm select-none font-mono">
                          ₦{(item.quantity * Number(item.unitPrice || 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center bg-dark-900/40 p-3 rounded-2xl border border-dark-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setNewPurchaseItems([
                      ...newPurchaseItems,
                      { itemId: '', itemName: '', quantity: 1, unitPrice: '' }
                    ]);
                  }}
                  className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <PlusCircle size={14} />
                  Add Another Item
                </button>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Total Estimated Outlay</span>
                  <span className="text-sm font-black text-brand-400 font-mono">
                    ₦{newPurchaseItems.reduce((sum, item) => sum + (item.quantity * Number(item.unitPrice || 0)), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1.5 uppercase">Notes / Procurement Description</label>
                <textarea
                  rows="2"
                  placeholder="Describe overall procurement reasoning, supplier details, target suite upgrades..."
                  value={newPurchaseNotes}
                  onChange={e => setNewPurchaseNotes(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-white focus:border-brand-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 text-white font-bold py-3 rounded-xl mt-2 transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <Check size={16} />
                    <span>Confirm & Log {newPurchaseItems.length} Purchase Requests</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreKeeping;

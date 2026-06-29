import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../lib/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, FileText, 
  Plus, Search, Filter, Download, ArrowUpRight, ArrowDownRight, 
  Wallet, User, PlusCircle, Check, Printer, Clock, Building, 
  ChevronRight, Sparkles, X, ChevronLeft, Archive 
} from 'lucide-react';
import StoreRequisitionModal from '../../components/admin/StoreRequisitionModal';
import Pagination from '../../components/Pagination';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, 
  BarChart, Bar 
} from 'recharts';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CATEGORIES = ['Salaries', 'Utilities', 'Maintenance', 'Marketing', 'Supplies', 'Taxes', 'Rent', 'Other'];
const PAYMENT_METHODS = ['stripe', 'paystack', 'paypal', 'bank_transfer', 'pos', 'cash', 'ar'];

const CHART_COLORS = [
  '#DF6853', '#EAB308', '#22C55E', '#3B82F6', 
  '#A855F7', '#EC4899', '#06B6D4', '#F97316'
];

const AdminAccounting = () => {
  const { user, profile, hasAccess } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isRequisitionOpen, setIsRequisitionOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Dynamic Contact & White-label Info
  const [contactInfo, setContactInfo] = useState({
    address: 'No2. Gowon P Haruna Close, Karu, Abuja',
    phone: '08033214684, 08062332639, 08171278657',
    email: 'info@Freshlandhotels.com',
    companyName: 'Freshland',
    logo: ''
  });

  // System Data
  const [properties, setProperties] = useState([]);
  const [staff, setStaff] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [inflows, setInflows] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Filter States
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerType, setLedgerType] = useState('all');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  // Report & Filter States
  const [reportStartDate, setReportStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportSubTab, setReportSubTab] = useState('pnl');
  const [reportProperty, setReportProperty] = useState('all');
  const [activeReportModal, setActiveReportModal] = useState(null);

  // Modals & Forms
  const [showLogExpense, setShowLogExpense] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    property_id: '',
    amount: '',
    category: 'Utilities',
    description: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    paid_to: '',
    payment_method: 'bank_transfer',
    status: 'paid'
  });

  const [showProcessPayroll, setShowProcessPayroll] = useState(false);
  const [selectedStaffMember, setSelectedStaffMember] = useState(null);
  const [calculatingAttendance, setCalculatingAttendance] = useState(false);
  const [attendanceAuditNotes, setAttendanceAuditNotes] = useState('');
  const [payrollForm, setPayrollForm] = useState({
    base_salary: 150000,
    allowances: 0,
    extra_bonuses: 0,
    bonuses: 0,
    deductions: 0,
    pay_period_start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    pay_period_end: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
    payment_method: 'bank_transfer',
    status: 'paid',
    notes: ''
  });

  const [activePayslip, setActivePayslip] = useState(null);
  const [showBankSettlementModal, setShowBankSettlementModal] = useState(false);
  const [settlementMonth, setSettlementMonth] = useState(new Date().getMonth()); // 0-indexed
  const [settlementYear, setSettlementYear] = useState(new Date().getFullYear());

  // Phase 55 states
  const [debtors, setDebtors] = useState([]);
  const [arAccounts, setArAccounts] = useState([]);
  const [crmGuests, setCrmGuests] = useState([]);
  const [groupAccounts, setGroupAccounts] = useState([]);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [selectedStatementGroup, setSelectedStatementGroup] = useState(null);
  const [showGroupStatementModal, setShowGroupStatementModal] = useState(false);
  const [groupBookings, setGroupBookings] = useState([]);
  const [loadingGroupBookings, setLoadingGroupBookings] = useState(false);
  const [closedGroupAccounts, setClosedGroupAccounts] = useState([]);
  const [departmentalClosures, setDepartmentalClosures] = useState([]);
  const [departmentalCloseReports, setDepartmentalCloseReports] = useState([]);
  const [selectedCloseReport, setSelectedCloseReport] = useState(null);
  const [isCloseReportModalOpen, setIsCloseReportModalOpen] = useState(false);
  const [debtorSearch, setDebtorSearch] = useState('');
  const [debtorFilter, setDebtorFilter] = useState('all');

  const ITEMS_PER_PAGE = 50;
  const [expensePage, setExpensePage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [arPage, setArPage] = useState(1);
  const [arSearchTerm, setArSearchTerm] = useState('');
  const [corporateBookings, setCorporateBookings] = useState([]);
  
  // Debt settlement states
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementMethod, setSettlementMethod] = useState('cash');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isProcessingSettlement, setIsProcessingSettlement] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  // AR Wallet states
  const [showARAddModal, setShowARAddModal] = useState(false);
  const [showARDepositModal, setShowARDepositModal] = useState(false);
  const [activeARWallet, setActiveARWallet] = useState(null);
  const [arDepositAmount, setArDepositAmount] = useState('');
  const [arDepositMethod, setArDepositMethod] = useState('cash');
  const [arDepositNotes, setArDepositNotes] = useState('');
  const [arNewWalletForm, setArNewWalletForm] = useState({ guest_id: '', initial_balance: '' });
  // AR Statement states
  const [selectedStatementGuest, setSelectedStatementGuest] = useState(null);
  const [showStatementModal, setShowStatementModal] = useState(false);

  // Close of Day states
  const [dailyClosures, setDailyClosures] = useState([]);
  const [closeOfDayData, setCloseOfDayData] = useState(null);
  const [isRunningNightAudit, setIsRunningNightAudit] = useState(false);
  const [showCloseOfDayModal, setShowCloseOfDayModal] = useState(false);
  const [selectedAuditDate, setSelectedAuditDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [timelineFilterDate, setTimelineFilterDate] = useState('');

  // Transaction adjustment states
  const [showVoidCorrectModal, setShowVoidCorrectModal] = useState(false);
  const [voidCorrectTransaction, setVoidCorrectTransaction] = useState(null);
  const [voidCorrectAmount, setVoidCorrectAmount] = useState('');
  const [voidCorrectMethod, setVoidCorrectMethod] = useState('cash');
  const [voidCorrectCategory, setVoidCorrectCategory] = useState('');
  const [voidCorrectNotes, setVoidCorrectNotes] = useState('');
  const [ledgerSubTab, setLedgerSubTab] = useState('all');

  useEffect(() => {
    fetchFinancialData();
    fetchCRMGuests();
    fetchARAccounts();
    fetchDailyClosures();
    fetchDebtorsData();
    fetchClosedGroupAccounts();
    fetchDepartmentalClosures();
  }, []);

  // Real-time synchronization for general accounting updates
  useRealtimeSync(['salary_structures', 'staff_attendance', 'leave_applications', 'payments', 'invoices', 'expenses', 'bookings', 'booking_services', 'refund_settlements'], () => {
    fetchFinancialData();
    fetchDailyClosures();
    fetchDebtorsData();
  });

  useEffect(() => {
    if (activeTab === 'debtors') {
      fetchDebtorsData();
    }
  }, [activeTab]);


  // Graceful Supabase & LocalStorage loader
  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch properties
      const { data: propData, error: propErr } = await supabase.from('properties').select('*');
      const resolvedProperties = propData || [{ id: 'mock-hq', name: 'Luxe Headquarters', base_currency: 'NGN' }];
      setProperties(resolvedProperties);

      // 1b. Fetch contact details and bank source settings from system_settings
      let settingsMap = {};
      try {
        const { data: settingsData } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'contact_address', 
            'contact_phone', 
            'contact_email', 
            'contact_logo', 
            'hotel_bank_name', 
            'hotel_account_name', 
            'hotel_account_number'
          ]);
        
        if (settingsData && settingsData.length > 0) {
          settingsData.forEach(s => {
            settingsMap[s.setting_key] = s.setting_value;
          });
        }
      } catch (err) {
        console.warn("Failed to fetch system settings from database:", err);
      }

      // Check LocalStorage fallbacks or default hardcoded values
      const contactAddress = settingsMap['contact_address'] || localStorage.getItem('contact_address') || 'No2. Gowon P Haruna Close, Karu, Abuja';
      const contactPhone = settingsMap['contact_phone'] || localStorage.getItem('contact_phone') || '08033214684, 08062332639, 08171278657';
      const contactEmail = settingsMap['contact_email'] || localStorage.getItem('contact_email') || 'info@Freshlandhotels.com';
      const contactLogo = settingsMap['contact_logo'] || localStorage.getItem('contact_logo') || '';
      const companyName = resolvedProperties[0]?.name || 'Freshland';

      setContactInfo({
        address: contactAddress,
        phone: contactPhone,
        email: contactEmail,
        companyName: companyName,
        logo: contactLogo,
        hotel_bank_name: settingsMap['hotel_bank_name'] || '',
        hotel_account_name: settingsMap['hotel_account_name'] || '',
        hotel_account_number: settingsMap['hotel_account_number'] || ''
      });

      // 2. Fetch staff members
      const { data: staffData, error: staffErr } = await supabase.from('profiles').select('*').neq('role', 'guest').order('first_name');
      const resolvedStaff = staffData || [];
      setStaff(resolvedStaff);

      // 3. Fetch customer bookings payment inflows
      const { data: paymentData, error: payErr } = await supabase
        .from('payments')
        .select('*, bookings(guest_name, total_amount_ngn)');

      // Fetch in-house room folio POS and Laundry charges from booking_services
      let folioPOSCharges = [];
      let folioLaundryCharges = [];
      try {
        const { data: bsData } = await supabase
          .from('booking_services')
          .select('*, bookings(booking_reference, guest_name, status, rooms(room_number)), services(name, category, internal_notes)')
          .eq('status', 'completed');
        
        if (bsData) {
          folioPOSCharges = bsData.filter(bs => 
            (bs.notes === 'pos_charge' || 
             (bs.services?.internal_notes?.toLowerCase() === 'restaurant' && bs.notes?.startsWith('restaurant_order:'))) && 
            bs.bookings?.status !== 'cancelled' &&
            bs.payment_status !== 'paid'
          );
          folioLaundryCharges = bsData.filter(bs => 
            (bs.services?.category?.toLowerCase() === 'laundry' || 
            bs.services?.name?.toLowerCase()?.includes('laundry') ||
            (bs.notes && (bs.notes.startsWith('laundry_') || bs.notes.includes('laundry_completed')))) &&
            bs.bookings?.status !== 'cancelled' &&
            bs.payment_status !== 'paid'
          );
        }
      } catch (err) {
        console.warn("Failed to fetch booking_services room POS/Laundry charges:", err);
      }
      
      let resolvedInflows = [];
      if (!payErr && paymentData && paymentData.length > 0) {
        resolvedInflows = paymentData.map(p => {
          const isPOS = p.transaction_ref?.startsWith('POS-') || 
                        p.transaction_ref?.startsWith('CORP-CHG-') || 
                        p.transaction_ref?.startsWith('REST-') ||
                        p.notes?.includes('POS Direct Walk-in Sale') || 
                        p.notes?.toLowerCase().includes('pos walk-in') ||
                        p.notes?.toLowerCase().includes('pos corporate charge') ||
                        p.notes?.toLowerCase().includes('restaurant room service') ||
                        p.notes?.toLowerCase().includes('restaurant direct payment') ||
                        p.notes?.toLowerCase().includes('outlet: restaurant') ||
                        p.notes?.toLowerCase().includes('outlet: bar') ||
                        p.notes?.toLowerCase().includes('corporate charge');
          const isLaundry = p.transaction_ref?.startsWith('LDY-') || p.notes?.toLowerCase().includes('laundry');
          const isARDeposit = p.transaction_ref?.startsWith('AR-DEP-') || 
                              p.notes?.toLowerCase().includes('deposit') || 
                              p.notes?.toLowerCase().includes('deposited') || 
                              p.notes?.toLowerCase().includes('initial ar wallet') ||
                              p.notes?.toLowerCase().includes('prepayment wallet deposit') ||
                              p.notes?.toLowerCase().includes('ar prepayment wallet deposit');
          const isAR = p.method === 'ar' || p.method === 'ar_wallet' || p.method === 'ar_prepayment_wallet' ||
                       p.notes?.toLowerCase().includes('ar prepayment') ||
                       p.notes?.toLowerCase().includes('ar wallet') ||
                       p.notes?.toLowerCase().includes('prepayment wallet');
          const isHallBooking = p.hall_booking_id != null || p.transaction_ref?.startsWith('PAY-HALL-') || p.transaction_ref?.startsWith('HALL-WEB-') || p.notes?.toLowerCase().includes('hall booking');
          
          return {
            id: p.id,
            date: p.processed_at || p.created_at,
            amount: Number(p.amount),
            description: isLaundry
              ? p.notes || `Walk-in Laundry direct sale settled via ${p.method.toUpperCase()}`
              : (isPOS 
                ? p.notes || `POS Walk-in Sale settled via ${p.method.toUpperCase()}`
                : (isHallBooking
                  ? p.notes || `Event Hall Booking Payment`
                  : (isARDeposit
                    ? `AR Prepayment Wallet Deposit`
                    : `Guest Booking Payment - ${p.bookings?.guest_name || 'Confirmed Guest'}`))),
            method: isAR ? 'ar' : p.method,
            status: p.status,
            type: 'inflow',
            booking_id: p.booking_id,
            notes: p.notes || '',
            category: isLaundry ? 'Laundry Revenue' : (isPOS ? 'POS Revenue' : (isHallBooking ? 'Event Hall Revenue' : 'Booking Revenue')),
            is_refund: p.is_refund
          };
        });
      } else {
        // Mock seed customer inflows if empty or query failed
        resolvedInflows = [];
      }

      // Append folio POS charges as separate inflows mapped under category 'POS Revenue'!
      if (folioPOSCharges && folioPOSCharges.length > 0) {
        const resolveFolioInflows = folioPOSCharges.map(bs => {
          const isRestaurantOrder = bs.notes?.startsWith('restaurant_order:');
          const outletName = isRestaurantOrder ? 'restaurant' : (bs.services?.internal_notes || 'restaurant');
          return {
            id: bs.id,
            date: bs.created_at,
            amount: Number(bs.total_price_ngn),
            description: `POS Suite Folio Charge [Room ${bs.bookings?.rooms?.room_number || 'N/A'}] — ${bs.services?.name || 'F&B Service'} (x${bs.quantity}) | Guest: ${bs.bookings?.guest_name || 'In-House'} | outlet: ${outletName}`,
            method: 'room_charge',
            status: 'completed',
            type: 'inflow',
            category: 'POS Revenue'
          };
        });
        resolvedInflows = [...resolvedInflows, ...resolveFolioInflows];
      }

      // Append folio Laundry charges as separate inflows mapped under category 'Laundry Revenue'!
      if (folioLaundryCharges && folioLaundryCharges.length > 0) {
        const resolveFolioLaundry = folioLaundryCharges.map(bs => ({
          id: bs.id,
          date: bs.created_at,
          amount: Number(bs.total_price_ngn),
          description: `Laundry Suite Folio Charge [Room ${bs.bookings?.rooms?.room_number || 'N/A'}] — ${bs.services?.name || 'Laundry Service'} (x${bs.quantity}) | Guest: ${bs.bookings?.guest_name || 'In-House'} | Items: ${bs.notes?.replace('laundry_completed:', '').replace('laundry_charge:', '').trim() || 'N/A'}`,
          method: 'room_charge',
          status: 'completed',
          type: 'inflow',
          category: 'Laundry Revenue'
        }));
        resolvedInflows = [...resolvedInflows, ...resolveFolioLaundry];
      }

      // Sort inflows chronologically
      resolvedInflows = resolvedInflows.sort((a, b) => new Date(b.date) - new Date(a.date));

      setInflows(resolvedInflows);

      // 3c. Fetch corporate bookings billed to groups
      try {
        const { data: corpBookings } = await supabase
          .from('bookings')
          .select('*, group_accounts(name, outstanding_balance, credit_limit)')
          .eq('bill_to_group', true)
          .neq('status', 'cancelled');
        setCorporateBookings(corpBookings || []);
      } catch (err) {
        console.warn("Failed to fetch corporate bookings:", err);
      }

      // 3b. Fetch invoices for Accounts Receivable
      const { data: invoiceData } = await supabase.from('invoices').select('*');
      setInvoices(invoiceData || []);

      // 4. Try fetching remote expenses & staff salaries
      const { data: expData, error: expErr } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
      const { data: salData, error: salErr } = await supabase.from('staff_salaries').select('*').order('created_at', { ascending: false });

      if (expErr || salErr) {
        console.warn("Accounting tables missing or inaccessible. expErr:", expErr, "salErr:", salErr);
        setIsUsingFallback(false);
        setExpenses(expData || []);
        setSalaries(salData || []);
      } else {
        setIsUsingFallback(false);
        setExpenses(expData || []);
        setSalaries(salData || []);
      }
      
      // Load standard stay debtors & corporate accounts
      fetchDebtorsData();

    } catch (err) {
      console.error("Critical error fetching accounting data:", err);
      setIsUsingFallback(false);
      setExpenses([]);
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  };

  // Seeding/Loading data from Local Storage
  const loadLocalStorageData = (currProperties, currStaff) => {
    let localExpenses = localStorage.getItem('luxe_expenses');
    let localSalaries = localStorage.getItem('luxe_salaries');
    let localInvoices = localStorage.getItem('luxe_invoices');

    if (!localExpenses) {
      // Seed default mockup expenses
      const seedExp = [
        { id: 'exp-1', property_id: currProperties[0]?.id || 'mock-hq', amount: 45000, category: 'Utilities', description: 'Headquarters electricity bill', expense_date: format(new Date(2026, 4, 10), 'yyyy-MM-dd'), paid_to: 'Nepa Power Corp', payment_method: 'bank_transfer', status: 'paid', created_at: new Date(2026, 4, 10).toISOString() },
        { id: 'exp-2', property_id: currProperties[0]?.id || 'mock-hq', amount: 28000, category: 'Supplies', description: 'Apartment toiletries & linen replenishment', expense_date: format(new Date(2026, 4, 12), 'yyyy-MM-dd'), paid_to: 'SaniSupplies Ltd', payment_method: 'cash', status: 'paid', created_at: new Date(2026, 4, 12).toISOString() },
        { id: 'exp-3', property_id: currProperties[0]?.id || 'mock-hq', amount: 35000, category: 'Marketing', description: 'Facebook advertising campaign', expense_date: format(new Date(2026, 4, 15), 'yyyy-MM-dd'), paid_to: 'Meta Ads', payment_method: 'stripe', status: 'paid', created_at: new Date(2026, 4, 15).toISOString() },
        { id: 'exp-4', property_id: currProperties[0]?.id || 'mock-hq', amount: 15000, category: 'Utilities', description: 'Fibre Internet monthly sub', expense_date: format(new Date(2026, 4, 18), 'yyyy-MM-dd'), paid_to: 'Swift Broadband', payment_method: 'bank_transfer', status: 'paid', created_at: new Date(2026, 4, 18).toISOString() },
        { id: 'exp-5', property_id: currProperties[0]?.id || 'mock-hq', amount: 20000, category: 'Maintenance', description: 'Room 102 air conditioner diagnostic servicing', expense_date: format(new Date(2026, 4, 19), 'yyyy-MM-dd'), paid_to: 'CoolAir Mechanics', payment_method: 'cash', status: 'paid', created_at: new Date(2026, 4, 19).toISOString() }
      ];
      localStorage.setItem('luxe_expenses', JSON.stringify(seedExp));
      localExpenses = JSON.stringify(seedExp);
    }

    if (!localSalaries) {
      // Seed default staff salaries payments matching staff directory if available
      const seedSal = [];
      if (currStaff && currStaff.length > 0) {
        currStaff.slice(0, 3).forEach((s, idx) => {
          seedSal.push({
            id: `sal-seed-${idx}`,
            staff_id: s.id,
            base_salary: s.role === 'accountant' ? 220000 : s.role === 'hotel_manager' ? 250000 : 150000,
            bonuses: idx === 1 ? 25000 : 0,
            deductions: 0,
            net_salary: (s.role === 'accountant' ? 220000 : s.role === 'hotel_manager' ? 250000 : 150000) + (idx === 1 ? 25000 : 0),
            pay_period_start: format(new Date(2026, 3, 1), 'yyyy-MM-dd'),
            pay_period_end: format(new Date(2026, 3, 30), 'yyyy-MM-dd'),
            payment_date: format(new Date(2026, 3, 30), 'yyyy-MM-dd'),
            status: 'paid',
            payment_method: 'bank_transfer',
            notes: 'April Salary Payout',
            created_at: new Date(2026, 3, 30).toISOString()
          });
        });
      }
      localStorage.setItem('luxe_salaries', JSON.stringify(seedSal));
      localSalaries = JSON.stringify(seedSal);
    }

    if (!localInvoices) {
      const seedInv = [
        { id: 'inv-1', invoice_number: 'INV-20260517-06a6', total_amount: 85000, amount_paid: 85000, status: 'paid', issue_date: '2026-05-17', booking_id: 'b1' },
        { id: 'inv-2', invoice_number: 'INV-20260520-5ec4', total_amount: 335000, amount_paid: 0, status: 'draft', issue_date: '2026-05-20', booking_id: 'b2' },
        { id: 'inv-3', invoice_number: 'INV-20260520-024c', total_amount: 235000, amount_paid: 235000, status: 'paid', issue_date: '2026-05-20', booking_id: 'b3' }
      ];
      localStorage.setItem('luxe_invoices', JSON.stringify(seedInv));
      localInvoices = JSON.stringify(seedInv);
    }

    setExpenses(JSON.parse(localExpenses));
    setSalaries(JSON.parse(localSalaries));
    setInvoices(JSON.parse(localInvoices));
  };

  // Add a new expense
  const handleLogExpense = async (e) => {
    e.preventDefault();
    if (!newExpenseForm.amount || isNaN(newExpenseForm.amount) || Number(newExpenseForm.amount) <= 0) {
      return toast.error("Please enter a valid expense amount.");
    }

    const payload = {
      property_id: newExpenseForm.property_id || properties[0]?.id,
      amount: Number(newExpenseForm.amount),
      category: newExpenseForm.category,
      description: newExpenseForm.description,
      expense_date: newExpenseForm.expense_date,
      paid_to: newExpenseForm.paid_to,
      payment_method: newExpenseForm.payment_method,
      status: newExpenseForm.status
    };

    const loadingToast = toast.loading("Logging expense...");

    try {
      if (isUsingFallback) {
        // Fallback to local storage
        const currentLocal = JSON.parse(localStorage.getItem('luxe_expenses') || '[]');
        const newRecord = {
          id: `exp-${Date.now()}`,
          ...payload,
          created_at: new Date().toISOString()
        };
        const updated = [newRecord, ...currentLocal];
        localStorage.setItem('luxe_expenses', JSON.stringify(updated));
        setExpenses(updated);
        toast.success("Expense logged to LocalStorage successfully!", { id: loadingToast });
      } else {
        // Remote write
        const { data, error } = await supabase.from('expenses').insert([payload]).select();
        if (error) throw error;
        setExpenses([data[0], ...expenses]);
        toast.success("Expense logged to Supabase database successfully!", { id: loadingToast });
      }

      // Log activity
      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Logged expense of NGN ${payload.amount} for ${payload.category}`,
          module: 'Accounting'
        });
      } catch (logErr) {
        console.error("Failed to log activity:", logErr);
      }

      setShowLogExpense(false);
      setNewExpenseForm({
        property_id: '',
        amount: '',
        category: 'Utilities',
        description: '',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        paid_to: '',
        payment_method: 'bank_transfer',
        status: 'paid'
      });
    } catch (err) {
      toast.error(`Failed to log expense: ${err.message}`, { id: loadingToast });
    }
  };

  // Open payroll processing panel for a staff member
  const handleOpenProcessPayroll = (staffMember) => {
    setSelectedStaffMember(staffMember);
    
    // Support custom profile-level base salary, allowances, and deductions
    let baseSalary = parseFloat(staffMember.base_salary);
    let defaultBase = 150000;
    if (staffMember.role === 'hotel_manager') defaultBase = 250000;
    if (staffMember.role === 'accountant') defaultBase = 200000;
    if (staffMember.role === 'receptionist') defaultBase = 140000;
    if (staffMember.role === 'housekeeping') defaultBase = 80000;
    if (staffMember.role === 'maintenance') defaultBase = 90000;

    const baseVal = (!isNaN(baseSalary) && baseSalary > 0) ? baseSalary : defaultBase;
    const allowancesVal = parseFloat(staffMember.allowances) || 0;
    const deductionsVal = parseFloat(staffMember.deductions) || 0;

    setPayrollForm({
      base_salary: baseVal,
      allowances: allowancesVal,
      allowances_list: staffMember.allowances_list || [],
      extra_bonuses: 0,
      bonuses: allowancesVal,
      deductions: deductionsVal,
      deductions_list: staffMember.deductions_list || [],
      pay_period_start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
      pay_period_end: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
      payment_method: 'bank_transfer',
      status: 'paid', // Default to paid to auto-sync expense outflow
      notes: ''
    });
    setShowProcessPayroll(true);
  };

  const calculateTotalDeductions = (baseSalary, deductionsList) => {
    if (!deductionsList || !Array.isArray(deductionsList)) return 0;
    const base = parseFloat(baseSalary) || 0;
    return deductionsList.reduce((sum, item) => {
      const val = parseFloat(item.amount) || 0;
      if (item.type === 'percentage') {
        return sum + (base * (val / 100));
      }
      return sum + val;
    }, 0);
  };

  const recalculateAttendanceDeductions = async (staffMember, start, end) => {
    if (!staffMember || !start || !end) return;
    setCalculatingAttendance(true);
    try {
      // 1. Fetch attendance records in period
      const { data: attendance, error: attError } = await supabase
        .from('staff_attendance')
        .select('clock_in, status')
        .eq('staff_id', staffMember.id)
        .gte('clock_in', `${start}T00:00:00Z`)
        .lte('clock_in', `${end}T23:59:59Z`);

      if (attError) throw attError;

      // 2. Fetch approved leaves in period
      const { data: leaves, error: leaveError } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('staff_id', staffMember.id)
        .eq('status', 'approved');

      if (leaveError) throw leaveError;

      // 3. Compute expected working days (based on employee expected_work_days configuration)
      const startDate = new Date(start);
      const endDate = new Date(end);
      let expectedDays = 0;
      let workingDates = [];
      const configuredWorkDays = Array.isArray(staffMember.expected_work_days) && staffMember.expected_work_days.length > 0
        ? staffMember.expected_work_days
        : [1, 2, 3, 4, 5, 6]; // Fallback to Mon-Sat

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (configuredWorkDays.includes(d.getDay())) {
          expectedDays++;
          workingDates.push(new Date(d));
        }
      }

      if (expectedDays === 0) expectedDays = 1; // prevent divide-by-zero

      // 4. Check status of each expected working day
      let daysPresent = 0;
      let daysLeavePaid = 0;
      let daysLeaveUnpaid = 0;
      let daysAbsent = 0;

      workingDates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Check if has attendance record for this day
        const hasClockIn = (attendance || []).some(a => format(new Date(a.clock_in), 'yyyy-MM-dd') === dateStr);
        
        if (hasClockIn) {
          daysPresent++;
        } else {
          // Check if has approved leave for this date
          const activeLeave = (leaves || []).find(l => {
            const startLeave = new Date(l.start_date);
            const endLeave = new Date(l.end_date);
            const checkDate = new Date(dateStr);
            return checkDate >= startLeave && checkDate <= endLeave;
          });

          if (activeLeave) {
            if (activeLeave.leave_type === 'unpaid' || activeLeave.leave_type === 'leave_without_pay') {
              daysLeaveUnpaid++;
            } else {
              daysLeavePaid++;
            }
          } else {
            daysAbsent++;
          }
        }
      });

      // 5. Calculate base and allowances
      let baseSalary = parseFloat(staffMember.base_salary);
      let defaultBase = 150000;
      if (staffMember.role === 'hotel_manager') defaultBase = 250000;
      if (staffMember.role === 'accountant') defaultBase = 200000;
      if (staffMember.role === 'receptionist') defaultBase = 140000;
      if (staffMember.role === 'housekeeping') defaultBase = 80000;
      if (staffMember.role === 'maintenance') defaultBase = 90000;

      const baseVal = (!isNaN(baseSalary) && baseSalary > 0) ? baseSalary : defaultBase;
      const allowancesVal = parseFloat(staffMember.allowances) || 0;
      
      // Calculate standard profile deduction
      let standardDeduction = 0;
      const baseDeductionsList = staffMember.deductions_list || [];
      if (Array.isArray(baseDeductionsList) && baseDeductionsList.length > 0) {
        standardDeduction = calculateTotalDeductions(baseVal, baseDeductionsList);
      } else {
        standardDeduction = parseFloat(staffMember.deductions) || 0;
        if (staffMember.deduction_type === 'percentage') {
          standardDeduction = baseVal * (standardDeduction / 100);
        }
      }

      // Calculate absenteeism deduction if NOT exempt
      let attendancePenalty = 0;
      let dailyPenaltyRate = 0;
      const proRataDailyRate = baseVal / expectedDays;
      const deductionType = staffMember.attendance_deduction_type || 'daily_rate';
      const deductionRate = parseFloat(staffMember.attendance_deduction_rate) || 0;

      if (deductionType === 'fixed') {
        dailyPenaltyRate = deductionRate;
      } else if (deductionType === 'percentage') {
        dailyPenaltyRate = baseVal * (deductionRate / 100);
      } else {
        dailyPenaltyRate = proRataDailyRate;
      }

      if (!staffMember.exempt_from_attendance_deduction) {
        attendancePenalty = daysAbsent * dailyPenaltyRate;
      }

      // Compute Leave Without Pay (LWP) deductions individually to log reasons
      let lwpDeductions = 0;
      const lwpDeductionsDetails = [];

      if (!staffMember.exempt_from_attendance_deduction) {
        (leaves || []).forEach(l => {
          if (l.leave_type === 'unpaid' || l.leave_type === 'leave_without_pay') {
            let leaveLwpDays = 0;
            const startLeave = new Date(l.start_date);
            const endLeave = new Date(l.end_date);
            
            workingDates.forEach(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const checkDate = new Date(dateStr);
              if (checkDate >= startLeave && checkDate <= endLeave) {
                const hasClockIn = (attendance || []).some(a => format(new Date(a.clock_in), 'yyyy-MM-dd') === dateStr);
                if (!hasClockIn) {
                  leaveLwpDays++;
                }
              }
            });

            if (leaveLwpDays > 0) {
              const amt = leaveLwpDays * dailyPenaltyRate;
              lwpDeductions += amt;
              lwpDeductionsDetails.push({
                start_date: l.start_date,
                end_date: l.end_date,
                amount: amt
              });
            }
          }
        });
      }

      const totalDeductions = standardDeduction + attendancePenalty + lwpDeductions;

      // Construct processed deductions list
      const processedDeductionsList = Array.isArray(baseDeductionsList) ? [...baseDeductionsList] : [];
      if (attendancePenalty > 0) {
        processedDeductionsList.push({
          name: "Absenteeism Penalty",
          amount: parseFloat(attendancePenalty.toFixed(2)),
          type: "fixed"
        });
      }

      lwpDeductionsDetails.forEach(detail => {
        processedDeductionsList.push({
          name: `Approved leave without pay from ${detail.start_date} to ${detail.end_date}`,
          amount: parseFloat(detail.amount.toFixed(2)),
          type: "fixed"
        });
      });

      // 6. Set payroll notes
      let auditNote = `Attendance Audit: Out of ${expectedDays} expected shifts in pay period, staff clocked ${daysPresent} present. Exemptions: ${daysLeavePaid} Paid Leaves approved, ${daysLeaveUnpaid} Unpaid Leaves approved. Unexcused Absences: ${daysAbsent}. `;
      
      if (lwpDeductionsDetails.length > 0) {
        lwpDeductionsDetails.forEach(detail => {
          auditNote += `Approved leave without pay from ${detail.start_date} to ${detail.end_date} (-₦${detail.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). `;
        });
      }

      if (attendancePenalty > 0) {
        auditNote += staffMember.exempt_from_attendance_deduction 
          ? `[Attendance Penalty Exempted due to Override]` 
          : `Absenteeism Deduction: -₦${attendancePenalty.toLocaleString('en-US', { minimumFractionDigits: 2 })} (₦${dailyPenaltyRate.toLocaleString('en-US', { maximumFractionDigits: 0 })}/day).`;
      }

      setAttendanceAuditNotes(auditNote);

      setPayrollForm(prev => ({
        ...prev,
        base_salary: baseVal,
        allowances: allowancesVal,
        bonuses: allowancesVal + (prev.extra_bonuses || 0),
        deductions: parseFloat(totalDeductions.toFixed(2)),
        deductions_list: processedDeductionsList,
        notes: auditNote.trim()
      }));

    } catch (e) {
      console.warn("Failed to calculate attendance deductions:", e.message);
    } finally {
      setCalculatingAttendance(false);
    }
  };

  useEffect(() => {
    if (selectedStaffMember && showProcessPayroll) {
      recalculateAttendanceDeductions(
        selectedStaffMember, 
        payrollForm.pay_period_start, 
        payrollForm.pay_period_end
      );
    }
  }, [selectedStaffMember, payrollForm.pay_period_start, payrollForm.pay_period_end, showProcessPayroll]);

  // Submit Payroll / salary payout
  const handleSubmitPayroll = async (e) => {
    e.preventDefault();
    if (!selectedStaffMember) return;

    const base = Number(payrollForm.base_salary);
    const bonus = Number(payrollForm.bonuses);
    const ded = Number(payrollForm.deductions);
    const net = base + bonus - ded;

    const evaluatedTotalDeductions = calculateTotalDeductions(base, payrollForm.deductions_list || []);
    let finalDeductionsPayloadList = payrollForm.deductions_list || [];

    if (Math.abs(evaluatedTotalDeductions - ded) > 0.01) {
      // The user modified the deductions input field manually! Add a manual override item
      finalDeductionsPayloadList = [
        ...finalDeductionsPayloadList,
        {
          name: "Manual Adjustment",
          amount: parseFloat((ded - evaluatedTotalDeductions).toFixed(2)),
          type: "fixed"
        }
      ];
    }

    const payload = {
      staff_id: selectedStaffMember.id,
      base_salary: base,
      bonuses: bonus,
      deductions: ded,
      deductions_list: finalDeductionsPayloadList,
      allowances_list: payrollForm.allowances_list || [],
      pay_period_start: payrollForm.pay_period_start,
      pay_period_end: payrollForm.pay_period_end,
      payment_method: payrollForm.payment_method,
      status: payrollForm.status,
      notes: payrollForm.notes,
      payment_date: format(new Date(), 'yyyy-MM-dd')
    };

    const loadingToast = toast.loading("Processing staff payroll...");

    try {
      if (isUsingFallback) {
        // Fallback to local storage
        const currentLocalSal = JSON.parse(localStorage.getItem('luxe_salaries') || '[]');
        const newSalRecord = {
          id: `sal-${Date.now()}`,
          net_salary: net,
          ...payload,
          created_at: new Date().toISOString()
        };
        const updatedSal = [newSalRecord, ...currentLocalSal];
        localStorage.setItem('luxe_salaries', JSON.stringify(updatedSal));
        setSalaries(updatedSal);

        // Client-side auto-sync to expense ledger if marked PAID
        if (payload.status === 'paid') {
          const currentLocalExp = JSON.parse(localStorage.getItem('luxe_expenses') || '[]');
          const newExpRecord = {
            id: `exp-sal-${Date.now()}`,
            property_id: properties[0]?.id || 'mock-hq',
            amount: net,
            category: 'Salaries',
            description: `Salary payout to ${selectedStaffMember.first_name} ${selectedStaffMember.last_name} for period ${format(new Date(payload.pay_period_start), 'MMM dd')} to ${format(new Date(payload.pay_period_end), 'MMM dd, yyyy')}. ${payload.notes}`,
            expense_date: payload.payment_date,
            paid_to: `${selectedStaffMember.first_name} ${selectedStaffMember.last_name}`,
            payment_method: payload.payment_method,
            status: 'paid',
            created_at: new Date().toISOString()
          };
          const updatedExp = [newExpRecord, ...currentLocalExp];
          localStorage.setItem('luxe_expenses', JSON.stringify(updatedExp));
          setExpenses(updatedExp);
        }

        toast.success("Payroll processed and locked in LocalStorage!", { id: loadingToast });
      } else {
        // Remote write staff_salaries. 
        // Postgres trigger `trigger_sync_salary_expense` automatically creates salaries expense on PAID transition.
        let insertPayload = { ...payload };
        let result = await supabase.from('staff_salaries').insert([insertPayload]).select();
        
        if (result.error && result.error.message && (result.error.message.includes('deductions_list') || result.error.message.includes('allowances_list'))) {
          console.warn("Database schema cache missing list columns. Retrying insert without list columns...");
          const fallbackPayload = { ...insertPayload };
          delete fallbackPayload.deductions_list;
          delete fallbackPayload.allowances_list;
          result = await supabase.from('staff_salaries').insert([fallbackPayload]).select();
        }
        
        if (result.error) throw result.error;
        
        const data = result.data;
        setSalaries([data[0], ...salaries]);

        // Refetch expenses to show the auto-created Salaries expense record
        const { data: freshExpenses } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
        if (freshExpenses) setExpenses(freshExpenses);

        toast.success("Payroll processed and saved to database!", { id: loadingToast });
      }

      try {
        await supabase.from('system_logs').insert({
          user_id: profile?.id,
          log_type: 'activity',
          action: `Processed salary payroll for ${selectedStaffMember.first_name} (${payrollForm.status})`,
          module: 'Accounting'
        });
      } catch (logErr) {
        console.error("Failed to log activity:", logErr);
      }

      setShowProcessPayroll(false);
      setSelectedStaffMember(null);
    } catch (err) {
      toast.error(`Failed to process payroll: ${err.message}`, { id: loadingToast });
    }
  };

  // Manual Trigger: Mark pending payroll as PAID and sync
  const handleMarkPayrollAsPaid = async (payrollItem) => {
    const loadingToast = toast.loading("Updating payout status...");
    try {
      if (isUsingFallback) {
        // Local fallback
        const currentSalaries = JSON.parse(localStorage.getItem('luxe_salaries') || '[]');
        const targetStaff = staff.find(s => s.id === payrollItem.staff_id) || { first_name: 'Staff', last_name: 'Member' };
        
        const updated = currentSalaries.map(s => {
          if (s.id === payrollItem.id) {
            return { ...s, status: 'paid', payment_date: format(new Date(), 'yyyy-MM-dd') };
          }
          return s;
        });
        localStorage.setItem('luxe_salaries', JSON.stringify(updated));
        setSalaries(updated);

        // Sync Salaries Expense manually
        const currentExpenses = JSON.parse(localStorage.getItem('luxe_expenses') || '[]');
        const newExpRecord = {
          id: `exp-sal-manual-${Date.now()}`,
          property_id: properties[0]?.id || 'mock-hq',
          amount: payrollItem.net_salary || (payrollItem.base_salary + payrollItem.bonuses - payrollItem.deductions),
          category: 'Salaries',
          description: `Salary payout to ${targetStaff.first_name} ${targetStaff.last_name} for period ${format(new Date(payrollItem.pay_period_start), 'MMM dd')} to ${format(new Date(payrollItem.pay_period_end), 'MMM dd, yyyy')}.`,
          expense_date: format(new Date(), 'yyyy-MM-dd'),
          paid_to: `${targetStaff.first_name} ${targetStaff.last_name}`,
          payment_method: payrollItem.payment_method,
          status: 'paid',
          created_at: new Date().toISOString()
        };
        const updatedExp = [newExpRecord, ...currentExpenses];
        localStorage.setItem('luxe_expenses', JSON.stringify(updatedExp));
        setExpenses(updatedExp);
        toast.success("Payroll status marked as paid and synced to expenses!", { id: loadingToast });
      } else {
        // Remote DB update
        const { error } = await supabase.from('staff_salaries')
          .update({ status: 'paid', payment_date: format(new Date(), 'yyyy-MM-dd') })
          .eq('id', payrollItem.id);
        
        if (error) throw error;

        // Refetch salaries & expenses
        const { data: freshSalaries } = await supabase.from('staff_salaries').select('*').order('created_at', { ascending: false });
        const { data: freshExpenses } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
        
        if (freshSalaries) setSalaries(freshSalaries);
        if (freshExpenses) setExpenses(freshExpenses);

        toast.success("Payroll marked as paid, synced successfully!", { id: loadingToast });
      }
    } catch (err) {
      toast.error(`Update failed: ${err.message}`, { id: loadingToast });
    }
  };

  const fetchClosedGroupAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'closed_group_accounts')
        .maybeSingle();
      if (error) throw error;
      if (data && data.setting_value) {
        setClosedGroupAccounts(data.setting_value);
      } else {
        const local = localStorage.getItem('closed_group_accounts');
        setClosedGroupAccounts(local ? JSON.parse(local) : []);
      }
    } catch (err) {
      console.warn("Failed to fetch closed group accounts from database:", err);
      const local = localStorage.getItem('closed_group_accounts');
      setClosedGroupAccounts(local ? JSON.parse(local) : []);
    }
  };

  const handleToggleGroupAccountStatus = async (groupId) => {
    const isClosed = closedGroupAccounts.includes(groupId);
    let updated;
    if (isClosed) {
      updated = closedGroupAccounts.filter(id => id !== groupId);
      toast.success("Group Account Reopened Successfully!");
    } else {
      updated = [...closedGroupAccounts, groupId];
      toast.success("Group Account Closed Successfully! Billing is now blocked.");
    }
    setClosedGroupAccounts(updated);
    localStorage.setItem('closed_group_accounts', JSON.stringify(updated));
    try {
      await supabase.from('system_settings').upsert({
        setting_key: 'closed_group_accounts',
        setting_value: updated
      }, { onConflict: 'setting_key' });
    } catch (err) {
      console.warn("Failed to persist closed group accounts:", err);
    }
  };

  const fetchDepartmentalClosures = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'departmental_closures')
        .maybeSingle();
      if (error) throw error;
      if (data && data.setting_value) {
        setDepartmentalClosures(data.setting_value);
      } else {
        const local = localStorage.getItem('departmental_closures');
        setDepartmentalClosures(local ? JSON.parse(local) : []);
      }
    } catch (err) {
      console.warn("Failed to fetch departmental closures from DB:", err);
      const local = localStorage.getItem('departmental_closures');
      setDepartmentalClosures(local ? JSON.parse(local) : []);
    }

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'departmental_close_reports')
        .maybeSingle();
      if (!error && data && data.setting_value) {
        setDepartmentalCloseReports(data.setting_value);
      } else {
        const local = localStorage.getItem('departmental_close_reports');
        setDepartmentalCloseReports(local ? JSON.parse(local) : []);
      }
    } catch (err) {
      console.warn("Failed to fetch departmental close reports from DB:", err);
      const local = localStorage.getItem('departmental_close_reports');
      setDepartmentalCloseReports(local ? JSON.parse(local) : []);
    }
  };

  const getDepartmentStatsForDate = (deptKey, dateStr) => {
    if (deptKey === 'front_office') {
      const rev = inflows
        .filter(i => format(new Date(i.date), 'yyyy-MM-dd') === dateStr && i.category === 'Booking Revenue')
        .reduce((sum, item) => sum + item.amount, 0);
      const count = inflows.filter(i => format(new Date(i.date), 'yyyy-MM-dd') === dateStr && i.category === 'Booking Revenue').length;
      return { revenue: rev, count };
    }
    
    if (deptKey === 'laundry') {
      const rev = inflows
        .filter(i => format(new Date(i.date), 'yyyy-MM-dd') === dateStr && i.category === 'Laundry Revenue')
        .reduce((sum, item) => sum + item.amount, 0);
      const count = inflows.filter(i => format(new Date(i.date), 'yyyy-MM-dd') === dateStr && i.category === 'Laundry Revenue').length;
      return { revenue: rev, count };
    }
    
    if (deptKey === 'bar') {
      const rev = inflows
        .filter(i => format(new Date(i.date), 'yyyy-MM-dd') === dateStr && i.category === 'POS Revenue' && i.description?.toLowerCase().includes('outlet: bar'))
        .reduce((sum, item) => sum + item.amount, 0);
      const count = inflows.filter(i => format(new Date(i.date), 'yyyy-MM-dd') === dateStr && i.category === 'POS Revenue' && i.description?.toLowerCase().includes('outlet: bar')).length;
      return { revenue: rev, count };
    }
    
    if (deptKey === 'restaurant') {
      const rev = inflows
        .filter(i => {
          const isTargetDate = format(new Date(i.date), 'yyyy-MM-dd') === dateStr;
          const isFnbCategory = i.category === 'POS Revenue';
          const isRestaurantOrKitchen = i.description?.toLowerCase().includes('outlet: restaurant') ||
                                        i.description?.toLowerCase().includes('outlet: kitchen') ||
                                        i.notes?.toLowerCase().includes('outlet: restaurant') ||
                                        i.notes?.toLowerCase().includes('outlet: kitchen') ||
                                        i.description?.toLowerCase().includes('restaurant direct payment') ||
                                        i.notes?.toLowerCase().includes('restaurant direct payment') ||
                                        i.description?.toLowerCase().includes('restaurant service') ||
                                        i.notes?.toLowerCase().includes('restaurant service') ||
                                        i.notes?.toLowerCase().includes('chef_notes:') ||
                                        (i.notes && i.notes.includes('restaurant_order:'));
          return isTargetDate && isFnbCategory && isRestaurantOrKitchen;
        })
        .reduce((sum, item) => sum + item.amount, 0);

      const count = inflows.filter(i => {
          const isTargetDate = format(new Date(i.date), 'yyyy-MM-dd') === dateStr;
          const isFnbCategory = i.category === 'POS Revenue';
          const isRestaurantOrKitchen = i.description?.toLowerCase().includes('outlet: restaurant') ||
                                        i.description?.toLowerCase().includes('outlet: kitchen') ||
                                        i.notes?.toLowerCase().includes('outlet: restaurant') ||
                                        i.notes?.toLowerCase().includes('outlet: kitchen') ||
                                        i.description?.toLowerCase().includes('restaurant direct payment') ||
                                        i.notes?.toLowerCase().includes('restaurant direct payment') ||
                                        i.description?.toLowerCase().includes('restaurant service') ||
                                        i.notes?.toLowerCase().includes('restaurant service') ||
                                        i.notes?.toLowerCase().includes('chef_notes:') ||
                                        (i.notes && i.notes.includes('restaurant_order:'));
          return isTargetDate && isFnbCategory && isRestaurantOrKitchen;
      }).length;
      return { revenue: rev, count };
    }
    
    return { revenue: 0, count: 0 };
  };

  const handleCloseDepartment = async (deptKey) => {
    const todayStr = selectedAuditDate;
    const stats = getDepartmentStatsForDate(deptKey, todayStr);
    const closureRecord = {
      department: deptKey,
      business_date: todayStr,
      staff_id: profile?.id || 'unknown',
      staff_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Super Admin',
      revenue: stats.revenue,
      transactions_count: stats.count,
      closed_at: new Date().toISOString()
    };
    
    const alreadyClosed = departmentalClosures.some(c => c.department === deptKey && c.business_date === todayStr);
    if (alreadyClosed) {
      return toast.error(`This department has already been closed for ${todayStr}!`);
    }
    
    const updated = [...departmentalClosures, closureRecord];
    setDepartmentalClosures(updated);
    localStorage.setItem('departmental_closures', JSON.stringify(updated));
    
    try {
      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_closures',
        setting_value: updated
      }, { onConflict: 'setting_key' });
      
      await supabase.from('system_logs').insert({
        user_id: profile?.id,
        log_type: 'activity',
        action: `Closed departmental ledger for ${deptKey.toUpperCase()} on date ${todayStr}. Revenue: ₦${stats.revenue.toLocaleString()}`,
        module: 'Accounting'
      });
      
      toast.success(`${deptKey.replace('_', ' ').toUpperCase()} Ledger Closed Successfully!`);
    } catch (err) {
      console.warn("Failed to persist departmental closure:", err);
      toast.success(`${deptKey.replace('_', ' ').toUpperCase()} Ledger Closed (LocalStorage Only).`);
    }
  };

  const handleReopenDepartment = async (deptKey) => {
    const allowedRoles = ['super_admin', 'admin', 'hotel_manager', 'hotel_owner'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      return toast.error("You do not have authorization to reopen departmental ledgers. Contact an Administrator or Manager.");
    }

    const todayStr = selectedAuditDate;
    
    // Check if it's actually closed
    const isClosed = departmentalClosures.some(c => c.department === deptKey && c.business_date === todayStr);
    if (!isClosed) {
      return toast.error(`This department is not closed for ${todayStr}!`);
    }
    
    if (!window.confirm(`Are you sure you want to RE-OPEN the ${deptKey.replace('_', ' ').toUpperCase()} ledger for ${todayStr}? This will clear the closure record and allow new transactions to be posted.`)) {
      return;
    }
    
    const updatedClosures = departmentalClosures.filter(c => !(c.department === deptKey && c.business_date === todayStr));
    const updatedReports = departmentalCloseReports.filter(r => !(r.department === deptKey && r.business_date === todayStr));
    
    setDepartmentalClosures(updatedClosures);
    setDepartmentalCloseReports(updatedReports);
    localStorage.setItem('departmental_closures', JSON.stringify(updatedClosures));
    localStorage.setItem('departmental_close_reports', JSON.stringify(updatedReports));
    
    try {
      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_closures',
        setting_value: updatedClosures
      }, { onConflict: 'setting_key' });
      
      await supabase.from('system_settings').upsert({
        setting_key: 'departmental_close_reports',
        setting_value: updatedReports
      }, { onConflict: 'setting_key' });
      
      await supabase.from('system_logs').insert({
        user_id: profile?.id,
        log_type: 'activity',
        action: `Re-opened departmental ledger for ${deptKey.toUpperCase()} on date ${todayStr}`,
        module: 'Accounting'
      });
      
      toast.success(`${deptKey.replace('_', ' ').toUpperCase()} Ledger Re-opened Successfully!`);
    } catch (err) {
      console.warn("Failed to persist departmental re-opening:", err);
      toast.success(`${deptKey.replace('_', ' ').toUpperCase()} Ledger Re-opened (LocalStorage Only).`);
    }
  };

  const handlePrintGroupStatement = (group, bookingsList) => {
    const tableRows = bookingsList.map(b => {
      const total = Number(b.total_room_price_ngn || 0) + Number(b.total_extras_price_ngn || 0);
      const outstanding = total - Number(b.amount_paid_ngn || 0);
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${b.booking_reference}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
            <strong>${b.guest_name}</strong>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">
            ${b.check_in_date} to ${b.check_out_date}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold;">
            ₦${total.toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold; color: #047857;">
            ₦${Number(b.amount_paid_ngn || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold; color: ${outstanding > 0 ? '#b91c1c' : '#111827'}">
            ₦${outstanding.toLocaleString()}
          </td>
        </tr>
      `;
    }).join('');

    const logoHtml = contactInfo.logo 
      ? `<img src="${contactInfo.logo}" style="max-height: 80px; width: auto; margin-bottom: 15px;" alt="Hotel Logo" />`
      : `<h1 style="margin: 0; font-size: 24px; color: #111827;">${contactInfo.companyName}</h1>`;

    const printWindow = window.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Consolidated Statement - ${group.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { border-bottom: 2px solid #e5e7eb; padding: 12px; text-align: left; font-size: 14px; background-color: #f9fafb; font-weight: bold; color: #374151; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #374151; padding-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            .meta { display: grid; grid-template-cols: 2fr 1fr; gap: 20px; margin-top: 15px; font-size: 14px; }
            .footer { margin-top: 40px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              ${logoHtml}
              <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${contactInfo.address}</div>
              <div style="font-size: 14px; color: #6b7280;">Phone: ${contactInfo.phone} | Email: ${contactInfo.email}</div>
            </div>
            <div style="text-align: right;">
              <h1 style="margin: 0; font-size: 28px; color: #111827; text-transform: uppercase;">CONSOLIDATED STATEMENT</h1>
            </div>
          </div>
          
          <div class="meta">
            <div>
              <strong>Corporate Group / Account Details:</strong><br />
              Group Name: ${group.name}<br />
              Credit Limit: ₦${Number(group.credit_limit || 0).toLocaleString()}<br />
              Statement Date: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
            </div>
            <div style="text-align: right;">
              <strong>Outstanding Group Balance:</strong><br />
              <span style="font-size: 24px; font-weight: 900; color: #b91c1c;">
                ₦${Number(group.outstanding_balance).toLocaleString()}
              </span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Booking Ref</th>
                <th>Guest Name</th>
                <th>Stay Period</th>
                <th>Total Billed</th>
                <th>Amount Paid</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="footer">
            Thank you for your business.<br />
            For support or billing inquiries, please contact ${contactInfo.email}.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const fetchCRMGuests = async () => {
    try {
      const { data } = await supabase.from('crm_guests').select('*');
      setCrmGuests(data || []);
    } catch (e) {
      console.warn("Failed to fetch crm_guests:", e);
    }
  };

  const fetchARAccounts = async () => {
    try {
      const { data, error } = await supabase.from('ar_accounts').select('*');
      if (error) throw error;
      setArAccounts(data || []);
    } catch (e) {
      try {
        const { data: sysData } = await supabase.from('system_settings').select('*').eq('setting_key', 'ar_accounts').maybeSingle();
        if (sysData && sysData.setting_value) {
          const parsed = typeof sysData.setting_value === 'string' ? JSON.parse(sysData.setting_value) : sysData.setting_value;
          setArAccounts(parsed || []);
        } else {
          const local = localStorage.getItem('luxe_ar_accounts');
          setArAccounts(local ? JSON.parse(local) : []);
        }
      } catch (err) {
        setArAccounts([]);
      }
    }
  };

  const getMergedARAccounts = () => {
    const list = [...arAccounts];
    crmGuests.forEach(g => {
      if (g.wallet_balance !== null && g.wallet_balance !== undefined && !list.some(acc => acc.guest_id === g.id)) {
        list.push({
          id: `ar_g_${g.id.substring(0, 8)}`,
          guest_id: g.id,
          guest_name: `${g.first_name || ''} ${g.last_name || ''}`.trim() || g.guest_name || 'Unnamed Guest',
          guest_email: g.email || 'N/A',
          balance: Number(g.wallet_balance || 0),
          status: 'active',
          created_at: g.created_at || new Date().toISOString()
        });
      }
    });
    return list.map(acc => {
      const match = crmGuests.find(g => g.id === acc.guest_id);
      if (match) {
        return { 
          ...acc, 
          balance: Number(match.wallet_balance || 0),
          status: acc.status || 'active'
        };
      }
      return {
        ...acc,
        status: acc.status || 'active'
      };
    });
  };

  const saveARAccounts = async (updatedAR) => {
    setArAccounts(updatedAR);
    try {
      const { error } = await supabase.from('ar_accounts').upsert(updatedAR);
      if (error) throw error;
    } catch (e) {
      try {
        await supabase.from('system_settings').upsert({
          setting_key: 'ar_accounts',
          setting_value: updatedAR
        }, { onConflict: 'setting_key' });
      } catch (sysErr) {
        console.warn("Failed to persist AR accounts in system_settings:", sysErr);
      }
      localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
    }
  };

  const handleUpdateARStatus = async (wallet, newStatus) => {
    // If the wallet is not in arAccounts list (merged from crmGuests), we must add it first!
    const walletExists = arAccounts.some(acc => acc.guest_id === wallet.guest_id);
    let updated;
    if (walletExists) {
      updated = arAccounts.map(acc => {
        if (acc.guest_id === wallet.guest_id) {
          return { ...acc, status: newStatus };
        }
        return acc;
      });
    } else {
      const newWallet = {
        id: wallet.id || 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        guest_id: wallet.guest_id,
        guest_name: wallet.guest_name,
        guest_email: wallet.guest_email || 'N/A',
        balance: Number(wallet.balance || 0),
        status: newStatus,
        created_at: wallet.created_at || new Date().toISOString()
      };
      updated = [...arAccounts, newWallet];
    }
    
    await saveARAccounts(updated);
    toast.success(`AR prepayment wallet status set to ${newStatus}`);
    fetchFinancialData();
    fetchARAccounts();
  };

  const getARStatement = (guest) => {
    if (!guest) return [];
    
    const guestName = guest.guest_name.toLowerCase().trim();
    const nameParts = guestName.split(/\s+/).filter(part => part.length > 2);
    
    // Filter inflows and payments for this guest
    const statement = inflows.filter(inf => {
      const desc = (inf.description || '').toLowerCase();
      const notes = (inf.notes || '').toLowerCase();
      
      const matchesName = desc.includes(guestName) || notes.includes(guestName) || 
                          (nameParts.length > 0 && nameParts.every(part => desc.includes(part) || notes.includes(part)));
      
      const matchesARMethod = inf.method === 'ar_prepayment_wallet' || inf.method === 'ar_wallet' || inf.method === 'ar' ||
                              desc.includes('ar prepayment') || notes.includes('ar prepayment') ||
                              desc.includes('ar wallet') || notes.includes('ar wallet');
      
      const isDeposit = (desc.includes('deposit') || notes.includes('deposit') || desc.includes('deposited') || notes.includes('deposited') || desc.includes('refund') || notes.includes('refund') || desc.includes('refunded') || notes.includes('refunded') || desc.includes('credit') || notes.includes('credit') || inf.is_refund === true) && matchesName;
                        
      const isDeduction = !isDeposit && matchesARMethod && matchesName;
                          
      return isDeposit || isDeduction;
    });

    // Format statement items cleanly
    return statement.map(item => {
      const descLower = (item.description || '').toLowerCase();
      const notesLower = (item.notes || '').toLowerCase();
      const isDeposit = descLower.includes('deposit') || notesLower.includes('deposit') || descLower.includes('deposited') || notesLower.includes('deposited') || descLower.includes('refund') || notesLower.includes('refund') || descLower.includes('refunded') || notesLower.includes('refunded') || descLower.includes('credit') || notesLower.includes('credit') || item.is_refund === true;
      return {
        ...item,
        type: isDeposit ? 'credit' : 'debit',
        amount: Number(item.amount)
      };
    }).sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (a.id || '').localeCompare(b.id || '');
    }); // Sort chronologically to compute running balance
  };

  const getARStatementWithRunningBalance = (guest) => {
    const list = getARStatement(guest);
    let bal = 0;
    return list.map(item => {
      if (item.type === 'credit') {
        bal += item.amount;
      } else {
        bal -= item.amount;
      }
      return { ...item, running_balance: bal };
    }).sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return (b.id || '').localeCompare(a.id || '');
    }); // Return newest first for visual grid
  };

  const handlePrintStatement = (guest) => {
    const list = getARStatementWithRunningBalance(guest);
    const tableRows = list.map(rec => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${rec.date ? format(new Date(rec.date), 'yyyy-MM-dd HH:mm') : 'N/A'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
          <strong>${rec.description}</strong>
          ${rec.notes ? `<br/><small style="color: #6b7280">${rec.notes}</small>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; font-family: monospace;">${rec.method?.replace('_', ' ')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
          <span style="font-weight: bold; font-size: 12px; color: ${rec.type === 'credit' ? '#047857' : '#b91c1c'}">
            ${rec.type === 'credit' ? 'DEPOSIT' : 'CHARGE'}
          </span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold; color: ${rec.type === 'credit' ? '#047857' : '#b91c1c'}">
          ${rec.type === 'credit' ? '+' : '-'}₦${rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold;">
          ₦${rec.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `).join('');

    const printWindow = window.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Prepayment Wallet Statement - ${guest.guest_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { border-bottom: 2px solid #e5e7eb; padding: 12px; text-align: left; font-size: 14px; background-color: #f9fafb; font-weight: bold; color: #374151; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #374151; padding-bottom: 15px; }
            .header h1 { margin: 0; font-size: 24px; color: #111827; }
            .meta { display: grid; grid-template-cols: 2fr 1fr; gap: 20px; margin-top: 15px; font-size: 14px; }
            .footer { margin-top: 40px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${contactInfo.logo ? `<img src="${contactInfo.logo}" style="max-height: 50px; object-fit: contain; margin-bottom: 10px;" /><br/>` : ''}
            <h1>ACCOUNT STATEMENT</h1>
            <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">Accounts Receivable Prepayment Wallet</div>
          </div>
          
          <div class="meta">
            <div>
              <strong>Guest Details:</strong><br />
              Name: ${guest.guest_name}<br />
              Email: ${guest.guest_email || 'N/A'}<br />
              Address: ${contactInfo.address}<br />
              Statement Compiled: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
            </div>
            <div style="text-align: right;">
              <strong>Account Balance:</strong><br />
              <span style="font-size: 22px; font-weight: 900; color: #047857;">
                ₦${Number(guest.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Description</th>
                <th>Method</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="footer">
            Thank you for choosing Freshland.<br />
            For support or billing inquiries, please contact ${contactInfo.email || 'info@Freshlandhotels.com'}.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const handleCreateARWallet = async (e) => {
    e.preventDefault();
    if (!arNewWalletForm.guest_id) return toast.error("Please select a guest");
    const initVal = Number(arNewWalletForm.initial_balance) || 0;
    
    const matchedGuest = crmGuests.find(g => g.id === arNewWalletForm.guest_id);
    if (!matchedGuest) return toast.error("Guest not resolved");
    
    if (getMergedARAccounts().some(acc => acc.guest_id === matchedGuest.id)) {
      return toast.error("Prepayment account already exists for this guest.");
    }
    
    const newWallet = {
      id: 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      guest_id: matchedGuest.id,
      guest_name: `${matchedGuest.first_name || ''} ${matchedGuest.last_name || ''}`.trim() || matchedGuest.guest_name || 'Unnamed Guest',
      guest_email: matchedGuest.email || matchedGuest.guest_email || 'N/A',
      balance: initVal,
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    const updated = [...arAccounts, newWallet];
    await saveARAccounts(updated);
    
    // Synchronize CRM guest's wallet_balance in local state and database!
    if (matchedGuest.id) {
      try {
        await supabase.from('crm_guests').update({ wallet_balance: initVal }).eq('id', matchedGuest.id);
        setCrmGuests(prev => prev.map(g => g.id === matchedGuest.id ? { ...g, wallet_balance: initVal } : g));
      } catch (dbErr) {
        console.warn("Failed to sync initial wallet balance to CRM database: ", dbErr.message);
      }
    }
    
    if (initVal > 0) {
      try {
        await supabase.from('payments').insert([{
          booking_id: null,
          amount: initVal,
          method: 'cash',
          status: 'completed',
          notes: `Initial AR Wallet Prepayment Deposit logged for guest: ${newWallet.guest_name} (${newWallet.guest_email || 'N/A'})`,
          transaction_ref: `AR-DEP-${Date.now()}`
        }]);
        fetchFinancialData();
      } catch (err) {
        console.warn("Could not log initial deposit to ledger:", err);
      }
    }
    
    toast.success(`AR Prepayment Wallet successfully activated for ${newWallet.guest_name}!`);
    setShowARAddModal(false);
    setArNewWalletForm({ guest_id: '', initial_balance: '' });
  };

  const handleARWalletDeposit = async (e) => {
    e.preventDefault();
    const amount = Number(arDepositAmount);
    if (!activeARWallet || amount <= 0) return toast.error("Please enter a valid deposit amount");
    
    // Check if the wallet already exists in arAccounts list. If not, add it!
    const walletExists = arAccounts.some(acc => acc.guest_id === activeARWallet.guest_id);
    let updated;
    if (walletExists) {
      updated = arAccounts.map(acc => {
        if (acc.guest_id === activeARWallet.guest_id) {
          return { ...acc, balance: Number(acc.balance || 0) + amount };
        }
        return acc;
      });
    } else {
      const newWallet = {
        id: activeARWallet.id || 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        guest_id: activeARWallet.guest_id,
        guest_name: activeARWallet.guest_name,
        guest_email: activeARWallet.guest_email || 'N/A',
        balance: amount,
        status: 'active',
        created_at: new Date().toISOString()
      };
      updated = [...arAccounts, newWallet];
    }
    
    await saveARAccounts(updated);
    
    // Sync CRM guest's wallet_balance in local state and database!
    if (activeARWallet.guest_id) {
      try {
        const { data: guestRecord } = await supabase.from('crm_guests').select('wallet_balance').eq('id', activeARWallet.guest_id).maybeSingle();
        const currentBalance = Number(guestRecord?.wallet_balance || 0);
        const newBalance = currentBalance + amount;
        await supabase.from('crm_guests').update({ wallet_balance: newBalance }).eq('id', activeARWallet.guest_id);
        
        // Sync local crmGuests state instantly
        setCrmGuests(prev => prev.map(g => g.id === activeARWallet.guest_id ? { ...g, wallet_balance: newBalance } : g));
      } catch (dbErr) {
        console.warn("Failed to sync wallet balance to CRM database: ", dbErr.message);
      }
    }
    
    try {
      const { error: payErr } = await supabase.from('payments').insert([{
        booking_id: null,
        amount: amount,
        method: arDepositMethod,
        status: 'completed',
        notes: `AR Wallet cash deposit of ₦${amount.toLocaleString()} for guest: ${activeARWallet.guest_name} (${activeARWallet.guest_email || 'N/A'}). Remarks: ${arDepositNotes || 'None'}`,
        transaction_ref: `AR-DEP-${arDepositMethod.toUpperCase()}-${Date.now()}`
      }]);
      if (payErr) throw payErr;
      
      await supabase.from('system_logs').insert([{
        user_id: profile?.id,
        log_type: 'activity',
        action: `Deposited ₦${amount.toLocaleString()} to AR Prepayment wallet for ${activeARWallet.guest_name}`,
        module: 'Accounting'
      }]);
      
      toast.success(`Successfully deposited ₦${amount.toLocaleString()} to wallet!`);
      setShowARDepositModal(false);
      setArDepositAmount('');
      setArDepositNotes('');
      fetchFinancialData();
    } catch (err) {
      toast.error("Failed to post ledger deposit: " + err.message);
    }
  };

  const fetchDebtorsData = async () => {
    try {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, profiles(first_name, last_name, phone)')
        .in('status', ['checked_in', 'checked_out']);
        
      const { data: groups } = await supabase.from('group_accounts').select('*');
      
      const resolvedBookings = (bookings || []).map(b => {
        const total = Number(b.total_room_price_ngn || 0) + Number(b.total_extras_price_ngn || 0);
        const outstanding = total - Number(b.amount_paid_ngn || 0);
        return {
          id: b.id,
          type: 'stay_debt',
          guest_name: b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : b.guest_name || 'Walk-in Guest',
          reference: b.booking_reference,
          total_amount: total,
          amount_paid: Number(b.amount_paid_ngn || 0),
          outstanding_balance: outstanding,
          status: b.status,
          check_in: b.check_in_date,
          check_out: b.check_out_date,
          phone: b.profiles?.phone || b.guest_phone || 'N/A',
          original: b
        };
      }).filter(d => d.outstanding_balance > 0);
      
      const resolvedGroups = (groups || []).map(g => {
        return {
          id: g.id,
          type: 'corporate_debt',
          guest_name: g.name,
          reference: `CORP-${g.id.substring(0, 4).toUpperCase()}`,
          total_amount: Number(g.outstanding_balance) + 500000,
          amount_paid: 0,
          outstanding_balance: Number(g.outstanding_balance),
          status: 'Corporate Account',
          check_in: 'N/A',
          check_out: 'N/A',
          phone: g.contact_phone || 'N/A',
          original: g
        };
      });
      
      setDebtors([...resolvedBookings, ...resolvedGroups]);
    } catch (e) {
      console.warn("Failed to load debtors:", e.message);
    }
  };

  const handleSettleDebtorPayment = async (e) => {
    e.preventDefault();
    const amount = Number(settlementAmount);
    if (!selectedDebtor || amount <= 0 || amount > selectedDebtor.outstanding_balance) {
      return toast.error("Invalid settlement amount");
    }
    
    setIsProcessingSettlement(true);
    const toastId = toast.loading('Processing debt folio settlement...');
    
    try {
      if (settlementMethod === 'ar_wallet') {
        const mergedAR = getMergedARAccounts();
        const wallet = mergedAR.find(acc => acc.guest_id === selectedDebtor.original.profiles?.id || acc.guest_email === selectedDebtor.original.guest_email || acc.guest_name === selectedDebtor.guest_name);
        if (!wallet) {
          throw new Error("No active AR Prepayment Wallet found for this guest.");
        }
        if (wallet.balance < amount) {
          throw new Error(`Insufficient wallet balance (Current: ₦${wallet.balance.toLocaleString()}). Please deposit funds first.`);
        }
        
        // Deduct from arAccounts list
        const walletInAr = arAccounts.some(acc => acc.guest_id === wallet.guest_id);
        let updatedWallets;
        if (walletInAr) {
          updatedWallets = arAccounts.map(acc => {
            if (acc.guest_id === wallet.guest_id) {
              return { ...acc, balance: Number(acc.balance || 0) - amount };
            }
            return acc;
          });
        } else {
          const newWallet = {
            id: wallet.id || 'ar_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            guest_id: wallet.guest_id,
            guest_name: wallet.guest_name,
            guest_email: wallet.guest_email || 'N/A',
            balance: wallet.balance - amount,
            status: 'active',
            created_at: new Date().toISOString()
          };
          updatedWallets = [...arAccounts, newWallet];
        }
        await saveARAccounts(updatedWallets);
        
        // Synchronize CRM guest's wallet_balance in local state and database!
        if (wallet.guest_id) {
          try {
            const { data: guestRecord } = await supabase.from('crm_guests').select('wallet_balance').eq('id', wallet.guest_id).maybeSingle();
            const currentBalance = Number(guestRecord?.wallet_balance || 0);
            const newBalance = Math.max(0, currentBalance - amount);
            await supabase.from('crm_guests').update({ wallet_balance: newBalance }).eq('id', wallet.guest_id);
            
            // Sync local state instantly
            setCrmGuests(prev => prev.map(g => g.id === wallet.guest_id ? { ...g, wallet_balance: newBalance } : g));
          } catch (dbErr) {
            console.warn("Failed to sync wallet deduction to CRM database: ", dbErr.message);
          }
        }
      }
      
      if (selectedDebtor.type === 'corporate_debt') {
        const newBalance = selectedDebtor.outstanding_balance - amount;
        const { error } = await supabase
          .from('group_accounts')
          .update({ outstanding_balance: newBalance })
          .eq('id', selectedDebtor.id);
        if (error) throw error;
      } else {
        const newPaidAmount = selectedDebtor.amount_paid + amount;
        const newPaymentStatus = newPaidAmount >= selectedDebtor.total_amount ? 'paid' : 'partial';
        
        const { error } = await supabase
          .from('bookings')
          .update({
            amount_paid_ngn: newPaidAmount,
            payment_status: newPaymentStatus
          })
          .eq('id', selectedDebtor.id);
        if (error) throw error;
      }
      
      const { error: payErr } = await supabase.from('payments').insert([{
        booking_id: selectedDebtor.type === 'corporate_debt' ? null : selectedDebtor.id,
        amount: amount,
        method: settlementMethod === 'ar_wallet' ? 'cash' : settlementMethod,
        status: 'completed',
        notes: `Debt settlement payout: ${selectedDebtor.guest_name} (Ref: ${selectedDebtor.reference}) settled via ${settlementMethod === 'ar_wallet' ? 'AR Prepayment Wallet' : settlementMethod.toUpperCase()}. Comments: ${settlementNotes || 'None'}`,
        transaction_ref: selectedDebtor.type === 'corporate_debt'
          ? `DEBT-SET-CORP-${settlementMethod.toUpperCase()}-${Date.now()}`
          : `DEBT-SET-${settlementMethod.toUpperCase()}-${Date.now()}`
      }]);
      if (payErr) throw payErr;
      
      await supabase.from('system_logs').insert([{
        user_id: profile?.id,
        log_type: 'activity',
        action: `Settled outstanding debt of ₦${amount.toLocaleString()} for guest/group: ${selectedDebtor.guest_name}`,
        module: 'Accounting'
      }]);
      
      toast.success(`Successfully processed payment of ₦${amount.toLocaleString()}! Debt folio updated.`, { id: toastId });
      setShowSettlementModal(false);
      setSettlementAmount('');
      setSettlementNotes('');
      fetchFinancialData();
      fetchDebtorsData();
    } catch (err) {
      toast.error(err.message || 'Settlement failed', { id: toastId });
    } finally {
      setIsProcessingSettlement(false);
    }
  };

  const fetchDailyClosures = async () => {
    let dbClosures = [];
    try {
      const { data, error } = await supabase.from('daily_closures').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn("daily_closures table query error:", error.message);
      } else if (data) {
        dbClosures = data;
      }
    } catch (e) {
      console.warn("Exception checking daily_closures table:", e);
    }

    let fallbackClosures = [];
    try {
      const { data: sysData } = await supabase.from('system_settings').select('*').eq('setting_key', 'daily_closure_reports').maybeSingle();
      if (sysData && sysData.setting_value) {
        fallbackClosures = typeof sysData.setting_value === 'string' ? JSON.parse(sysData.setting_value) : sysData.setting_value;
      } else {
        const local = localStorage.getItem('luxe_daily_closures');
        if (local) {
          fallbackClosures = JSON.parse(local);
        }
      }
    } catch (err) {
      console.warn("Exception checking fallback closure storage:", err);
    }

    // Merge reports uniquely by date to ensure historical reports compiled before/during migrations aren't lost
    const mergedMap = new Map();
    if (Array.isArray(fallbackClosures)) {
      fallbackClosures.forEach(c => {
        if (c && c.date) mergedMap.set(c.date, c);
      });
    }
    if (Array.isArray(dbClosures)) {
      dbClosures.forEach(c => {
        if (c && c.date) mergedMap.set(c.date, c);
      });
    }

    const mergedList = Array.from(mergedMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    setDailyClosures(mergedList);
  };

  const generateReportForDate = async (targetDateStr) => {
    const toastId = toast.loading(`Generating audit sheet for ${targetDateStr}...`);
    try {
      // 1. Check if we already have it in dailyClosures
      const existing = dailyClosures.find(c => {
        const dStr = format(new Date(c.date), 'yyyy-MM-dd');
        return dStr === targetDateStr;
      });
      if (existing) {
        setCloseOfDayData(existing);
        setShowCloseOfDayModal(true);
        toast.success(`✓ Loaded compiled report for ${targetDateStr}!`, { id: toastId });
        return;
      }
      
      // 2. If not, compile it dynamically from local state/DB for that date!
      const targetInflows = inflows.filter(i => {
        const dStr = format(new Date(i.date), 'yyyy-MM-dd');
        return dStr === targetDateStr && i.category === 'Booking Revenue';
      });
      const roomRevenue = targetInflows.reduce((sum, item) => sum + item.amount, 0);
      
      const targetPOS = inflows.filter(i => {
        const dStr = format(new Date(i.date), 'yyyy-MM-dd');
        return dStr === targetDateStr && i.category === 'POS Revenue';
      });
      const posRevenue = targetPOS.reduce((sum, item) => sum + item.amount, 0);
      
      const targetLaundry = inflows.filter(i => {
        const dStr = format(new Date(i.date), 'yyyy-MM-dd');
        return dStr === targetDateStr && i.category === 'Laundry Revenue';
      });
      const laundryRevenue = targetLaundry.reduce((sum, item) => sum + item.amount, 0);
      
      const targetExpensesList = expenses.filter(e => {
        const dStr = format(new Date(e.expense_date || e.created_at || e.date), 'yyyy-MM-dd');
        return dStr === targetDateStr;
      });
      const totalExpenses = targetExpensesList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      
      const targetAllInflows = inflows.filter(i => {
        const dStr = format(new Date(i.date), 'yyyy-MM-dd');
        return dStr === targetDateStr;
      });
      
      const paymentMethods = {
        cash: targetAllInflows.filter(i => i.method === 'cash').reduce((sum, item) => sum + item.amount, 0),
        pos: targetAllInflows.filter(i => i.method === 'pos').reduce((sum, item) => sum + item.amount, 0),
        bank_transfer: targetAllInflows.filter(i => ['bank_transfer', 'transfer'].includes(i.method)).reduce((sum, item) => sum + item.amount, 0),
        paystack: targetAllInflows.filter(i => i.method === 'paystack').reduce((sum, item) => sum + item.amount, 0),
        ar_wallet: targetAllInflows.filter(i => ['ar_wallet', 'ar'].includes(i.method)).reduce((sum, item) => sum + item.amount, 0),
        room_charge: targetAllInflows.filter(i => i.method === 'room_charge').reduce((sum, item) => sum + item.amount, 0),
      };
      
      const posOutlets = {
        bar: targetPOS.filter(i => i.description?.toLowerCase().includes('outlet: bar')).reduce((sum, item) => sum + item.amount, 0),
        restaurant: targetPOS.filter(i => i.description?.toLowerCase().includes('outlet: restaurant')).reduce((sum, item) => sum + item.amount, 0),
        kitchen: targetPOS.filter(i => i.description?.toLowerCase().includes('outlet: kitchen')).reduce((sum, item) => sum + item.amount, 0),
      };
      
      const accountedPOS = posOutlets.bar + posOutlets.restaurant + posOutlets.kitchen;
      const otherPOS = Math.max(0, posRevenue - accountedPOS);
      if (otherPOS > 0) {
        posOutlets.restaurant += otherPOS;
      }
      
      // Fetch bookings joined with profiles and rooms details for that date
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, profiles(first_name, last_name), rooms(room_number, name)');
      const resolvedBookings = bookings || [];
      
      const arrivalsCount = resolvedBookings.filter(b => b.check_in_date === targetDateStr && ['checked_in', 'checked_out'].includes(b.status)).length;
      const departuresCount = resolvedBookings.filter(b => b.check_out_date === targetDateStr && b.status === 'checked_out').length;
      
      // For historical in-house guests, we can look at bookings that were active on targetDateStr
      const inHouseBookings = resolvedBookings.filter(b => {
        if (b.status === 'cancelled' || b.status === 'pending') return false;
        return b.check_in_date <= targetDateStr && b.check_out_date >= targetDateStr;
      });
      const inHouseCount = inHouseBookings.reduce((sum, b) => sum + Number(b.number_of_guests || 1), 0);
      
      const { data: rooms } = await supabase.from('rooms').select('id');
      const totalRoomsCount = rooms?.length || 10;
      const occupiedRoomsCount = inHouseBookings.length;
      const occupancyPercentage = Math.round((occupiedRoomsCount / totalRoomsCount) * 100);
      
      const inHouseList = inHouseBookings.map(b => ({
        room_number: b.rooms?.room_number || 'N/A',
        room_name: b.rooms?.name || 'N/A',
        guest_name: b.guest_name || (b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : 'Walk-in'),
        check_in: b.check_in_date,
        check_out: b.check_out_date,
        paid: b.amount_paid_ngn || 0,
        total: b.total_amount_ngn || 0
      }));
      
      const compiledReport = {
        id: 'closure_temp_' + targetDateStr.replace(/-/g, ''),
        date: targetDateStr,
        room_revenue: roomRevenue,
        pos_revenue: posRevenue,
        laundry_revenue: laundryRevenue,
        total_revenue: roomRevenue + posRevenue + laundryRevenue,
        total_expenses: totalExpenses,
        net_cash_flow: (roomRevenue + posRevenue + laundryRevenue) - totalExpenses,
        arrivals: arrivalsCount,
        departures: departuresCount,
        in_house_guests: inHouseCount,
        occupancy_rate: occupancyPercentage,
        payment_methods: paymentMethods,
        pos_outlets: posOutlets,
        in_house_list: inHouseList,
        created_at: new Date().toISOString()
      };
      
      setCloseOfDayData(compiledReport);
      setShowCloseOfDayModal(true);
      toast.success(`✓ Dynamic report sheet generated for ${targetDateStr}!`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report: " + err.message, { id: toastId });
    }
  };

  const handleCompileCloseOfDay = async () => {
    setIsRunningNightAudit(true);
    const toastId = toast.loading("Compiling Night Audit & Close of Day...");
    
    try {
      const todayStr = selectedAuditDate;
      
      const todayInflows = inflows.filter(i => {
        const dStr = format(new Date(i.date), 'yyyy-MM-dd');
        return dStr === todayStr && i.category === 'Booking Revenue';
      });
      const roomRevenue = todayInflows.reduce((sum, item) => sum + item.amount, 0);
      
      const todayPOS = inflows.filter(i => {
        const dStr = format(new Date(i.date), 'yyyy-MM-dd');
        return dStr === todayStr && i.category === 'POS Revenue';
      });
      const posRevenue = todayPOS.reduce((sum, item) => sum + item.amount, 0);
      
      const todayLaundry = inflows.filter(i => {
        const dStr = format(new Date(i.date), 'yyyy-MM-dd');
        return dStr === todayStr && i.category === 'Laundry Revenue';
      });
      const laundryRevenue = todayLaundry.reduce((sum, item) => sum + item.amount, 0);
      
      // Calculate today's operational expenses (outflows)
      const todayExpensesList = expenses.filter(e => {
        const dStr = format(new Date(e.expense_date || e.created_at || e.date), 'yyyy-MM-dd');
        return dStr === todayStr;
      });
      const totalExpenses = todayExpensesList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      
      // Calculate breakdown of payment methods settled today
      const todayAllInflows = inflows.filter(i => {
        const dStr = format(new Date(i.date), 'yyyy-MM-dd');
        return dStr === todayStr;
      });
      
      const paymentMethods = {
        cash: todayAllInflows.filter(i => i.method === 'cash').reduce((sum, item) => sum + item.amount, 0),
        pos: todayAllInflows.filter(i => i.method === 'pos').reduce((sum, item) => sum + item.amount, 0),
        bank_transfer: todayAllInflows.filter(i => ['bank_transfer', 'transfer'].includes(i.method)).reduce((sum, item) => sum + item.amount, 0),
        paystack: todayAllInflows.filter(i => i.method === 'paystack').reduce((sum, item) => sum + item.amount, 0),
        ar_wallet: todayAllInflows.filter(i => ['ar_wallet', 'ar'].includes(i.method)).reduce((sum, item) => sum + item.amount, 0),
        room_charge: todayAllInflows.filter(i => i.method === 'room_charge').reduce((sum, item) => sum + item.amount, 0),
      };
      
      // Calculate POS outlet-level performance
      const posOutlets = {
        bar: todayPOS.filter(i => i.description?.toLowerCase().includes('outlet: bar')).reduce((sum, item) => sum + item.amount, 0),
        restaurant: todayPOS.filter(i => i.description?.toLowerCase().includes('outlet: restaurant')).reduce((sum, item) => sum + item.amount, 0),
        kitchen: todayPOS.filter(i => i.description?.toLowerCase().includes('outlet: kitchen')).reduce((sum, item) => sum + item.amount, 0),
      };
      
      const accountedPOS = posOutlets.bar + posOutlets.restaurant + posOutlets.kitchen;
      const otherPOS = Math.max(0, posRevenue - accountedPOS);
      if (otherPOS > 0) {
        posOutlets.restaurant += otherPOS;
      }
      
      // Fetch bookings joined with profiles and rooms details
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, profiles(first_name, last_name), rooms(room_number, name)');
      const resolvedBookings = bookings || [];
      
      const arrivalsCount = resolvedBookings.filter(b => b.check_in_date === todayStr && ['checked_in', 'checked_out'].includes(b.status)).length;
      const departuresCount = resolvedBookings.filter(b => b.check_out_date === todayStr && b.status === 'checked_out').length;
      
      const inHouseBookings = resolvedBookings.filter(b => b.status === 'checked_in');
      const inHouseCount = inHouseBookings.reduce((sum, b) => sum + Number(b.number_of_guests || 1), 0);
      
      const { data: rooms } = await supabase.from('rooms').select('id');
      const totalRoomsCount = rooms?.length || 10;
      const occupiedRoomsCount = inHouseBookings.length;
      const occupancyPercentage = Math.round((occupiedRoomsCount / totalRoomsCount) * 100);
      
      // Compile directory of checked-in stays
      const inHouseList = inHouseBookings.map(b => ({
        room_number: b.rooms?.room_number || 'N/A',
        room_name: b.rooms?.name || 'N/A',
        guest_name: b.guest_name || (b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : 'Walk-in'),
        check_in: b.check_in_date,
        check_out: b.check_out_date,
        paid: b.amount_paid_ngn || 0,
        total: b.total_amount_ngn || 0
      }));
      
      const compiledReport = {
        id: 'closure_' + Date.now(),
        date: todayStr,
        room_revenue: roomRevenue,
        pos_revenue: posRevenue,
        laundry_revenue: laundryRevenue,
        total_revenue: roomRevenue + posRevenue + laundryRevenue,
        total_expenses: totalExpenses,
        net_cash_flow: (roomRevenue + posRevenue + laundryRevenue) - totalExpenses,
        arrivals: arrivalsCount,
        departures: departuresCount,
        in_house_guests: inHouseCount,
        occupancy_rate: occupancyPercentage,
        payment_methods: paymentMethods,
        pos_outlets: posOutlets,
        in_house_list: inHouseList,
        created_at: new Date().toISOString()
      };
      
      setCloseOfDayData(compiledReport);
      
      const updatedClosures = [compiledReport, ...dailyClosures];
      setDailyClosures(updatedClosures);
      
      const { error: dbErr } = await supabase.from('daily_closures').insert([compiledReport]);
      if (dbErr) {
        console.warn("Failed to insert daily closure in database, falling back to system_settings / localStorage:", dbErr.message);
      }

      // Always sync to system_settings and localStorage as fallback/backup
      try {
        await supabase.from('system_settings').upsert({
          setting_key: 'daily_closure_reports',
          setting_value: updatedClosures
        }, { onConflict: 'setting_key' });
        localStorage.setItem('luxe_daily_closures', JSON.stringify(updatedClosures));
      } catch (fallbackErr) {
        console.error("Failed to save daily closures to fallbacks:", fallbackErr);
      }
      
      await supabase.from('system_logs').insert([{
        user_id: profile?.id,
        log_type: 'activity',
        action: `Executed Close of Day & Night Audit for ${todayStr}`,
        module: 'Accounting'
      }]);
      
      toast.success("Night Audit compiled and daily ledger successfully closed!", { id: toastId });
      setShowCloseOfDayModal(true);
    } catch (err) {
      toast.error("Compilation failed: " + err.message, { id: toastId });
    } finally {
      setIsRunningNightAudit(false);
    }
  };

  const handleOpenVoidCorrect = (item) => {
    if (!hasAccess('Finance - Process Refunds & Adjustments')) {
      return toast.error("You do not have permission to adjust or void ledger transactions.");
    }
    setVoidCorrectTransaction(item);
    setVoidCorrectAmount(item.amount.toString());
    setVoidCorrectMethod(item.method);
    setVoidCorrectCategory(item.category || '');
    setVoidCorrectNotes('');
    setShowVoidCorrectModal(true);
  };

  const handleVoidTransaction = async () => {
    if (!hasAccess('Finance - Process Refunds & Adjustments')) {
      return toast.error("You do not have permission to adjust or void ledger transactions.");
    }
    if (!voidCorrectTransaction) return;
    const confirm = window.confirm("Are you sure you want to VOID this transaction completely? This will set its amount to 0, append [VOIDED] to description, and reverse any linked bookings paid amounts.");
    if (!confirm) return;
    
    const toastId = toast.loading("Voiding transaction in system ledger...");
    try {
      const type = voidCorrectTransaction.source;
      const id = voidCorrectTransaction.id;
      
      if (type === 'guest_payment') {
        const { error } = await supabase
          .from('payments')
          .update({
            amount: 0,
            status: 'voided',
            notes: `${voidCorrectTransaction.description} [VOIDED - By Admin ${profile?.first_name || 'Super Admin'}]`
          })
          .eq('id', id);
        if (error) throw error;
        
        if (voidCorrectTransaction.booking_id) {
          const { data: booking } = await supabase.from('bookings').select('amount_paid_ngn').eq('id', voidCorrectTransaction.booking_id).single();
          if (booking) {
            const currentPaid = Number(booking.amount_paid_ngn || 0);
            const newPaid = Math.max(0, currentPaid - voidCorrectTransaction.amount);
            await supabase.from('bookings').update({ amount_paid_ngn: newPaid, payment_status: 'partial' }).eq('id', voidCorrectTransaction.booking_id);
          }
        }
      } else if (type === 'expense') {
        const { error } = await supabase
          .from('expenses')
          .update({
            amount: 0,
            status: 'voided',
            description: `${voidCorrectTransaction.description} [VOIDED - By Admin]`
          })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'salary') {
        const { error } = await supabase
          .from('staff_salaries')
          .update({
            base_salary: 0,
            bonuses: 0,
            deductions: 0,
            net_salary: 0,
            status: 'voided',
            notes: `${voidCorrectTransaction.description} [VOIDED - By Admin]`
          })
          .eq('id', id);
        if (error) throw error;
      }
      
      await fetchFinancialData();
      toast.success("Transaction voided successfully and general ledger synchronized!", { id: toastId });
      setShowVoidCorrectModal(false);
    } catch (err) {
      toast.error("Voiding failed: " + err.message, { id: toastId });
    }
  };

  const handleCorrectTransaction = async (e) => {
    e.preventDefault();
    if (!hasAccess('Finance - Process Refunds & Adjustments')) {
      return toast.error("You do not have permission to adjust or void ledger transactions.");
    }
    if (!voidCorrectTransaction) return;
    const amount = Number(voidCorrectAmount);
    if (isNaN(amount) || amount < 0) return toast.error("Invalid amount");
    
    const toastId = toast.loading("Updating ledger details...");
    try {
      const type = voidCorrectTransaction.source;
      const id = voidCorrectTransaction.id;
      const difference = amount - voidCorrectTransaction.amount;
      
      if (type === 'guest_payment') {
        const { error } = await supabase
          .from('payments')
          .update({
            amount: amount,
            method: voidCorrectMethod,
            notes: `${voidCorrectTransaction.notes} [CORRECTED: ${voidCorrectNotes || 'Details updated'}]`
          })
          .eq('id', id);
        if (error) throw error;
        
        if (voidCorrectTransaction.booking_id && difference !== 0) {
          const { data: booking } = await supabase.from('bookings').select('amount_paid_ngn').eq('id', voidCorrectTransaction.booking_id).single();
          if (booking) {
            const currentPaid = Number(booking.amount_paid_ngn || 0);
            const newPaid = Math.max(0, currentPaid + difference);
            await supabase.from('bookings').update({ amount_paid_ngn: newPaid }).eq('id', voidCorrectTransaction.booking_id);
          }
        }
      } else if (type === 'expense') {
        const { error } = await supabase
          .from('expenses')
          .update({
            amount: amount,
            payment_method: voidCorrectMethod,
            category: voidCorrectCategory,
            description: `${voidCorrectTransaction.notes} [CORRECTED: ${voidCorrectNotes || 'Details updated'}]`
          })
          .eq('id', id);
        if (error) throw error;
      } else if (type === 'salary') {
        const { error } = await supabase
          .from('staff_salaries')
          .update({
            net_salary: amount,
            payment_method: voidCorrectMethod,
            notes: `${voidCorrectTransaction.notes} [CORRECTED: ${voidCorrectNotes || 'Details updated'}]`
          })
          .eq('id', id);
        if (error) throw error;
      }
      
      await fetchFinancialData();
      toast.success("Ledger transaction details adjusted successfully!", { id: toastId });
      setShowVoidCorrectModal(false);
    } catch (err) {
      toast.error("Correction failed: " + err.message, { id: toastId });
    }
  };

  const getUnifiedLedger = () => {
    // 1. Gather Customer Inflow Receipts
    const ledgerInflows = inflows.map(inf => ({
      ...inf,
      source: 'guest_payment'
    }));

    // 2. Gather Outflows (Logged Expenses) - excluding salary duplicates
    const nonDuplicateExpenses = expenses.filter(exp => {
      return !(exp.category === 'Salaries' && (exp.description || '').toLowerCase().includes('salary payout'));
    });

    const ledgerOutflows = nonDuplicateExpenses.map(exp => ({
      id: exp.id,
      date: exp.expense_date,
      amount: Number(exp.amount),
      description: exp.description || `Cost Outflow - ${exp.category}`,
      method: exp.payment_method || 'bank_transfer',
      status: exp.status,
      type: 'outflow',
      category: exp.category,
      source: 'expense',
      notes: exp.description || ''
    }));

    // 3. Gather Paid Salaries
    const salaryOutflows = salaries
      .filter(s => s.status === 'paid')
      .map(s => {
        const staffMember = staff.find(st => st.id === s.staff_id) || { first_name: 'Staff', last_name: 'Member' };
        const netSalary = s.net_salary || (Number(s.base_salary) + Number(s.bonuses) - Number(s.deductions));
        const periodStart = s.pay_period_start ? format(new Date(s.pay_period_start), 'MMM dd') : '';
        const periodEnd = s.pay_period_end ? format(new Date(s.pay_period_end), 'MMM dd, yyyy') : '';
        const periodText = periodStart && periodEnd ? ` for period ${periodStart} to ${periodEnd}` : '';
        return {
          id: s.id,
          date: s.payment_date || s.created_at,
          amount: netSalary,
          description: `Salary payout to ${staffMember.first_name} ${staffMember.last_name}${periodText}. ${s.notes || ''}`.trim(),
          method: s.payment_method || 'bank_transfer',
          status: s.status,
          type: 'outflow',
          category: 'Salaries',
          source: 'salary',
          notes: s.notes || ''
        };
      });

    // 4. Gather Corporate Billed Bookings (paid but not settled initially, settled once group balance is 0)
    const ledgerCorpBookings = corporateBookings.map(b => {
      const isSettled = Number(b.group_accounts?.outstanding_balance || 0) === 0;
      return {
        id: b.id,
        date: b.created_at || b.check_in_date,
        amount: Number(b.total_amount_ngn),
        description: `Corporate Billed Stay — [Guest: ${b.guest_name}] | Company: ${b.group_accounts?.name || 'Group'}`,
        method: 'corporate_billing',
        status: isSettled ? 'settled' : 'paid but not settled',
        type: 'inflow',
        category: 'Booking Revenue',
        source: 'corporate_booking',
        notes: `Group credit settlement managed in Debtors Ledger`
      };
    });

    // Combine & Sort chronologically descending
    const combined = [...ledgerInflows, ...ledgerOutflows, ...salaryOutflows, ...ledgerCorpBookings].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply Multi-Criteria Filters
    return combined.filter(item => {
      // 1. Departmental Sub-Tab Filter
      if (ledgerSubTab === 'front_office') {
        const matchesFrontOffice = item.category === 'Booking Revenue' || item.method === 'corporate_billing';
        if (!matchesFrontOffice) return false;
      } else if (ledgerSubTab === 'laundry') {
        const matchesLaundry = item.category === 'Laundry Revenue' || 
                               (item.transaction_ref && item.transaction_ref.startsWith('LDY-')) || 
                               (item.description && item.description.toLowerCase().includes('laundry')) ||
                               (item.notes && item.notes.toLowerCase().includes('laundry'));
        if (!matchesLaundry) return false;
      } else if (ledgerSubTab === 'restaurant') {
        const descLower = (item.description || '').toLowerCase();
        const notesLower = (item.notes || '').toLowerCase();
        const matchesRestaurant = item.category === 'POS Revenue' && 
                                  (descLower.includes('outlet: restaurant') || 
                                   descLower.includes('restaurant') || 
                                   descLower.includes('kitchen') ||
                                   notesLower.includes('outlet: restaurant') || 
                                   notesLower.includes('restaurant') || 
                                   notesLower.includes('kitchen') ||
                                   notesLower.includes('restaurant_order:'));
        if (!matchesRestaurant) return false;
      } else if (ledgerSubTab === 'bar') {
        const descLower = (item.description || '').toLowerCase();
        const notesLower = (item.notes || '').toLowerCase();
        const matchesBar = item.category === 'POS Revenue' && 
                           (descLower.includes('outlet: bar') || 
                            descLower.includes('bar') || 
                            notesLower.includes('outlet: bar') || 
                            notesLower.includes('bar'));
        if (!matchesBar) return false;
      }

      // 2. Search / Type / Date Filters
      const matchesSearch = (item.description || '').toLowerCase().includes(ledgerSearch.toLowerCase()) || 
                            (item.category || '').toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                            (item.method || '').toLowerCase().includes(ledgerSearch.toLowerCase());
      
      const matchesType = ledgerType === 'all' || item.type === ledgerType;

      let matchesDate = true;
      if (item.date) {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);

        if (ledgerStartDate) {
          const start = new Date(ledgerStartDate);
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && itemDate >= start;
        }
        if (ledgerEndDate) {
          const end = new Date(ledgerEndDate);
          end.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && itemDate <= end;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  };

  // CSV Dynamic Exporter
  const handleExportCSV = () => {
    const filteredLedger = getUnifiedLedger();
    if (filteredLedger.length === 0) {
      return toast.error("No transaction records found to export.");
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Transaction ID,Date,Type,Category,Description,Method,Amount (NGN),Status\r\n";

    filteredLedger.forEach(row => {
      const dateStr = format(new Date(row.date), 'yyyy-MM-dd');
      const descClean = row.description.replace(/"/g, '""');
      csvContent += `"${row.id}","${dateStr}","${row.type.toUpperCase()}","${row.category}","${descClean}","${row.method}","${row.amount}","${row.status.toUpperCase()}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Luxe_General_Ledger_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV spreadsheet downloaded successfully!");
  };

  const calculateFinancialMetrics = () => {
    const standardInflows = inflows.filter(i => {
      const isCorpSettlement = i.transaction_ref?.startsWith('DEBT-SET-CORP-') || (i.notes?.includes('Debt settlement payout') && i.notes?.includes('Ref: CORP-'));
      return !isCorpSettlement && (i.status === 'completed' || i.status === 'paid' || i.status === 'success');
    });
    const standardInflowsSum = standardInflows.reduce((sum, item) => sum + item.amount, 0);
    const corporateStaysSum = corporateBookings.reduce((sum, item) => sum + Number(item.total_amount_ngn || 0), 0);
    const grossIncome = standardInflowsSum + corporateStaysSum;

    const nonDuplicateExpenses = expenses.filter(exp => {
      return !(exp.category === 'Salaries' && (exp.description || '').toLowerCase().includes('salary payout'));
    });

    const standardExpenses = nonDuplicateExpenses
      .filter(e => e.status === 'paid')
      .reduce((sum, item) => sum + item.amount, 0);

    const paidSalariesSum = salaries
      .filter(s => s.status === 'paid')
      .reduce((sum, item) => sum + (item.net_salary || (Number(item.base_salary) + Number(item.bonuses) - Number(item.deductions))), 0);

    const totalExpenses = standardExpenses + paidSalariesSum;

    const netProfit = grossIncome - totalExpenses;

    const outstandingPayrollLiabilities = salaries
      .filter(s => s.status !== 'paid')
      .reduce((sum, item) => sum + (item.net_salary || (item.base_salary + item.bonuses - item.deductions)), 0);

    return { grossIncome, totalExpenses, netProfit, outstandingPayrollLiabilities };
  };

  const metrics = calculateFinancialMetrics();

  // Prepare Recharts Data
  const getTimelineChartData = () => {
    const monthlyMap = {};

    // Inflows aggregation
    inflows.forEach(i => {
      const isCorpSettlement = i.transaction_ref?.startsWith('DEBT-SET-CORP-') || (i.notes?.includes('Debt settlement payout') && i.notes?.includes('Ref: CORP-'));
      if (isCorpSettlement) return;
      
      const monthYear = format(new Date(i.date), 'MMM yyyy');
      if (!monthlyMap[monthYear]) monthlyMap[monthYear] = { name: monthYear, income: 0, expenses: 0 };
      if (i.status === 'completed' || i.status === 'paid' || i.status === 'success') {
        monthlyMap[monthYear].income += Number(i.amount);
      }
    });

    // Corporate Stays aggregation
    corporateBookings.forEach(b => {
      const monthYear = format(new Date(b.created_at || b.check_in_date), 'MMM yyyy');
      if (!monthlyMap[monthYear]) monthlyMap[monthYear] = { name: monthYear, income: 0, expenses: 0 };
      monthlyMap[monthYear].income += Number(b.total_amount_ngn || 0);
    });

    const nonDuplicateExpenses = expenses.filter(exp => {
      return !(exp.category === 'Salaries' && (exp.description || '').toLowerCase().includes('salary payout'));
    });

    // Expenses aggregation
    nonDuplicateExpenses.forEach(e => {
      const monthYear = format(new Date(e.expense_date), 'MMM yyyy');
      if (!monthlyMap[monthYear]) monthlyMap[monthYear] = { name: monthYear, income: 0, expenses: 0 };
      if (e.status === 'paid') {
        monthlyMap[monthYear].expenses += Number(e.amount);
      }
    });

    // Paid Salaries aggregation
    salaries.forEach(s => {
      const monthYear = format(new Date(s.payment_date || s.created_at), 'MMM yyyy');
      if (!monthlyMap[monthYear]) monthlyMap[monthYear] = { name: monthYear, income: 0, expenses: 0 };
      if (s.status === 'paid') {
        const netSalary = s.net_salary || (Number(s.base_salary) + Number(s.bonuses) - Number(s.deductions));
        monthlyMap[monthYear].expenses += Number(netSalary);
      }
    });

    return Object.values(monthlyMap);
  };

  const timelineData = getTimelineChartData();

  const getPieChartData = () => {
    const catMap = {};
    
    const nonDuplicateExpenses = expenses.filter(exp => {
      return !(exp.category === 'Salaries' && (exp.description || '').toLowerCase().includes('salary payout'));
    });

    nonDuplicateExpenses.forEach(e => {
      if (e.status === 'paid') {
        catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
      }
    });

    salaries.forEach(s => {
      if (s.status === 'paid') {
        const netSalary = s.net_salary || (Number(s.base_salary) + Number(s.bonuses) - Number(s.deductions));
        catMap['Salaries'] = (catMap['Salaries'] || 0) + Number(netSalary);
      }
    });

    return Object.keys(catMap).map(cat => ({
      name: cat,
      value: catMap[cat]
    }));
  };

  const pieData = getPieChartData();

  // Payslip Helper details
  const triggerPrintPayslip = (payrollItem) => {
    const matchedStaff = staff.find(s => s.id === payrollItem.staff_id) || { first_name: 'Staff', last_name: 'Member', role: 'housekeeper', email: 'staff@luxepms.com' };
    setActivePayslip({
      ...payrollItem,
      staffName: `${matchedStaff.first_name} ${matchedStaff.last_name}`,
      staffRole: matchedStaff.role.replace('_', ' ').toUpperCase(),
      staffEmail: matchedStaff.email
    });
  };

  // --- Accounting Report Calculators ---

  const getFilteredReportData = () => {
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);

    const filteredInflows = inflows.filter(i => {
      const d = new Date(i.date);
      const matchesDate = d >= start && d <= end;
      return matchesDate;
    });

    const nonDuplicateExpenses = expenses.filter(exp => {
      return !(exp.category === 'Salaries' && (exp.description || '').toLowerCase().includes('salary payout'));
    });

    const filteredExpenses = nonDuplicateExpenses.filter(e => {
      const d = new Date(e.expense_date);
      const matchesDate = d >= start && d <= end;
      const matchesProp = reportProperty === 'all' || e.property_id === reportProperty;
      return matchesDate && matchesProp;
    });

    const filteredSalaries = salaries.filter(s => {
      const d = new Date(s.payment_date || s.created_at);
      const matchesDate = d >= start && d <= end;
      return matchesDate;
    });

    return { filteredInflows, filteredExpenses, filteredSalaries };
  };

  const calculatePnLReport = () => {
    const { filteredInflows, filteredExpenses, filteredSalaries } = getFilteredReportData();
    
    const standardInflows = filteredInflows.filter(i => {
      const isCorpSettlement = i.transaction_ref?.startsWith('DEBT-SET-CORP-') || (i.notes?.includes('Debt settlement payout') && i.notes?.includes('Ref: CORP-'));
      return !isCorpSettlement && ['completed', 'paid', 'success'].includes(i.status);
    });

    const standardInflowsSum = standardInflows.reduce((sum, item) => sum + item.amount, 0);
    
    // Filter corporate bookings to report date range
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    const filteredCorpBookings = corporateBookings.filter(b => {
      const d = new Date(b.created_at || b.check_in_date);
      return d >= start && d <= end;
    });
    const corporateStaysSum = filteredCorpBookings.reduce((sum, item) => sum + Number(item.total_amount_ngn || 0), 0);

    const bookingRevenue = standardInflowsSum + corporateStaysSum;

    const expensesByCategory = {};
    CATEGORIES.forEach(cat => {
      expensesByCategory[cat] = 0;
    });

    filteredExpenses
      .filter(e => e.status === 'paid')
      .forEach(e => {
        const cat = e.category || 'Other';
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(e.amount);
      });

    // Populate Salaries from salaries state
    filteredSalaries
      .filter(s => s.status === 'paid')
      .forEach(s => {
        const netSalary = s.net_salary || (Number(s.base_salary) + Number(s.bonuses) - Number(s.deductions));
        expensesByCategory['Salaries'] = (expensesByCategory['Salaries'] || 0) + Number(netSalary);
      });

    const totalRevenue = bookingRevenue;
    const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { bookingRevenue, totalRevenue, expensesByCategory, totalExpenses, netProfit, margin };
  };

  const calculateCashFlowReport = () => {
    const { filteredInflows, filteredExpenses, filteredSalaries } = getFilteredReportData();
    const inflowsByMethod = {};
    const outflowsByMethod = {};

    filteredInflows
      .filter(i => ['completed', 'paid', 'success'].includes(i.status))
      .forEach(i => {
        const m = i.method || 'bank_transfer';
        inflowsByMethod[m] = (inflowsByMethod[m] || 0) + Number(i.amount);
      });

    filteredExpenses
      .filter(e => e.status === 'paid')
      .forEach(e => {
        const m = e.payment_method || 'bank_transfer';
        outflowsByMethod[m] = (outflowsByMethod[m] || 0) + Number(e.amount);
      });

    // Accumulate paid salaries outflows grouped by payment method
    filteredSalaries
      .filter(s => s.status === 'paid')
      .forEach(s => {
        const m = s.payment_method || 'bank_transfer';
        const netSalary = s.net_salary || (Number(s.base_salary) + Number(s.bonuses) - Number(s.deductions));
        outflowsByMethod[m] = (outflowsByMethod[m] || 0) + Number(netSalary);
      });

    const totalCashInflows = Object.values(inflowsByMethod).reduce((sum, val) => sum + val, 0);
    const totalCashOutflows = Object.values(outflowsByMethod).reduce((sum, val) => sum + val, 0);
    const netCashFlow = totalCashInflows - totalCashOutflows;

    return { inflowsByMethod, outflowsByMethod, totalCashInflows, totalCashOutflows, netCashFlow };
  };

  const calculateBalanceSheetReport = () => {
    const end = new Date(reportEndDate);

    const pastInflows = inflows.filter(i => new Date(i.date) <= end && ['completed', 'paid', 'success'].includes(i.status));
    
    const nonDuplicateExpenses = expenses.filter(exp => {
      return !(exp.category === 'Salaries' && (exp.description || '').toLowerCase().includes('salary payout'));
    });

    const pastExpensesPaid = nonDuplicateExpenses.filter(e => new Date(e.expense_date) <= end && e.status === 'paid');
    
    // Paid salaries up to report end date
    const pastSalariesPaid = salaries.filter(s => new Date(s.payment_date || s.created_at) <= end && s.status === 'paid');
    
    const totalPaidInflows = pastInflows.reduce((sum, item) => sum + item.amount, 0);
    
    const totalPaidExpenses = pastExpensesPaid.reduce((sum, item) => sum + item.amount, 0);
    const totalPaidSalaries = pastSalariesPaid.reduce((sum, item) => {
      const netSalary = item.net_salary || (Number(item.base_salary) + Number(item.bonuses) - Number(item.deductions));
      return sum + netSalary;
    }, 0);

    const totalPaidOutflows = totalPaidExpenses + totalPaidSalaries;
    const cash = Math.max(0, totalPaidInflows - totalPaidOutflows);

    const corporateDebtsSum = groupAccounts.reduce((sum, g) => sum + Number(g.outstanding_balance || 0), 0);

    const receivables = invoices
      .filter(inv => new Date(inv.issue_date) <= end && inv.status !== 'paid')
      .reduce((sum, inv) => sum + (Number(inv.total_amount) - Number(inv.amount_paid)), 0) + corporateDebtsSum;

    const totalAssets = cash + receivables;

    const payableExpenses = nonDuplicateExpenses
      .filter(e => new Date(e.expense_date) <= end && e.status !== 'paid')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const payableSalaries = salaries
      .filter(s => new Date(s.payment_date || s.created_at) <= end && s.status !== 'paid')
      .reduce((sum, s) => sum + (s.net_salary || (s.base_salary + s.bonuses - s.deductions)), 0);

    const totalLiabilities = payableExpenses + payableSalaries;
    const equity = totalAssets - totalLiabilities;

    return { cash, receivables, totalAssets, payableExpenses, payableSalaries, totalLiabilities, equity };
  };

  const downloadCSV = (content, filename) => {
    const encodedUri = encodeURI(content);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully!");
  };

  const handleExportPnLCSV = (data) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `PROFIT AND LOSS STATEMENT (${reportStartDate} to ${reportEndDate})\r\n\r\n`;
    csvContent += "Line Item,Amount (NGN)\r\n";
    csvContent += `REVENUE,,\r\n`;
    csvContent += `  Booking Revenue,${data.bookingRevenue}\r\n`;
    csvContent += `  TOTAL REVENUE,${data.totalRevenue}\r\n\r\n`;
    csvContent += `OPERATING EXPENSES,,\r\n`;
    Object.entries(data.expensesByCategory).forEach(([cat, val]) => {
      csvContent += `  ${cat},${val}\r\n`;
    });
    csvContent += `  TOTAL EXPENSES,${data.totalExpenses}\r\n\r\n`;
    csvContent += `NET OPERATING INCOME,${data.netProfit}\r\n`;
    csvContent += `OPERATING MARGIN %,${data.margin.toFixed(2)}%\r\n`;

    downloadCSV(csvContent, `Profit_Loss_Statement_${reportStartDate}_to_${reportEndDate}.csv`);
  };

  const handleExportCashFlowCSV = (data) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `CASH FLOW STATEMENT (${reportStartDate} to ${reportEndDate})\r\n\r\n`;
    csvContent += "Cash Flow Type,Payment Mode,Amount (NGN)\r\n";
    csvContent += "CASH INFLOWS,,\r\n";
    Object.entries(data.inflowsByMethod).forEach(([method, val]) => {
      csvContent += `  Customer Booking,${method.toUpperCase()},${val}\r\n`;
    });
    csvContent += `  TOTAL CASH INFLOWS,,${data.totalCashInflows}\r\n\r\n`;
    csvContent += "CASH OUTFLOWS,,\r\n";
    Object.entries(data.outflowsByMethod).forEach(([method, val]) => {
      csvContent += `  Operations Outflow,${method.toUpperCase()},${val}\r\n`;
    });
    csvContent += `  TOTAL CASH OUTFLOWS,,${data.totalCashOutflows}\r\n\r\n`;
    csvContent += `NET INCREASE IN CASH,,${data.netCashFlow}\r\n`;

    downloadCSV(csvContent, `Cash_Flow_Statement_${reportStartDate}_to_${reportEndDate}.csv`);
  };

  const handleExportBalanceSheetCSV = (data) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `BALANCE SHEET (As of ${reportEndDate})\r\n\r\n`;
    csvContent += "Account Category,Account Type,Amount (NGN)\r\n";
    csvContent += "ASSETS,,\r\n";
    csvContent += `  Current Assets,Cash & Cash Equivalents,${data.cash}\r\n`;
    csvContent += `  Current Assets,Accounts Receivable,${data.receivables}\r\n`;
    csvContent += `  TOTAL ASSETS,,${data.totalAssets}\r\n\r\n`;
    csvContent += "LIABILITIES,,\r\n";
    csvContent += `  Current Liabilities,Accounts Payable (Pending Expenses),${data.payableExpenses}\r\n`;
    csvContent += `  Current Liabilities,Accrued Payroll (Pending Salaries),${data.payableSalaries}\r\n`;
    csvContent += `  TOTAL LIABILITIES,,${data.totalLiabilities}\r\n\r\n`;
    csvContent += "EQUITY,,\r\n";
    csvContent += `  Owner Equity,Retained Earnings,${data.equity}\r\n`;
    csvContent += `  TOTAL EQUITY,,${data.equity}\r\n\r\n`;
    csvContent += `TOTAL EQUITY & LIABILITIES,,${data.totalLiabilities + data.equity}\r\n`;

    downloadCSV(csvContent, `Balance_Sheet_${reportEndDate}.csv`);
  };

  const baseExpenses = expenses.filter(exp => {
    const matchesSearch = (exp.description || '').toLowerCase().includes(expenseSearch.toLowerCase()) || 
                          (exp.paid_to || '').toLowerCase().includes(expenseSearch.toLowerCase());
    const matchesCategory = expenseCategory === 'all' || exp.category === expenseCategory;
    return matchesSearch && matchesCategory;
  });
  const paginatedExpenses = baseExpenses.slice((expensePage - 1) * ITEMS_PER_PAGE, expensePage * ITEMS_PER_PAGE);

  const baseUnifiedLedger = getUnifiedLedger();
  const paginatedLedger = baseUnifiedLedger.slice((ledgerPage - 1) * ITEMS_PER_PAGE, ledgerPage * ITEMS_PER_PAGE);

  const baseMergedAR = getMergedARAccounts();
  const filteredMergedAR = baseMergedAR.filter(ar => {
    const s = arSearchTerm.toLowerCase();
    return (ar.guest_name || '').toLowerCase().includes(s) || 
           (ar.guest_email || '').toLowerCase().includes(s) || 
           (ar.id || '').toLowerCase().includes(s);
  });
  const paginatedARAccounts = filteredMergedAR.slice((arPage - 1) * ITEMS_PER_PAGE, arPage * ITEMS_PER_PAGE);

  return (
    <div className="pb-12 text-white">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dark-800 p-6 rounded-2xl border border-dark-700/50 shadow-xl mb-6 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Wallet className="text-brand-500" size={28} /> Financial & Payroll Center
          </h1>
          <p className="text-gray-200 mt-1">
            Aggregate customer booking payments, track utility & operations expenses, manage staff payroll profiles and print employee payslips.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-3 md:mt-0">
          {hasAccess('Store Keeping - Log Requisitions') && (
            <button 
              onClick={() => setIsRequisitionOpen(true)} 
              className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white py-2 px-4 rounded-xl text-xs font-bold transition-all shadow flex items-center gap-2"
            >
              <Archive size={14} />
              <span>Store Requisition</span>
            </button>
          )}
          {isUsingFallback && (
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
              <Sparkles size={14} /> Local Sandbox Session Active
            </span>
          )}
        </div>
      </div>

      {/* Summary KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* KPI 1 */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Gross Booking Income</p>
              <h3 className="text-2xl font-black mt-2 text-white font-mono">
                ₦{metrics.grossIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10 text-green-500 border border-green-500/20">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs text-green-400 font-semibold">
            <ArrowUpRight size={14} />
            <span>100% Inflow tracking</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Total Expenses</p>
              <h3 className="text-2xl font-black mt-2 text-white font-mono">
                ₦{metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-brand-500/10 text-brand-500 border border-brand-500/20">
              <TrendingDown size={24} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs text-brand-400 font-semibold">
            <ArrowDownRight size={14} />
            <span>Salaries & utilities outflow</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Net Profit / Loss</p>
              <h3 className={`text-2xl font-black mt-2 font-mono ${metrics.netProfit >= 0 ? 'text-green-400' : 'text-rose-500'}`}>
                ₦{metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className={`p-3 rounded-xl border ${metrics.netProfit >= 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
              {metrics.netProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 mt-4 text-xs font-semibold ${metrics.netProfit >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
            {metrics.netProfit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{metrics.netProfit >= 0 ? 'Upbeat margins' : 'Deficit check required'}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Payroll Liabilities</p>
              <h3 className="text-2xl font-black mt-2 text-white font-mono">
                ₦{metrics.outstandingPayrollLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
              <Clock size={24} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs text-yellow-400 font-semibold">
            <Clock size={14} />
            <span>Unpaid pay periods</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 border-b border-dark-700 mb-6 overflow-x-auto select-none no-scrollbar">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`pb-3 px-5 font-bold flex items-center gap-2 border-b-2 transition-all duration-300 ${activeTab === 'overview' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <TrendingUp size={18} /> Financial Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('expenses')} 
          className={`pb-3 px-5 font-bold flex items-center gap-2 border-b-2 transition-all duration-300 ${activeTab === 'expenses' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <ArrowDownRight size={18} /> Expense Tracker
        </button>
        <button 
          onClick={() => setActiveTab('payroll')} 
          className={`pb-3 px-5 font-bold flex items-center gap-2 border-b-2 transition-all duration-300 ${activeTab === 'payroll' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <User size={18} /> Staff Payroll & Salaries
        </button>
        <button 
          onClick={() => setActiveTab('ledger')} 
          className={`pb-3 px-5 font-bold flex items-center gap-2 border-b-2 transition-all duration-300 ${activeTab === 'ledger' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <FileText size={18} /> General Ledger
        </button>
        <button 
          onClick={() => setActiveTab('debtors')} 
          className={`pb-3 px-5 font-bold flex items-center gap-2 border-b-2 transition-all duration-300 ${activeTab === 'debtors' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <Building size={18} className="text-brand-400" /> Debtors Ledger
        </button>
        <button 
          onClick={() => setActiveTab('ar')} 
          className={`pb-3 px-5 font-bold flex items-center gap-2 border-b-2 transition-all duration-300 ${activeTab === 'ar' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <Wallet size={18} className="text-green-400" /> AR Accounts
        </button>
        <button 
          onClick={() => setActiveTab('close_of_day')} 
          className={`pb-3 px-5 font-bold flex items-center gap-2 border-b-2 transition-all duration-300 ${activeTab === 'close_of_day' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <Clock size={18} className="text-amber-400" /> Close of Day & Audit
        </button>
        <button 
          onClick={() => setActiveTab('reports')} 
          className={`pb-3 px-5 font-bold flex items-center gap-2 border-b-2 transition-all duration-300 ${activeTab === 'reports' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
        >
          <FileText size={18} /> Accounting Reports
        </button>
      </div>

      {/* Tab 1: Financial Dashboard */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cash Flow Line Chart */}
            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 lg:col-span-2 flex flex-col min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold">Monthly Revenue & Cost Timeline</h3>
                  <p className="text-gray-200 text-xs">Aggregated gross income vs. utility/salaries expenses</p>
                </div>
              </div>
              <div className="flex-1 w-full min-h-[300px]">
                {timelineData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-300 text-sm">No transaction periods logged yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DF6853" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#DF6853" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" vertical={false} />
                      <XAxis dataKey="name" stroke="#666" fontSize={11} tickLine={false} />
                      <YAxis stroke="#666" fontSize={11} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E1E1E', borderColor: '#2D2D2D', borderRadius: '12px', color: '#fff' }}
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area name="Inflows (Gross)" type="monotone" dataKey="income" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                      <Area name="Outflows (Paid)" type="monotone" dataKey="expenses" stroke="#DF6853" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Expenses Category Cost Breakdown */}
            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 flex flex-col min-h-[400px]">
              <div className="mb-6">
                <h3 className="text-lg font-bold">Operational Expense Allocation</h3>
                <p className="text-gray-200 text-xs">Breakdown by categorized cost centers</p>
              </div>
              <div className="flex-1 w-full min-h-[220px] flex items-center justify-center">
                {pieData.length === 0 ? (
                  <div className="text-gray-300 text-sm">No expenses logged yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E1E1E', borderColor: '#2D2D2D', borderRadius: '12px' }}
                        formatter={(val) => `₦${val.toLocaleString()}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {pieData.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs overflow-y-auto max-h-[120px] pr-1">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 truncate">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                      <span className="text-gray-300 truncate">{entry.name}</span>
                      <span className="font-bold ml-auto text-white">₦{entry.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Expense Tracker */}
      {activeTab === 'expenses' && (
        <div className="glass-panel rounded-2xl border border-dark-700/50 overflow-hidden shadow-xl">
          <div className="p-5 border-b border-dark-700/50 bg-dark-800/80 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-200" />
                <input 
                  type="text" 
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Search description, recipient..."
                  className="w-full bg-dark-900 border border-dark-700/60 p-2.5 pl-10 rounded-xl text-sm outline-none focus:border-brand-500"
                />
              </div>
              {/* Category dropdown */}
              <select 
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="bg-dark-900 border border-dark-700/60 p-2.5 rounded-xl text-sm outline-none focus:border-brand-500 w-full sm:w-44 text-gray-300"
              >
                <option value="all" className="bg-dark-900 text-white">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-dark-900 text-white">{c}</option>)}
              </select>
            </div>
            
            <button 
              onClick={() => setShowLogExpense(true)}
              className="btn-primary py-2.5 px-5 text-sm font-bold flex items-center justify-center gap-2 rounded-xl"
            >
              <Plus size={16} /> Log Operational Expense
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-dark-900/60 border-b border-dark-700/50 text-gray-200">
                <tr>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Expense Date</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Cost Category</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Description</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Paid To</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Payment Mode</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Transaction Amount</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/40">
                {paginatedExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-dark-700/20 transition-colors">
                      <td className="p-4 text-gray-200 font-mono">{format(new Date(exp.expense_date), 'MMM dd, yyyy')}</td>
                      <td className="p-4">
                        <span className="bg-dark-700 text-gray-300 border border-dark-600/50 px-2 py-0.5 rounded text-xs font-semibold">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-4 text-white max-w-xs truncate">{exp.description}</td>
                      <td className="p-4 text-gray-300 font-medium">{exp.paid_to || 'N/A'}</td>
                      <td className="p-4 text-gray-200 uppercase text-xs font-semibold font-mono">{exp.payment_method}</td>
                      <td className="p-4 text-white font-bold font-mono">₦{Number(exp.amount).toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          exp.status === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                          exp.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {exp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                {baseExpenses.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-gray-300 text-sm">No expenses found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {baseExpenses.length > ITEMS_PER_PAGE && (
            <div className="p-4 border-t border-dark-700/50 bg-dark-800/80">
              <Pagination currentPage={expensePage} totalPages={Math.ceil(baseExpenses.length / ITEMS_PER_PAGE)} limit={ITEMS_PER_PAGE} onPageChange={setExpensePage} />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payroll & Salaries */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Active staff list & process panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-5 rounded-2xl border border-dark-700/50 lg:col-span-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><User size={20} className="text-brand-500" /> Active System Staff Directory</h3>
                <button
                  onClick={() => setShowBankSettlementModal(true)}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 hover:scale-[1.02]"
                >
                  <FileText size={14} /> Generate Settlement Sheet
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-dark-900 border-b border-dark-700/50 text-gray-200">
                    <tr>
                      <th className="p-4 font-bold text-xs uppercase tracking-wider">Employee</th>
                      <th className="p-4 font-bold text-xs uppercase tracking-wider">Role</th>
                      <th className="p-4 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700/40">
                    {staff.map(s => (
                      <tr key={s.id} className="hover:bg-dark-700/10 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white">{s.first_name} {s.last_name}</div>
                          <div className="text-xs text-gray-300 font-mono mt-0.5">{s.email || 'No email registered'}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                            {s.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleOpenProcessPayroll(s)}
                            className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-1.5 px-4 rounded-xl text-xs transition-colors shadow-sm"
                          >
                            Process Payout
                          </button>
                        </td>
                      </tr>
                    ))}
                    {staff.length === 0 && (
                      <tr>
                        <td colSpan="3" className="p-12 text-center text-gray-300 text-sm">No registered staff found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historical payroll payouts lists */}
            <div className="glass-panel p-5 rounded-2xl border border-dark-700/50 flex flex-col max-h-[500px]">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Clock size={20} className="text-brand-500" /> Historical Payouts Ledger</h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {salaries.map(sal => {
                  const employee = staff.find(s => s.id === sal.staff_id) || { first_name: 'Employee', last_name: '' };
                  const netSalary = sal.net_salary || (Number(sal.base_salary) + Number(sal.bonuses) - Number(sal.deductions));
                  return (
                    <div key={sal.id} className="bg-dark-900 border border-dark-700/50 p-4 rounded-xl flex items-center justify-between hover:border-dark-600 transition-all">
                      <div>
                        <div className="font-bold text-white">{employee.first_name} {employee.last_name}</div>
                        <div className="text-[11px] text-gray-300 font-mono mt-1">Period: {format(new Date(sal.pay_period_start), 'MMM dd')} - {format(new Date(sal.pay_period_end), 'MMM dd')}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            sal.status === 'paid' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {sal.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-white font-mono text-sm">₦{netSalary.toLocaleString()}</div>
                        <div className="flex gap-2 justify-end mt-3">
                          {sal.status !== 'paid' && (
                            <button 
                              onClick={() => handleMarkPayrollAsPaid(sal)}
                              className="text-[10px] font-bold text-green-400 hover:text-white bg-green-500/10 hover:bg-green-500 border border-green-500/20 px-2 py-1 rounded-lg transition-all"
                            >
                              Pay Now
                            </button>
                          )}
                          <button 
                            onClick={() => triggerPrintPayslip(sal)}
                            className="text-[10px] font-bold text-brand-400 hover:text-white bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 px-2 py-1 rounded-lg transition-all"
                          >
                            Payslip
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {salaries.length === 0 && (
                  <div className="text-center py-12 text-gray-300 text-sm">No payroll processed yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: General Cash Ledger */}
      {activeTab === 'ledger' && (
        <div className="glass-panel rounded-2xl border border-dark-700/50 overflow-hidden shadow-xl">
          <div className="p-5 border-b border-dark-700/50 bg-dark-800/80 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              {/* Search ledger */}
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-200" />
                <input 
                  type="text" 
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search ledger details..."
                  className="w-full bg-dark-900 border border-dark-700/60 p-2.5 pl-10 rounded-xl text-sm outline-none focus:border-brand-500 placeholder-gray-500"
                />
              </div>

              {/* Date Range Sorting Inputs */}
              <div className="flex flex-row items-center gap-2">
                <div className="relative flex items-center flex-1 sm:flex-initial">
                  <Calendar size={14} className="absolute left-3 text-brand-500 pointer-events-none" />
                  <input 
                    type="date"
                    value={ledgerStartDate}
                    onChange={(e) => setLedgerStartDate(e.target.value)}
                    className="bg-dark-900 border border-dark-700/60 p-2.5 pl-9 rounded-xl text-xs outline-none focus:border-brand-500 text-gray-300 w-full sm:w-36 cursor-pointer"
                    title="Filter Start Date"
                  />
                </div>
                <span className="text-gray-300 text-xs font-bold shrink-0">to</span>
                <div className="relative flex items-center flex-1 sm:flex-initial">
                  <Calendar size={14} className="absolute left-3 text-brand-500 pointer-events-none" />
                  <input 
                    type="date"
                    value={ledgerEndDate}
                    onChange={(e) => setLedgerEndDate(e.target.value)}
                    className="bg-dark-900 border border-dark-700/60 p-2.5 pl-9 rounded-xl text-xs outline-none focus:border-brand-500 text-gray-300 w-full sm:w-36 cursor-pointer"
                    title="Filter End Date"
                  />
                </div>

                {/* Reset button if dates selected */}
                {(ledgerStartDate || ledgerEndDate) && (
                  <button
                    onClick={() => {
                      setLedgerStartDate('');
                      setLedgerEndDate('');
                    }}
                    className="p-2.5 rounded-xl border border-dark-700/60 bg-dark-900 text-brand-400 hover:text-white text-xs font-black transition-all hover:bg-dark-800 shrink-0 shadow-[0_0_15px_rgba(180,150,90,0.05)] cursor-pointer"
                    title="Clear Date Window"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Inflow/Outflow type dropdown */}
              <select 
                value={ledgerType}
                onChange={(e) => setLedgerType(e.target.value)}
                className="bg-dark-900 border border-dark-700/60 p-2.5 rounded-xl text-sm outline-none focus:border-brand-500 w-full sm:w-44 text-gray-300 cursor-pointer"
              >
                <option value="all" className="bg-dark-900 text-white">All Cash Flows</option>
                <option value="inflow" className="bg-dark-900 text-white">Inflows (Revenue)</option>
                <option value="outflow" className="bg-dark-900 text-white">Outflows (Expenses)</option>
              </select>
            </div>
            
            <button 
              onClick={handleExportCSV}
              className="bg-dark-900 border border-dark-700/60 hover:bg-dark-800 text-gray-300 font-bold py-2.5 px-5 text-sm flex items-center justify-center gap-2 rounded-xl transition-all"
            >
              <Download size={16} /> Export CSV Ledger
            </button>
          </div>

          <div className="flex gap-2 px-5 py-3 border-b border-dark-700/50 bg-dark-800/40 select-none overflow-x-auto no-scrollbar">
            {[
              { id: 'all', name: 'General Unified Ledger' },
              { id: 'front_office', name: 'Front Office' },
              { id: 'laundry', name: 'Laundry' },
              { id: 'restaurant', name: 'Restaurant' },
              { id: 'bar', name: 'Bar' }
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setLedgerSubTab(sub.id)}
                className={`py-1.5 px-4 rounded-xl text-xs font-bold transition-all ${
                  ledgerSubTab === sub.id
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                    : 'bg-dark-900/60 text-gray-200 hover:text-white border border-dark-700/60'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-dark-900/60 border-b border-dark-700/50 text-gray-200">
                <tr>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Posting Date</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Flow Type</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Category</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Journal Details</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Payment Method</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Amount</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Comments / Remarks</th>
                  <th className="p-4 font-bold text-xs uppercase tracking-wider">Status</th>
                  {hasAccess('Finance - Process Refunds & Adjustments') && (
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/40">
                {paginatedLedger.map((item, idx) => (
                  <tr key={`ledger-${idx}-${item.id}`} className="hover:bg-dark-700/20 transition-colors">
                    <td className="p-4 text-gray-200 font-mono">{format(new Date(item.date), 'MMM dd, yyyy')}</td>
                    <td className="p-4">
                      {item.type === 'inflow' ? (
                        <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit">
                          <ArrowUpRight size={12} /> Inflow
                        </span>
                      ) : (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit">
                          <ArrowDownRight size={12} /> Outflow
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-300 font-semibold">{item.category}</td>
                    <td className="p-4 text-white max-w-xs truncate" title={item.description}>{item.description}</td>
                    <td className="p-4 text-gray-200 uppercase text-xs font-semibold font-mono">{item.method}</td>
                    <td className={`p-4 font-bold font-mono ${item.type === 'inflow' ? 'text-green-400' : 'text-rose-400'}`}>
                      {item.type === 'inflow' ? '+' : '-'}₦{item.amount.toLocaleString()}
                    </td>
                    <td className="p-4 text-xs text-gray-200 font-medium max-w-xs truncate" title={item.notes || 'None'}>
                      {item.notes || '—'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        ['paid', 'completed', 'success', 'settled'].includes(item.status) ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                        item.status === 'pending' || item.status === 'paid but not settled' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    {hasAccess('Finance - Process Refunds & Adjustments') && (
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenVoidCorrect(item)}
                          className="bg-brand-500/10 hover:bg-brand-500 hover:text-dark-900 border border-brand-500/20 text-brand-400 py-1 px-2.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          Void / Correct
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {baseUnifiedLedger.length === 0 && (
                  <tr>
                    <td colSpan={hasAccess('Finance - Process Refunds & Adjustments') ? "9" : "8"} className="p-12 text-center text-gray-300 text-sm">
                      No general ledger records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {baseUnifiedLedger.length > ITEMS_PER_PAGE && (
            <div className="p-4 border-t border-dark-700/50 bg-dark-800/80">
              <Pagination currentPage={ledgerPage} totalPages={Math.ceil(baseUnifiedLedger.length / ITEMS_PER_PAGE)} limit={ITEMS_PER_PAGE} onPageChange={setLedgerPage} />
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Accounting Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="glass-panel p-5 rounded-2xl border border-dark-700/50 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Start Date</label>
                <input 
                  type="date" 
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700/60 p-2.5 rounded-xl text-sm text-gray-300 outline-none focus:border-brand-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">End Date</label>
                <input 
                  type="date" 
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700/60 p-2.5 rounded-xl text-sm text-gray-300 outline-none focus:border-brand-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Property Branch</label>
                <select 
                  value={reportProperty}
                  onChange={(e) => setReportProperty(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700/60 p-2.5 rounded-xl text-sm text-gray-300 outline-none focus:border-brand-500"
                >
                  <option value="all" className="bg-dark-900 text-white">All Properties</option>
                  {properties.map(p => <option key={p.id} value={p.id} className="bg-dark-900 text-white">{p.name}</option>)}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end items-end pt-5 lg:pt-0">
              <button 
                onClick={() => {
                  const data = reportSubTab === 'pnl' ? calculatePnLReport() : reportSubTab === 'cashflow' ? calculateCashFlowReport() : calculateBalanceSheetReport();
                  if (reportSubTab === 'pnl') handleExportPnLCSV(data);
                  else if (reportSubTab === 'cashflow') handleExportCashFlowCSV(data);
                  else handleExportBalanceSheetCSV(data);
                }}
                className="bg-dark-900 border border-dark-700/60 hover:bg-dark-800 text-gray-300 font-bold py-2.5 px-5 text-sm flex items-center justify-center gap-2 rounded-xl transition-all"
              >
                <Download size={16} /> Export CSV
              </button>
              <button 
                onClick={() => {
                  const data = reportSubTab === 'pnl' ? calculatePnLReport() : reportSubTab === 'cashflow' ? calculateCashFlowReport() : calculateBalanceSheetReport();
                  setActiveReportModal({ type: reportSubTab, data });
                }}
                className="btn-primary py-2.5 px-5 text-sm font-bold flex items-center justify-center gap-2 rounded-xl"
              >
                <Printer size={16} /> Print Report
              </button>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex gap-2 border-b border-dark-700/50 pb-px overflow-x-auto select-none no-scrollbar">
            <button 
              onClick={() => setReportSubTab('pnl')} 
              className={`pb-2.5 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all duration-300 ${reportSubTab === 'pnl' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
            >
              <TrendingUp size={16} /> Profit & Loss
            </button>
            <button 
              onClick={() => setReportSubTab('cashflow')} 
              className={`pb-2.5 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all duration-300 ${reportSubTab === 'cashflow' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
            >
              <Wallet size={16} /> Cash Flow Statement
            </button>
            <button 
              onClick={() => setReportSubTab('balancesheet')} 
              className={`pb-2.5 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all duration-300 ${reportSubTab === 'balancesheet' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}
            >
              <Building size={16} /> Balance Sheet
            </button>
          </div>

          {/* Report Sheet Area */}
          <AnimatePresence mode="wait">
            {reportSubTab === 'pnl' && (
              <motion.div 
                key="pnl"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="glass-panel p-6 rounded-2xl border border-dark-700/50 space-y-6"
              >
                <div className="flex justify-between items-start border-b border-dark-700/40 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Profit & Loss Statement</h3>
                    <p className="text-gray-200 text-xs mt-1">Aggregated income and expenditure breakdown from {reportStartDate} to {reportEndDate}</p>
                  </div>
                  <span className="bg-brand-500/10 text-brand-400 border border-brand-500/20 px-3 py-1 rounded-full text-xs font-bold font-mono">
                    Accrual Mode
                  </span>
                </div>

                {/* KPI metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-dark-900 border border-dark-700/50 p-4 rounded-xl">
                    <p className="text-gray-200 text-xs font-bold uppercase tracking-wider">Gross Operating Revenue</p>
                    <h4 className="text-xl font-black mt-1 text-green-400 font-mono">₦{calculatePnLReport().totalRevenue.toLocaleString()}</h4>
                  </div>
                  <div className="bg-dark-900 border border-dark-700/50 p-4 rounded-xl">
                    <p className="text-gray-200 text-xs font-bold uppercase tracking-wider">Total Operating Costs</p>
                    <h4 className="text-xl font-black mt-1 text-rose-400 font-mono">₦{calculatePnLReport().totalExpenses.toLocaleString()}</h4>
                  </div>
                  <div className="bg-dark-900 border border-dark-700/50 p-4 rounded-xl">
                    <p className="text-gray-200 text-xs font-bold uppercase tracking-wider">Net Operating Income</p>
                    <h4 className={`text-xl font-black mt-1 font-mono ${calculatePnLReport().netProfit >= 0 ? 'text-green-400' : 'text-rose-500'}`}>
                      ₦{calculatePnLReport().netProfit.toLocaleString()}
                    </h4>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-4 pt-2">
                  <div>
                    <div className="text-sm font-bold text-gray-300 uppercase tracking-wide border-b border-dark-700/30 pb-2 mb-3">Revenues</div>
                    <div className="flex justify-between items-center text-sm p-2 hover:bg-dark-700/10 rounded-lg">
                      <span className="text-gray-200">Room Booking Income Receipts</span>
                      <span className="font-semibold text-white font-mono">₦{calculatePnLReport().bookingRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold bg-dark-900/50 p-3 rounded-lg mt-1 border-t border-dark-700/30">
                      <span className="text-gray-300">Total Operating Revenues</span>
                      <span className="text-green-400 font-mono">₦{calculatePnLReport().totalRevenue.toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-bold text-gray-300 uppercase tracking-wide border-b border-dark-700/30 pb-2 mb-3">Operational Expenditures</div>
                    <div className="space-y-2">
                      {Object.entries(calculatePnLReport().expensesByCategory).map(([cat, val]) => {
                        const totalExpenses = calculatePnLReport().totalExpenses;
                        const pct = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
                        return (
                          <div key={cat} className="space-y-1.5 p-2 hover:bg-dark-700/10 rounded-lg">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-200">{cat} Costs</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-300 font-mono">({pct.toFixed(0)}%)</span>
                                <span className="font-semibold text-white font-mono">₦{val.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="w-full bg-dark-900 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold bg-dark-900/50 p-3 rounded-lg mt-3 border-t border-dark-700/30">
                      <span className="text-gray-300">Total Operating Expenses</span>
                      <span className="text-rose-400 font-mono">₦{calculatePnLReport().totalExpenses.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="bg-dark-950/80 border border-dark-700/40 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-gray-300 uppercase">Net Margin Performance</span>
                      <span className="text-xs text-gray-300 block mt-0.5">Ratio of operating profitability</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-brand-500 font-mono">{calculatePnLReport().margin.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {reportSubTab === 'cashflow' && (
              <motion.div 
                key="cashflow"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="glass-panel p-6 rounded-2xl border border-dark-700/50 space-y-6"
              >
                <div className="flex justify-between items-start border-b border-dark-700/40 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Statement of Cash Flows</h3>
                    <p className="text-gray-200 text-xs mt-1">Cash tracking by payment channels from {reportStartDate} to {reportEndDate}</p>
                  </div>
                  <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-xs font-bold font-mono">
                    Direct Cash Mode
                  </span>
                </div>

                {/* KPI metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-dark-900 border border-dark-700/50 p-4 rounded-xl">
                    <p className="text-gray-200 text-xs font-bold uppercase tracking-wider">Operational Cash Receipts</p>
                    <h4 className="text-xl font-black mt-1 text-green-400 font-mono">₦{calculateCashFlowReport().totalCashInflows.toLocaleString()}</h4>
                  </div>
                  <div className="bg-dark-900 border border-dark-700/50 p-4 rounded-xl">
                    <p className="text-gray-200 text-xs font-bold uppercase tracking-wider">Operational Cash Payments</p>
                    <h4 className="text-xl font-black mt-1 text-rose-400 font-mono">₦{calculateCashFlowReport().totalCashOutflows.toLocaleString()}</h4>
                  </div>
                  <div className="bg-dark-900 border border-dark-700/50 p-4 rounded-xl">
                    <p className="text-gray-200 text-xs font-bold uppercase tracking-wider">Net Cash Position Increase</p>
                    <h4 className={`text-xl font-black mt-1 font-mono ${calculateCashFlowReport().netCashFlow >= 0 ? 'text-green-400' : 'text-rose-500'}`}>
                      ₦{calculateCashFlowReport().netCashFlow.toLocaleString()}
                    </h4>
                  </div>
                </div>

                {/* Inflows detail */}
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-bold text-gray-300 uppercase tracking-wide border-b border-dark-700/30 pb-2 mb-3">Operating Inflows (Revenues Received)</div>
                    {Object.entries(calculateCashFlowReport().inflowsByMethod).map(([method, val]) => (
                      <div key={method} className="flex justify-between items-center text-sm p-2 hover:bg-dark-700/10 rounded-lg">
                        <span className="text-gray-200 capitalize">{method.replace('_', ' ')} customer bookings</span>
                        <span className="font-semibold text-white font-mono">₦{val.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-sm font-bold bg-dark-900/50 p-3 rounded-lg mt-2 border-t border-dark-700/30">
                      <span className="text-gray-300">Total Customer Inflow Receipts</span>
                      <span className="text-green-400 font-mono">₦{calculateCashFlowReport().totalCashInflows.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Outflows detail */}
                  <div>
                    <div className="text-sm font-bold text-gray-300 uppercase tracking-wide border-b border-dark-700/30 pb-2 mb-3">Operating Outflows (Operational Costs Disbursed)</div>
                    {Object.entries(calculateCashFlowReport().outflowsByMethod).map(([method, val]) => (
                      <div key={method} className="flex justify-between items-center text-sm p-2 hover:bg-dark-700/10 rounded-lg">
                        <span className="text-gray-200 capitalize">{method.replace('_', ' ')} disbursements</span>
                        <span className="font-semibold text-white font-mono">₦{val.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-sm font-bold bg-dark-900/50 p-3 rounded-lg mt-2 border-t border-dark-700/30">
                      <span className="text-gray-300">Total Operating Disbursements</span>
                      <span className="text-rose-400 font-mono">₦{calculateCashFlowReport().totalCashOutflows.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {reportSubTab === 'balancesheet' && (
              <motion.div 
                key="balancesheet"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="glass-panel p-6 rounded-2xl border border-dark-700/50 space-y-6"
              >
                <div className="flex justify-between items-start border-b border-dark-700/40 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Balance Sheet Statement</h3>
                    <p className="text-gray-200 text-xs mt-1">Financial position snapshot as of {reportEndDate}</p>
                  </div>
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-bold font-mono">
                    Financial Position
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Assets */}
                  <div className="bg-dark-900/50 border border-dark-700/40 p-5 rounded-xl space-y-4">
                    <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider border-b border-dark-700/30 pb-2 flex justify-between items-center">
                      <span>Assets</span>
                      <span className="text-xs text-gray-300 normal-case font-normal">What company owns</span>
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm p-1.5 hover:bg-dark-700/10 rounded">
                        <span className="text-gray-200">Cash & Cash Equivalents</span>
                        <span className="font-semibold text-white font-mono">₦{calculateBalanceSheetReport().cash.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-1.5 hover:bg-dark-700/10 rounded">
                        <span className="text-gray-200">Accounts Receivable (Outstanding Invoices)</span>
                        <span className="font-semibold text-white font-mono">₦{calculateBalanceSheetReport().receivables.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold bg-dark-900 p-3 rounded-lg border-t border-dark-700/40">
                      <span className="text-gray-300">TOTAL ASSETS</span>
                      <span className="text-brand-500 font-mono text-base">₦{calculateBalanceSheetReport().totalAssets.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Liabilities & Equity */}
                  <div className="bg-dark-900/50 border border-dark-700/40 p-5 rounded-xl space-y-4 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider border-b border-dark-700/30 pb-2 flex justify-between items-center">
                        <span>Liabilities & Equity</span>
                        <span className="text-xs text-gray-300 normal-case font-normal">What company owes & owns net</span>
                      </h4>
                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center text-sm p-1.5 hover:bg-dark-700/10 rounded">
                          <span className="text-gray-200">Accounts Payable (Pending Vendor Bills)</span>
                          <span className="font-semibold text-white font-mono">₦{calculateBalanceSheetReport().payableExpenses.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-1.5 hover:bg-dark-700/10 rounded">
                          <span className="text-gray-200">Accrued Payroll (Pending Salaries)</span>
                          <span className="font-semibold text-white font-mono">₦{calculateBalanceSheetReport().payableSalaries.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-1.5 hover:bg-dark-700/10 rounded border-t border-dark-700/30 mt-2">
                          <span className="text-gray-200 font-bold">Retained Earnings (Equity)</span>
                          <span className="font-bold text-white font-mono">₦{calculateBalanceSheetReport().equity.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold bg-dark-900 p-3 rounded-lg border-t border-dark-700/40 mt-4">
                      <span className="text-gray-300">TOTAL LIABILITIES & EQUITY</span>
                      <span className="text-brand-500 font-mono text-base">₦{(calculateBalanceSheetReport().totalLiabilities + calculateBalanceSheetReport().equity).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Double Entry Check Banner */}
                {calculateBalanceSheetReport().totalAssets === (calculateBalanceSheetReport().totalLiabilities + calculateBalanceSheetReport().equity) && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3.5 flex items-center justify-between">
                    <span className="text-xs text-green-400 font-semibold flex items-center gap-2">
                      <Check size={16} /> Asset & Liability ledger balanced perfectly
                    </span>
                    <span className="text-[10px] text-green-500 font-bold tracking-widest font-mono">DOUBLE ENTRY OK</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tab: Debtors Ledger */}
      {activeTab === 'debtors' && (
        <div className="space-y-6">
          {/* Debtors Telemetry Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Total Active Debtors</p>
              <h3 className="text-2xl font-black mt-2 text-white font-mono">{debtors.length}</h3>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-brand-400 font-semibold">
                <Building size={14} />
                <span>Standard & Corporate</span>
              </div>
            </div>
            
            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Total Outstanding Debt</p>
              <h3 className="text-2xl font-black mt-2 text-rose-500 font-mono">
                ₦{debtors.reduce((sum, d) => sum + d.outstanding_balance, 0).toLocaleString()}
              </h3>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-rose-400 font-semibold">
                <ArrowDownRight size={14} />
                <span>Receivables reserve</span>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Stay Folio Debts</p>
              <h3 className="text-2xl font-black mt-2 text-amber-500 font-mono">
                ₦{debtors.filter(d => d.type === 'stay_debt').reduce((sum, d) => sum + d.outstanding_balance, 0).toLocaleString()}
              </h3>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-amber-400 font-semibold">
                <User size={14} />
                <span>Checked stays</span>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Corporate Debts</p>
              <h3 className="text-2xl font-black mt-2 text-blue-500 font-mono">
                ₦{debtors.filter(d => d.type === 'corporate_debt').reduce((sum, d) => sum + d.outstanding_balance, 0).toLocaleString()}
              </h3>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-blue-400 font-semibold">
                <Building size={14} />
                <span>Group credits</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="glass-panel p-5 rounded-2xl border border-dark-700/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-3.5 text-gray-200" size={18} />
              <input 
                type="text"
                placeholder="Search debtors by name or reference..."
                value={debtorSearch}
                onChange={e => setDebtorSearch(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700/60 pl-10 pr-4 py-2.5 rounded-xl text-sm text-gray-300 outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex gap-2">
              {['all', 'stay_debt', 'corporate_debt'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDebtorFilter(tab)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    debtorFilter === tab 
                      ? 'bg-brand-500 text-dark-900 border-brand-500' 
                      : 'bg-dark-900 text-gray-200 border-dark-700/60 hover:text-white'
                  }`}
                >
                  {tab === 'all' ? 'All Ledger Debts' : tab === 'stay_debt' ? 'Guest Stays' : 'Corporate Groups'}
                </button>
              ))}
            </div>
          </div>

          {/* Debtors List Grid */}
          <div className="glass-panel rounded-2xl border border-dark-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-dark-900/60 border-b border-dark-700/50 text-gray-200">
                  <tr>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Debtor / Account</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Reference ID</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Stay / Credit details</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Contact Info</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Financial Summary</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Status</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/40">
                  {debtors
                    .filter(d => {
                      const matchesSearch = d.guest_name.toLowerCase().includes(debtorSearch.toLowerCase()) || 
                                            d.reference.toLowerCase().includes(debtorSearch.toLowerCase());
                      const matchesFilter = debtorFilter === 'all' || d.type === debtorFilter;
                      return matchesSearch && matchesFilter;
                    })
                    .map((item, idx) => (
                      <tr key={`debtor-${idx}-${item.id}`} className="hover:bg-dark-700/20 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white text-base">{item.guest_name}</div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-1.5 py-0.5 rounded border inline-block ${
                            item.type === 'corporate_debt' 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {item.type === 'corporate_debt' ? 'Corporate Group' : 'Guest Folio'}
                          </span>
                        </td>
                        <td className="p-4 text-gray-200 font-mono font-semibold">{item.reference}</td>
                        <td className="p-4">
                          {item.type === 'corporate_debt' ? (
                            <span className="text-gray-300">Permanent Line of Credit</span>
                          ) : (
                            <div className="text-xs text-gray-300">
                              <div className="font-mono">In: {format(new Date(item.check_in), 'MMM dd, yyyy')}</div>
                              <div className="font-mono text-gray-300">Out: {format(new Date(item.check_out), 'MMM dd, yyyy')}</div>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-gray-200 font-semibold font-mono">{item.phone}</td>
                        <td className="p-4">
                          <div className="text-xs space-y-0.5 text-gray-200">
                            <div>Total Folio: <span className="font-mono text-gray-300">₦{item.total_amount.toLocaleString()}</span></div>
                            <div>Paid Amount: <span className="font-mono text-green-400">₦{item.amount_paid.toLocaleString()}</span></div>
                            <div className="font-bold text-sm text-rose-500">Unpaid Bal: <span className="font-mono">₦{item.outstanding_balance.toLocaleString()}</span></div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'checked_in' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                            item.status === 'checked_out' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-2">
                          {item.type === 'corporate_debt' && (
                            <button
                              type="button"
                              onClick={async () => {
                                setSelectedStatementGroup(item.original);
                                setShowGroupStatementModal(true);
                                setLoadingGroupBookings(true);
                                try {
                                  const { data, error } = await supabase
                                    .from('bookings')
                                    .select('*, profiles(first_name, last_name, phone)')
                                    .eq('group_account_id', item.original.id);
                                  if (error) throw error;
                                  setGroupBookings(data || []);
                                } catch (err) {
                                  console.error("Failed to fetch group bookings:", err);
                                  const filtered = corporateBookings.filter(b => b.group_account_id === item.original.id);
                                  setGroupBookings(filtered);
                                } finally {
                                  setLoadingGroupBookings(false);
                                }
                              }}
                              className="bg-blue-500/10 hover:bg-blue-500 hover:text-white border border-blue-500/20 text-blue-400 py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                            >
                              View Statement / Settings
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDebtor(item);
                              setSettlementAmount(item.outstanding_balance.toString());
                              setSettlementMethod('cash');
                              setSettlementNotes('');
                              setShowSettlementModal(true);
                            }}
                            className="bg-brand-500/10 hover:bg-brand-500 hover:text-dark-900 border border-brand-500/20 text-brand-400 py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                          >
                            Settle Payment
                          </button>
                        </td>
                      </tr>
                    ))}
                  {debtors.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-12 text-center text-gray-300 text-sm">No active outstanding ledger debts registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: AR Prepayment Wallets */}
      {activeTab === 'ar' && (
        <div className="space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Wallet className="text-green-400" /> Accounts Receivable (AR) Prepayment Wallets</h2>
              <p className="text-gray-200 text-xs mt-1">Manage guest prepayment profiles, advance cash deposits, and wallet credits.</p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setArNewWalletForm({ guest_id: '', initial_balance: '' });
                setShowARAddModal(true);
              }}
              className="bg-green-500/15 hover:bg-green-500 text-green-400 hover:text-dark-900 border border-green-500/30 font-bold py-2.5 px-5 text-sm flex items-center justify-center gap-2 rounded-xl transition-all shadow-lg active:scale-95"
            >
              <PlusCircle size={18} /> Activate Guest Wallet
            </button>
          </div>

          {/* AR Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Total Registered Accounts</p>
              <h3 className="text-2xl font-black mt-2 text-white font-mono">{baseMergedAR.length}</h3>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-green-400 font-semibold">
                <Check size={14} />
                <span>Active Prepayments</span>
              </div>
            </div>
            
            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Total Prepayment Reserve</p>
              <h3 className="text-2xl font-black mt-2 text-green-400 font-mono">
                ₦{baseMergedAR.reduce((sum, a) => sum + Number(a.balance), 0).toLocaleString()}
              </h3>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-green-400 font-semibold">
                <TrendingUp size={14} />
                <span>Holding Ledger Liquid</span>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 relative overflow-hidden">
              <p className="text-gray-200 text-sm font-semibold uppercase tracking-wider">Active Guest CRM Linked</p>
              <h3 className="text-2xl font-black mt-2 text-blue-400 font-mono">{crmGuests.length}</h3>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-blue-400 font-semibold">
                <User size={14} />
                <span>Standard CRM Profiles</span>
              </div>
            </div>
          </div>

          {/* Wallets Table */}
          <div className="glass-panel rounded-2xl border border-dark-700/50 overflow-hidden">
            <div className="p-5 border-b border-dark-700/50 bg-dark-800/80">
              <div className="relative w-full max-w-md">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-200" />
                <input 
                  type="text" 
                  value={arSearchTerm}
                  onChange={(e) => { setArSearchTerm(e.target.value); setArPage(1); }}
                  placeholder="Live search by guest name, email, or reference..."
                  className="w-full bg-dark-900 border border-dark-700/60 p-2.5 pl-10 rounded-xl text-sm outline-none focus:border-brand-500 text-white"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-dark-900/60 border-b border-dark-700/50 text-gray-200">
                  <tr>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Wallet reference</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Guest profile</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Linked Email</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Prepaid Balance</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Account Status</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Activation Date</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/40">
                  {paginatedARAccounts.map((item, idx) => (
                    <tr key={`ar-${idx}-${item.id}`} className="hover:bg-dark-700/20 transition-colors">
                      <td className="p-4 text-gray-200 font-mono font-bold">{item.id}</td>
                      <td className="p-4">
                        <div className="font-bold text-white text-base">{item.guest_name}</div>
                        <span className="text-[10px] text-gray-300 block mt-0.5 font-semibold">CRM Active Guest</span>
                      </td>
                      <td className="p-4 text-gray-200 font-mono">{item.guest_email || 'N/A'}</td>
                      <td className="p-4">
                        <div className="text-lg font-black text-green-400 font-mono">
                          ₦{Number(item.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="p-4">
                        {(item.status === 'inactive' || item.status === 'deactivated') ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1.5 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span> Inactive
                          </span>
                        ) : item.status === 'closed' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Closed
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1.5 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Active
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-300 font-mono text-xs">{item.created_at ? format(new Date(item.created_at), 'MMM dd, yyyy HH:mm') : 'N/A'}</td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStatementGuest(item);
                            setShowStatementModal(true);
                          }}
                          className="bg-brand-500/10 hover:bg-brand-500 hover:text-dark-900 border border-brand-500/20 text-brand-400 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 mr-2 inline-flex items-center gap-1.5"
                        >
                          <FileText size={14} /> Statement
                        </button>
                        
                        {(item.status === 'inactive' || item.status === 'deactivated') && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateARStatus(item, 'active')}
                              className="bg-green-500/10 hover:bg-green-500 hover:text-dark-900 border border-green-500/20 text-green-400 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 mr-2"
                            >
                              Reopen
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateARStatus(item, 'closed')}
                              className="bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-400 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 mr-2"
                            >
                              Close
                            </button>
                          </>
                        )}
                        
                        {item.status === 'closed' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateARStatus(item, 'active')}
                            className="bg-green-500/10 hover:bg-green-500 hover:text-dark-900 border border-green-500/20 text-green-400 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 mr-2"
                          >
                            Reopen
                          </button>
                        )}
                        
                        {(!item.status || item.status === 'active') && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateARStatus(item, 'inactive')}
                              className="bg-yellow-500/10 hover:bg-yellow-500 hover:text-dark-900 border border-yellow-500/20 text-yellow-400 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 mr-2"
                            >
                              Deactivate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateARStatus(item, 'closed')}
                              className="bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-400 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 mr-2"
                            >
                              Close
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if ((item.status || 'active') !== 'active') {
                              toast.error("Deposit is blocked on inactive or closed wallets.");
                              return;
                            }
                            setActiveARWallet(item);
                            setArDepositAmount('');
                            setArDepositMethod('cash');
                            setArDepositNotes('');
                            setShowARDepositModal(true);
                          }}
                          className={`${(item.status || 'active') === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500 hover:text-dark-900 cursor-pointer' : 'bg-gray-500/5 text-gray-300 border-gray-700/30 cursor-not-allowed opacity-50'} border py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5`}
                        >
                          <PlusCircle size={14} /> Deposit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredMergedAR.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-12 text-center text-gray-300 text-sm">No active prepayment wallets found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredMergedAR.length > ITEMS_PER_PAGE && (
              <div className="p-4 border-t border-dark-700/50 bg-dark-800/80">
                <Pagination currentPage={arPage} totalPages={Math.ceil(filteredMergedAR.length / ITEMS_PER_PAGE)} limit={ITEMS_PER_PAGE} onPageChange={setArPage} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Close of Day & Audit */}
      {activeTab === 'close_of_day' && (
        <div className="space-y-6">
          {/* Header Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-dark-700/30 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Clock className="text-amber-400" /> Close of Day & Daily Night Audit</h2>
              <p className="text-gray-200 text-xs mt-1">Review live reception occupancy, compiles daily departmental revenues, and seals logs before close of business.</p>
            </div>
            
            {/* Target Audit Date Selector */}
            <div className="flex flex-wrap items-center gap-3 bg-dark-900/60 border border-dark-700/60 rounded-2xl px-4 py-2.5 shadow-inner">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-amber-400" />
                <span className="text-xs text-gray-200 font-bold tracking-wider uppercase font-sans">Target Audit Date:</span>
              </div>
              <input
                type="date"
                value={selectedAuditDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) setSelectedAuditDate(val);
                }}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="bg-dark-950/80 border border-dark-750 rounded-xl px-3 py-1.5 text-xs font-bold text-white font-sans focus:outline-none focus:border-amber-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => generateReportForDate(selectedAuditDate)}
                className="bg-amber-500/10 hover:bg-amber-500 hover:text-dark-900 border border-amber-500/20 text-amber-400 py-1.5 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
              >
                <FileText size={13} /> View Audit Sheet
              </button>
              {selectedAuditDate !== format(new Date(), 'yyyy-MM-dd') && (
                <button
                  type="button"
                  onClick={() => setSelectedAuditDate(format(new Date(), 'yyyy-MM-dd'))}
                  className="text-xs text-amber-500 hover:text-amber-400 font-bold font-sans transition-colors active:scale-95"
                >
                  Reset to Today
                </button>
              )}
            </div>
          </div>

          {/* Departmental Close of Day Grid */}
          <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building size={16} className="text-brand-500" /> Departmental End-of-Day Closures Status ({selectedAuditDate})
            </h3>
            <p className="text-xs text-gray-200">Each operations department ledger must be independently verified and closed before the overall system-wide Night Audit.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              {[
                { key: 'front_office', label: 'Front Office' },
                { key: 'laundry', label: 'Laundry' },
                { key: 'restaurant', label: 'Restaurant & Kitchen' },
                { key: 'bar', label: 'Bar' }
              ].map(dept => {
                const todayStr = selectedAuditDate;
                const closure = departmentalClosures.find(c => c.department === dept.key && c.business_date === todayStr);
                const stats = getDepartmentStatsForDate(dept.key, todayStr);
                
                return (
                  <div key={dept.key} className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] transition-all duration-300 ${
                    closure 
                      ? 'bg-green-500/5 border-green-500/30' 
                      : 'bg-dark-900/40 border-dark-750 hover:border-dark-700'
                  }`}>
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-black uppercase text-gray-200">{dept.label}</span>
                        {closure ? (
                          <span className="text-green-500 bg-green-500/10 p-0.5 rounded-full"><Check size={14} /></span>
                        ) : (
                          <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded tracking-wider animate-pulse">Open</span>
                        )}
                      </div>
                      
                      <div className="space-y-1 mt-3">
                        <div className="text-[10px] text-gray-300">Live Revenue:</div>
                        <div className="text-sm font-bold text-white font-mono">₦{stats.revenue.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-200 font-mono">{stats.count} Transactions</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-dark-700/50">
                      {closure ? (
                        <div className="flex flex-col gap-2">
                          <div className="text-[9px] text-gray-450 leading-relaxed">
                            <div className="font-semibold truncate">By: {closure.staff_name}</div>
                            <div className="font-mono text-gray-300 mt-0.5">{format(new Date(closure.closed_at), 'yyyy-MM-dd HH:mm')}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReopenDepartment(dept.key)}
                            className="w-full bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 text-[9px] font-bold uppercase py-1 px-2 rounded transition-all active:scale-95 cursor-pointer mt-1"
                          >
                            Reopen Ledger
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCloseDepartment(dept.key)}
                          className="w-full bg-brand-500/10 hover:bg-brand-500 hover:text-dark-900 border border-brand-500/20 text-brand-400 text-[10px] font-black uppercase py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                        >
                          Close Ledger
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed End of Day Reports list */}
          <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-brand-500" /> Compiled Departmental Closure Reports
            </h3>
            <p className="text-xs text-gray-200">View detailed itemized transaction lists, payment methods, and staff sign-offs for finalized operating periods.</p>

            {departmentalCloseReports.length === 0 ? (
              <p className="text-xs text-gray-300 italic py-4">No departmental closure reports registered in database yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-dark-750 text-gray-200 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Business Date</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Closed By</th>
                      <th className="py-3 px-4">Closed Timestamp</th>
                      <th className="py-3 px-4 text-right">Transactions</th>
                      <th className="py-3 px-4 text-right">Closed Revenue</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-750">
                    {departmentalCloseReports.map((rpt, index) => (
                      <tr key={index} className="hover:bg-dark-900/35 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">{rpt.business_date}</td>
                        <td className="py-3.5 px-4 font-semibold capitalize text-brand-400">
                          {rpt.department?.replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-4">{rpt.staff_name || 'System Admin'}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-300">{format(new Date(rpt.closed_at), 'yyyy-MM-dd HH:mm')}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white">{rpt.transactions_count}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white">₦{rpt.total_revenue?.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedCloseReport(rpt);
                              setIsCloseReportModalOpen(true);
                            }}
                            className="text-amber-500 hover:text-amber-400 font-bold hover:underline cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Audit Panel Controller */}
            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 space-y-6 lg:col-span-1 bg-gradient-to-br from-dark-800 to-dark-900 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-amber-500 pointer-events-none">
                <Clock size={160} />
              </div>
              
              <div className="flex items-center gap-3 border-b border-dark-700 pb-4">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white">Daily Closure Engine</h4>
                  <span className="text-[10px] text-gray-200 uppercase tracking-widest font-mono">Business Date: {selectedAuditDate}</span>
                </div>
              </div>

              <div className="space-y-4 text-sm text-gray-300">
                <p className="leading-relaxed">
                  Executing a Close of Day closure pulls dynamic real-time metrics across all modules. It seals all Room Revenues, POS Outlet Inflows, and Laundry Invoices registered today.
                </p>
                <div className="bg-dark-950/80 border border-dark-700/40 p-4 rounded-xl space-y-3 font-mono text-xs text-gray-200">
                  <div className="flex justify-between">
                    <span>Business Date:</span>
                    <span className="text-white">{format(new Date(selectedAuditDate + 'T00:00:00'), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audit Time:</span>
                    <span className="text-amber-400">{format(new Date(), 'HH:mm:ss')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Scope:</span>
                    <span className="text-white">All Properties</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCompileCloseOfDay}
                disabled={isRunningNightAudit}
                className="w-full bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-dark-900 border border-amber-500/30 font-bold py-3.5 px-5 text-sm flex items-center justify-center gap-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isRunningNightAudit ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-dark-900 border-t-transparent animate-spin"></span>
                    Executing Audit...
                  </span>
                ) : (
                  <>
                    <Clock size={18} /> Compile & Close Business Day
                  </>
                )}
              </button>
            </div>

            {/* Audit History Log */}
            <div className="glass-panel p-6 rounded-2xl border border-dark-700/50 space-y-4 lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-700/40 pb-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <span>Closure Audit Timeline Log</span>
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-200 font-bold font-sans">Filter Date:</span>
                  <input
                    type="date"
                    value={timelineFilterDate}
                    onChange={(e) => setTimelineFilterDate(e.target.value)}
                    className="bg-dark-900/60 border border-dark-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-sans cursor-pointer"
                  />
                  {timelineFilterDate && (
                    <button
                      onClick={() => setTimelineFilterDate('')}
                      className="text-xs text-red-400 hover:text-red-300 font-bold font-sans transition-colors active:scale-95"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-gray-200 border-b border-dark-700/40 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="pb-3">Audit Date</th>
                      <th className="pb-3 text-right">Total Revenue</th>
                      <th className="pb-3 text-right">Room Revenue</th>
                      <th className="pb-3 text-right">POS Sales</th>
                      <th className="pb-3 text-right">Laundry</th>
                      <th className="pb-3 text-center">Occupancy</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700/40 text-gray-300 font-mono text-xs">
                    {(timelineFilterDate
                      ? dailyClosures.filter(item => item.date === timelineFilterDate)
                      : dailyClosures
                    ).map((item, idx) => (
                      <tr key={`closure-item-${idx}-${item.id}`} className="hover:bg-dark-700/10 transition-colors">
                        <td className="py-3.5 font-bold text-white font-sans">{format(new Date(item.date + 'T00:00:00'), 'MMM dd, yyyy')}</td>
                        <td className="py-3.5 text-right font-black text-green-400">₦{Number(item.total_revenue).toLocaleString()}</td>
                        <td className="py-3.5 text-right text-gray-200">₦{Number(item.room_revenue).toLocaleString()}</td>
                        <td className="py-3.5 text-right text-gray-200">₦{Number(item.pos_revenue).toLocaleString()}</td>
                        <td className="py-3.5 text-right text-gray-200">₦{Number(item.laundry_revenue).toLocaleString()}</td>
                        <td className="py-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                            item.occupancy_rate >= 70 ? 'bg-green-500/10 text-green-400' : 
                            item.occupancy_rate >= 40 ? 'bg-amber-500/10 text-amber-400' : 
                            'bg-rose-500/10 text-rose-400'
                          }`}>
                            {item.occupancy_rate}%
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setCloseOfDayData(item);
                              setShowCloseOfDayModal(true);
                            }}
                            className="bg-amber-500/10 hover:bg-amber-500 hover:text-dark-900 border border-amber-500/20 text-amber-400 py-1 px-2.5 rounded-lg text-xs font-bold transition-all"
                          >
                            View Sheet
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(timelineFilterDate
                      ? dailyClosures.filter(item => item.date === timelineFilterDate)
                      : dailyClosures
                    ).length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-gray-300 font-sans">No daily closure reports found. Execute your first audit using the engine controls.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODALS & OVERLAYS -------------------- */}

      {/* Log Expense Modal Overlay details */}
      {showLogExpense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-dark-700/60 flex justify-between items-center bg-dark-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><ArrowDownRight className="text-brand-500"/> Log Operational Outflow</h2>
              <button onClick={() => setShowLogExpense(false)} className="text-gray-200 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleLogExpense} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm text-gray-200 mb-2 font-medium">Associated Property Branch</label>
                <select 
                  value={newExpenseForm.property_id}
                  onChange={e => setNewExpenseForm({...newExpenseForm, property_id: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                >
                  {properties.map(p => <option key={p.id} value={p.id} className="bg-dark-900 text-white">{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Expense Category</label>
                  <select 
                    value={newExpenseForm.category}
                    onChange={e => setNewExpenseForm({...newExpenseForm, category: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c} className="bg-dark-900 text-white">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Transaction Amount (NGN)</label>
                  <input 
                    type="number" 
                    required 
                    value={newExpenseForm.amount}
                    onChange={e => setNewExpenseForm({...newExpenseForm, amount: e.target.value})}
                    placeholder="e.g. 50000"
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-200 mb-2 font-medium">Vendor / Paid To</label>
                <input 
                  type="text" 
                  required
                  value={newExpenseForm.paid_to}
                  onChange={e => setNewExpenseForm({...newExpenseForm, paid_to: e.target.value})}
                  placeholder="Recipient company or technician name"
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Outflow Date</label>
                  <input 
                    type="date" 
                    required
                    value={newExpenseForm.expense_date}
                    onChange={e => setNewExpenseForm({...newExpenseForm, expense_date: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Payment Method</label>
                  <select 
                    value={newExpenseForm.payment_method}
                    onChange={e => setNewExpenseForm({...newExpenseForm, payment_method: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm uppercase"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-dark-900 text-white">{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-200 mb-2 font-medium">Expense Description</label>
                <textarea 
                  rows={2}
                  required
                  value={newExpenseForm.description}
                  onChange={e => setNewExpenseForm({...newExpenseForm, description: e.target.value})}
                  placeholder="Detail items purchased or services rendered..."
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm text-gray-200 mb-2 font-medium">Payment Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="status"
                      checked={newExpenseForm.status === 'paid'}
                      onChange={() => setNewExpenseForm({...newExpenseForm, status: 'paid'})}
                      className="accent-brand-500" 
                    />
                    <span className="text-sm">Paid</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="status"
                      checked={newExpenseForm.status === 'pending'}
                      onChange={() => setNewExpenseForm({...newExpenseForm, status: 'pending'})}
                      className="accent-brand-500" 
                    />
                    <span className="text-sm">Pending / Unpaid</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-dark-700/60 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowLogExpense(false)} 
                  className="flex-1 bg-dark-900 hover:bg-dark-700 text-white font-bold py-3 rounded-xl transition-colors text-sm border border-dark-700/60"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 btn-primary py-3 rounded-xl font-bold text-sm"
                >
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Payroll Modal Overlay details */}
      {showProcessPayroll && selectedStaffMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-dark-700/60 flex justify-between items-center bg-dark-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><User className="text-brand-500"/> Process Salary Payroll</h2>
              <button onClick={() => setShowProcessPayroll(false)} className="text-gray-200 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitPayroll} className="p-6 overflow-y-auto space-y-4">
              <div className="bg-dark-900/50 border border-dark-700/60 p-4 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center font-bold">
                  {selectedStaffMember.first_name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{selectedStaffMember.first_name} {selectedStaffMember.last_name}</div>
                  <div className="text-xs text-gray-200 capitalize">{selectedStaffMember.role.replace('_', ' ')} Access Account</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Base Salary</label>
                  <input 
                    type="number" 
                    required 
                    value={payrollForm.base_salary}
                    onChange={e => setPayrollForm({...payrollForm, base_salary: Number(e.target.value)})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Deductions</label>
                  <input 
                    type="number" 
                    value={payrollForm.deductions}
                    onChange={e => setPayrollForm({...payrollForm, deductions: Number(e.target.value)})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium font-sans">Standard Allowances (Entitled)</label>
                  <input 
                    disabled={true}
                    type="number" 
                    value={payrollForm.allowances}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none text-sm font-mono opacity-60 cursor-not-allowed"
                  />
                  {payrollForm.allowances_list && payrollForm.allowances_list.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {payrollForm.allowances_list.map((allow, idx) => (
                        <span key={idx} className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          {allow.name}: ₦{parseFloat(allow.amount).toLocaleString()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-300 italic mt-1 block">No entitled standard allowances</span>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Extra Bonuses</label>
                  <input 
                    type="number" 
                    value={payrollForm.extra_bonuses}
                    onChange={e => {
                      const extra = Number(e.target.value);
                      setPayrollForm({
                        ...payrollForm,
                        extra_bonuses: extra,
                        bonuses: (payrollForm.allowances || 0) + extra
                      });
                    }}
                    placeholder="One-off performance bonus"
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="bg-dark-900/60 p-3 rounded-xl border border-dark-700/60 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-200">Total Calculated Net Pay</span>
                <span className="text-lg font-black text-brand-500 font-mono">
                  ₦{(Number(payrollForm.base_salary) + Number(payrollForm.bonuses) - Number(payrollForm.deductions)).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Period Start</label>
                  <input 
                    type="date" 
                    required
                    value={payrollForm.pay_period_start}
                    onChange={e => setPayrollForm({...payrollForm, pay_period_start: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Period End</label>
                  <input 
                    type="date" 
                    required
                    value={payrollForm.pay_period_end}
                    onChange={e => setPayrollForm({...payrollForm, pay_period_end: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                  />
                </div>
              </div>

              {/* Informative Attendance Audit Feedback Block */}
              {attendanceAuditNotes && (
                <div className="bg-brand-500/5 border border-brand-500/15 p-3 rounded-xl text-xs text-brand-400 leading-normal flex items-start gap-2 select-text font-semibold">
                  <span className="font-extrabold block uppercase shrink-0">📊 Attendance Link:</span>
                  <span>{attendanceAuditNotes}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Payout Method</label>
                  <select 
                    value={payrollForm.payment_method}
                    onChange={e => setPayrollForm({...payrollForm, payment_method: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm uppercase"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-dark-900 text-white">{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-200 mb-2 font-medium">Processing Status</label>
                  <select 
                    value={payrollForm.status}
                    onChange={e => setPayrollForm({...payrollForm, status: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm capitalize"
                  >
                    <option value="paid" className="bg-dark-900 text-white">Paid & Settled</option>
                    <option value="approved" className="bg-dark-900 text-white">Approved / Processing</option>
                    <option value="pending" className="bg-dark-900 text-white">Pending Audit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-200 mb-2 font-medium font-mono">Ledger Remarks / Notes</label>
                <textarea 
                  rows={2}
                  value={payrollForm.notes}
                  onChange={e => setPayrollForm({...payrollForm, notes: e.target.value})}
                  placeholder="e.g. Performance bonus included, regular monthly cycle..."
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                ></textarea>
              </div>

              <div className="flex gap-4 pt-4 border-t border-dark-700/60 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowProcessPayroll(false)} 
                  className="flex-1 bg-dark-900 hover:bg-dark-700 text-white font-bold py-3 rounded-xl transition-colors text-sm border border-dark-700/60"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 btn-primary py-3 rounded-xl font-bold text-sm"
                >
                  Settle Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Corporate Payslip Printable Modal details */}
      {activePayslip && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:absolute print:inset-0">
          <div className="bg-pure-white text-pure-black w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-pure-gray-200 print-container print-a4 print:max-h-none print:shadow-none print:border-none print:w-full print:m-0">
            {/* Modal actions - stays in DOM, hidden in @media print */}
            <div className="p-4 bg-gray-100 border-b border-gray-200 flex justify-between items-center select-none print:hidden">
              <span className="font-bold text-xs uppercase tracking-wider text-pure-gray-500 flex items-center gap-2">
                <Sparkles size={16} className="text-brand-500" /> Employee Payout Document
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Printer size={14} /> Print Payslip
                </button>
                <button 
                  onClick={() => setActivePayslip(null)} 
                  className="bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold p-2 rounded-xl transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Area starts */}
            <div className="p-8 overflow-y-auto space-y-8 print:p-0 print:overflow-visible">
              
              {/* Receipt Header details */}
              <div className="flex justify-between items-start border-b-2 border-gray-100 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M50 10 L10 90 L35 90 L60 40 Z" fill="#DF6853"/>
                      <path d="M40 90 L90 90 L75 60 L50 90 Z" fill="#DF6853"/>
                    </svg>
                    <div className="flex flex-col justify-center">
                      <span className="text-sm font-extrabold text-pure-black tracking-wider uppercase">{contactInfo.companyName}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-pure-gray-500 mt-2 max-w-[280px]">
                    {contactInfo.address}<br />
                    Tel: {contactInfo.phone} | Email: {contactInfo.email}
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-black text-pure-black tracking-tight">SALARY PAYSLIP</h3>
                  <div className="text-xs text-pure-gray-500 font-mono mt-1 font-semibold">REF: SS-{activePayslip.id.substring(0, 8).toUpperCase()}</div>
                  <div className="text-[10px] text-pure-gray-400 mt-0.5">DATE: {format(new Date(activePayslip.payment_date || new Date()), 'yyyy-MM-dd')}</div>
                </div>
              </div>

              {/* Employee & Cycle Info */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-pure-gray-400 font-semibold uppercase text-[9px] tracking-wider block">EMPLOYEE DETAILS</span>
                    <span className="font-bold text-pure-black text-sm block">{activePayslip.staffName}</span>
                    <span className="text-pure-gray-500">{activePayslip.staffEmail}</span>
                  </div>
                  <div>
                    <span className="text-pure-gray-400 font-semibold uppercase text-[9px] block">ROLE / POSITION</span>
                    <span className="font-semibold text-pure-black">{activePayslip.staffRole}</span>
                  </div>
                </div>
                <div className="space-y-1.5 text-right">
                  <div>
                    <span className="text-pure-gray-400 font-semibold uppercase text-[9px] tracking-wider block">PAY PERIOD CYCLE</span>
                    <span className="font-bold text-pure-black block">
                      {format(new Date(activePayslip.pay_period_start), 'MMM dd, yyyy')} - {format(new Date(activePayslip.pay_period_end), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div>
                    <span className="text-pure-gray-400 font-semibold uppercase text-[9px] block">PAYOUT SETTLEMENT</span>
                    <span className="font-semibold text-green-600 uppercase flex items-center gap-1 justify-end font-mono">
                      <Check size={12} /> {activePayslip.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions breakdown table */}
              <div className="space-y-3">
                <div className="text-pure-gray-400 font-bold uppercase text-[9px] tracking-wider">Salary Component Statement</div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider border-b border-pure-gray-200">
                    <tr>
                      <th className="p-2.5">Earnings Description</th>
                      <th className="p-2.5 text-right">Amount (NGN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-pure-black">
                    <tr>
                      <td className="p-2.5">Basic Accrued Salary</td>
                      <td className="p-2.5 text-right font-mono">₦{Number(activePayslip.base_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">Allowances / Bonuses / Incentives</td>
                      <td className="p-2.5 text-right font-mono text-green-600">+ ₦{Number(activePayslip.bonuses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    {activePayslip.deductions_list && Array.isArray(activePayslip.deductions_list) && activePayslip.deductions_list.length > 0 ? (
                      activePayslip.deductions_list.map((deduct, idx) => {
                        const dedAmt = deduct.type === 'percentage' 
                          ? (parseFloat(activePayslip.base_salary) * (parseFloat(deduct.amount) / 100)) 
                          : parseFloat(deduct.amount);
                        return (
                          <tr key={idx}>
                            <td className="p-2.5 text-pure-gray-500 text-xs pl-6">— {deduct.name || 'Deduction'} {deduct.type === 'percentage' ? `(${deduct.amount}%)` : ''}</td>
                            <td className="p-2.5 text-right font-mono text-rose-600">- ₦{dedAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="p-2.5">Corporate Taxes / Deductions</td>
                        <td className="p-2.5 text-right font-mono text-rose-600">- ₦{Number(activePayslip.deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Final net payout footer */}
              <div style={{ backgroundColor: '#111827', color: '#ffffff' }} className="p-4 rounded-xl flex justify-between items-center">
                <span style={{ color: '#d1d5db' }} className="font-bold uppercase text-xs tracking-wider">Net Settled Salary</span>
                <span className="text-xl font-black font-mono">
                  ₦{Number(activePayslip.net_salary || (activePayslip.base_salary + activePayslip.bonuses - activePayslip.deductions)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Watermark Remarks */}
              {activePayslip.notes && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-pure-gray-500">
                  <strong className="text-pure-black block mb-0.5">Corporate Remarks:</strong>
                  {activePayslip.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="flex justify-between items-end pt-12 border-t border-dashed border-gray-200">
                <div className="text-center w-36">
                  <div className="border-b border-gray-300 h-8"></div>
                  <span className="text-[10px] text-pure-gray-400 font-semibold block mt-1.5 uppercase">Employee Signature</span>
                </div>
                <div className="text-center w-40">
                  <div className="border-b border-gray-300 h-8"></div>
                  <span className="text-[10px] text-pure-gray-400 font-semibold block mt-1.5 uppercase">Prepared By</span>
                </div>
                <div className="text-center w-48 relative">
                  {/* Subtle verified watermark */}
                  <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 text-green-600/10 font-bold border-4 border-green-600/10 rounded-xl px-4 py-1 rotate-[-12deg] text-xs select-none">
                    PAYROLL VERIFIED
                  </div>
                  <div className="border-b border-gray-300 h-8"></div>
                  <span className="text-[10px] text-pure-gray-400 font-semibold block mt-1.5 uppercase">Audited By (Hotel Manager)</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}


      {/* Printable Report Modal */}
      {activeReportModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:absolute print:inset-0">
          <div className="bg-pure-white text-pure-black w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-pure-gray-200 print-container print-a4 print:max-h-none print:shadow-none print:border-none print:w-full print:m-0">
            {/* Modal actions */}
            <div className="p-4 bg-gray-100 border-b border-gray-200 flex justify-between items-center select-none print:hidden">
              <span className="font-bold text-xs uppercase tracking-wider text-pure-gray-500 flex items-center gap-2">
                <Sparkles size={16} className="text-brand-500" /> Corporate Accounting Report
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Printer size={14} /> Print Report
                </button>
                <button 
                  onClick={() => setActiveReportModal(null)} 
                  className="bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold p-2 rounded-xl transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Area starts */}
            <div className="p-8 overflow-y-auto space-y-8 print:p-0 print:overflow-visible">
              
              {/* Receipt Header details */}
              <div className="flex justify-between items-start border-b-2 border-gray-100 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M50 10 L10 90 L35 90 L60 40 Z" fill="#DF6853"/>
                      <path d="M40 90 L90 90 L75 60 L50 90 Z" fill="#DF6853"/>
                    </svg>
                    <div className="flex flex-col justify-center">
                      <span className="text-sm font-extrabold text-pure-black tracking-wider uppercase">{contactInfo.companyName}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-pure-gray-500 mt-2 max-w-[320px]">
                    {contactInfo.address}<br />
                    Tel: {contactInfo.phone} | Email: {contactInfo.email}
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-black text-pure-black tracking-tight uppercase">
                    {activeReportModal.type === 'pnl' ? 'Profit & Loss Statement' : 
                     activeReportModal.type === 'cashflow' ? 'Statement of Cash Flows' : 
                     'Balance Sheet Statement'}
                  </h3>
                  <div className="text-xs text-pure-gray-500 font-mono mt-1 font-semibold">
                    REF: FIN-{activeReportModal.type.toUpperCase()}-{format(new Date(), 'yyyyMMdd').toUpperCase()}
                  </div>
                  <div className="text-[10px] text-pure-gray-400 mt-0.5 font-bold uppercase tracking-wider">
                    {activeReportModal.type === 'balancesheet' ? (
                      `As of ${reportEndDate}`
                    ) : (
                      `Period: ${reportStartDate} to ${reportEndDate}`
                    )}
                  </div>
                </div>
              </div>

              {/* REPORT CONTENT TYPES */}
              {activeReportModal.type === 'pnl' && (
                <div className="space-y-6">
                  {/* Summary Grid */}
                  <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                    <div>
                      <span className="text-pure-gray-400 font-semibold uppercase text-[9px] tracking-wider block">GROSS REVENUE</span>
                      <span className="font-bold text-green-600 text-sm font-mono block">₦{activeReportModal.data.totalRevenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-pure-gray-400 font-semibold uppercase text-[9px] tracking-wider block">OPERATING EXPENSES</span>
                      <span className="font-bold text-rose-600 text-sm font-mono block">₦{activeReportModal.data.totalExpenses.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-pure-gray-400 font-semibold uppercase text-[9px] tracking-wider block">NET INCOME</span>
                      <span className={`font-bold text-sm font-mono block ${activeReportModal.data.netProfit >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                        ₦{activeReportModal.data.netProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Revenue Table */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-pure-gray-400 uppercase tracking-wider border-b border-gray-200 pb-1">1. Operating Revenue</div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider">
                          <th className="p-2">Line Item</th>
                          <th className="p-2 text-right">Amount (NGN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-pure-black">
                        <tr>
                          <td className="p-2">Guest Room Booking Revenue</td>
                          <td className="p-2 text-right font-mono">₦{activeReportModal.data.bookingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr className="font-bold bg-gray-50 text-pure-black border-t-2 border-gray-200">
                          <td className="p-2">Total Revenue (A)</td>
                          <td className="p-2 text-right font-mono">₦{activeReportModal.data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Expense Table */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-pure-gray-400 uppercase tracking-wider border-b border-gray-200 pb-1">2. Operating Expenses</div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider">
                          <th className="p-2">Category</th>
                          <th className="p-2 text-right">Amount (NGN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-pure-black">
                        {Object.entries(activeReportModal.data.expensesByCategory).map(([cat, val]) => (
                          <tr key={cat}>
                            <td className="p-2">{cat} Costs</td>
                            <td className="p-2 text-right font-mono">₦{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-gray-50 text-pure-black border-t-2 border-gray-200">
                          <td className="p-2">Total Operating Expenses (B)</td>
                          <td className="p-2 text-right font-mono text-rose-600">₦{activeReportModal.data.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary / Performance */}
                  <div style={{ backgroundColor: '#111827', color: '#ffffff' }} className="p-4 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span style={{ color: '#d1d5db' }} className="font-bold uppercase tracking-wider block">Net Profit / Loss (A - B)</span>
                      <span style={{ color: '#9ca3af' }} className="text-[9px] mt-0.5 block">Calculated operating surplus</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black font-mono block">₦{activeReportModal.data.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-brand-400 font-bold font-mono">Operating Margin: {activeReportModal.data.margin.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {activeReportModal.type === 'cashflow' && (
                <div className="space-y-6">
                  {/* Summary Grid */}
                  <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                    <div>
                      <span className="text-pure-gray-400 font-semibold uppercase text-[9px] tracking-wider block">CASH INFLOWS</span>
                      <span className="font-bold text-green-600 text-sm font-mono block">₦{activeReportModal.data.totalCashInflows.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-pure-gray-400 font-semibold uppercase text-[9px] tracking-wider block">CASH OUTFLOWS</span>
                      <span className="font-bold text-rose-600 text-sm font-mono block">₦{activeReportModal.data.totalCashOutflows.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-pure-gray-400 font-semibold uppercase text-[9px] tracking-wider block">NET CHANGE</span>
                      <span className={`font-bold text-sm font-mono block ${activeReportModal.data.netCashFlow >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                        ₦{activeReportModal.data.netCashFlow.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Inflows Table */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-pure-gray-400 uppercase tracking-wider border-b border-gray-200 pb-1">1. Cash Inflows (Revenues Received)</div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider">
                          <th className="p-2">Payment Method</th>
                          <th className="p-2 text-right">Amount (NGN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-pure-black">
                        {Object.entries(activeReportModal.data.inflowsByMethod).map(([method, val]) => (
                          <tr key={method}>
                            <td className="p-2 capitalize">{method.replace('_', ' ')} customer bookings</td>
                            <td className="p-2 text-right font-mono">₦{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        {Object.keys(activeReportModal.data.inflowsByMethod).length === 0 && (
                          <tr>
                            <td className="p-2 text-pure-gray-400 italic">No inflows registered for the period</td>
                            <td className="p-2 text-right font-mono">₦0.00</td>
                          </tr>
                        )}
                        <tr className="font-bold bg-gray-50 text-pure-black border-t-2 border-gray-200">
                          <td className="p-2">Total Cash Inflows (A)</td>
                          <td className="p-2 text-right font-mono text-green-600">₦{activeReportModal.data.totalCashInflows.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Outflows Table */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-pure-gray-400 uppercase tracking-wider border-b border-gray-200 pb-1">2. Cash Outflows (Operational Costs Disbursed)</div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider">
                          <th className="p-2">Payment Method</th>
                          <th className="p-2 text-right">Amount (NGN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-pure-black">
                        {Object.entries(activeReportModal.data.outflowsByMethod).map(([method, val]) => (
                          <tr key={method}>
                            <td className="p-2 capitalize">{method.replace('_', ' ')} disbursements</td>
                            <td className="p-2 text-right font-mono">₦{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        {Object.keys(activeReportModal.data.outflowsByMethod).length === 0 && (
                          <tr>
                            <td className="p-2 text-pure-gray-400 italic">No outflows registered for the period</td>
                            <td className="p-2 text-right font-mono">₦0.00</td>
                          </tr>
                        )}
                        <tr className="font-bold bg-gray-50 text-pure-black border-t-2 border-gray-200">
                          <td className="p-2">Total Cash Outflows (B)</td>
                          <td className="p-2 text-right font-mono text-rose-600">₦{activeReportModal.data.totalCashOutflows.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Net Cash Position */}
                  <div style={{ backgroundColor: '#111827', color: '#ffffff' }} className="p-4 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span style={{ color: '#d1d5db' }} className="font-bold uppercase tracking-wider block">Net Increase / Decrease in Cash (A - B)</span>
                      <span style={{ color: '#9ca3af' }} className="text-[9px] mt-0.5 block">Net operational liquidity flow</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-black font-mono block ${activeReportModal.data.netCashFlow >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                        ₦{activeReportModal.data.netCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeReportModal.type === 'balancesheet' && (
                <div className="space-y-6">
                  {/* Assets and Liabilities Split */}
                  <div className="grid grid-cols-2 gap-6 items-start">
                    
                    {/* Assets */}
                    <div className="space-y-4">
                      <div className="text-[10px] font-bold text-pure-gray-400 uppercase tracking-wider border-b border-gray-200 pb-1">1. Assets</div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider">
                            <th className="p-2">Account Type</th>
                            <th className="p-2 text-right">Amount (NGN)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-pure-black">
                          <tr>
                            <td className="p-2">Cash & Equivalents</td>
                            <td className="p-2 text-right font-mono">₦{activeReportModal.data.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td className="p-2">Accounts Receivable</td>
                            <td className="p-2 text-right font-mono">₦{activeReportModal.data.receivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr className="font-bold bg-gray-50 text-pure-black border-t-2 border-gray-200">
                            <td className="p-2">Total Assets</td>
                            <td className="p-2 text-right font-mono text-brand-500">₦{activeReportModal.data.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Liabilities & Equity */}
                    <div className="space-y-4">
                      <div className="text-[10px] font-bold text-pure-gray-400 uppercase tracking-wider border-b border-gray-200 pb-1">2. Liabilities & Equity</div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider">
                            <th className="p-2">Account Type</th>
                            <th className="p-2 text-right">Amount (NGN)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-pure-black">
                          <tr>
                            <td className="p-2">Accounts Payable</td>
                            <td className="p-2 text-right font-mono">₦{activeReportModal.data.payableExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td className="p-2">Accrued Payroll</td>
                            <td className="p-2 text-right font-mono">₦{activeReportModal.data.payableSalaries.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold">Retained Earnings (Equity)</td>
                            <td className="p-2 text-right font-mono font-semibold">₦{activeReportModal.data.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr className="font-bold bg-gray-50 text-pure-black border-t-2 border-gray-200">
                            <td className="p-2">Total Liabilities & Equity</td>
                            <td className="p-2 text-right font-mono text-brand-500">₦{(activeReportModal.data.totalLiabilities + activeReportModal.data.equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>

                  {/* Balanced Entry Sign */}
                  {activeReportModal.data.totalAssets === (activeReportModal.data.totalLiabilities + activeReportModal.data.equity) && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center justify-between text-xs">
                      <span className="text-green-600 font-semibold flex items-center gap-1.5">
                        <Check size={14} className="text-green-600" /> Double-entry financial statement balanced perfectly
                      </span>
                      <span className="text-[9px] text-green-700 font-bold tracking-widest font-mono">LEDGER OK</span>
                    </div>
                  )}
                </div>
              )}

              {/* Verified Audit Remark */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-pure-gray-500">
                <strong className="text-pure-black block mb-0.5">Audit & Verification:</strong>
                This report is compiled dynamically from verified active database ledgers, including guest booking payments, operational vendor invoices, and staff payroll transactions. It satisfies GAAP and standard accounting conventions.
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end pt-12 border-t border-dashed border-gray-200">
                <div className="text-center w-48">
                  <div className="border-b border-gray-300 h-8"></div>
                  <span className="text-[10px] text-pure-gray-400 font-semibold block mt-1.5 uppercase">Prepared By</span>
                </div>
                <div className="text-center w-48 relative">
                  <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 text-green-600/10 font-bold border-4 border-green-600/10 rounded-xl px-4 py-1 rotate-[-12deg] text-xs select-none">
                    REPORT COMPILED
                  </div>
                  <div className="border-b border-gray-300 h-8"></div>
                  <span className="text-[10px] text-pure-gray-400 font-semibold block mt-1.5 uppercase">Audited By (Hotel Manager)</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- Store Requisition Modal --- */}
      <StoreRequisitionModal 
        isOpen={isRequisitionOpen} 
        onClose={() => setIsRequisitionOpen(false)} 
        department="accounts"
      />

      {/* Settle Debtor Payment Modal */}
      {showSettlementModal && selectedDebtor && (() => {
        const matchedWallet = getMergedARAccounts().find(acc => 
          acc.guest_id === selectedDebtor.original?.profiles?.id || 
          acc.guest_email === selectedDebtor.original?.guest_email || 
          acc.guest_name === selectedDebtor.guest_name
        );
        const hasWallet = !!matchedWallet;
        const walletBalance = hasWallet ? Number(matchedWallet.balance) : 0;
        const isWalletInsufficient = hasWallet && walletBalance < Number(settlementAmount);

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 border border-dark-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-dark-700/60 flex justify-between items-center bg-dark-900/50 bg-gradient-to-r from-dark-900 via-dark-800 to-dark-900">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Building className="text-brand-500"/> Settle Outstanding Debt
                </h2>
                <button onClick={() => setShowSettlementModal(false)} className="text-gray-200 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSettleDebtorPayment} className="p-6 space-y-4">
                {/* Debtor Details Summary Card */}
                <div className="bg-dark-950/80 border border-dark-700/40 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-300 font-bold uppercase">Account Debtor</span>
                    <span className="text-xs text-brand-400 font-mono font-bold">{selectedDebtor.reference}</span>
                  </div>
                  <div className="font-bold text-lg text-white">{selectedDebtor.guest_name}</div>
                  <div className="flex justify-between items-center text-xs border-t border-dark-700/30 pt-2 mt-2">
                    <span className="text-gray-200">Total Outstanding Balance:</span>
                    <span className="text-rose-500 font-mono font-black text-sm">₦{selectedDebtor.outstanding_balance.toLocaleString()}</span>
                  </div>
                </div>

                {/* Amount input */}
                <div>
                  <label className="block text-xs text-gray-200 mb-1.5 font-medium">Settlement Payment Amount (NGN)</label>
                  <input 
                    type="number" 
                    required 
                    min="1"
                    max={selectedDebtor.outstanding_balance}
                    value={settlementAmount}
                    onChange={e => setSettlementAmount(e.target.value)}
                    placeholder="e.g. 20000"
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                  />
                </div>

                {/* Method selector */}
                <div>
                  <label className="block text-xs text-gray-200 mb-1.5 font-medium">Settlement Method</label>
                  <select 
                    value={settlementMethod}
                    onChange={e => setSettlementMethod(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm uppercase font-semibold"
                  >
                    <option value="cash">Cash Payment</option>
                    <option value="pos">POS Terminal Outflow</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="ar_wallet" disabled={!hasWallet || isWalletInsufficient}>
                      AR Prepayment Wallet {hasWallet ? `(Bal: ₦${walletBalance.toLocaleString()})` : '(No active wallet)'}
                    </option>
                  </select>
                  {settlementMethod === 'ar_wallet' && hasWallet && (
                    <div className={`mt-2 p-2.5 rounded-lg text-xs font-semibold ${isWalletInsufficient ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                      {isWalletInsufficient 
                        ? `❌ Insufficient prepayment wallet funds (Missing ₦${(Number(settlementAmount) - walletBalance).toLocaleString()})`
                        : `✅ Prepayment wallet funds qualified! (Wallet Balance: ₦${walletBalance.toLocaleString()})`
                      }
                    </div>
                  )}
                  {!hasWallet && (
                    <span className="text-[10px] text-gray-300 mt-1 block">To activate an AR prepayment wallet for this guest, navigate to the AR tab.</span>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs text-gray-200 mb-1.5 font-medium">Journal Remarks / Comments</label>
                  <textarea 
                    rows={2}
                    value={settlementNotes}
                    onChange={e => setSettlementNotes(e.target.value)}
                    placeholder="Enter receipt details or transaction reference notes..."
                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                  ></textarea>
                </div>

                {/* Submit Actions */}
                <div className="flex gap-3 justify-end pt-2 border-t border-dark-700/50">
                  <button 
                    type="button"
                    onClick={() => setShowSettlementModal(false)}
                    className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-4 text-xs rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isProcessingSettlement || (settlementMethod === 'ar_wallet' && (!hasWallet || isWalletInsufficient))}
                    className="btn-primary py-2.5 px-5 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isProcessingSettlement ? 'Processing...' : 'Settle Folio'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Add AR Wallet Prepayment Modal */}
      {showARAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-dark-700/60 flex justify-between items-center bg-dark-900/50 bg-gradient-to-r from-dark-900 via-dark-800 to-dark-900">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="text-green-400"/> Activate Prepayment Wallet
              </h2>
              <button onClick={() => setShowARAddModal(false)} className="text-gray-200 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateARWallet} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Select CRM Registered Guest</label>
                <select 
                  required
                  value={arNewWalletForm.guest_id}
                  onChange={e => setArNewWalletForm({...arNewWalletForm, guest_id: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-semibold"
                >
                  <option value="" className="bg-dark-900 text-white">-- Select Guest --</option>
                  {crmGuests
                    .filter(g => !arAccounts.some(acc => acc.guest_id === g.id))
                    .map(g => (
                      <option key={g.id} value={g.id} className="bg-dark-900 text-white">
                        {`${g.first_name || ''} ${g.last_name || ''}`.trim() || g.guest_name || 'Unnamed Guest'} ({g.email || 'No email'})
                      </option>
                    ))
                  }
                </select>
                {crmGuests.filter(g => !arAccounts.some(acc => acc.guest_id === g.id)).length === 0 && (
                  <span className="text-[10px] text-rose-400 mt-1 block font-semibold">All registered CRM guests already have prepayment wallets activated.</span>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Initial Prepayment Balance (NGN)</label>
                <input 
                  type="number" 
                  min="0"
                  value={arNewWalletForm.initial_balance}
                  onChange={e => setArNewWalletForm({...arNewWalletForm, initial_balance: e.target.value})}
                  placeholder="e.g. 50000 (Optional)"
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                />
                <span className="text-[10px] text-gray-300 mt-1 block">If initial balance &gt; 0, an initial Cash prepayment deposit inflow will be automatically registered.</span>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-dark-700/50">
                <button 
                  type="button"
                  onClick={() => setShowARAddModal(false)}
                  className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-4 text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-dark-900 font-bold py-2.5 px-5 text-xs rounded-xl transition-all shadow-md active:scale-95"
                >
                  Activate Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Funds Prepayment Modal */}
      {showARDepositModal && activeARWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-dark-700/60 flex justify-between items-center bg-dark-900/50 bg-gradient-to-r from-dark-900 via-dark-800 to-dark-900">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="text-green-400"/> Deposit Prepayment Funds
              </h2>
              <button onClick={() => setShowARDepositModal(false)} className="text-gray-200 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleARWalletDeposit} className="p-6 space-y-4">
              <div className="bg-dark-950/80 border border-dark-700/40 p-4 rounded-xl space-y-1">
                <div className="text-[10px] text-gray-300 font-bold uppercase">Prepayment Account holder</div>
                <div className="font-bold text-base text-white">{activeARWallet.guest_name}</div>
                <div className="text-xs text-gray-200 mt-1 font-semibold">
                  Current Wallet Balance: <span className="font-mono text-green-400 font-bold">₦{Number(activeARWallet.balance).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Cash Deposit Amount (NGN)</label>
                <input 
                  type="number" 
                  required
                  min="100"
                  value={arDepositAmount}
                  onChange={e => setArDepositAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Deposit Method Mode</label>
                <select 
                  value={arDepositMethod}
                  onChange={e => setArDepositMethod(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm uppercase font-semibold"
                >
                  <option value="cash">Cash Inflow</option>
                  <option value="pos">POS Terminal</option>
                  <option value="bank_transfer">Bank Wire / Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-200 mb-1.5 font-medium">Deposit Remarks / Remarks</label>
                <textarea 
                  rows={2}
                  value={arDepositNotes}
                  onChange={e => setArDepositNotes(e.target.value)}
                  placeholder="Enter comments or transaction receipts references..."
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                ></textarea>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-dark-700/50">
                <button 
                  type="button"
                  onClick={() => setShowARDepositModal(false)}
                  className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-4 text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-dark-900 font-bold py-2.5 px-5 text-xs rounded-xl transition-all shadow-md active:scale-95"
                >
                  Post Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prepayment Account Statement Modal */}
      {showStatementModal && selectedStatementGuest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-dark-700/60 flex justify-between items-center bg-dark-900/50 bg-gradient-to-r from-dark-900 via-dark-800 to-dark-900">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="text-brand-400"/> Prepayment Account Statement
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintStatement(selectedStatementGuest)}
                  className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <Printer size={13} /> Print Statement
                </button>
                <button onClick={() => { setShowStatementModal(false); setSelectedStatementGuest(null); }} className="text-gray-200 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark-950/80 border border-dark-700/40 p-4 rounded-xl space-y-1">
                  <div className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">Account holder profile</div>
                  <div className="font-bold text-lg text-white">{selectedStatementGuest.guest_name}</div>
                  <div className="text-xs text-gray-200 font-mono">{selectedStatementGuest.guest_email || 'No email registered'}</div>
                </div>
                
                <div className="bg-dark-950/80 border border-dark-700/40 p-4 rounded-xl space-y-1 flex flex-col justify-center">
                  <div className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">Unified Wallet Balance</div>
                  <div className="text-2xl font-black text-green-400 font-mono">
                    ₦{Number(selectedStatementGuest.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Transactions Ledger */}
              <div className="space-y-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  📜 Prepayment Wallet Transaction Ledger
                </h3>
                <div className="border border-dark-700 rounded-xl overflow-hidden bg-dark-900/20">
                  <div className="overflow-x-auto max-h-[350px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-dark-900/80 border-b border-dark-700/50 text-gray-200 sticky top-0">
                        <tr>
                          <th className="p-3 font-bold text-xs uppercase tracking-wider">Date / Time</th>
                          <th className="p-3 font-bold text-xs uppercase tracking-wider">Description</th>
                          <th className="p-3 font-bold text-xs uppercase tracking-wider">Method</th>
                          <th className="p-3 font-bold text-xs uppercase tracking-wider">Type</th>
                          <th className="p-3 font-bold text-xs uppercase tracking-wider">Amount</th>
                          <th className="p-3 font-bold text-xs uppercase tracking-wider font-mono">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/40">
                        {(() => {
                          const records = getARStatementWithRunningBalance(selectedStatementGuest);
                          if (records.length === 0) {
                            return (
                              <tr>
                                <td colSpan="6" className="p-12 text-center text-gray-300 text-xs">
                                  No transaction records found for this AR Prepayment wallet.
                                </td>
                              </tr>
                            );
                          }
                          return records.map((rec, idx) => (
                            <tr key={`statement-row-${idx}`} className="hover:bg-dark-700/20 transition-colors text-xs">
                              <td className="p-3 text-gray-200 font-mono">{rec.date ? format(new Date(rec.date), 'yyyy-MM-dd HH:mm') : 'N/A'}</td>
                              <td className="p-3 text-white max-w-[250px] truncate" title={rec.description}>
                                <div className="font-bold text-gray-100">{rec.description}</div>
                                {rec.notes && <span className="text-[10px] text-gray-300 block truncate font-semibold">{rec.notes}</span>}
                              </td>
                              <td className="p-3 text-gray-200 uppercase font-mono">{rec.method?.replace('_', ' ')}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  rec.type === 'credit' 
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}>
                                  {rec.type === 'credit' ? 'Deposit (+)' : 'Charge (-)'}
                                </span>
                              </td>
                              <td className={`p-3 font-mono font-black ${rec.type === 'credit' ? 'text-green-400' : 'text-rose-400'}`}>
                                {rec.type === 'credit' ? '+' : '-'}₦{rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 font-mono font-bold text-gray-300">
                                ₦{rec.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-dark-700/60 flex justify-end">
              <button 
                onClick={() => { setShowStatementModal(false); setSelectedStatementGuest(null); }}
                className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-5 text-xs rounded-xl transition-all"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Close & Night Audit Modal Printable Sheet */}
      {showCloseOfDayModal && closeOfDayData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto print:bg-white print:p-0">
          <div className="bg-pure-white border border-pure-gray-200 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 print:bg-white print:border-none print:shadow-none print:w-full print:m-0 print:rounded-none">
            <div className="p-6 border-b border-pure-gray-200 flex justify-between items-center bg-pure-white screen-only text-pure-black">
              <h2 className="text-lg font-bold text-pure-black flex items-center gap-2">
                <Clock className="text-amber-600"/> Daily Night Audit Sheet
              </h2>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => window.print()}
                  className="bg-amber-500 hover:bg-amber-600 text-dark-900 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Printer size={14} /> Print Report
                </button>
                <button onClick={() => setShowCloseOfDayModal(false)} className="text-pure-gray-500 hover:text-pure-black transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Printable Area Wrapper (Light-themed corporate audit sheet look) */}
            <div id="close-of-day-print-area" className="p-8 bg-pure-white text-pure-black font-sans space-y-6 min-h-[700px] overflow-y-auto max-h-[80vh] print-container print-a4 print:max-h-none print:shadow-none print:border-none print:w-full print:m-0 print:p-0">
              {/* Report Header */}
              <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 text-left">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-wider text-pure-black">{contactInfo.companyName || 'Freshland'}</h1>
                  <p className="text-[10px] text-pure-gray-500 mt-1 uppercase font-semibold">Night Audit & Daily Operations Closure Report</p>
                  <p className="text-[9px] text-pure-gray-400 mt-0.5">{contactInfo.address}</p>
                </div>
                <div className="text-right">
                  <span className="bg-amber-500 text-dark-900 px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded font-mono select-none">
                    CLOSURE AUDIT
                  </span>
                  <div className="text-[10px] text-pure-gray-500 font-mono mt-2 font-semibold">REF: {closeOfDayData.id}</div>
                  <div className="text-[10px] text-pure-gray-500 font-mono font-semibold">AUDIT DATE: {format(new Date(closeOfDayData.date), 'MMMM dd, yyyy')}</div>
                </div>
              </div>

              {/* Grid 1: Departmental Revenue & Outflows Breakdown */}
              <div className="space-y-3 text-left">
                <h3 className="text-xs font-black uppercase tracking-widest text-pure-black border-b border-gray-300 pb-1">1. Departmental Revenue & Outflows Breakdown</h3>
                
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider border-b border-gray-200">
                      <th className="p-2.5">Revenue Department</th>
                      <th className="p-2.5">Posting Method Summary</th>
                      <th className="p-2.5 text-right">Settled Amount (NGN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="p-2.5 font-semibold">Front Desk Reception Room Revenue</td>
                      <td className="p-2.5 text-pure-gray-400">Guest Stays & Room Bookings</td>
                      <td className="p-2.5 text-right font-mono font-semibold">₦{Number(closeOfDayData.room_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold">POS Food & Beverage Outlets Sales</td>
                      <td className="p-2.5 text-pure-gray-400">Kitchen, Bar, & Restaurants Outlets</td>
                      <td className="p-2.5 text-right font-mono font-semibold">₦{Number(closeOfDayData.pos_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold">In-House Laundry Operations Inflows</td>
                      <td className="p-2.5 text-pure-gray-400">Direct drycleaning sales & deferred stays services</td>
                      <td className="p-2.5 text-right font-mono font-semibold">₦{Number(closeOfDayData.laundry_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="bg-emerald-50/50 font-bold border-t border-gray-200">
                      <td className="p-2.5 text-emerald-800">GROSS DAILY COMPILED REVENUE</td>
                      <td className="p-2.5 text-pure-gray-400">Total Department Inflows Sum</td>
                      <td className="p-2.5 text-right font-mono text-emerald-700">₦{Number(closeOfDayData.total_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-rose-700">Daily Operational Outflows & Expenses</td>
                      <td className="p-2.5 text-pure-gray-400">Staff Salaries, Procurement allocations, & Utility Expenses</td>
                      <td className="p-2.5 text-right font-mono font-semibold text-rose-700">-₦{Number(closeOfDayData.total_expenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-300 text-sm">
                      <td className="p-2.5">NET CASH FLOW BALANCE</td>
                      <td className="p-2.5 text-pure-gray-400">Net Revenue Inflows / Outflows Delta</td>
                      <td className={`p-2.5 text-right font-mono ${(closeOfDayData.net_cash_flow ?? closeOfDayData.total_revenue) >= 0 ? 'text-green-700' : 'text-rose-700'}`}>
                        ₦{Number(closeOfDayData.net_cash_flow ?? closeOfDayData.total_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Grid 2: Settlements Channels Inflows Breakdown */}
              {closeOfDayData.payment_methods && (
                <div className="space-y-3 pt-1 text-left">
                  <h3 className="text-xs font-black uppercase tracking-widest text-pure-black border-b border-gray-300 pb-1">2. Daily Settlements Channel Inflows</h3>
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider border-b border-gray-200">
                        <th className="p-2.5">Settlement Method Mode</th>
                        <th className="p-2.5">Ledger Allocation Target</th>
                        <th className="p-2.5 text-right">Settled Amount (NGN)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">Cash Payments Mode</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Direct Reception/POS cash desk drawer</td>
                        <td className="p-2.5 text-right font-semibold">₦{Number(closeOfDayData.payment_methods.cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">POS Card Terminal Settlements</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Bank terminal accounts registry</td>
                        <td className="p-2.5 text-right font-semibold">₦{Number(closeOfDayData.payment_methods.pos || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">Bank Wire / Electronic Transfer</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Corporate bank ledger checkouts</td>
                        <td className="p-2.5 text-right font-semibold">₦{Number(closeOfDayData.payment_methods.bank_transfer || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">Paystack Online Processor Gateways</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Online reservation deposits settlements</td>
                        <td className="p-2.5 text-right font-semibold">₦{Number(closeOfDayData.payment_methods.paystack || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">Accounts Receivable Prepayment (AR Wallet)</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Debited from active guest prepayment balances</td>
                        <td className="p-2.5 text-right font-semibold">₦{Number(closeOfDayData.payment_methods.ar_wallet || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">In-House Stays Suite Folio Charges</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Deferred checkout charges linked to stayed folios</td>
                        <td className="p-2.5 text-right font-semibold text-pure-gray-400">₦{Number(closeOfDayData.payment_methods.room_charge || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Grid 3: POS Outlets Performance Breakdown */}
              {closeOfDayData.pos_outlets && (
                <div className="space-y-3 pt-1 text-left">
                  <h3 className="text-xs font-black uppercase tracking-widest text-pure-black border-b border-gray-300 pb-1">3. Point of Sale (POS) Outlets Performance</h3>
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider border-b border-gray-200">
                        <th className="p-2.5">POS Service Outlet</th>
                        <th className="p-2.5">Category Department Focus</th>
                        <th className="p-2.5 text-right">Revenue Volume (NGN)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">Beverage & Liquor Bar Outlet</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Soft Drinks, Spirits, & Wines</td>
                        <td className="p-2.5 text-right font-semibold">₦{Number(closeOfDayData.pos_outlets.bar || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">Gourmet Dining Restaurant Outlet</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Continental Dining & Standard Folio Meals</td>
                        <td className="p-2.5 text-right font-semibold">₦{Number(closeOfDayData.pos_outlets.restaurant || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold font-sans">House Food Kitchen Outlet</td>
                        <td className="p-2.5 text-pure-gray-400 font-sans">Room Orders & Standard Quick Meals</td>
                        <td className="p-2.5 text-right font-semibold">₦{Number(closeOfDayData.pos_outlets.kitchen || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Grid 4: Front Desk & Telemetry */}
              <div className="space-y-3 pt-1 text-left">
                <h3 className="text-xs font-black uppercase tracking-widest text-pure-black border-b border-gray-300 pb-1">4. Front Office & Reception Telemetry</h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="border border-pure-gray-200 p-3 rounded-lg text-center bg-pure-white">
                    <span className="text-[9px] uppercase tracking-wider text-pure-gray-400 block font-semibold">Today's Arrivals</span>
                    <strong className="text-lg text-pure-black block font-mono font-black mt-0.5">{closeOfDayData.arrivals}</strong>
                  </div>
                  <div className="border border-pure-gray-200 p-3 rounded-lg text-center bg-pure-white">
                    <span className="text-[9px] uppercase tracking-wider text-pure-gray-400 block font-semibold">Today's Departures</span>
                    <strong className="text-lg text-pure-black block font-mono font-black mt-0.5">{closeOfDayData.departures}</strong>
                  </div>
                  <div className="border border-pure-gray-200 p-3 rounded-lg text-center bg-pure-white">
                    <span className="text-[9px] uppercase tracking-wider text-pure-gray-400 block font-semibold">In-House Guests</span>
                    <strong className="text-lg text-pure-black block font-mono font-black mt-0.5">{closeOfDayData.in_house_guests}</strong>
                  </div>
                  <div className="border border-pure-gray-200 p-3 rounded-lg text-center bg-pure-white">
                    <span className="text-[9px] uppercase tracking-wider text-pure-gray-400 block font-semibold">Occupancy Rate</span>
                    <strong className="text-lg text-pure-black block font-mono font-black mt-0.5">{closeOfDayData.occupancy_rate}%</strong>
                  </div>
                </div>
              </div>

              {/* Grid 5: In-House Occupied Stays */}
              {closeOfDayData.in_house_list && closeOfDayData.in_house_list.length > 0 && (
                <div className="space-y-3 pt-1 text-left">
                  <h3 className="text-xs font-black uppercase tracking-widest text-pure-black border-b border-gray-300 pb-1">5. In-House Occupied Stays Directory</h3>
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider border-b border-gray-200">
                        <th className="p-2">Room Unit</th>
                        <th className="p-2">In-House Guest Name</th>
                        <th className="p-2">Check-in Date</th>
                        <th className="p-2">Check-out Date</th>
                        <th className="p-2 text-right">Paid (NGN)</th>
                        <th className="p-2 text-right">Total (NGN)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono text-[10px]">
                      {closeOfDayData.in_house_list.map((stay, index) => (
                        <tr key={index}>
                          <td className="p-2 font-bold font-sans">{stay.room_number}</td>
                          <td className="p-2 font-semibold font-sans">{stay.guest_name}</td>
                          <td className="p-2 font-sans">{stay.check_in}</td>
                          <td className="p-2 font-sans">{stay.check_out}</td>
                          <td className="p-2 text-right">₦{Number(stay.paid).toLocaleString()}</td>
                          <td className="p-2 text-right font-bold">₦{Number(stay.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Grid 6: Departmental End-of-Day Closure Logs */}
              <div className="space-y-3 pt-1 text-left">
                <h3 className="text-xs font-black uppercase tracking-widest text-pure-black border-b border-gray-300 pb-1">6. Departmental End-of-Day Closure Logs</h3>
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-gray-100 text-pure-black font-semibold uppercase text-[9px] tracking-wider border-b border-gray-200">
                      <th className="p-2.5">Department</th>
                      <th className="p-2.5">Closed By Staff</th>
                      <th className="p-2.5">Closed At Timestamp</th>
                      <th className="p-2.5 text-right">Transactions Count</th>
                      <th className="p-2.5 text-right">Closed Revenue (NGN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { key: 'front_office', label: 'Front Office' },
                      { key: 'laundry', label: 'Laundry' },
                      { key: 'restaurant', label: 'Restaurant & Kitchen' },
                      { key: 'bar', label: 'Bar' }
                    ].map(dept => {
                      const closure = departmentalClosures.find(c => c.department === dept.key && c.business_date === closeOfDayData.date);
                      return (
                        <tr key={dept.key}>
                          <td className="p-2.5 font-semibold">{dept.label}</td>
                          <td className="p-2.5 text-pure-gray-400">{closure ? closure.staff_name : 'N/A (Auto-Sealed)'}</td>
                          <td className="p-2.5 text-pure-gray-400 font-mono">{closure ? format(new Date(closure.closed_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}</td>
                          <td className="p-2.5 text-right font-mono">{closure ? closure.transactions_count : 0}</td>
                          <td className="p-2.5 text-right font-mono font-semibold">
                            ₦{closure ? Number(closure.revenue).toLocaleString() : '0.00'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* GAAP Notice and Audit Statements */}
              <div className="bg-pure-white border border-pure-gray-200 rounded-xl p-4 text-[9px] text-pure-gray-500 space-y-1.5 leading-relaxed font-sans text-left">
                <strong className="text-pure-black block font-bold uppercase tracking-wider text-[10px]">Internal Audit & GAAPs Compliance Review:</strong>
                <p>
                  This night audit has compiled the ledger accounts and reception telemetry recorded up to the standard hotel end-of-day cut-off time. Total daily revenue captures all cash settlements, pos transactions, bank transfers, and prepaid wallet settlements.
                </p>
                <p>
                  We certify that double entry parameters balance and all transactions correspond to registered bookings and vouchers. Compiled automatically.
                </p>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end pt-12 border-t border-dashed border-pure-gray-200 text-left">
                <div className="text-center w-48">
                  <div className="border-b border-pure-gray-200 h-8"></div>
                  <span className="text-[9px] text-pure-gray-400 font-bold block mt-1.5 uppercase tracking-wider">Prepared By</span>
                </div>
                <div className="text-center w-48 relative">
                  <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 text-green-700/10 font-bold border-4 border-green-700/10 rounded-xl px-4 py-1 rotate-[-12deg] text-xs select-none">
                    AUDIT COMPLETED
                  </div>
                  <div className="border-b border-pure-gray-200 h-8"></div>
                  <span className="text-[9px] text-pure-gray-400 font-bold block mt-1.5 uppercase tracking-wider">Audited By (Hotel Manager)</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-pure-gray-200 bg-pure-white flex justify-end gap-3 screen-only">
              <button 
                type="button"
                onClick={() => setShowCloseOfDayModal(false)}
                className="bg-pure-white border border-pure-gray-200 hover:bg-gray-100 text-pure-black font-bold py-2.5 px-5 rounded-xl text-xs shadow-sm active:scale-95 transition-all"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void / Correct Modal */}
      {showVoidCorrectModal && voidCorrectTransaction && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-dark-700/60 flex justify-between items-center bg-dark-900/50 bg-gradient-to-r from-dark-900 via-dark-800 to-dark-900">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="text-brand-500"/> Void / Correct Ledger Entry
              </h2>
              <button onClick={() => setShowVoidCorrectModal(false)} className="text-gray-200 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Transaction Summary Card */}
              <div className="bg-dark-950/80 border border-dark-700/40 p-5 rounded-xl grid grid-cols-2 gap-4 text-xs font-semibold text-gray-300">
                <div>
                  <span className="text-gray-300 text-[10px] uppercase font-bold block">Posting Date</span>
                  <span className="text-white font-mono text-sm">{format(new Date(voidCorrectTransaction.date), 'MMM dd, yyyy HH:mm')}</span>
                </div>
                <div>
                  <span className="text-gray-300 text-[10px] uppercase font-bold block">Transaction Flow</span>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider inline-block mt-0.5 ${
                    voidCorrectTransaction.type === 'inflow' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {voidCorrectTransaction.type}
                  </span>
                </div>
                <div>
                  <span className="text-gray-300 text-[10px] uppercase font-bold block">Ledger Category</span>
                  <span className="text-white font-mono text-sm">{voidCorrectTransaction.category}</span>
                </div>
                <div>
                  <span className="text-gray-300 text-[10px] uppercase font-bold block">Payment Method</span>
                  <span className="text-white font-mono text-sm uppercase">{voidCorrectTransaction.method}</span>
                </div>
                <div className="col-span-2 border-t border-dark-700/30 pt-3">
                  <span className="text-gray-300 text-[10px] uppercase font-bold block">Posting Details / Description</span>
                  <span className="text-white font-medium text-sm leading-relaxed">{voidCorrectTransaction.description}</span>
                </div>
                <div className="col-span-2 border-t border-dark-700/30 pt-3 flex justify-between items-center bg-dark-900/35 p-3 rounded-lg border border-dark-700/20">
                  <span className="text-gray-200 font-bold uppercase">Original Ledger Value</span>
                  <span className="text-lg font-black text-white font-mono">₦{voidCorrectTransaction.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Adjustment vs Void Split Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* LHS: Correction Form */}
                <form onSubmit={handleCorrectTransaction} className="glass-panel p-5 rounded-xl border border-dark-700/60 flex flex-col justify-between space-y-4">
                  <h3 className="font-bold text-white text-sm border-b border-dark-700/40 pb-2 mb-1 flex items-center gap-1.5 font-sans">
                    <Check size={16} className="text-brand-400" /> Adjust Transaction details
                  </h3>
                  
                  <div className="space-y-3 flex-1">
                    <div>
                      <label className="block text-[11px] text-gray-200 mb-1 font-medium">New Corrected Amount (NGN)</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        value={voidCorrectAmount}
                        onChange={e => setVoidCorrectAmount(e.target.value)}
                        className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[11px] text-gray-200 mb-1 font-medium">Adjusted Payment Method</label>
                      <select 
                        value={voidCorrectMethod}
                        onChange={e => setVoidCorrectMethod(e.target.value)}
                        className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded-xl text-white outline-none focus:border-brand-500 text-sm uppercase font-semibold"
                      >
                        {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-dark-900 text-white">{m}</option>)}
                      </select>
                    </div>

                    {voidCorrectTransaction.source === 'expense' && (
                      <div>
                        <label className="block text-[11px] text-gray-200 mb-1 font-medium">Adjusted Expense Category</label>
                        <select 
                          value={voidCorrectCategory}
                          onChange={e => setVoidCorrectCategory(e.target.value)}
                          className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-semibold"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c} className="bg-dark-900 text-white">{c}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] text-gray-200 mb-1 font-medium">Correction Reason Remarks</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Typo correction, resolved bill"
                        value={voidCorrectNotes}
                        onChange={e => setVoidCorrectNotes(e.target.value)}
                        className="w-full bg-dark-900 border border-dark-700 p-2.5 rounded-xl text-white outline-none focus:border-brand-500 text-sm"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-brand-500 hover:bg-brand-600 text-dark-900 font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 mt-4"
                  >
                    Save Correction
                  </button>
                </form>

                {/* RHS: Danger Zone Voiding */}
                <div className="glass-panel p-5 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-rose-400 text-sm border-b border-rose-500/20 pb-2 mb-3 flex items-center gap-1.5 font-sans">
                      <X size={16} className="text-rose-400" /> Void Transaction (Danger Zone)
                    </h3>
                    <p className="text-xs text-rose-300/80 leading-relaxed font-sans">
                      Voiding a transaction completely sets its amount value to <strong>₦0.00</strong>, updates the posting ledger status to <strong>'voided'</strong>, and records audit marks on descriptions.
                    </p>
                    <div className="bg-rose-950/20 border border-rose-500/10 p-3 rounded-lg text-[10px] text-rose-400 mt-4 leading-relaxed font-sans">
                      ⚠️ WARNING: Voiding guest payments automatically recalculates paid room stay totals for linked booking references, modifying booking statuses back to partial/unpaid. This is an irreversible audit adjustment.
                    </div>
                  </div>

                  <button 
                    onClick={handleVoidTransaction}
                    type="button"
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95"
                  >
                    Void Transaction Completely
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Group Statement Modal */}
      {showGroupStatementModal && selectedStatementGroup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-dark-700/60 flex justify-between items-center bg-dark-900/50">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Building className="text-blue-400"/> Consolidated Statement: {selectedStatementGroup.name}
                </h2>
                <p className="text-xs text-gray-200 mt-1">Corporate credit line management, billing statuses, and stay history.</p>
              </div>
              <button onClick={() => setShowGroupStatementModal(false)} className="text-gray-200 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-dark-900/40 p-4 rounded-xl border border-dark-750">
                <div>
                  <span className="text-[11px] font-black text-gray-300 uppercase tracking-wider block">Outstanding balance</span>
                  <span className="text-xl font-black text-rose-500 font-mono">₦{Number(selectedStatementGroup.outstanding_balance).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[11px] font-black text-gray-300 uppercase tracking-wider block">Credit Limit</span>
                  <span className="text-xl font-black text-blue-400 font-mono">₦{Number(selectedStatementGroup.credit_limit || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[11px] font-black text-gray-300 uppercase tracking-wider block">Account Status</span>
                  <span className={`text-sm font-extrabold uppercase tracking-wider mt-1 px-2.5 py-1.5 rounded-full border inline-block ${
                    closedGroupAccounts.includes(selectedStatementGroup.id)
                      ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : 'bg-green-500/10 text-green-400 border-green-500/20'
                  }`}>
                    {closedGroupAccounts.includes(selectedStatementGroup.id) ? 'Closed Account (Billing Blocked)' : 'Active Account (Open)'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Stay & Extras Folios Billed to Group</h3>
                {loadingGroupBookings ? (
                  <div className="text-center py-8 text-gray-200">Loading stayed bookings...</div>
                ) : groupBookings.length === 0 ? (
                  <div className="text-center py-8 text-gray-300 bg-dark-900/20 border border-dark-750 rounded-xl">No stays found billed to this group.</div>
                ) : (
                  <div className="border border-dark-750 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-dark-900 text-gray-200 border-b border-dark-750">
                        <tr>
                          <th className="p-3">Reference</th>
                          <th className="p-3">Guest Name</th>
                          <th className="p-3">Stay Dates</th>
                          <th className="p-3">Total Amount</th>
                          <th className="p-3">Amount Paid</th>
                          <th className="p-3">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750 bg-dark-900/20">
                        {groupBookings.map((b, bIdx) => {
                          const total = Number(b.total_room_price_ngn || 0) + Number(b.total_extras_price_ngn || 0);
                          const outstanding = total - Number(b.amount_paid_ngn || 0);
                          return (
                            <tr key={`g-book-${bIdx}`} className="hover:bg-dark-700/10">
                              <td className="p-3 font-mono font-bold text-white">{b.booking_reference}</td>
                              <td className="p-3 font-semibold text-gray-300">{b.guest_name}</td>
                              <td className="p-3 font-mono text-gray-200">{b.check_in_date} to {b.check_out_date}</td>
                              <td className="p-3 font-mono font-bold text-gray-300">₦{total.toLocaleString()}</td>
                              <td className="p-3 font-mono font-bold text-green-400">₦{Number(b.amount_paid_ngn || 0).toLocaleString()}</td>
                              <td className={`p-3 font-mono font-bold ${outstanding > 0 ? 'text-rose-500' : 'text-gray-300'}`}>₦{outstanding.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-dark-700/60 flex flex-col sm:flex-row justify-between gap-4 bg-dark-900/50">
              <button
                type="button"
                onClick={() => handleToggleGroupAccountStatus(selectedStatementGroup.id)}
                className={`py-3 px-5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                  closedGroupAccounts.includes(selectedStatementGroup.id)
                    ? 'bg-green-500/10 hover:bg-green-500 hover:text-dark-900 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-500'
                }`}
              >
                {closedGroupAccounts.includes(selectedStatementGroup.id) ? 'Reopen Group Account' : 'Close Group Account'}
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handlePrintGroupStatement(selectedStatementGroup, groupBookings)}
                  className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-bold py-3 px-5 text-xs flex items-center justify-center gap-2 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  <Printer size={16} /> Print Statement
                </button>
                <button
                  type="button"
                  onClick={() => setShowGroupStatementModal(false)}
                  className="bg-dark-900 hover:bg-dark-700 text-white font-bold py-3 px-5 rounded-xl transition-colors text-xs border border-dark-700/60"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Departmental Close Report */}
      {isCloseReportModalOpen && selectedCloseReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-dark-800 rounded-3xl border border-dark-700 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 my-8 text-white">
            <div className="flex justify-between items-center p-6 border-b border-dark-700 bg-dark-900 rounded-t-3xl">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <FileText className="text-amber-500" size={20} />
                Department Close Ledger Report: {selectedCloseReport.department?.replace('_', ' ').toUpperCase()}
              </h2>
              <button 
                onClick={() => setIsCloseReportModalOpen(false)} 
                className="text-gray-200 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-200 block mb-1">Total Closed Revenue</span>
                  <span className="text-2xl font-black text-white">₦{selectedCloseReport.total_revenue?.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-300 block mt-1">{selectedCloseReport.transactions_count} total transactions</span>
                </div>
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-200 block mb-1">Operating Date</span>
                  <span className="text-2xl font-black text-brand-500">{selectedCloseReport.business_date}</span>
                  <span className="text-[10px] text-gray-300 block mt-1">Closed at: {format(new Date(selectedCloseReport.closed_at), 'yyyy-MM-dd HH:mm')}</span>
                </div>
                <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-755">
                  <span className="text-xs text-gray-200 block mb-1">Closed Sign-off Staff</span>
                  <span className="text-2xl font-black text-blue-400 truncate block">{selectedCloseReport.staff_name || 'System Admin'}</span>
                  <span className="text-[10px] text-gray-300 block mt-1">Verifying Accountant Ledger</span>
                </div>
              </div>

              {selectedCloseReport.department === 'restaurant' ? (
                <>
                  {/* Restaurant POS Transactions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-2 border-b border-dark-700 pb-2">
                      <Utensils size={14} />
                      Restaurant POS Transactions (Walk-ins & POS Sales)
                    </h3>
                    {(!selectedCloseReport.transactions || selectedCloseReport.transactions.filter(t => t.type === 'Restaurant POS').length === 0) ? (
                      <p className="text-xs text-gray-300 italic">No Restaurant POS transactions recorded on this day.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-dark-750 text-gray-200 text-[10px] uppercase font-bold">
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Reference / Guest</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3">Method</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dark-750">
                            {selectedCloseReport.transactions.filter(t => t.type === 'Restaurant POS').map((t, idx) => (
                              <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                                <td className="py-2.5 px-3 font-mono text-gray-300">{t.time}</td>
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
                    {(!selectedCloseReport.transactions || selectedCloseReport.transactions.filter(t => t.type === 'Kitchen Order').length === 0) ? (
                      <p className="text-xs text-gray-300 italic">No Kitchen orders recorded on this day.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-dark-750 text-gray-200 text-[10px] uppercase font-bold">
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Reference / Room</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3">Method</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dark-750">
                            {selectedCloseReport.transactions.filter(t => t.type === 'Kitchen Order').map((t, idx) => (
                              <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                                <td className="py-2.5 px-3 font-mono text-gray-300">{t.time}</td>
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
                </>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 flex items-center gap-2 border-b border-dark-700 pb-2">
                    <FileText size={14} />
                    Transactions Ledger Details
                  </h3>
                  {!selectedCloseReport.transactions || selectedCloseReport.transactions.length === 0 ? (
                    <p className="text-xs text-gray-300 italic">No transactions recorded under this closure report.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-dark-750 text-gray-200 text-[10px] uppercase font-bold">
                            <th className="py-2 px-3">Time</th>
                            <th className="py-2 px-3">Reference / Guest</th>
                            <th className="py-2 px-3">Description</th>
                            <th className="py-2 px-3">Method</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-750">
                          {selectedCloseReport.transactions.map((t, idx) => (
                            <tr key={idx} className="text-xs text-gray-300 hover:bg-dark-900/35">
                              <td className="py-2.5 px-3 font-mono text-gray-300">{t.time}</td>
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
              )}
            </div>

            <div className="p-6 border-t border-dark-700 bg-dark-900 flex justify-end gap-3 rounded-b-3xl">
              <button 
                type="button"
                onClick={() => setIsCloseReportModalOpen(false)}
                className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Bank Settlement Payroll Modal */}
      {showBankSettlementModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:absolute print:inset-0">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: landscape !important;
              }
              .print-container.print-landscape {
                width: 100% !important;
                max-width: 297mm !important;
              }
            }
          `}} />
          <div className="bg-pure-white text-pure-black w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-pure-gray-200 print-container print-landscape print:max-h-none print:shadow-none print:border-none print:w-full print:m-0">
            {/* Modal actions */}
            <div className="p-4 bg-gray-100 border-b border-gray-200 flex justify-between items-center select-none print:hidden">
              <span className="font-bold text-xs uppercase tracking-wider text-pure-gray-500 flex items-center gap-2">
                <Sparkles size={16} className="text-brand-500" /> Bank Settlement Payroll
              </span>
              
              {/* Date Filter selector in modal header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-pure-gray-500">Month:</span>
                  <select
                    value={settlementMonth}
                    onChange={e => setSettlementMonth(Number(e.target.value))}
                    className="bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-brand-500 font-semibold cursor-pointer text-pure-black"
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-pure-gray-500">Year:</span>
                  <select
                    value={settlementYear}
                    onChange={e => setSettlementYear(Number(e.target.value))}
                    className="bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-brand-500 font-semibold cursor-pointer text-pure-black"
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  >
                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                
                <button 
                  onClick={() => window.print()}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Printer size={14} /> Print Document
                </button>
                <button 
                  onClick={() => setShowBankSettlementModal(false)} 
                  className="bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold p-2 rounded-xl transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Area starts */}
            <div className="p-8 overflow-y-auto space-y-8 print:p-0 print:overflow-visible flex-1">
              
              {/* Receipt Header / Letterhead */}
              <div className="flex justify-between items-start border-b-2 border-gray-100 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    {contactInfo.logo ? (
                      <img src={contactInfo.logo} alt="Brand Logo" className="max-h-12 object-contain" />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M50 10 L10 90 L35 90 L60 40 Z" fill="#DF6853"/>
                        <path d="M40 90 L90 90 L75 60 L50 90 Z" fill="#DF6853"/>
                      </svg>
                    )}
                    <div className="flex flex-col justify-center">
                      <span className="text-base font-extrabold text-pure-black tracking-wider uppercase">{contactInfo.companyName}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-pure-gray-500 mt-2 max-w-[340px] leading-relaxed">
                    {contactInfo.address}<br />
                    Tel: {contactInfo.phone} | Email: {contactInfo.email}
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-black text-pure-black tracking-tight uppercase">
                    Bank Settlement Payroll
                  </h3>
                  <div className="text-xs text-pure-gray-500 font-mono mt-1 font-semibold">
                    PERIOD: {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][settlementMonth].toUpperCase()} {settlementYear}
                  </div>
                  <div className="text-[10px] text-pure-gray-400 mt-0.5 font-bold uppercase tracking-wider font-mono">
                    GENERATED ON: {new Date().toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>

              {/* Settlement table */}
              <div className="space-y-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-pure-black font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                      <th className="p-3">Staff Details</th>
                      <th className="p-3">Designation</th>
                      <th className="p-3">Bank Name</th>
                      <th className="p-3">Account Number</th>
                      <th className="p-3">Account Name</th>
                      <th className="p-3 text-right">Base Salary</th>
                      <th className="p-3 text-right">Bonuses</th>
                      <th className="p-3 text-right">Deductions</th>
                      <th className="p-3 text-right">Net Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(() => {
                      const filteredSalaries = salaries.filter(sal => {
                        const dateObj = new Date(sal.pay_period_end);
                        return dateObj.getMonth() === settlementMonth && dateObj.getFullYear() === settlementYear;
                      });

                      if (filteredSalaries.length === 0) {
                        return (
                          <tr>
                            <td colSpan="9" className="p-8 text-center text-pure-gray-500 italic">No processed payroll payouts found for the selected period.</td>
                          </tr>
                        );
                      }

                      let totalBase = 0;
                      let totalBonuses = 0;
                      let totalDeductions = 0;
                      let totalNet = 0;

                      const rows = filteredSalaries.map(sal => {
                        const matchedStaff = staff.find(s => s.id === sal.staff_id) || {};
                        const netPay = sal.net_salary || (Number(sal.base_salary) + Number(sal.bonuses) - Number(sal.deductions));
                        
                        totalBase += Number(sal.base_salary);
                        totalBonuses += Number(sal.bonuses);
                        totalDeductions += Number(sal.deductions);
                        totalNet += netPay;

                        return (
                          <tr key={sal.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 font-semibold text-pure-black">
                              {matchedStaff.first_name ? `${matchedStaff.first_name} ${matchedStaff.last_name}` : 'Staff Member'}
                              <div className="text-[10px] text-pure-gray-400 font-mono font-medium">{matchedStaff.email || 'No email'}</div>
                            </td>
                            <td className="p-3 uppercase text-[10px] font-bold text-pure-gray-500">
                              {matchedStaff.role?.replace('_', ' ') || 'N/A'}
                            </td>
                            <td className="p-3">
                              {matchedStaff.bank_name || (
                                <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-rose-100">MISSING</span>
                              )}
                            </td>
                            <td className="p-3 font-mono font-semibold">
                              {matchedStaff.account_number || '—'}
                            </td>
                            <td className="p-3 text-pure-gray-500">
                              {matchedStaff.account_name || '—'}
                            </td>
                            <td className="p-3 text-right font-mono">
                              ₦{Number(sal.base_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-green-600">
                              +₦{Number(sal.bonuses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-rose-600">
                              -₦{Number(sal.deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-pure-black">
                              ₦{netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      });

                      // Append a Grand Total row
                      rows.push(
                        <tr key="totals" className="bg-gray-50 border-t-2 border-pure-black font-black text-pure-black">
                          <td colSpan="5" className="p-3 uppercase tracking-wider text-[10px] font-black">Grand Totals</td>
                          <td className="p-3 text-right font-mono">₦{totalBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono text-green-600">+₦{totalBonuses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono text-rose-600">-₦{totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono text-lg text-brand-600">₦{totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );

                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Bank Settlement Summary Instructions */}
              <div 
                className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-xs text-pure-gray-500 space-y-2 mt-8 leading-relaxed"
                style={{ backgroundColor: '#f9fafb', color: '#4b5563', borderColor: '#e5e7eb' }}
              >
                <strong className="text-pure-black block mb-1 uppercase tracking-wider text-[10px]" style={{ color: '#000000' }}>Bank Settlement Instructions</strong>
                <p style={{ color: '#4b5563' }}>Please initiate bank transfer payouts for the employees listed above from the hotel corporate account:</p>
                <div 
                  className="grid grid-cols-3 gap-4 font-mono text-[11px] text-pure-black py-2 bg-white p-3 rounded-lg border border-gray-100"
                  style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#f3f4f6' }}
                >
                  <div>
                    <span className="text-[9px] text-pure-gray-400 block font-bold font-sans uppercase" style={{ color: '#9ca3af' }}>Source Bank</span>
                    <strong style={{ color: '#000000' }}>{contactInfo.hotel_bank_name || 'Access Bank Plc'}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-pure-gray-400 block font-bold font-sans uppercase" style={{ color: '#9ca3af' }}>Account Name</span>
                    <strong style={{ color: '#000000' }}>{contactInfo.hotel_account_name || 'Luxe Elite Hotels Ltd'}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-pure-gray-400 block font-bold font-sans uppercase" style={{ color: '#9ca3af' }}>Account Number</span>
                    <strong style={{ color: '#000000' }}>{contactInfo.hotel_account_number || '0098172635'}</strong>
                  </div>
                </div>
                <p className="text-[10px] text-pure-gray-450 italic mt-2" style={{ color: '#6b7280' }}>Note: This is an official audit-locked document. All calculations have been cross-checked with active duty attendance clock logs and verified role salary exceptions.</p>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end pt-12 border-t border-dashed border-gray-200 mt-12">
                <div className="text-center w-48 relative">
                  <div className="border-b border-gray-300 h-8"></div>
                  <span className="text-[10px] text-pure-gray-400 font-semibold block mt-1.5 uppercase">Prepared By</span>
                </div>
                <div className="text-center w-48 relative">
                  <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 text-green-600/10 font-bold border-4 border-green-600/10 rounded-xl px-4 py-1 rotate-[-12deg] text-xs select-none">
                    PAYROLL AUDITED
                  </div>
                  <div className="border-b border-gray-300 h-8"></div>
                  <span className="text-[10px] text-pure-gray-400 font-semibold block mt-1.5 uppercase">Audited By (Hotel Manager)</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAccounting;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Wallet, Printer, Clock, FileText, ArrowUpRight, ArrowDownLeft, X } from 'lucide-react';
import { format } from 'date-fns';

const GuestFinancials = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guestRecord, setGuestRecord] = useState(null);
  const [arStatement, setArStatement] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [paystackPublicKey, setPaystackPublicKey] = useState('');

  // Prepayment Wallet Add Funds States
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [addFundsMethod, setAddFundsMethod] = useState('paystack');
  const [addFundsRef, setAddFundsRef] = useState('');
  const [isProcessingAddFunds, setIsProcessingAddFunds] = useState(false);

  const [bankDetails, setBankDetails] = useState({
    bankName: 'Access Bank Plc',
    accountName: 'Sparkles Apartments Ltd',
    accountNumber: '0098172635'
  });

  const [contactInfo, setContactInfo] = useState({
    address: 'Plot 572 Iduwa Ogenyi Street Mabushi, Off Ahmadu Bello Way, Abuja',
    phone: '08033214684, 08062332639, 08171278657',
    email: 'info@sparklesapartments.ng',
    logo: ''
  });

  const fetchContactSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['contact_address', 'contact_phone', 'contact_email', 'contact_logo']);
      if (!error && data) {
        const settingsMap = data.reduce((acc, curr) => {
          acc[curr.setting_key] = curr.setting_value;
          return acc;
        }, {});
        setContactInfo(prev => ({
          address: settingsMap.contact_address || prev.address,
          phone: settingsMap.contact_phone || prev.phone,
          email: settingsMap.contact_email || prev.email,
          logo: settingsMap.contact_logo || prev.logo
        }));
      }
    } catch (e) {
      console.error("Failed to load contact settings:", e);
    }
  };

  const fetchBankSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['hotel_bank_name', 'hotel_account_name', 'hotel_account_number']);
      if (!error && data) {
        const settingsMap = data.reduce((acc, curr) => {
          acc[curr.setting_key] = curr.setting_value;
          return acc;
        }, {});
        setBankDetails({
          bankName: settingsMap.hotel_bank_name || 'Access Bank Plc',
          accountName: settingsMap.hotel_account_name || 'Sparkles Apartments Ltd',
          accountNumber: settingsMap.hotel_account_number || '0098172635'
        });
      }
    } catch (e) {
      console.error("Failed to load bank settings:", e);
    }
  };

  useEffect(() => {
    fetchContactSettings();
    fetchBankSettings();
    if (user) {
      fetchGuestAndStatement();

      const channel = supabase
        .channel('guest-financials-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_guests', filter: `email=eq.${user.email.toLowerCase()}` }, () => {
          fetchGuestAndStatement();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
          fetchGuestAndStatement();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchGuestAndStatement = async () => {
    setLoading(true);
    try {
      // 1. Fetch CRM guest record to get current wallet balance
      const { data: crmData, error: crmError } = await supabase
        .from('crm_guests')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .maybeSingle();

      if (crmError) throw crmError;
      
      if (!crmData) {
        setGuestRecord(null);
        setLoading(false);
        return;
      }

      setGuestRecord(crmData);

      if (crmData.wallet_balance !== null && crmData.wallet_balance !== undefined) {
        setLoadingStatement(true);
        const email = crmData.email.toLowerCase().trim();
        
        // 2. Fetch all booking IDs associated with this guest first
        const { data: guestBookings } = await supabase
          .from('bookings')
          .select('id')
          .or(`guest_id.eq.${user?.id},guest_email.ilike.${email}`);

        const bookingIds = guestBookings ? guestBookings.map(b => b.id) : [];

        // 3. Fetch payments list to reconcile statement (filtered to this guest)
        let paymentsData = [];
        try {
          let paymentsQuery = supabase
            .from('payments')
            .select('*, bookings(guest_name, total_amount_ngn)');

          const guestFullName = `${crmData.first_name || ''} ${crmData.last_name || ''}`.replace(/\s+/g, ' ').trim();
          const orFilters = [`notes.ilike.%${email}%`];
          if (guestFullName) {
            orFilters.push(`notes.ilike.%${guestFullName}%`);
          }
          if (bookingIds.length > 0) {
            orFilters.push(`booking_id.in.(${bookingIds.join(',')})`);
          }
          paymentsQuery = paymentsQuery.or(orFilters.join(','));
          
          const { data: pData, error: payError } = await paymentsQuery;
          if (payError) throw payError;
          paymentsData = pData || [];
        } catch (payErr) {
          console.error("Failed to fetch payments:", payErr);
        }

        // 4. Fetch completed booking services (POS and Laundry folio charges) for this guest's bookings only
        let folioPOSCharges = [];
        let folioLaundryCharges = [];
        if (bookingIds.length > 0) {
          try {
            const { data: bsData, error: bsError } = await supabase
              .from('booking_services')
              .select('*, bookings(booking_reference, guest_name, rooms(room_number)), services(name, category, internal_notes)')
              .eq('status', 'completed')
              .in('booking_id', bookingIds);
            
            if (bsError) throw bsError;
            
            if (bsData) {
              folioPOSCharges = bsData.filter(bs => 
                (bs.notes === 'pos_charge' || 
                 (bs.services?.internal_notes?.toLowerCase() === 'restaurant' && bs.notes?.startsWith('restaurant_order:'))) &&
                bs.payment_status !== 'paid'
              );
              folioLaundryCharges = bsData.filter(bs => 
                (bs.services?.category?.toLowerCase() === 'laundry' || 
                bs.services?.name?.toLowerCase()?.includes('laundry') ||
                (bs.notes && (bs.notes.startsWith('laundry_') || bs.notes.includes('laundry_completed')))) &&
                bs.payment_status !== 'paid'
              );
            }
          } catch (bsErr) {
            console.warn("Failed to fetch booking_services room POS/Laundry charges:", bsErr);
          }
        }

        let resolvedInflows = [];
        if (paymentsData && paymentsData.length > 0) {
          resolvedInflows = paymentsData.map(p => {
            const isPOS = p.transaction_ref?.startsWith('POS-') || 
                          p.transaction_ref?.startsWith('CORP-CHG-') || 
                          p.notes?.includes('POS Direct Walk-in Sale') || 
                          p.notes?.toLowerCase().includes('pos walk-in') ||
                          p.notes?.toLowerCase().includes('pos corporate charge') ||
                          p.notes?.toLowerCase().includes('restaurant room service') ||
                          p.notes?.toLowerCase().includes('corporate charge');
            const isLaundry = p.transaction_ref?.startsWith('LDY-') || p.notes?.toLowerCase().includes('laundry');
            const isARFunding = p.transaction_ref?.startsWith('AR-DEP-') || 
                                (p.notes?.toLowerCase().includes('deposit') && !p.notes?.toLowerCase().includes('paid from')) || 
                                p.notes?.toLowerCase().includes('initial ar wallet') ||
                                (p.notes?.toLowerCase().includes('prepayment wallet deposit') && !p.notes?.toLowerCase().includes('paid from'));
            const isAR = p.method === 'ar' || p.method === 'ar_wallet' || p.method === 'ar_prepayment_wallet' ||
                         p.notes?.toLowerCase().includes('paid from guest ar');
            return {
              id: p.id,
              date: p.processed_at || p.created_at,
              amount: Number(p.amount),
              description: isLaundry
                ? p.notes || `Walk-in Laundry direct sale settled via ${p.method?.toUpperCase()}`
                : (isPOS 
                  ? p.notes || `POS Walk-in Sale settled via ${p.method?.toUpperCase()}`
                  : (p.is_refund === true
                    ? p.notes || "AR Prepayment Wallet Refund"
                    : (isARFunding
                      ? p.notes || `AR Prepayment Wallet Deposit (Funding)`
                      : (isAR ? `Folio Charge (AR Payment) - ${p.bookings?.guest_name || 'Confirmed Guest'}` : `Guest Booking Payment - ${p.bookings?.guest_name || 'Confirmed Guest'}`)))),
              method: isAR ? 'ar' : p.method,
              status: p.status,
              type: (isAR && !isARFunding) ? 'outflow' : 'inflow',
              booking_id: p.booking_id,
              notes: p.notes || '',
              category: isLaundry ? 'Laundry Revenue' : (isPOS ? 'POS Revenue' : 'Booking Revenue'),
              is_refund: p.is_refund
            };
          });
        }

        if (folioPOSCharges && folioPOSCharges.length > 0) {
          const resolveFolioInflows = folioPOSCharges.map(bs => ({
            id: bs.id,
            date: bs.created_at,
            amount: Number(bs.total_price_ngn),
            description: `POS Suite Folio Charge [Room ${bs.bookings?.rooms?.room_number || 'N/A'}] — ${bs.services?.name || 'F&B Service'} (x${bs.quantity})`,
            method: 'room_charge',
            status: 'completed',
            type: 'inflow',
            notes: `Guest: ${bs.bookings?.guest_name || 'In-House'}`,
            category: 'POS Revenue'
          }));
          resolvedInflows = [...resolvedInflows, ...resolveFolioInflows];
        }

        if (folioLaundryCharges && folioLaundryCharges.length > 0) {
          const resolveFolioLaundry = folioLaundryCharges.map(bs => ({
            id: bs.id,
            date: bs.created_at,
            amount: Number(bs.total_price_ngn),
            description: `Laundry Suite Folio Charge [Room ${bs.bookings?.rooms?.room_number || 'N/A'}] — ${bs.services?.name || 'Laundry Service'} (x${bs.quantity})`,
            method: 'room_charge',
            status: 'completed',
            type: 'inflow',
            notes: `Guest: ${bs.bookings?.guest_name || 'In-House'} | Items: ${bs.notes?.replace('laundry_completed:', '').replace('laundry_charge:', '').trim() || 'N/A'}`,
            category: 'Laundry Revenue'
          }));
          resolvedInflows = [...resolvedInflows, ...resolveFolioLaundry];
        }

        const guestFullName = `${crmData.first_name || ''} ${crmData.last_name || ''}`.toLowerCase().trim();
        const nameParts = guestFullName.split(/\s+/).filter(part => part.length > 2);

        const statement = resolvedInflows.filter(inf => {
          const desc = (inf.description || '').toLowerCase();
          const notes = (inf.notes || '').toLowerCase();
          
          const matchesEmail = email && (desc.includes(email) || notes.includes(email));
          const matchesName = desc.includes(guestFullName) || notes.includes(guestFullName) || 
                              (nameParts.length > 0 && nameParts.every(part => desc.includes(part) || notes.includes(part)));
          
          const matchesARMethod = inf.method === 'ar_prepayment_wallet' || inf.method === 'ar_wallet' || inf.method === 'ar' ||
                                  desc.includes('ar prepayment') || notes.includes('ar prepayment') ||
                                  desc.includes('ar wallet') || notes.includes('ar wallet') ||
                                  notes.includes('ar prepayment wallet') || notes.includes('prepayment wallet');
          
          const isDeposit = (desc.includes('deposit') || notes.includes('deposit') || desc.includes('deposited') || notes.includes('deposited') || notes.includes('initial ar wallet') || desc.includes('refund') || notes.includes('refund') || desc.includes('refunded') || notes.includes('refunded') || desc.includes('credit') || notes.includes('credit') || inf.is_refund === true) && (matchesName || matchesEmail);
          const isDeduction = !isDeposit && matchesARMethod && (matchesName || matchesEmail);
          
          return isDeposit || isDeduction;
        });

        // Format items and compute running balance chronologically
        const formatted = statement.map(rec => {
          const descLower = (rec.description || '').toLowerCase();
          const notesLower = (rec.notes || '').toLowerCase();
          const isDepositText = descLower.includes('deposit') || notesLower.includes('deposit') || descLower.includes('deposited') || notesLower.includes('deposited') || notesLower.includes('initial ar wallet') || descLower.includes('refund') || notesLower.includes('refund') || descLower.includes('refunded') || notesLower.includes('refunded') || descLower.includes('credit') || notesLower.includes('credit');
          const isDeposit = (isDepositText && !notesLower.includes('paid from') && !descLower.includes('paid from')) || rec.is_refund === true;
          return {
            id: rec.id,
            date: rec.date,
            description: rec.description,
            notes: rec.notes,
            method: rec.method,
            type: isDeposit ? 'credit' : 'debit',
            amount: Number(rec.amount || 0)
          };
        }).sort((a, b) => {
          const dateDiff = new Date(a.date) - new Date(b.date);
          if (dateDiff !== 0) return dateDiff;
          return (a.id || '').localeCompare(b.id || '');
        });

        // Add running balance
        let runningBal = 0;
        const withBal = formatted.map(item => {
          if (item.type === 'credit') {
            runningBal += item.amount;
          } else {
            runningBal -= item.amount;
          }
          return { ...item, running_balance: runningBal };
        }).sort((a, b) => {
          const dateDiff = new Date(b.date) - new Date(a.date);
          if (dateDiff !== 0) return dateDiff;
          return (b.id || '').localeCompare(a.id || '');
        }); // Sort newest first for display

        setArStatement(withBal);
      }

      // 5. Fetch Hotel Bank Details from system_settings
      try {
        const { data: sysData } = await supabase
          .from('system_settings')
          .select('*')
          .in('setting_key', ['hotel_bank_name', 'hotel_account_name', 'hotel_account_number', 'paystack_public']);
        
        if (sysData && sysData.length > 0) {
          const map = {};
          sysData.forEach(s => map[s.setting_key] = s.setting_value);
          setBankDetails({
            bankName: map.hotel_bank_name || 'Access Bank Plc',
            accountName: map.hotel_account_name || 'Luxe Elite Hotels Ltd',
            accountNumber: map.hotel_account_number || '0098172635'
          });
          setPaystackPublicKey(map.paystack_public || '');
        }
      } catch (sysErr) {
        console.warn("Failed to fetch hotel bank details from system_settings:", sysErr);
      }
    } catch (err) {
      console.error("Failed to load guest financials:", err);
      toast.error('Failed to load financials statement');
    } finally {
      setLoading(false);
      setLoadingStatement(false);
    }
  };

  const initializePayment = usePaystackPayment({});

  const executeWalletDeposit = async (amount, method, transactionRef, methodLabel, refLabel) => {
    const currentBalance = Number(guestRecord.wallet_balance || 0);
    const newBalance = currentBalance + amount;
    
    // 1. Update wallet_balance in crm_guests
    const { error: crmErr } = await supabase.from('crm_guests').update({ wallet_balance: newBalance }).eq('id', guestRecord.id);
    if (crmErr) throw crmErr;

    // 2. Fetch all AR accounts to keep fallbacks synchronized
    let arAccounts = [];
    try {
      const { data } = await supabase.from('ar_accounts').select('*');
      if (data) arAccounts = data;
    } catch (arErr) {
      try {
        const { data: sysData } = await supabase.from('system_settings').select('*').eq('setting_key', 'ar_accounts').maybeSingle();
        if (sysData && sysData.setting_value) {
          arAccounts = typeof sysData.setting_value === 'string' ? JSON.parse(sysData.setting_value) : sysData.setting_value;
        } else {
          const local = localStorage.getItem('luxe_ar_accounts');
          arAccounts = local ? JSON.parse(local) : [];
        }
      } catch (err) {
        arAccounts = [];
      }
    }

    // 3. Upsert single changed record into ar_accounts (with fallback)
    const arAcc = arAccounts.find(acc => acc.guest_id === guestRecord.id);
    const targetWallet = {
      id: arAcc ? arAcc.id : ('ar_' + Math.random().toString(36).substring(2, 9).toUpperCase()),
      guest_id: guestRecord.id,
      guest_name: `${guestRecord.first_name || ''} ${guestRecord.last_name || ''}`.trim() || guestRecord.guest_name || 'Unnamed Guest',
      guest_email: guestRecord.email || 'N/A',
      balance: newBalance,
      status: 'active',
      created_at: arAcc ? arAcc.created_at : new Date().toISOString()
    };

    let updatedAR;
    if (arAcc) {
      updatedAR = arAccounts.map(acc => 
        acc.guest_id === guestRecord.id ? targetWallet : acc
      );
    } else {
      updatedAR = [...arAccounts, targetWallet];
    }

    try {
      const { error: arErr } = await supabase.from('ar_accounts').upsert([targetWallet]);
      if (arErr) throw arErr;
    } catch (arErr) {
      console.warn("ar_accounts update/insert fallback, table missing:", arErr.message);
      try {
        await supabase.from('system_settings').upsert({
          setting_key: 'ar_accounts',
          setting_value: updatedAR
        }, { onConflict: 'setting_key' });
      } catch (sysErr) {
        console.warn("Failed to update system_settings on deposit:", sysErr);
      }
      localStorage.setItem('luxe_ar_accounts', JSON.stringify(updatedAR));
    }

    // 4. Insert payment ledger entry
    const { data: insertedPayment, error: payErr } = await supabase
      .from('payments')
      .insert([{
        booking_id: null,
        amount: amount,
        currency: 'NGN',
        method: method,
        status: 'completed',
        is_refund: false,
        transaction_ref: transactionRef,
        notes: `AR Prepayment Wallet Deposit logged by Guest Portal (${methodLabel}, Ref: ${refLabel}) for guest: ${guestRecord.first_name} ${guestRecord.last_name} (${guestRecord.email || 'N/A'})`
      }])
      .select()
      .maybeSingle();

    if (payErr) console.warn("Failed to log prepayment deposit to payments table:", payErr.message);
    return insertedPayment;
  };

  const handleWalletPaymentSuccess = async (reference) => {
    setIsProcessingAddFunds(true);
    const amount = Number(addFundsAmount);
    const toastId = toast.loading(`Completing payment and updating wallet...`);
    try {
      const transRef = typeof reference === 'string' ? reference : (reference?.reference || reference?.transaction || `DEP-${Date.now()}`);
      const dbTxRef = `AR-DEP-PAYSTACK-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`;
      
      const insertedPayment = await executeWalletDeposit(
        amount,
        'paystack',
        dbTxRef,
        'Paystack (Online Card)',
        transRef
      );

      toast.success(`✓ Deposit successful! ₦${amount.toLocaleString()} added to your wallet.`, { id: toastId });
      
      // Reset and close
      setIsAddFundsOpen(false);
      setAddFundsAmount('');
      setAddFundsRef('');

      // Redirect to payment success page
      const paymentIdQuery = insertedPayment ? `&payment_id=${insertedPayment.id}` : '';
      navigate(`/payment-success?type=wallet${paymentIdQuery}&amount=${amount}`);
    } catch (err) {
      console.error(err);
      toast.error(`Deposit failed to log in system: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessingAddFunds(false);
    }
  };

  const onSuccess = (reference) => {
    handleWalletPaymentSuccess(reference);
  };

  const onClose = () => {
    toast.error('Payment cancelled.');
  };

  const handleAddFunds = async (e) => {
    e.preventDefault();
    if (!guestRecord) return toast.error("No guest profile resolved");
    const amount = Number(addFundsAmount);
    if (amount <= 0) return toast.error("Please enter a valid amount");

    if (addFundsMethod === 'paystack') {
      if (!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY && !paystackPublicKey) {
        return toast.error("Payment gateway is not configured.");
      }
      const depRef = `DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      initializePayment({
        config: {
          reference: depRef,
          email: guestRecord?.email || user?.email || '',
          amount: Math.round(amount * 100), // in kobo
          publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || paystackPublicKey || '',
          currency: 'NGN'
        },
        onSuccess,
        onClose
      });
      return;
    }

    setIsProcessingAddFunds(true);
    const toastId = toast.loading(`Processing prepayment deposit of ₦${amount.toLocaleString()}...`);
    try {
      const dbTxRef = `AR-DEP-BANK_TRANSFER-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now()}`;
      await executeWalletDeposit(
        amount,
        'bank_transfer',
        dbTxRef,
        'Bank Transfer',
        addFundsRef || 'N/A'
      );

      toast.success(`✓ Deposit successful! ₦${amount.toLocaleString()} added to your wallet.`, { id: toastId });
      
      // Reset and close
      setIsAddFundsOpen(false);
      setAddFundsAmount('');
      setAddFundsRef('');
      
      // Refresh local page data
      await fetchGuestAndStatement();
    } catch (err) {
      console.error(err);
      toast.error(`Deposit failed: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessingAddFunds(false);
    }
  };

  const handlePrintStatement = () => {
    if (!guestRecord) return;
    const tableRows = arStatement.map(rec => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${rec.date ? new Date(rec.date).toLocaleDateString() + ' ' + new Date(rec.date).toLocaleTimeString() : 'N/A'}</td>
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
          <title>Prepayment Wallet Statement - ${guestRecord.first_name} ${guestRecord.last_name}</title>
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
              Name: ${guestRecord.first_name} ${guestRecord.last_name}<br />
              Email: ${guestRecord.email || 'N/A'}<br />
              Address: ${contactInfo.address}<br />
              Statement Compiled: ${new Date().toLocaleString()}
            </div>
            <div style="text-align: right;">
              <strong>Account Balance:</strong><br />
              <span style="font-size: 22px; font-weight: 900; color: #047857;">
                ₦${Number(guestRecord.wallet_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
            Thank you for choosing Sparkles Apartments.<br />
            For support or billing inquiries, please contact ${contactInfo.email}.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  if (loading) {
    return <div className="text-gray-400 p-8 text-center bg-dark-800 border border-dark-700 rounded-lg">Loading financial details...</div>;
  }

  const isWalletActive = guestRecord && guestRecord.wallet_balance !== null && guestRecord.wallet_balance !== undefined;

  return (
    <div className="space-y-8 text-white relative">
      <div>
        <h2 className="text-2xl font-semibold text-white">Prepayment & Wallet Financials</h2>
        <p className="text-gray-400 mt-1">Monitor cash deposits, track chronological room charge checkout deductions, and manage your digital luxury wallet.</p>
      </div>

      {!isWalletActive ? (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-10 text-center max-w-lg mx-auto shadow-xl space-y-4 animate-in zoom-in-95">
          <div className="w-16 h-16 bg-dark-900 rounded-full border border-dark-750 flex items-center justify-center mx-auto shadow">
            <Wallet size={32} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-bold text-white">Prepayment Wallet Inactive</h3>
          <p className="text-sm text-gray-400 max-w-xs mx-auto leading-normal">
            Your guest prepayment account receivable profile has not been activated yet. 
          </p>
          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
            Please contact the front desk or finance manager to activate your digital wallet to enable prepayment cash deposits, rapid checkouts, and charge routing.
          </p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Top Row: Luxury Gold Mesh Prepayment Card & Info Block */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* Card Widget */}
            <div className="relative bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-dark-900 border border-amber-500/20 p-6 rounded-2xl flex flex-col justify-between h-[250px] overflow-hidden shadow-2xl group transition-all duration-300 hover:border-amber-400/40">
              {/* Decorative Mesh Background */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent opacity-60"></div>
              
              <div className="flex justify-between items-start z-10">
                <div>
                  <p className="text-[10px] font-black uppercase text-amber-500/80 tracking-widest">Luxe Prepayment Account</p>
                  <p className="text-sm font-semibold text-gray-400 mt-0.5">AR-GUEST-{guestRecord.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <Wallet size={24} className="text-amber-500" />
              </div>
              
              <div className="z-10 mt-2">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Available Prepayment Balance</p>
                <div className="flex justify-between items-center mt-1.5">
                  <p className="text-3xl font-black text-amber-400 font-mono">₦{Number(guestRecord.wallet_balance).toLocaleString()}</p>
                  <button 
                    onClick={() => {
                      setAddFundsAmount('');
                      setAddFundsRef('');
                      setAddFundsMethod('paystack');
                      setIsAddFundsOpen(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-dark-950 font-bold py-1.5 px-3.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 z-20"
                  >
                    Add Funds
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-end z-10 text-xs border-t border-amber-500/15 pt-2">
                <span className="text-gray-400 font-medium capitalize">{guestRecord.first_name} {guestRecord.last_name}</span>
                <span className="text-amber-500 font-extrabold uppercase tracking-widest text-[9px] bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Active Wallet</span>
              </div>
            </div>

            {/* Loyalty/Telemetry Grid */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-dark-800 border border-dark-700 p-6 rounded-xl flex flex-col justify-between shadow-md">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Stay & Extras Prepayments</p>
                  <h4 className="text-lg font-bold text-white mt-1.5 leading-snug">Rapid Checkout Ledger Enabled</h4>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    With prepayments active, room rent and service charges are automatically reconciled, keeping your front desk wait times down to zero.
                  </p>
                </div>
                <div className="text-xs text-brand-500 font-bold flex items-center gap-1 mt-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span> Safe & Audited Accounts Receivable System
                </div>
              </div>

              <div className="bg-dark-800 border border-dark-700 p-6 rounded-xl flex flex-col justify-between shadow-md">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Loyalty Tier & Rank</p>
                  <h4 className="text-lg font-bold text-gold-500 mt-1.5 flex items-center gap-1.5">
                    🌟 Frequent Guest Program
                  </h4>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    Earn rewards and dynamic point pools for each night stayed. Prepayment bookings receive double multiplier points.
                  </p>
                </div>
                <div className="text-xs font-mono font-bold text-white flex justify-between items-center bg-dark-900 p-2 rounded border border-dark-750 mt-4">
                  <span className="text-gray-500 uppercase tracking-widest text-[9px]">Loyalty Balance</span>
                  <span className="text-gold-500 font-black">{guestRecord.loyalty_points || 0} Points</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chronological Prepayment Ledger Statement Table */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-dark-700/60 pb-4 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="text-amber-500" size={20} /> Transaction Ledger Statement
                </h3>
                <p className="text-xs text-gray-400 mt-1">Detailed list of prepayment cash deposits, bank transfers, and room folio check-out checkout deductions.</p>
              </div>
              <button 
                onClick={handlePrintStatement}
                className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-bold text-xs py-2.5 px-5 rounded-xl shadow flex items-center justify-center gap-1.5 self-start md:self-auto transition-all active:scale-95 hover:scale-102"
              >
                <Printer size={15} /> Print Prepayment Statement
              </button>
            </div>

            {loadingStatement ? (
              <div className="text-center p-12 text-gray-500 text-xs">Compiling transaction history...</div>
            ) : arStatement.length === 0 ? (
              <div className="text-center p-12 text-gray-500 text-xs bg-dark-900 rounded border border-dark-700/50">
                No ledger deposits or folio wallet deductions registered on your account yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-dark-700/50 bg-dark-900/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-dark-950 text-gray-400 border-b border-dark-700">
                    <tr>
                      <th className="p-4 font-semibold uppercase tracking-wider">Date / Time</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Transaction Details</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Payment Mode</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Type</th>
                      <th className="p-4 font-semibold uppercase tracking-wider text-right">Amount</th>
                      <th className="p-4 font-semibold uppercase tracking-wider text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-750">
                    {arStatement.map(rec => (
                      <tr key={rec.id} className="hover:bg-dark-800/25">
                        <td className="p-4 text-gray-400 font-mono text-[10px]">
                          {new Date(rec.date).toLocaleDateString()} {new Date(rec.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-white block">{rec.description}</span>
                          {rec.notes && <span className="text-[10px] text-gray-500 font-mono block mt-1">{rec.notes}</span>}
                        </td>
                        <td className="p-4 text-gray-400 uppercase font-mono text-[10px]">
                          {rec.method?.replace('_', ' ')}
                        </td>
                        <td className="p-4">
                          {rec.type === 'credit' ? (
                            <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase">
                              <ArrowUpRight size={10} /> Deposit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase">
                              <ArrowDownLeft size={10} /> Folio Charge
                            </span>
                          )}
                        </td>
                        <td className={`p-4 font-mono font-bold text-right text-[11px] ${rec.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                          {rec.type === 'credit' ? '+' : '-'}₦{rec.amount.toLocaleString()}
                        </td>
                        <td className="p-4 font-mono font-bold text-white text-right text-[11px]">
                          ₦{rec.running_balance.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {isAddFundsOpen && guestRecord && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 p-6 w-full max-w-md relative rounded-xl animate-in zoom-in-95 flex flex-col shadow-2xl">
            <button onClick={() => setIsAddFundsOpen(false)} className="absolute top-4 right-4 text-gray-450 hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Wallet className="text-brand-500" />
              <span>Add Prepayment Funds</span>
            </h2>
            <p className="text-xs text-gray-400 mb-6 uppercase tracking-wider font-bold">
              Secure Online Prepayment Gateway
            </p>
            
            <form onSubmit={handleAddFunds} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Payment Amount (₦) *</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  value={addFundsAmount}
                  onChange={e => setAddFundsAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Deposit Method *</label>
                <select 
                  required
                  value={addFundsMethod}
                  onChange={e => setAddFundsMethod(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-white outline-none focus:border-brand-500 text-sm font-semibold"
                >
                  <option value="paystack" className="bg-dark-900 text-white">Paystack (Online Card/USSD/Bank)</option>
                  <option value="bank_transfer" className="bg-dark-900 text-white">Direct Bank Transfer / Wire</option>
                </select>
              </div>

              {addFundsMethod === 'bank_transfer' ? (
                <div className="bg-dark-900/80 p-4 border border-dark-700/60 rounded-xl space-y-2 animate-in slide-in-from-top duration-300">
                  <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Hotel Bank Details:</span>
                  <div className="text-xs text-gray-300 space-y-1 font-mono">
                    <p><span className="text-gray-500 font-sans">Bank:</span> {bankDetails.bankName}</p>
                    <p><span className="text-gray-500 font-sans">Account Name:</span> {bankDetails.accountName}</p>
                    <p><span className="text-gray-500 font-sans">Account No:</span> {bankDetails.accountNumber}</p>
                  </div>
                  <div className="pt-2">
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">Bank Transfer Reference Number *</label>
                    <input 
                      required
                      type="text" 
                      value={addFundsRef}
                      onChange={e => setAddFundsRef(e.target.value)}
                      placeholder="e.g. TXN-ACCESS-0981726"
                      className="w-full bg-dark-800 border border-dark-750 p-2.5 rounded-lg text-white text-xs outline-none focus:border-brand-500"
                    />
                    <span className="text-[9px] text-gray-500 mt-1 block">Specify the bank transaction receipt reference for audit confirmation.</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl text-[11px] text-emerald-400 leading-normal animate-in slide-in-from-top duration-300">
                  🔒 Your online card transaction is secured with TLS 1.3 military-grade encryption. The mock gateway will instantly approve the prepayment credit balance.
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t border-dark-700/50">
                <button 
                  type="button"
                  onClick={() => setIsAddFundsOpen(false)}
                  className="bg-dark-900 border border-dark-700 hover:bg-dark-700 text-gray-300 font-bold py-2.5 px-4 text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isProcessingAddFunds || !addFundsAmount || (addFundsMethod === 'bank_transfer' && !addFundsRef)}
                  className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-dark-900 font-bold py-2.5 px-5 text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  {isProcessingAddFunds ? "Processing..." : "Confirm & Deposit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestFinancials;

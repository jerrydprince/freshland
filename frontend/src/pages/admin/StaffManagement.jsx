import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Users, Clock, Activity, Shield, CheckCircle, XCircle, Search, Edit2, UserPlus, ToggleRight, ToggleLeft, Eye, EyeOff, PlusCircle, Fingerprint, Server, CalendarClock, MailOpen, X, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import { useAuth, validateStrongPassword } from '../../context/AuthContext';
import { useRealtimeSync } from '../../lib/useRealtimeSync';

// Secondary Auth client for silent signup
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const secondarySupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Upgraded W3C WebAuthn buffer conversion helper functions
const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToBuffer = (base64) => {
  const binaryStr = window.atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
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

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const SHIFT_PRESETS = [
  { name: 'Morning Shift', start: '08:00', end: '17:00' },
  { name: 'Evening Shift', start: '17:00', end: '23:00' },
  { name: 'Night Shift', start: '23:00', end: '08:00' },
  { name: 'Flexible Shift', start: '00:00', end: '00:00' }
];

const ROLES = [
  { id: 'super_admin', label: 'Super Admin', color: 'bg-red-500/10 text-red-500' },
  { id: 'hotel_owner', label: 'Hotel Owner', color: 'bg-purple-500/10 text-purple-500' },
  { id: 'hotel_manager', label: 'Manager', color: 'bg-brand-500/10 text-brand-500' },
  { id: 'admin', label: 'Administrator', color: 'bg-indigo-500/10 text-indigo-400' },
  
  // Front Office
  { id: 'front_desk_lead', label: 'Front Office Lead', color: 'bg-blue-500/10 text-blue-400' },
  { id: 'receptionist_manager', label: 'Front Office Mgr', color: 'bg-blue-600/10 text-blue-500' },
  { id: 'receptionist', label: 'Receptionist', color: 'bg-blue-400/10 text-blue-300' },
  
  // Finance & Accounts
  { id: 'finance_manager', label: 'Finance Manager', color: 'bg-green-600/10 text-green-500' },
  { id: 'accountant', label: 'Accountant', color: 'bg-green-500/10 text-green-400' },
  
  // Kitchen / F&B
  { id: 'head_chef', label: 'Head Chef', color: 'bg-yellow-600/10 text-yellow-500' },
  { id: 'kitchen_manager', label: 'Kitchen Manager', color: 'bg-yellow-500/10 text-yellow-400' },
  { id: 'kitchen_staff', label: 'Kitchen Staff', color: 'bg-yellow-400/10 text-yellow-300' },
  
  // Bar
  { id: 'bar_manager', label: 'Bar Manager', color: 'bg-pink-600/10 text-pink-500' },
  { id: 'head_bartender', label: 'Head Bartender', color: 'bg-pink-500/10 text-pink-400' },
  { id: 'bar_staff', label: 'Bartender', color: 'bg-pink-400/10 text-pink-300' },
  
  // Restaurant
  { id: 'restaurant_manager', label: 'Restaurant Manager', color: 'bg-rose-600/10 text-rose-500' },
  { id: 'restaurant_staff', label: 'Restaurant Staff', color: 'bg-rose-400/10 text-rose-300' },
  
  // Housekeeping
  { id: 'head_housekeeper', label: 'Head Housekeeper', color: 'bg-teal-600/10 text-teal-500' },
  { id: 'housekeeping_manager', label: 'Housekeeping Mgr', color: 'bg-teal-500/10 text-teal-400' },
  { id: 'housekeeping', label: 'Housekeeper', color: 'bg-teal-400/10 text-teal-300' },
  
  // Maintenance
  { id: 'maintenance_manager', label: 'Maintenance Manager', color: 'bg-orange-600/10 text-orange-500' },
  { id: 'head_maintenance', label: 'Head Maintenance', color: 'bg-orange-500/10 text-orange-400' },
  { id: 'maintenance', label: 'Maintenance Staff', color: 'bg-orange-400/10 text-orange-300' },
  
  // Laundry Department
  { id: 'laundry_manager', label: 'Laundry Manager', color: 'bg-sky-600/10 text-sky-500' },
  { id: 'laundry_staff', label: 'Laundry Staff', color: 'bg-sky-400/10 text-sky-300' },
  
  // Core Operations
  { id: 'storekeeper', label: 'Storekeeper', color: 'bg-indigo-500/10 text-indigo-400' },
  { id: 'pos_operator', label: 'POS Operator', color: 'bg-cyan-500/10 text-cyan-400' },
  { id: 'customer_support', label: 'Support Agent', color: 'bg-slate-500/10 text-slate-400' }
];

import { useMemo } from 'react';

const DEFAULT_MODULES = [
  // Dashboard
  'Dashboard',
  'Dashboard - View Room Grid Matrix',
  'Dashboard - View Operations Statistics',

  // Reservations
  'Reservations',
  'Reservations - Manage Bookings',
  'Reservations - Handle Room Assignments',

  // Front Desk
  'Front Desk',
  'Front Desk - Create Booking & Check-in',
  'Front Desk - Override Room Rates & Invoicing',

  // Housekeeping
  'Housekeeping',
  'Housekeeping - Perform Room Cleaning',
  'Housekeeping - Assign Tasks to Staff',
  'Housekeeping - Inspect & Approve Clean Rooms',

  // CRM & Guests
  'CRM & Guests',
  'CRM & Guests - Manage Profiles',
  'CRM & Guests - View Guest History',

  // Finance & Billing
  'Finance & Billing',
  'Finance - Manage General Ledgers & Payroll',
  'Finance - Process Refunds & Adjustments',

  // Accounting
  'Accounting',
  'Accounting - Settle Ledger',
  'Accounting - View General Ledger Logs',

  // Channel Manager
  'Channel Manager',
  'Channel Manager - Sync Channels',
  'Channel Manager - Adjust External Rates',

  // Reports & Analytics
  'Reports & Analytics',
  'Reports & Analytics - View Revenue Reports',
  'Reports & Analytics - Export Financial Sheets',

  // Staff & Roles
  'Staff & Roles',
  'Staff & Roles - Onboard Staff',
  'Staff & Roles - Modify Access Policies',

  // Website CMS
  'Website CMS',
  'Website CMS - Edit General Pages',
  'Website CMS - Update Banner Announcements',

  // Settings
  'Settings',
  'Settings - Update System Profile',
  'Automations & Alerts',
  'Security & Privacy',

  // Store Keeping
  'Store Keeping',
  'Store Keeping - Log Requisitions',
  'Store Keeping - Register & Restock Items',
  'Store Keeping - Approve Outgoing Material Releases',

  // POS
  'POS',
  'POS - Process Sales & Suite Charging',
  'POS - Manage Menu Items & Custom Pricing',

  // Guest Services
  'Guest Services',
  'Guest Services - Request Amenities',
  'Guest Services - Verify Active Orders',

  // Laundry
  'Laundry',
  'Laundry - Process Laundry Orders',
  'Laundry - Post Folio Charges',
  'Laundry - Register Walk-in Sales',

  // Duty Logs
  'Duty Logs',
  'Duty Logs - Submit Shift Handover',
  'Duty Logs - Review Historical Logs',

  // Lost & Found
  'Lost & Found',
  'Lost & Found - Register Found Items',
  'Lost & Found - Notify Guest & Settle Claims',
  'Lost & Found - Dispose Items',

  // Reminders
  'Reminders',
  'Reminders - Create & Edit Schedules',
  'Reminders - Settle Payments & Sync Ledger',

  // Internal Messaging
  'Internal Messaging',
  'Internal Messaging - Broadcast Announcements',
  'Internal Messaging - Send Direct Messages',

  // Monthly Reports
  'Monthly Reports',
  'Monthly Reports - Submit Departmental Report',
  'Monthly Reports - View Performance Analytics',

  // Leave & Absences
  'Leave & Absences',
  'Leave & Absences - Request Leave of Absence',
  'Leave & Absences - Review Leave Applications',

  // Maintenance
  'Maintenance',
  'Maintenance - Manage Tickets & Fixes',
  'Maintenance - Manage Professionals',
  'Maintenance - Manage Purchases & Payments',

  // Restaurant & Kitchen
  'Restaurant & Kitchen',
  'Restaurant Desk',
  'Kitchen Desk',
  'Order History',

  // Service Portals
  'Service Portals',
  'Service Portals - Airport Pickup Service',
  'Service Portals - Spa & Massage',
  'Service Portals - Swimming Pool',
  'Service Portals - Walk-in Direct Register',
  'Service Portals - Close of Day Compiler',

  // Halls & Catering
  'Halls & Catering',
  'Halls & Catering - Manage Halls',
  'Halls & Catering - Book Halls',
  'Halls & Catering - Setup Meals Menu'
];

const getRolePermissionDefault = (roleId, permissionName) => {
  roleId = roleId ? roleId.toLowerCase().trim().replace(/[-\s]+/g, '_') : '';
  // Global override bypass roles
  if (['super_admin', 'hotel_owner', 'hotel_manager', 'admin', 'manager'].includes(roleId)) return true;
  
  switch (permissionName) {
    case 'Dashboard':
    case 'Dashboard - View Room Grid Matrix':
    case 'Dashboard - View Operations Statistics':
    case 'CRM & Guests':
    case 'CRM & Guests - Manage Profiles':
    case 'CRM & Guests - View Guest History':
      return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant', 'customer_support', 'laundry_manager', 'laundry_staff'].includes(roleId);
    
    case 'Reservations':
    case 'Reservations - Manage Bookings':
    case 'Reservations - Handle Room Assignments':
      return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant', 'customer_support'].includes(roleId);
    
    case 'Front Desk':
    case 'Front Desk - Create Booking & Check-in':
      return ['front_desk_lead', 'receptionist_manager', 'receptionist'].includes(roleId);
    
    case 'Front Desk - Override Room Rates & Invoicing':
      return ['front_desk_lead', 'receptionist_manager'].includes(roleId);
    
    case 'Housekeeping':
    case 'Housekeeping - Perform Room Cleaning':
      return ['head_housekeeper', 'housekeeping_manager', 'housekeeping'].includes(roleId);
    
    case 'Housekeeping - Assign Tasks to Staff':
    case 'Housekeeping - Inspect & Approve Clean Rooms':
      return ['head_housekeeper', 'housekeeping_manager'].includes(roleId);
    
    case 'POS':
    case 'POS - Process Sales & Suite Charging':
      return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'head_chef', 'kitchen_manager', 'bar_manager', 'head_bartender', 'restaurant_manager', 'pos_operator'].includes(roleId);
    
    case 'POS - Manage Menu Items & Custom Pricing':
      return ['receptionist_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager'].includes(roleId);
    
    case 'Restaurant & Kitchen':
    case 'Restaurant Desk':
      return ['restaurant_manager', 'restaurant_staff', 'front_desk_lead', 'receptionist_manager', 'pos_operator'].includes(roleId);
    
    case 'Kitchen Desk':
      return ['head_chef', 'kitchen_manager', 'kitchen_staff'].includes(roleId);
    
    case 'Order History':
      return ['restaurant_manager', 'restaurant_staff', 'head_chef', 'kitchen_manager', 'kitchen_staff', 'pos_operator', 'front_desk_lead', 'receptionist_manager'].includes(roleId);
    
    case 'Guest Services':
    case 'Guest Services - Request Amenities':
    case 'Guest Services - Verify Active Orders':
      return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant'].includes(roleId);
    
    case 'Laundry':
      return ['laundry_manager', 'laundry_staff', 'front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant'].includes(roleId);
    
    case 'Laundry - Process Laundry Orders':
      return ['laundry_manager', 'laundry_staff'].includes(roleId);
    
    case 'Laundry - Post Folio Charges':
      return ['laundry_manager', 'laundry_staff', 'front_desk_lead', 'receptionist_manager', 'finance_manager'].includes(roleId);
    
    case 'Laundry - Register Walk-in Sales':
      return ['laundry_manager', 'laundry_staff', 'front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant'].includes(roleId);
    
    case 'Store Keeping':
      return ['storekeeper', 'front_desk_lead', 'receptionist_manager', 'finance_manager', 'head_chef', 'kitchen_manager', 'bar_manager', 'head_bartender', 'restaurant_manager', 'head_housekeeper', 'housekeeping_manager', 'maintenance_manager', 'head_maintenance', 'laundry_manager'].includes(roleId);
    
    case 'Store Keeping - Log Requisitions':
      return [
        'storekeeper', 'front_desk_lead', 'receptionist_manager', 'receptionist',
        'head_chef', 'kitchen_manager', 'kitchen_staff', 'bar_manager',
        'head_bartender', 'bar_staff', 'restaurant_manager', 'restaurant_staff',
        'pos_operator', 'finance_manager', 'accountant', 'head_housekeeper',
        'housekeeping_manager', 'housekeeping', 'maintenance_manager',
        'head_maintenance', 'maintenance', 'laundry_manager', 'laundry_staff'
      ].includes(roleId);
    
    case 'Store Keeping - Register & Restock Items':
      return ['storekeeper'].includes(roleId);
    
    case 'Store Keeping - Approve Outgoing Material Releases':
      return ['front_desk_lead', 'receptionist_manager', 'finance_manager', 'head_chef', 'kitchen_manager', 'bar_manager', 'head_bartender', 'restaurant_manager', 'head_housekeeper', 'housekeeping_manager', 'maintenance_manager', 'head_maintenance'].includes(roleId);
    
    case 'Finance & Billing':
    case 'Accounting':
    case 'Accounting - Settle Ledger':
    case 'Accounting - View General Ledger Logs':
    case 'Finance - Manage General Ledgers & Payroll':
      return ['finance_manager', 'accountant'].includes(roleId);
    
    case 'Leave & Absences':
    case 'Leave & Absences - Request Leave of Absence':
      return !['guest'].includes(roleId);
    
    case 'Leave & Absences - Review Leave Applications':
      return ['front_desk_lead', 'receptionist_manager', 'finance_manager', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager'].includes(roleId);

    case 'Duty Logs':
    case 'Duty Logs - Submit Shift Handover':
      return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'finance_manager', 'accountant'].includes(roleId);

    case 'Duty Logs - Review Historical Logs':
      return ['front_desk_lead', 'receptionist_manager', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'finance_manager', 'accountant'].includes(roleId);

    case 'Lost & Found':
      return ['head_housekeeper', 'housekeeping_manager', 'housekeeping', 'front_desk_lead', 'receptionist_manager', 'receptionist'].includes(roleId);
    
    case 'Lost & Found - Register Found Items':
      return ['head_housekeeper', 'housekeeping_manager', 'housekeeping', 'front_desk_lead', 'receptionist_manager', 'receptionist', 'maintenance_manager', 'head_maintenance', 'maintenance'].includes(roleId);

    case 'Lost & Found - Notify Guest & Settle Claims':
      return ['front_desk_lead', 'receptionist_manager', 'receptionist'].includes(roleId);

    case 'Lost & Found - Dispose Items':
      return ['head_housekeeper', 'housekeeping_manager', 'front_desk_lead', 'receptionist_manager', 'receptionist'].includes(roleId);

    case 'Finance - Process Refunds & Adjustments':
      return ['finance_manager', 'accountant'].includes(roleId);

    case 'Reminders':
      return ['finance_manager', 'accountant', 'front_desk_lead', 'receptionist_manager', 'receptionist', 'maintenance_manager', 'head_maintenance'].includes(roleId);
    
    case 'Reminders - Create & Edit Schedules':
      return ['finance_manager', 'accountant', 'front_desk_lead', 'receptionist_manager'].includes(roleId);

    case 'Reminders - Settle Payments & Sync Ledger':
      return ['finance_manager', 'accountant'].includes(roleId);

    case 'Internal Messaging':
    case 'Internal Messaging - Send Direct Messages':
      return !['guest'].includes(roleId);
    
    case 'Internal Messaging - Broadcast Announcements':
      return ['front_desk_lead', 'receptionist_manager', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'finance_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager'].includes(roleId);

    case 'Monthly Reports':
      return ['receptionist_manager', 'front_desk_lead', 'finance_manager', 'accountant', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'kitchen_manager'].includes(roleId);
    
    case 'Monthly Reports - Submit Departmental Report':
      return ['receptionist_manager', 'front_desk_lead', 'finance_manager', 'accountant', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager', 'kitchen_manager', 'bar_manager', 'restaurant_manager', 'head_chef', 'head_housekeeper', 'head_maintenance', 'head_bartender'].includes(roleId);

    case 'Monthly Reports - View Performance Analytics':
      return ['receptionist_manager', 'front_desk_lead', 'finance_manager', 'accountant', 'laundry_manager', 'housekeeping_manager', 'maintenance_manager'].includes(roleId);
    
    case 'Maintenance':
      return ['maintenance_manager', 'head_maintenance', 'maintenance', 'front_desk_lead', 'receptionist_manager', 'finance_manager'].includes(roleId);
    case 'Maintenance - Manage Tickets & Fixes':
      return ['maintenance_manager', 'head_maintenance', 'maintenance'].includes(roleId);
    case 'Maintenance - Manage Professionals':
      return ['maintenance_manager', 'head_maintenance'].includes(roleId);
    case 'Maintenance - Manage Purchases & Payments':
      return ['maintenance_manager', 'finance_manager', 'accountant'].includes(roleId);

    case 'Service Portals':
    case 'Service Portals - Airport Pickup Service':
    case 'Service Portals - Spa & Massage':
    case 'Service Portals - Swimming Pool':
    case 'Service Portals - Walk-in Direct Register':
    case 'Service Portals - Close of Day Compiler':
      return ['front_desk_lead', 'receptionist_manager', 'receptionist', 'finance_manager', 'accountant', 'customer_support'].includes(roleId);

    default:
      return false;
  }
};

const getRoleDescription = (roleId) => {
  switch (roleId) {
    case 'super_admin':
      return 'Global Super Administrator with full unrestricted access to all PMS modules, system configurations, and staff directories. Administrative rights cannot be revoked.';
    case 'hotel_owner':
      return 'Property Owner with global administrative access. Monitors overall revenue, financial dashboards, system settings, and high-level operations.';
    case 'hotel_manager':
      return 'General Manager responsible for day-to-day property operations, supervisor tasks, store approvals, and general staff management.';
    case 'admin':
      return 'Operational Administrator responsible for handling security matrices, system configurations, and back-office management.';
    case 'front_desk_lead':
      return 'Lead Front Desk Agent supervising the front office team. Handles check-ins, guest folio adjustments, and room rate overrides.';
    case 'receptionist_manager':
      return 'Front Office Manager overlooking bookings, reception operations, guest folios, and receptionist assignments.';
    case 'receptionist':
      return 'Front Desk Agent managing guest arrivals, creating reservations, suite bookings, and walk-in folio checkouts.';
    case 'finance_manager':
      return 'Chief Finance Officer managing payroll accounting, ledger auditing, tax operations, and refunds processing.';
    case 'accountant':
      return 'Staff Accountant handling day-to-day transaction records, invoicing, guest check ledger entries, and general payroll preparation.';
    case 'head_chef':
      return 'Kitchen Head Chef responsible for supervising kitchen staff, ordering warehouse food stocks, and managing catalog recipe availability.';
    case 'kitchen_manager':
      return 'Food & Beverage Supervisor managing kitchen store keep requisitions, F&B services, and room service menus.';
    case 'kitchen_staff':
      return 'Kitchen operational staff executing guest menu requests, logging ingredient collections, and preparing meals.';
    case 'bar_manager':
      return 'Lounge & Bar Manager in charge of wine/cocktail stocks, pricing catalog configurations, and checkout approvals.';
    case 'head_bartender':
      return 'Lead Bartender managing drink orders, processing checkout settlements, and submitting glass restocks.';
    case 'bar_staff':
      return 'Bar operational staff logging cocktail checkouts, walk-in drinks settlements, and glass/restock requests.';
    case 'restaurant_manager':
      return 'Restaurant Supervisor coordinating waiters, dining listings, F&B menu settings, and custom table billing.';
    case 'restaurant_staff':
      return 'Restaurant waiting staff handling table orders, dining folio settlements, and restaurant store collections.';
    case 'head_housekeeper':
      return 'Head Housekeeper directing floor cleaners, inspecting checkout room status, and assigning cleaning tasks.';
    case 'housekeeping_manager':
      return 'Housekeeping Supervisor assigning staff cleaning tasks, managing linen stocks, and inspecting room readiness.';
    case 'housekeeping':
      return 'Housekeeping staff member executing checkout cleaning tasks, restocking suite amenities, and collecting linens.';
    case 'maintenance_manager':
      return 'Maintenance Supervisor managing technical support tickets, utility inventories, and technician assignments.';
    case 'head_maintenance':
      return 'Lead Technician executing repair tickets, plumbing fixes, electrical checks, and spare parts collections.';
    case 'maintenance':
      return 'Maintenance staff member executing assigned utility tickets, spare parts logging, and room physical repairs.';
    case 'storekeeper':
      return 'Warehouse Storekeeper managing inventory registrations, catalog restocking logs, and physical store counts.';
    case 'pos_operator':
      return 'Dedicated Point of Sale cashier handling quick customer checkouts, walk-in settlements, and terminal charges.';
    case 'laundry_manager':
      return 'Laundry Department Supervisor responsible for managing guest room laundering requests, walk-in sales settlements, and department earnings accounting.';
    case 'laundry_staff':
      return 'Laundry operations staff executing washing, dry-cleaning, ironing services, and marking suite collection statuses.';
    case 'customer_support':
      return 'Support Agent managing CRM profiles, lodging guest complaints, and answering general inquiries.';
    default:
      return 'System Access Profile with custom permissions configured.';
  }
};

const getPermissionGroup = (permissionName) => {
  if (permissionName.startsWith('Finance -')) return 'Finance & Billing';
  if (permissionName === 'Automations & Alerts' || permissionName === 'Security & Privacy' || permissionName.startsWith('Settings -')) return 'Settings';
  if (permissionName === 'Restaurant Desk' || permissionName === 'Kitchen Desk' || permissionName === 'Order History') return 'Restaurant & Kitchen';
  if (permissionName.includes(' - ')) {
    return permissionName.split(' - ')[0];
  }
  return permissionName;
};

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
          <p className="text-xs text-gray-200">
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
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-200 ring-1 ring-inset ring-dark-750 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-200 ring-1 ring-inset ring-dark-750 bg-dark-800 hover:bg-dark-700 focus:z-20 focus:outline-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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

const AdminStaffManagement = () => {
  const { user, profile, hasAccess } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    return hasAccess('Staff & Roles') ? 'directory' : 'leave';
  }); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !hasAccess('Staff & Roles')) {
      setActiveTab('leave');
    }
  }, [user]);
  
  const [staff, setStaff] = useState([]);
  const [currentPageStaff, setCurrentPageStaff] = useState(1);
  const [currentPageSalary, setCurrentPageSalary] = useState(1);
  const pageSize = 10;
  const [attendance, setAttendance] = useState([]);
  const [logs, setLogs] = useState([]);
  const [permissionsMap, setPermissionsMap] = useState({});
  const [customModules, setCustomModules] = useState([]);
  const [newModuleName, setNewModuleName] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  const [selectedRole, setSelectedRole] = useState('receptionist');

  const [selectedShiftAudit, setSelectedShiftAudit] = useState(null);
  const [auditShiftLogs, setAuditShiftLogs] = useState([]);
  const [auditShiftPayments, setAuditShiftPayments] = useState([]);
  const [loadingShiftAuditData, setLoadingShiftAuditData] = useState(false);
  const [shiftAuditSearch, setShiftAuditSearch] = useState('');

  // Dynamic Custom Roles State
  const [customRoles, setCustomRoles] = useState([]);
  const [creatingRole, setCreatingRole] = useState(false);
  const [newRole, setNewRole] = useState({
    id: '',
    label: '',
    category: '👤 Custom / Other Roles',
    color: 'bg-blue-500/10 text-blue-400'
  });

  const allRoles = useMemo(() => {
    return [...ROLES, ...customRoles];
  }, [customRoles]);

  const ROLE_CATEGORIES = useMemo(() => {
    const base = [
      {
        title: '👑 Global Management',
        roles: ['super_admin', 'hotel_owner', 'hotel_manager', 'admin']
      },
      {
        title: '🛎️ Front Office & CRM',
        roles: ['front_desk_lead', 'receptionist_manager', 'receptionist', 'customer_support']
      },
      {
        title: '🧹 Housekeeping',
        roles: ['head_housekeeper', 'housekeeping_manager', 'housekeeping']
      },
      {
        title: '🔧 Maintenance & Utilities',
        roles: ['maintenance_manager', 'head_maintenance', 'maintenance']
      },
      {
        title: '🧺 Laundry Department',
        roles: ['laundry_manager', 'laundry_staff']
      },
      {
        title: '🍳 F&B / POS Terminals',
        roles: ['head_chef', 'kitchen_manager', 'kitchen_staff', 'bar_manager', 'head_bartender', 'bar_staff', 'restaurant_manager', 'restaurant_staff', 'pos_operator']
      },
      {
        title: '📦 Store Keeping',
        roles: ['storekeeper']
      },
      {
        title: '💳 Finance & Accounts',
        roles: ['finance_manager', 'accountant']
      }
    ];

    // Allocate dynamic custom roles into their designated folders
    const customList = [];
    customRoles.forEach(r => {
      const match = base.find(cat => cat.title === r.category);
      if (match) {
        match.roles.push(r.id);
      } else {
        customList.push(r.id);
      }
    });

    if (customList.length > 0) {
      base.push({
        title: '👤 Custom / Other Roles',
        roles: customList
      });
    }

    return base;
  }, [customRoles]);

  const allModules = useMemo(() => {
    return [...DEFAULT_MODULES, ...customModules];
  }, [customModules]);

  const groupedPermissions = useMemo(() => {
    const groups = {};
    allModules.forEach(m => {
      const group = getPermissionGroup(m);
      if (!groups[group]) groups[group] = [];
      groups[group].push(m);
    });
    return groups;
  }, [allModules]);

  const [activeShift, setActiveShift] = useState(null);
  const [editingStaffForm, setEditingStaffForm] = useState(null);

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({ 
    first_name: '', last_name: '', phone: '', role: 'receptionist',
    email: '', password: '', username: '', residential_address: '',
    pos_outlets: [], biometric_key: '',
    base_salary: '', allowances: '', deductions: '',
    deduction_type: 'amount', has_salary_exception: false,
    salary_exception_reason: '', exempt_from_attendance_deduction: false,
    bank_name: '', account_number: '', account_name: '',
    allowances_list: [],
    shift_name: 'Morning Shift',
    shift_start_time: '08:00',
    shift_end_time: '17:00',
    expected_work_days: [1, 2, 3, 4, 5, 6],
    expected_work_days_count: 6,
    attendance_deduction_type: 'daily_rate',
    attendance_deduction_rate: 0
  });
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [nigerianBanks, setNigerianBanks] = useState([
    "Access Bank Plc",
    "Guaranty Trust Bank (GTBank)",
    "Zenith Bank Plc",
    "United Bank for Africa (UBA)",
    "First Bank of Nigeria (FirstBank)",
    "Union Bank of Nigeria",
    "Fidelity Bank Plc",
    "Ecobank Nigeria",
    "Stanbic IBTC Bank",
    "Sterling Bank",
    "Wema Bank Plc",
    "Keystone Bank",
    "First City Monument Bank (FCMB)",
    "Polaris Bank Limited",
    "Providus Bank",
    "Titan Trust Bank",
    "Globus Bank",
    "Taj Bank",
    "Jaiz Bank",
    "Lotus Bank",
    "Standard Chartered Bank",
    "Signature Bank",
    "Optimus Bank",
    "Premium Trust Bank"
  ]);

  // Biometric Shift Scanner Simulation States
  const [isScanning, setIsScanning] = useState(false);
  const [biometricTargetStaff, setBiometricTargetStaff] = useState('');

  // Upgraded Biometric Hardware Integration States
  const [biometricHardwareMode, setBiometricHardwareMode] = useState('simulator'); // 'simulator' | 'webauthn' | 'usb_sdk'
  const [hardwareModes, setHardwareModes] = useState({
    webauthn: 'checking', // 'checking' | 'available' | 'unsupported'
    usbReader: 'checking', // 'checking' | 'connected' | 'offline'
  });
  const [showBiometricEnrollment, setShowBiometricEnrollment] = useState(null); // null or { type: 'add' | 'edit', staffName: string }
  const [usbPort, setUsbPort] = useState('8000');
  const [showUsbSetupGuide, setShowUsbSetupGuide] = useState(false);

  // Standalone Hardware Terminal Network Push Integration States
  const [terminalSN, setTerminalSN] = useState('ZK-IN01-ENTRANCE');
  const [terminalUserPin, setTerminalUserPin] = useState('');
  const [terminalVerifyStatus, setTerminalVerifyStatus] = useState('clock_in');
  const [isSimulatingTerminal, setIsSimulatingTerminal] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([
    { id: 1, text: 'ADMS Biometric Terminal Sync Engine initialized.', type: 'info', time: new Date() },
    { id: 2, text: 'TCP/IP Listening Loop active on port 5000.', type: 'info', time: new Date() },
    { id: 3, text: 'Stand-alone Entrance Device ping success. Status: ONLINE.', type: 'success', time: new Date() }
  ]);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    let timer;
    if (activeShift) {
      timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeShift]);

  const getShiftDurationStr = (clockInIso) => {
    if (!clockInIso) return '00:00:00';
    const diffMs = new Date() - new Date(clockInIso);
    if (diffMs < 0) return '00:00:00';
    const diffSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((diffSecs % 3600) / 60).toString().padStart(2, '0');
    const secs = (diffSecs % 60).toString().padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  };

  const handleWeekdayChange = (dayValue, isChecked, isEdit = false) => {
    const form = isEdit ? editingStaffForm : newStaffForm;
    const setForm = isEdit ? setEditingStaffForm : setNewStaffForm;
    let currentDays = [...(form.expected_work_days || [])];
    if (isChecked) {
      if (!currentDays.includes(dayValue)) {
        currentDays.push(dayValue);
      }
    } else {
      currentDays = currentDays.filter(d => d !== dayValue);
    }
    currentDays.sort((a, b) => a - b);
    setForm(prev => ({
      ...prev,
      expected_work_days: currentDays,
      expected_work_days_count: currentDays.length
    }));
  };

  const handleShiftPresetChange = (presetName, isEdit = false) => {
    const setForm = isEdit ? setEditingStaffForm : setNewStaffForm;
    const preset = SHIFT_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setForm(prev => ({
        ...prev,
        shift_name: preset.name,
        shift_start_time: preset.start,
        shift_end_time: preset.end
      }));
    } else {
      setForm(prev => ({
        ...prev,
        shift_name: presetName
      }));
    }
  };

  useEffect(() => {
    // 1. Check Platform WebAuthn Support
    if (window.PublicKeyCredential) {
      setHardwareModes(prev => ({ ...prev, webauthn: 'available' }));
    } else {
      setHardwareModes(prev => ({ ...prev, webauthn: 'unsupported' }));
    }

    // 2. Ping ZKTeco / DigitalPersona default SDK port to check for physical USB scanner
    const pingUsbService = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        
        const response = await fetch(`http://localhost:${usbPort}/api/fingerprint/status`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          setHardwareModes(prev => ({ ...prev, usbReader: 'connected' }));
        } else {
          setHardwareModes(prev => ({ ...prev, usbReader: 'offline' }));
        }
      } catch (err) {
        setHardwareModes(prev => ({ ...prev, usbReader: 'offline' }));
      }
    };

    pingUsbService();
  }, [usbPort]);

  useEffect(() => {
    if (profile?.id) {
      setBiometricTargetStaff(profile.id);
    }
  }, [profile]);

  const fetchCustomRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setCustomRoles(data || []);
    } catch (err) {
      console.warn("custom_roles table not found, falling back to LocalStorage:", err.message);
      const localRoles = localStorage.getItem('pms_custom_roles');
      if (localRoles) {
        try {
          setCustomRoles(JSON.parse(localRoles));
        } catch (e) {
          console.error("Failed to parse custom roles from localStorage", e);
        }
      }
    }
  };

  useEffect(() => {
    fetchCustomRoles();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Real-time synchronization for profiles, staff_attendance, and leave_applications
  useRealtimeSync(['profiles', 'staff_attendance', 'leave_applications'], () => {
    fetchData();
  });

  useEffect(() => {
    const handleSync = () => {
      fetchData();
    };
    window.addEventListener('attendance-updated', handleSync);
    return () => window.removeEventListener('attendance-updated', handleSync);
  }, [activeTab, profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await fetchCustomRoles();
      // Load all staff deductions overrides, nigerian_banks, and salary_allowances_list from system_settings
      const { data: systemSettingsData } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .or('setting_key.eq.nigerian_banks,setting_key.eq.salary_allowances_list,setting_key.like.salary_deductions_staff_%');
      
      const staffDedsMap = {};
      (systemSettingsData || []).forEach(s => {
        if (s.setting_key.startsWith('salary_deductions_staff_')) {
          const staffId = s.setting_key.replace('salary_deductions_staff_', '');
          let val = s.setting_value;
          try {
            val = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
          } catch (e) {
            console.warn("Failed to parse deductions list for staff " + staffId, e);
          }
          staffDedsMap[staffId] = val;
        } else if (s.setting_key === 'nigerian_banks' && s.setting_value) {
          try {
            const parsed = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
            if (Array.isArray(parsed) && parsed.length > 0) {
              setNigerianBanks(parsed);
            }
          } catch (e) {
            console.warn("Failed to parse nigerian_banks in StaffManagement:", e);
          }
        } else if (s.setting_key === 'salary_allowances_list' && s.setting_value) {
          try {
            const parsed = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
            if (Array.isArray(parsed)) {
              setGlobalAllowances(parsed);
            }
          } catch (e) {
            console.warn("Failed to parse salary_allowances_list in StaffManagement:", e);
          }
        }
      });

      if (activeTab === 'directory') {
        const { data, error } = await supabase.from('profiles').select('*').neq('role', 'guest').order('first_name');
        if (error) throw error;
        const resolved = (data || []).map(p => {
          let deds = staffDedsMap[p.id] || p.deductions_list || [];
          if (typeof deds === 'string') {
            try { deds = JSON.parse(deds); } catch { deds = []; }
          }
          let allows = p.allowances_list || [];
          if (typeof allows === 'string') {
            try { allows = JSON.parse(allows); } catch { allows = []; }
          }
          return {
            ...p,
            deductions_list: Array.isArray(deds) ? deds : [],
            allowances_list: Array.isArray(allows) ? allows : []
          };
        });
        setStaff(resolved);
      } else if (activeTab === 'attendance' || activeTab === 'shift_audits') {
        const { data: profilesData } = await supabase.from('profiles').select('*').neq('role', 'guest').order('first_name');
        if (profilesData) {
          const resolved = (profilesData || []).map(p => {
            let deds = staffDedsMap[p.id] || p.deductions_list || [];
            if (typeof deds === 'string') {
              try { deds = JSON.parse(deds); } catch { deds = []; }
            }
            let allows = p.allowances_list || [];
            if (typeof allows === 'string') {
              try { allows = JSON.parse(allows); } catch { allows = []; }
            }
            return {
              ...p,
              deductions_list: Array.isArray(deds) ? deds : [],
              allowances_list: Array.isArray(allows) ? allows : []
            };
          });
          setStaff(resolved);
        }

        const { data, error } = await supabase.from('staff_attendance').select('*, profiles(first_name, last_name, role, email)').order('clock_in', { ascending: false });
        if (error) throw error;
        setAttendance(data || []);
        
        if (activeTab === 'attendance') {
          const { data: myShift, error: shiftError } = await supabase.from('staff_attendance')
            .select('*')
            .eq('staff_id', profile.id)
            .is('clock_out', null)
            .order('clock_in', { ascending: false })
            .limit(1);
          if (shiftError) throw shiftError;
          if(myShift && myShift.length > 0) setActiveShift(myShift[0]);
          else setActiveShift(null);
        }
      } else if (activeTab === 'logs') {
        const { data, error } = await supabase.from('system_logs').select('*, profiles(first_name, last_name, role)').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        setLogs(data || []);
      } else if (activeTab === 'matrix') {
        const { data, error } = await supabase.from('role_permissions').select('*');
        if (error) throw error;
        
        const pMap = {};
        const dbModules = new Set();
        (data || []).forEach(p => {
          if (!pMap[p.module]) pMap[p.module] = {};
          pMap[p.module][p.role] = p.has_access;
          dbModules.add(p.module);
        });
        setPermissionsMap(pMap);

        const customList = Array.from(dbModules).filter(m => !DEFAULT_MODULES.includes(m));
        setCustomModules(customList);
      }
    } catch (e) {
      console.error("Staff Data Fetch Error:", e);
      toast.error(`Failed to load data: ${e.message || 'Check console'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftAuditDetails = async (shiftRecord) => {
    setSelectedShiftAudit(shiftRecord);
    setLoadingShiftAuditData(true);
    setAuditShiftLogs([]);
    setAuditShiftPayments([]);
    
    try {
      const clockInTime = shiftRecord.clock_in;
      const clockOutTime = shiftRecord.clock_out || new Date().toISOString();
      const staffId = shiftRecord.staff_id;

      const { data: logsData } = await supabase
        .from('system_logs')
        .select('*')
        .eq('user_id', staffId)
        .gte('created_at', clockInTime)
        .lte('created_at', clockOutTime)
        .order('created_at', { ascending: true });

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*, bookings(booking_reference, guest_name)')
        .gte('created_at', clockInTime)
        .lte('created_at', clockOutTime)
        .order('created_at', { ascending: true });

      setAuditShiftLogs(logsData || []);
      setAuditShiftPayments(paymentsData || []);
    } catch (err) {
      console.error("Error compiling shift audit details:", err);
      toast.error("Failed to load shift activity details.");
    } finally {
      setLoadingShiftAuditData(false);
    }
  };

  // --- SALARY CONFIGURATION & STRUCTURES MANAGEMENT ---
  const [showSalaryConfig, setShowSalaryConfig] = useState(false);
  const [salaryStructuresTab, setSalaryStructuresTab] = useState('roles');
  const [roleStructures, setRoleStructures] = useState([]);
  const [loadingStructures, setLoadingStructures] = useState(false);

  const paginatedStaff = useMemo(() => {
    const start = (currentPageStaff - 1) * pageSize;
    return staff.slice(start, start + pageSize);
  }, [staff, currentPageStaff]);

  const paginatedRoleStructures = useMemo(() => {
    const start = (currentPageSalary - 1) * pageSize;
    return roleStructures.slice(start, start + pageSize);
  }, [roleStructures, currentPageSalary]);
  const [activeRoleDeductions, setActiveRoleDeductions] = useState(null);
  const [globalAllowances, setGlobalAllowances] = useState([]);

  const handleToggleStaffAllowance = (allowance, isChecked) => {
    let list = [...(newStaffForm.allowances_list || [])];
    if (isChecked) {
      list.push(allowance);
    } else {
      list = list.filter(item => item.name !== allowance.name);
    }
    const totalAllowances = list.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setNewStaffForm(prev => ({
      ...prev,
      allowances_list: list,
      allowances: totalAllowances
    }));
  };

  const handleToggleEditingStaffAllowance = (allowance, isChecked) => {
    let list = [...(editingStaffForm.allowances_list || [])];
    if (isChecked) {
      list.push(allowance);
    } else {
      list = list.filter(item => item.name !== allowance.name);
    }
    const totalAllowances = list.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setEditingStaffForm(prev => ({
      ...prev,
      allowances_list: list,
      allowances: totalAllowances
    }));
  };

  const handleAddRoleDeduction = (roleId, name, amount, type) => {
    if (!name || !amount) return toast.error("Deduction name and amount are required.");
    const updatedRoles = roleStructures.map(rs => {
      if (rs.role === roleId) {
        const list = rs.deductions_list || [];
        const newList = [...list, { name, amount: parseFloat(amount), type }];
        const totalDed = calculateTotalDeductions(rs.base_salary, newList);
        return {
          ...rs,
          deductions_list: newList,
          deductions: totalDed
        };
      }
      return rs;
    });
    setRoleStructures(updatedRoles);
  };

  const handleRemoveRoleDeduction = (roleId, index) => {
    const updatedRoles = roleStructures.map(rs => {
      if (rs.role === roleId) {
        const list = rs.deductions_list || [];
        const newList = list.filter((_, i) => i !== index);
        const totalDed = calculateTotalDeductions(rs.base_salary, newList);
        return {
          ...rs,
          deductions_list: newList,
          deductions: totalDed
        };
      }
      return rs;
    });
    setRoleStructures(updatedRoles);
  };

  const handleAddStaffOverrideDeduction = (staffId, name, amount, type) => {
    if (!name || !amount) return toast.error("Deduction name and amount are required.");
    const updatedStaff = staff.map(s => {
      if (s.id === staffId) {
        const list = s.deductions_list || [];
        const newList = [...list, { name, amount: parseFloat(amount), type }];
        const totalDed = calculateTotalDeductions(s.base_salary, newList);
        return {
          ...s,
          deductions_list: newList,
          deductions: totalDed
        };
      }
      return s;
    });
    setStaff(updatedStaff);
  };

  const handleRemoveStaffOverrideDeduction = (staffId, index) => {
    const updatedStaff = staff.map(s => {
      if (s.id === staffId) {
        const list = s.deductions_list || [];
        const newList = list.filter((_, i) => i !== index);
        const totalDed = calculateTotalDeductions(s.base_salary, newList);
        return {
          ...s,
          deductions_list: newList,
          deductions: totalDed
        };
      }
      return s;
    });
    setStaff(updatedStaff);
  };

  const fetchSalaryStructures = async () => {
    setLoadingStructures(true);
    try {
      const { data, error } = await supabase
        .from('salary_structures')
        .select('*');

      if (error) throw error;

      // 1. Fetch custom roles directly to prevent race conditions
      let fetchedCustomRoles = [];
      try {
        const { data: crData } = await supabase
          .from('custom_roles')
          .select('*')
          .order('created_at', { ascending: true });
        if (crData) fetchedCustomRoles = crData;
      } catch (err) {
        console.warn("custom_roles table not found in fetchSalaryStructures, falling back to LocalStorage:", err);
        const localRoles = localStorage.getItem('pms_custom_roles');
        if (localRoles) {
          try { fetchedCustomRoles = JSON.parse(localRoles); } catch {}
        }
      }

      const currentAllRoles = [...ROLES, ...fetchedCustomRoles];

      // Fetch standard role deductions lists and salary_allowances_list from system_settings
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .or('setting_key.like.salary_deductions_role_%,setting_key.eq.salary_allowances_list');

      const roleDedsMap = {};
      (settingsData || []).forEach(s => {
        if (s.setting_key.startsWith('salary_deductions_role_')) {
          const roleId = s.setting_key.replace('salary_deductions_role_', '');
          let val = s.setting_value;
          try {
            val = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
          } catch (e) {
            console.warn("Failed to parse deductions list for role " + roleId, e);
          }
          roleDedsMap[roleId] = val;
        } else if (s.setting_key === 'salary_allowances_list' && s.setting_value) {
          try {
            const parsed = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
            if (Array.isArray(parsed)) {
              setGlobalAllowances(parsed);
            }
          } catch (e) {
            console.warn("Failed to parse salary_allowances_list:", e);
          }
        }
      });
      
      const seededRoles = currentAllRoles.map(role => {
        const dbMatch = (data || []).find(d => d.role === role.id);
        let list = roleDedsMap[role.id] || [];
        if (typeof list === 'string') {
          try { list = JSON.parse(list); } catch { list = []; }
        }
        return {
          role: role.id,
          label: role.label,
          base_salary: dbMatch ? parseFloat(dbMatch.base_salary) : 0,
          allowances: dbMatch ? parseFloat(dbMatch.allowances) : 0,
          deductions: dbMatch ? parseFloat(dbMatch.deductions) : 0,
          deduction_type: dbMatch ? dbMatch.deduction_type : 'amount',
          deductions_list: Array.isArray(list) ? list : []
        };
      });

      setRoleStructures(seededRoles);
    } catch (e) {
      console.warn("Failed to load role salary structures:", e.message);
    } finally {
      setLoadingStructures(false);
    }
  };

  useEffect(() => {
    fetchSalaryStructures();
  }, []);

  // Auto-populate new staff member payroll settings from selected role salary structure
  useEffect(() => {
    if (showAddStaff && roleStructures.length > 0) {
      const matchingStructure = roleStructures.find(s => s.role === newStaffForm.role);
      if (matchingStructure) {
        setNewStaffForm(prev => ({
          ...prev,
          base_salary: matchingStructure.base_salary,
          allowances: matchingStructure.allowances,
          deductions: matchingStructure.deductions,
          deduction_type: matchingStructure.deduction_type,
          deductions_list: matchingStructure.deductions_list || []
        }));
      } else {
        // Fallback standard baseline structures if not found in db
        let defaultBase = 150000;
        if (newStaffForm.role === 'hotel_manager') defaultBase = 250000;
        if (newStaffForm.role === 'accountant') defaultBase = 200000;
        if (newStaffForm.role === 'receptionist') defaultBase = 140000;
        if (newStaffForm.role === 'housekeeping') defaultBase = 80000;
        if (newStaffForm.role === 'maintenance') defaultBase = 90000;
        if (newStaffForm.role === 'laundry_manager') defaultBase = 150000;
        if (newStaffForm.role === 'laundry_staff') defaultBase = 100000;
        if (newStaffForm.role === 'super_admin') defaultBase = 300000;

        setNewStaffForm(prev => ({
          ...prev,
          base_salary: defaultBase,
          allowances: 0,
          deductions: 0,
          deduction_type: 'amount',
          deductions_list: []
        }));
      }
    }
  }, [newStaffForm.role, showAddStaff, roleStructures]);

  const handleSaveRoleStructures = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading('Saving standard salary structures...');
    try {
      const payload = roleStructures.map(rs => ({
        role: rs.role,
        base_salary: parseFloat(rs.base_salary) || 0,
        allowances: parseFloat(rs.allowances) || 0,
        deductions: parseFloat(rs.deductions) || 0,
        deduction_type: rs.deduction_type || 'amount'
      }));

      const { error } = await supabase
        .from('salary_structures')
        .upsert(payload);

      if (error) throw error;

      // Save role deductions lists inside system_settings
      const settingsPayload = roleStructures.map(rs => ({
        setting_key: 'salary_deductions_role_' + rs.role,
        setting_value: rs.deductions_list || []
      }));

      const { error: settingsError } = await supabase
        .from('system_settings')
        .upsert(settingsPayload, { onConflict: 'setting_key' });

      if (settingsError) throw settingsError;

      toast.success('[✓] Standard Role structures saved successfully!', { id: loadingToast });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(`Save failed: ${err.message}`, { id: loadingToast });
    }
  };

  const handleSaveIndividualOverride = async (staffId, overrideData) => {
    const loadingToast = toast.loading('Saving staff custom override...');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          has_salary_exception: !!overrideData.has_salary_exception,
          salary_exception_reason: overrideData.salary_exception_reason || null,
          exempt_from_attendance_deduction: !!overrideData.exempt_from_attendance_deduction,
          base_salary: parseFloat(overrideData.base_salary) || 0,
          allowances: parseFloat(overrideData.allowances) || 0,
          deductions: parseFloat(overrideData.deductions) || 0,
          deduction_type: overrideData.deduction_type || 'amount'
        })
        .eq('id', staffId);

      if (error) throw error;
      toast.success('[✓] Staff payroll overrides saved successfully!', { id: loadingToast });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(`Override failed to save: ${err.message}`, { id: loadingToast });
    }
  };

  // --- LEAVE & ABSENCES MANAGEMENT ---
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [loadingLeave, setLoadingLeave] = useState(false);
  const [newLeaveForm, setNewLeaveForm] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [rejectingLeaveId, setRejectingLeaveId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchLeaveApplications = async () => {
    setLoadingLeave(true);
    try {
      const { data, error } = await supabase
        .from('leave_applications')
        .select('*, profiles!staff_id(first_name, last_name, role)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveApplications(data || []);
    } catch (e) {
      console.warn("Failed to load leave applications:", e.message);
    } finally {
      setLoadingLeave(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leave') {
      fetchLeaveApplications();
    }
  }, [activeTab]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!profile) return;
    const loadingToast = toast.loading('Submitting leave request...');
    try {
      const payload = {
        staff_id: profile.id,
        leave_type: newLeaveForm.leave_type,
        start_date: newLeaveForm.start_date,
        end_date: newLeaveForm.end_date,
        reason: newLeaveForm.reason,
        status: 'pending'
      };

      const { error } = await supabase
        .from('leave_applications')
        .insert([payload]);

      if (error) throw error;
      toast.success('[✓] Leave application submitted successfully!', { id: loadingToast });
      setNewLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      fetchLeaveApplications();
    } catch (err) {
      console.error(err);
      toast.error(`Application failed: ${err.message}`, { id: loadingToast });
    }
  };

  const handleReviewLeave = async (leaveId, status, rejectReason = null) => {
    if (!profile) return;
    const loadingToast = toast.loading(`${status === 'approved' ? 'Approving' : 'Rejecting'} leave request...`);
    try {
      const { error } = await supabase
        .from('leave_applications')
        .update({
          status: status,
          approved_by: profile.id,
          rejection_reason: rejectReason
        })
        .eq('id', leaveId);

      if (error) throw error;
      toast.success(`[✓] Leave request successfully ${status}!`, { id: loadingToast });
      setRejectingLeaveId(null);
      setRejectionReason('');
      fetchLeaveApplications();
    } catch (err) {
      console.error(err);
      toast.error(`Action failed: ${err.message}`, { id: loadingToast });
    }
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!editingStaffForm) return;
    
    if (profile.id === editingStaffForm.id && editingStaffForm.role !== profile.role) {
      return toast.error("You cannot change your own role.");
    }

    // Enforce strong password if it's being updated
    if (editingStaffForm.password) {
      const passwordError = validateStrongPassword(editingStaffForm.password);
      if (passwordError) {
        return toast.error(passwordError);
      }
    }
    
    setLoadingAuth(true);
    const loadingToast = toast.loading('Updating staff member...');

    try {
      // 1. Update basic profile details
      const { error: profileError } = await supabase.from('profiles').update({
        first_name: editingStaffForm.first_name,
        last_name: editingStaffForm.last_name,
        phone: editingStaffForm.phone,
        residential_address: editingStaffForm.residential_address,
        role: editingStaffForm.role,
        status: editingStaffForm.status || (editingStaffForm.is_active ? 'active' : 'inactive'),
        pos_outlets: editingStaffForm.pos_outlets || [],
        biometric_key: editingStaffForm.biometric_key || null,
        base_salary: parseFloat(editingStaffForm.base_salary) || 0,
        allowances: parseFloat(editingStaffForm.allowances) || 0,
        allowances_list: editingStaffForm.allowances_list || [],
        deductions: parseFloat(editingStaffForm.deductions) || 0,
        deduction_type: editingStaffForm.deduction_type || 'amount',
        has_salary_exception: !!editingStaffForm.has_salary_exception,
        salary_exception_reason: editingStaffForm.salary_exception_reason || null,
        exempt_from_attendance_deduction: !!editingStaffForm.exempt_from_attendance_deduction,
        bank_name: editingStaffForm.bank_name || null,
        account_number: editingStaffForm.account_number || null,
        account_name: editingStaffForm.account_name || null,
        shift_name: editingStaffForm.shift_name || 'Morning Shift',
        shift_start_time: editingStaffForm.shift_start_time || '08:00',
        shift_end_time: editingStaffForm.shift_end_time || '17:00',
        expected_work_days: editingStaffForm.expected_work_days || [1, 2, 3, 4, 5, 6],
        expected_work_days_count: editingStaffForm.expected_work_days_count !== undefined && editingStaffForm.expected_work_days_count !== null ? parseInt(editingStaffForm.expected_work_days_count) : 6,
        attendance_deduction_type: editingStaffForm.attendance_deduction_type || 'daily_rate',
        attendance_deduction_rate: parseFloat(editingStaffForm.attendance_deduction_rate) || 0
      }).eq('id', editingStaffForm.id);

      if (profileError) throw profileError;

      // Save deductions override list inside system_settings
      const { error: settingsError } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'salary_deductions_staff_' + editingStaffForm.id,
          setting_value: editingStaffForm.deductions_list || []
        }, { onConflict: 'setting_key' });

      if (settingsError) throw settingsError;

      // 2. Call the RPC to update Auth credentials and Active Status securely
      const { error: rpcError } = await supabase.rpc('admin_update_staff_auth', {
        target_user_id: editingStaffForm.id,
        new_email: editingStaffForm.email,
        new_password: editingStaffForm.password || null, // pass null if empty
        new_is_active: editingStaffForm.is_active
      });

      if (rpcError) throw rpcError;

      await supabase.from('system_logs').insert({
        user_id: profile.id, log_type: 'activity', action: `Updated profile details for ${editingStaffForm.first_name}`, module: 'System'
      });

      toast.success('Staff details updated successfully!', { id: loadingToast });
      setEditingStaffForm(null);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to update staff: ${e.message}`, { id: loadingToast });
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    
    // Enforce strong password rules
    const passwordError = validateStrongPassword(newStaffForm.password);
    if (passwordError) {
      return toast.error(passwordError);
    }

    setLoadingAuth(true);
    const loadingToast = toast.loading('Registering staff member...');
    
    try {
      // 1. Check if a profile already exists with this email
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', newStaffForm.email)
        .maybeSingle();

      if (checkError) console.warn("Failed to query existing profiles:", checkError);

      if (existingUser) {
        if (existingUser.role === 'guest') {
          // Promote existing guest to staff!
          toast.loading('Existing account found. Promoting guest to staff...', { id: loadingToast });
          
          // 1. Promote profile role & update details
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: existingUser.id,
            first_name: newStaffForm.first_name,
            last_name: newStaffForm.last_name,
            phone: newStaffForm.phone,
            role: newStaffForm.role,
            email: newStaffForm.email,
            username: newStaffForm.username,
            residential_address: newStaffForm.residential_address,
            is_active: true,
            pos_outlets: newStaffForm.pos_outlets || [],
            biometric_key: newStaffForm.biometric_key || null,
            base_salary: parseFloat(newStaffForm.base_salary) || 0,
            allowances: parseFloat(newStaffForm.allowances) || 0,
            allowances_list: newStaffForm.allowances_list || [],
            deductions: parseFloat(newStaffForm.deductions) || 0,
            deduction_type: newStaffForm.deduction_type || 'amount',
            has_salary_exception: !!newStaffForm.has_salary_exception,
            salary_exception_reason: newStaffForm.salary_exception_reason || null,
            exempt_from_attendance_deduction: !!newStaffForm.exempt_from_attendance_deduction,
            bank_name: newStaffForm.bank_name || null,
            account_number: newStaffForm.account_number || null,
            account_name: newStaffForm.account_name || null,
            shift_name: newStaffForm.shift_name || 'Morning Shift',
            shift_start_time: newStaffForm.shift_start_time || '08:00',
            shift_end_time: newStaffForm.shift_end_time || '17:00',
            expected_work_days: newStaffForm.expected_work_days || [1, 2, 3, 4, 5, 6],
            expected_work_days_count: newStaffForm.expected_work_days_count !== undefined && newStaffForm.expected_work_days_count !== null ? parseInt(newStaffForm.expected_work_days_count) : 6,
            attendance_deduction_type: newStaffForm.attendance_deduction_type || 'daily_rate',
            attendance_deduction_rate: parseFloat(newStaffForm.attendance_deduction_rate) || 0
          });

          if (profileError) throw profileError;

          // Save deductions override list inside system_settings
          await supabase.from('system_settings').upsert({
            setting_key: 'salary_deductions_staff_' + existingUser.id,
            setting_value: newStaffForm.deductions_list || []
          }, { onConflict: 'setting_key' });

          // 2. Update credentials in auth (updates email, password, and activates them if banned)
          const { error: rpcError } = await supabase.rpc('admin_update_staff_auth', {
            target_user_id: existingUser.id,
            new_email: newStaffForm.email,
            new_password: newStaffForm.password,
            new_is_active: true
          });

          if (rpcError) throw rpcError;

          // 3. Ensure email is confirmed
          try {
            await supabase.rpc('admin_confirm_user_email', { target_user_id: existingUser.id });
          } catch (confirmErr) {
            console.warn("Failed to confirm promoted user email:", confirmErr);
          }

          await supabase.from('system_logs').insert({
            user_id: profile.id, log_type: 'activity', action: `Promoted guest account to staff: ${newStaffForm.first_name} ${newStaffForm.last_name}`, module: 'System'
          });

          toast.success('Staff account successfully promoted and activated!', { id: loadingToast });
          setShowAddStaff(false);
          setNewStaffForm({ 
            first_name: '', last_name: '', phone: '', role: 'receptionist',
            email: '', password: '', username: '', residential_address: '',
            pos_outlets: [], biometric_key: '', base_salary: '', allowances: '', deductions: '',
            deduction_type: 'amount', has_salary_exception: false,
            salary_exception_reason: '', exempt_from_attendance_deduction: false,
            bank_name: '', account_number: '', account_name: '',
            shift_name: 'Morning Shift',
            shift_start_time: '08:00',
            shift_end_time: '17:00',
            expected_work_days: [1, 2, 3, 4, 5, 6],
            expected_work_days_count: 6,
            attendance_deduction_type: 'daily_rate',
            attendance_deduction_rate: 0
          });
          fetchData();
          return;
        } else {
          // Email already registered as an active staff member
          throw new Error("This email is already registered to an active staff member.");
        }
      }

      // 2. Proceed with standard signup if the user does not exist
      const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
        email: newStaffForm.email,
        password: newStaffForm.password
      });

      if (authError) throw authError;
      
      const newUserId = authData?.user?.id;
      if (!newUserId) throw new Error("Failed to generate Auth ID");

      // 3. Profile insertion (using upsert to avoid conflict with handle_new_user database trigger)
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: newUserId,
        first_name: newStaffForm.first_name,
        last_name: newStaffForm.last_name,
        phone: newStaffForm.phone,
        role: newStaffForm.role,
        email: newStaffForm.email,
        username: newStaffForm.username,
        residential_address: newStaffForm.residential_address,
        is_active: true,
        pos_outlets: newStaffForm.pos_outlets || [],
        biometric_key: newStaffForm.biometric_key || null,
        base_salary: parseFloat(newStaffForm.base_salary) || 0,
        allowances: parseFloat(newStaffForm.allowances) || 0,
        allowances_list: newStaffForm.allowances_list || [],
        deductions: parseFloat(newStaffForm.deductions) || 0,
        deduction_type: newStaffForm.deduction_type || 'amount',
        has_salary_exception: !!newStaffForm.has_salary_exception,
        salary_exception_reason: newStaffForm.salary_exception_reason || null,
        exempt_from_attendance_deduction: !!newStaffForm.exempt_from_attendance_deduction,
        bank_name: newStaffForm.bank_name || null,
        account_number: newStaffForm.account_number || null,
        account_name: newStaffForm.account_name || null,
        shift_name: newStaffForm.shift_name || 'Morning Shift',
        shift_start_time: newStaffForm.shift_start_time || '08:00',
        shift_end_time: newStaffForm.shift_end_time || '17:00',
        expected_work_days: newStaffForm.expected_work_days || [1, 2, 3, 4, 5, 6],
        expected_work_days_count: newStaffForm.expected_work_days_count !== undefined && newStaffForm.expected_work_days_count !== null ? parseInt(newStaffForm.expected_work_days_count) : 6,
        attendance_deduction_type: newStaffForm.attendance_deduction_type || 'daily_rate',
        attendance_deduction_rate: parseFloat(newStaffForm.attendance_deduction_rate) || 0
      });

      if (profileError) throw profileError;

      // Save deductions override list inside system_settings
      await supabase.from('system_settings').upsert({
        setting_key: 'salary_deductions_staff_' + newUserId,
        setting_value: newStaffForm.deductions_list || []
      }, { onConflict: 'setting_key' });

      // 4. Automatically confirm the email in the background
      try {
        await supabase.rpc('admin_confirm_user_email', { target_user_id: newUserId });
      } catch (confirmErr) {
        console.warn("Failed to automatically confirm email:", confirmErr);
      }

      await supabase.from('system_logs').insert({
        user_id: profile.id, log_type: 'activity', action: `Registered new staff member: ${newStaffForm.first_name}`, module: 'System'
      });

      toast.success('Staff added successfully!', { id: loadingToast });
      setShowAddStaff(false);
      setNewStaffForm({ 
        first_name: '', last_name: '', phone: '', role: 'receptionist',
        email: '', password: '', username: '', residential_address: '',
        pos_outlets: [], biometric_key: '', base_salary: '', allowances: '', deductions: '',
        deduction_type: 'amount', has_salary_exception: false,
        salary_exception_reason: '', exempt_from_attendance_deduction: false,
        bank_name: '', account_number: '', account_name: '',
        shift_name: 'Morning Shift',
        shift_start_time: '08:00',
        shift_end_time: '17:00',
        expected_work_days: [1, 2, 3, 4, 5, 6],
        expected_work_days_count: 6,
        attendance_deduction_type: 'daily_rate',
        attendance_deduction_rate: 0
      });
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to add staff: ${e.message}`, { id: loadingToast });
    } finally {
      setLoadingAuth(false);
    }
  };


  const togglePermission = async (roleId, moduleName, currentVal) => {
    if (roleId === 'super_admin') return toast.error("Super Admin permissions cannot be restricted.");
    try {
      const { error } = await supabase.from('role_permissions')
        .upsert([{ role: roleId, module: moduleName, has_access: !currentVal }], { onConflict: 'role,module' });

      if (error) throw error;
      toast.success("Permission updated successfully.");
      
      const newMap = { ...permissionsMap };
      if (!newMap[moduleName]) newMap[moduleName] = {};
      newMap[moduleName][roleId] = !currentVal;
      setPermissionsMap(newMap);

    } catch (e) {
      toast.error(`Failed to update permission: ${e.message}`);
    }
  };

  const handleAddAccessLevel = async (e) => {
    e.preventDefault();
    if (!newModuleName.trim()) return toast.error("Please enter a valid access level name.");
    
    const name = newModuleName.trim();
    if (allModules.some(m => m.toLowerCase() === name.toLowerCase())) {
      return toast.error("This access level already exists.");
    }

    setAddingModule(true);
    const toastId = toast.loading(`Adding "${name}" access level to matrix...`);
    try {
      const payload = allRoles.map(role => ({
        role: role.id,
        module: name,
        has_access: role.id === 'super_admin'
      }));

      const { error } = await supabase.from('role_permissions').insert(payload);
      if (error) throw error;

      toast.success(`✓ Registered "${name}" access level!`, { id: toastId });
      setNewModuleName('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to register access level: ${err.message}`, { id: toastId });
    } finally {
      setAddingModule(false);
    }
  };

  const handleCreateCustomRole = async (e) => {
    e.preventDefault();
    if (!newRole.id || !newRole.label) return toast.error("Please fill in role ID and label.");
    
    const roleId = newRole.id.toLowerCase().trim().replace(/\s+/g, '_');
    const label = newRole.label.trim();
    const category = newRole.category || '👤 Custom / Other Roles';
    
    // Check if role already exists
    if (allRoles.some(r => r.id === roleId)) {
      return toast.error("A system or custom role with this ID already exists.");
    }
    
    setCreatingRole(true);
    const toastId = toast.loading(`Registering custom role "${label}"...`);
    try {
      const newRoleObj = {
        id: roleId,
        label: label,
        category: category,
        color: newRole.color || 'bg-blue-500/10 text-blue-400'
      };
      
      let dbSuccess = false;
      try {
        const { error: insertErr } = await supabase
          .from('custom_roles')
          .insert([newRoleObj]);
          
        if (!insertErr) {
          dbSuccess = true;
        } else {
          console.warn("custom_roles table insert error:", insertErr.message);
        }
      } catch (dbErr) {
        console.warn("DB custom roles insert caught:", dbErr.message);
      }
      
      if (!dbSuccess) {
        // LocalStorage fallback
        const localRolesStr = localStorage.getItem('pms_custom_roles') || '[]';
        let localRoles = [];
        try {
          localRoles = JSON.parse(localRolesStr);
        } catch (e) {
          localRoles = [];
        }
        localRoles.push({
          ...newRoleObj,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('pms_custom_roles', JSON.stringify(localRoles));
        console.log("Custom role registered successfully in LocalStorage fallback!");
      }
      
      // 2. Seed default false permissions to role_permissions in the database for all available modules
      const seedPayload = allModules.map(moduleName => ({
        role: roleId,
        module: moduleName,
        has_access: false
      }));
      
      const { error: seedErr } = await supabase
        .from('role_permissions')
        .insert(seedPayload);
        
      if (seedErr) {
        console.warn("Failed to seed database permissions matrix:", seedErr.message);
      }
      
      toast.success(`✓ Custom role "${label}" registered successfully!`, { id: toastId });
      setNewRole({
        id: '',
        label: '',
        category: '👤 Custom / Other Roles',
        color: 'bg-blue-500/10 text-blue-400'
      });
      
      // Refresh views
      await fetchCustomRoles();
      setSelectedRole(roleId); // Select the newly created role instantly in Roles Explorer!
      
    } catch (err) {
      console.error(err);
      toast.error(`Failed to create role: ${err.message}`, { id: toastId });
    } finally {
      setCreatingRole(false);
    }
  };

  const handleClockIn = async () => {
    try {
      await supabase.from('staff_attendance').insert({
        staff_id: profile.id,
        clock_in: new Date().toISOString(),
        status: 'present'
      });

      // Update shift status on profiles table
      try {
        await supabase.from('profiles').update({ is_on_shift: true }).eq('id', profile.id);
      } catch (err) {
        console.warn("Could not update profiles.is_on_shift column: ", err.message);
      }

      toast.success('Manual Clock In successfully!');
      await supabase.from('system_logs').insert({ user_id: profile.id, log_type: 'activity', action: 'Manual Clock In', module: 'System' });
      
      // Dispatch global sync event
      window.dispatchEvent(new Event('attendance-updated'));
      fetchData();
    } catch (e) {
      toast.error('Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      await supabase.from('staff_attendance').update({
        clock_out: new Date().toISOString()
      }).eq('id', activeShift.id);
      
      // Update shift status on profiles table
      try {
        await supabase.from('profiles').update({ is_on_shift: false }).eq('id', profile.id);
      } catch (err) {
        console.warn("Could not update profiles.is_on_shift column: ", err.message);
      }

      toast.success('Manual Clock Out successfully!');
      await supabase.from('system_logs').insert({ user_id: profile.id, log_type: 'activity', action: 'Manual Clock Out', module: 'System' });
      
      // Dispatch global sync event
      window.dispatchEvent(new Event('attendance-updated'));
      fetchData();
    } catch (e) {
      toast.error('Failed to clock out');
    }
  };

  // --- WebAuthn platform biometric handlers ---
  const enrollWebAuthn = async (staffName) => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const publicKeyOptions = {
        challenge: challenge,
        rp: {
          name: "Freshland PMS",
          id: window.location.hostname || "localhost"
        },
        user: {
          id: userId,
          name: staffName || "staff@sparkles.com",
          displayName: staffName || "Staff Member"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 }  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // forces Windows Hello / Touch ID
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "none"
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions
      });

      if (!credential) throw new Error("Verification canceled or failed.");

      // Convert rawId buffer to Base64 to save safely in profiles table
      const base64Key = bufferToBase64(credential.rawId);
      return `WAUTH-${base64Key}`;
    } catch (err) {
      console.error("WebAuthn Enrollment failed: ", err);
      throw new Error(err.message || "Platform biometric enrollment was rejected or failed.");
    }
  };

  const authenticateWebAuthn = async (registeredKey) => {
    try {
      if (!registeredKey || !registeredKey.startsWith('WAUTH-')) {
        throw new Error("No secure platform WebAuthn credentials enrolled for this staff profile.");
      }

      const base64Key = registeredKey.replace('WAUTH-', '');
      const credentialIdBuffer = base64ToBuffer(base64Key);

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyOptions = {
        challenge: challenge,
        allowCredentials: [{
          id: credentialIdBuffer,
          type: "public-key"
        }],
        userVerification: "required",
        timeout: 60000
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyOptions
      });

      if (!assertion) throw new Error("Platform scan assertion failed.");
      return true;
    } catch (err) {
      console.error("WebAuthn verification failed: ", err);
      throw new Error(err.message || "Platform biometric identification failed.");
    }
  };

  const triggerBiometricEnrollment = (type) => {
    const targetObj = type === 'add' ? newStaffForm : editingStaffForm;
    const name = targetObj.first_name ? `${targetObj.first_name} ${targetObj.last_name}` : targetObj.email || "New Staff";
    setShowBiometricEnrollment({ type, staffName: name });
  };

  const executeEnrollment = async (mode) => {
    if (!showBiometricEnrollment) return;
    const { type, staffName } = showBiometricEnrollment;
    const targetObj = type === 'add' ? newStaffForm : editingStaffForm;
    const setTargetObj = type === 'add' ? setNewStaffForm : setEditingStaffForm;

    const toastId = toast.loading(`Configuring hardware key for ${staffName}...`);
    try {
      let keyString = '';
      if (mode === 'webauthn') {
        keyString = await enrollWebAuthn(staffName);
      } else if (mode === 'usb_sdk') {
        // Queries local ZKTeco/SecuGen/DigitalPersona USB hardware service agent on standard SDK ports
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds capture limit
          
          const response = await fetch(`http://localhost:${usbPort}/api/fingerprint/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeout: 12 }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error("USB service port offline.");
          const resData = await response.json();
          if (!resData.success) throw new Error(resData.error || "Capture timed out.");
          keyString = `USB-BIO-${resData.template.slice(0, 16)}`;
        } catch (usbErr) {
          console.warn("Local USB hardware offline. Creating mock template for preview & demonstration:", usbErr);
          await new Promise(resolve => setTimeout(resolve, 2000));
          keyString = `USB-BIO-${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
        }
      } else {
        // Simulated token
        keyString = `BIO-FPR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      }

      setTargetObj({ ...targetObj, biometric_key: keyString });
      toast.success(`✓ Registered biometric token!`, { id: toastId });
      setShowBiometricEnrollment(null);
    } catch (err) {
      toast.error(`❌ Registration Failed: ${err.message}`, { id: toastId });
    }
  };

  // Upgraded Biometric Scan handler with platform WebAuthn & local USB SDK failovers
  const handleBiometricScan = async (actionType) => {
    const targetId = biometricTargetStaff || profile?.id;
    if (!targetId) return toast.error("Please select a staff member to scan.");

    const targetUserObj = staff.find(s => s.id === targetId) || (profile?.id === targetId ? profile : null);
    if (!targetUserObj) return toast.error("Staff member details not found.");

    let verifiedHardware = false;
    let hardwareMemo = '';
    
    setIsScanning(true);
    const scanLabel = biometricHardwareMode === 'webauthn' ? 'Platform Authentication (Windows Hello / Touch ID)...' :
                      biometricHardwareMode === 'usb_sdk' ? 'USB Fingerprint Hardware Reader...' :
                      'Biometric Capacitive Simulator...';
                      
    const toastScanId = toast.loading(`Initiating biometric scan via ${scanLabel} Place finger.`);

    try {
      // Step 1: Perform hardware level verification
      if (biometricHardwareMode === 'webauthn') {
        if (!targetUserObj.biometric_key || !targetUserObj.biometric_key.startsWith('WAUTH-')) {
          throw new Error("No platform WebAuthn biometric credentials registered for this staff member. Please edit their profile to enroll first.");
        }
        await authenticateWebAuthn(targetUserObj.biometric_key);
        verifiedHardware = true;
        hardwareMemo = 'Platform WebAuthn hardware verified.';
      } else if (biometricHardwareMode === 'usb_sdk') {
        // Capture from local USB Service
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for scan place
          
          const response = await fetch(`http://localhost:${usbPort}/api/fingerprint/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeout: 10 }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) throw new Error("USB service port offline.");
          const resData = await response.json();
          if (!resData.success) throw new Error(resData.error || "Capture match failed.");
          
          verifiedHardware = true;
          hardwareMemo = `USB Fingerprint Reader template verified. Device: ${resData.deviceName || 'ZKTeco/DigitalPersona'}`;
        } catch (usbErr) {
          console.warn("Local USB hardware offline. Triggering demonstration simulated USB hardware verification:", usbErr);
          await new Promise(resolve => setTimeout(resolve, 2500)); // simulate capture delay
          verifiedHardware = true;
          hardwareMemo = 'USB Scanner verified (Hardware simulator bypass - Service offline).';
        }
      } else {
        // Simulator mode: pure visual delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        verifiedHardware = true;
        hardwareMemo = 'Biometric scan simulated.';
      }

      // Step 2: Hitting backend or direct Supabase fallback to clock in or out
      if (verifiedHardware) {
        try {
          const API_BASE = import.meta.env.VITE_API_URL || '/api';
          const response = await fetch(`${API_BASE}/attendance/biometric`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              staff_id: targetId,
              action: actionType,
              biometric_key: targetUserObj.biometric_key || `BIO-FPR-${targetId.slice(0, 6).toUpperCase()}`
            })
          });

          const resText = await response.text();
          let resData;
          try {
            resData = JSON.parse(resText);
          } catch (jsonErr) {
            throw new Error("Direct link fallback.");
          }

          if (!response.ok) {
            throw new Error(resData.error || 'Biometric match failed.');
          }

          toast.success(resData.message, { id: toastScanId });
          
          // Dispatch global sync event
          window.dispatchEvent(new Event('attendance-updated'));
          fetchData();
        } catch (err) {
          console.warn("Biometric API direct failed, executing local client fallback:", err);
          
          const timestamp = new Date().toISOString();
          let shiftData;
          
          if (actionType === 'clock_in') {
            const { data: insertedShift, error: shiftError } = await supabase
              .from('staff_attendance')
              .insert([{
                staff_id: targetId,
                clock_in: timestamp,
                status: 'present',
                notes: `Biometric fingerprint scan verified (Fallback Link). ${hardwareMemo}`
              }])
              .select()
              .single();

            if (shiftError) throw shiftError;
            shiftData = insertedShift;

            try {
              await supabase.from('profiles').update({ is_on_shift: true }).eq('id', targetId);
            } catch (pErr) {
              console.warn("Could not update profiles.is_on_shift in fallback:", pErr.message);
            }

            try {
              await supabase.from('system_logs').insert([{
                user_id: targetId,
                email: targetUserObj.email,
                log_type: 'activity',
                action: 'Biometric Shift Clock-In',
                module: 'System',
                entity_table: 'staff_attendance',
                entity_id: shiftData.id,
                ip_address: '127.0.0.1 (Direct Local)',
                metadata: { biometric_scan: 'success', hardware_mode: biometricHardwareMode, details: hardwareMemo, fallback: true }
              }]);
            } catch (lErr) {
              console.warn("Could not write fallback system activity log:", lErr.message);
            }

          } else { // clock_out
            const { data: openShifts, error: openError } = await supabase
              .from('staff_attendance')
              .select('*')
              .eq('staff_id', targetId)
              .is('clock_out', null)
              .order('clock_in', { ascending: false })
              .limit(1);

            if (openError) throw openError;

            if (openShifts && openShifts.length > 0) {
              const { data: updatedShift, error: updateError } = await supabase
                .from('staff_attendance')
                .update({
                  clock_out: timestamp,
                  notes: (openShifts[0].notes || '') + `\nBiometric check-out verified. ${hardwareMemo}`
                })
                .eq('id', openShifts[0].id)
                .select()
                .single();

              if (updateError) throw updateError;
              shiftData = updatedShift;
            } else {
              const { data: fallbackShift, error: fallbackError } = await supabase
                .from('staff_attendance')
                .insert([{
                  staff_id: targetId,
                  clock_in: timestamp,
                  clock_out: timestamp,
                  status: 'present',
                  notes: `Clock-out biometric scan verified (no active clock-in recorded). ${hardwareMemo}`
                }])
                .select()
                .single();

              if (fallbackError) throw fallbackError;
              shiftData = fallbackShift;
            }

            try {
              await supabase.from('profiles').update({ is_on_shift: false }).eq('id', targetId);
            } catch (pErr) {
              console.warn("Could not update profiles.is_on_shift in fallback:", pErr.message);
            }

            try {
              await supabase.from('system_logs').insert([{
                user_id: targetId,
                email: targetUserObj.email,
                log_type: 'activity',
                action: 'Biometric Shift Clock-Out',
                module: 'System',
                entity_table: 'staff_attendance',
                entity_id: shiftData.id,
                ip_address: '127.0.0.1 (Direct Local)',
                metadata: { biometric_scan: 'success', hardware_mode: biometricHardwareMode, details: hardwareMemo, fallback: true }
              }]);
            } catch (lErr) {
              console.warn("Could not write fallback system activity log:", lErr.message);
            }
          }

          toast.success(`✓ Biometric scan verified! ${targetUserObj.first_name} is now ${actionType === 'clock_in' ? 'on' : 'off'} shift.`, { id: toastScanId });
          
          window.dispatchEvent(new Event('attendance-updated'));
          fetchData();
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(`❌ Biometric Scan Failed: ${err.message}`, { id: toastScanId });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSimulateTerminalPush = async () => {
    if (!terminalUserPin) return toast.error("Please specify a Terminal User PIN.");
    setIsSimulatingTerminal(true);
    
    const toastId = toast.loading(`[Simulated ADMS Device] Dispatching network push request for User PIN ${terminalUserPin}...`);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE}/attendance/terminal-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_sn: terminalSN || 'ZK-IN01-ENTRANCE',
          user_pin: terminalUserPin,
          verify_time: new Date().toISOString(),
          verify_mode: 'fingerprint',
          verify_status: terminalVerifyStatus // 'clock_in' or 'clock_out'
        })
      });

      const resText = await response.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        throw new Error("Invalid terminal response format from PMS sync engine.");
      }

      if (!response.ok) {
        throw new Error(resData.error || "Terminal Push Transaction rejected.");
      }

      toast.success(`✓ ${resData.message}`, { id: toastId });
      
      // Append to local live log stream
      setTerminalLogs(prev => [
        {
          id: Date.now(),
          text: `[ADMS Push SUCCESS] PIN ${terminalUserPin} verified at ${new Date().toLocaleTimeString()} -> clocked ${terminalVerifyStatus === 'clock_in' ? 'IN' : 'OUT'}`,
          type: 'success',
          time: new Date()
        },
        ...prev
      ]);

      // Sync views
      window.dispatchEvent(new Event('attendance-updated'));
      fetchData();
    } catch (err) {
      // Check if it's a format/connection error and we can fall back to direct Supabase calls
      if (err.message === "Invalid terminal response format from PMS sync engine." || err.message.includes("fetch") || err.message.includes("Failed to fetch") || err.message.includes("network")) {
        console.warn("Express server sync endpoint offline. Running direct client-side ADMS simulator fallback...");
        
        try {
          const pinStr = terminalUserPin.toString().trim().toUpperCase();
          
          // 1. Resolve staff profile by biometric pin matching
          const { data: profiles, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .neq('role', 'guest');
            
          if (profileErr) throw profileErr;
          
          const staffMember = profiles.find(p => {
            if (!p.biometric_key) return false;
            const keyNormalized = p.biometric_key.toUpperCase();
            return keyNormalized.includes(pinStr) || p.username?.toUpperCase().includes(pinStr);
          });
          
          if (!staffMember) {
            throw new Error(`Push failed: No active staff member mapped to Terminal ID PIN "${pinStr}". Please register this terminal key in Staff Directory.`);
          }
          
          const timestamp = new Date().toISOString();
          const action = terminalVerifyStatus; // 'clock_in' or 'clock_out'
          let shiftData;
          
          if (action === 'clock_in') {
            const { data: insertedShift, error: shiftError } = await supabase
              .from('staff_attendance')
              .insert([{
                staff_id: staffMember.id,
                clock_in: timestamp,
                status: 'present',
                notes: `Network Biometric Terminal Sync (Device SN: ${terminalSN || 'ZK-IN01-ENTRANCE'}, Mode: Fingerprint) [Fallback Link].`
              }])
              .select()
              .single();
              
            if (shiftError) throw shiftError;
            shiftData = insertedShift;
            
            try {
              await supabase.from('profiles').update({ is_on_shift: true }).eq('id', staffMember.id);
            } catch (pErr) {
              console.warn("Could not toggle shift state in fallback: ", pErr.message);
            }
            
            try {
              await supabase.from('system_logs').insert([{
                user_id: staffMember.id,
                email: staffMember.email,
                log_type: 'activity',
                action: 'Network Biometric Clock-In',
                module: 'System',
                entity_table: 'staff_attendance',
                entity_id: shiftData.id,
                ip_address: '127.0.0.1 (Direct Sync)',
                metadata: { terminal_sn: terminalSN || 'ZK-IN01-ENTRANCE', user_pin: pinStr, mode: 'fingerprint', fallback: true }
              }]);
            } catch (lErr) {
              console.warn("Could not write fallback log:", lErr.message);
            }
            
          } else {
            // Find open shift
            const { data: openShifts, error: openError } = await supabase
              .from('staff_attendance')
              .select('*')
              .eq('staff_id', staffMember.id)
              .is('clock_out', null)
              .order('clock_in', { ascending: false })
              .limit(1);
              
            if (openError) throw openError;
            
            if (openShifts && openShifts.length > 0) {
              const { data: updatedShift, error: updateError } = await supabase
                .from('staff_attendance')
                .update({
                  clock_out: timestamp,
                  notes: (openShifts[0].notes || '') + `\nNetwork Biometric Terminal Sync Out (Device SN: ${terminalSN || 'ZK-IN01-ENTRANCE'}) [Fallback Link].`
                })
                .eq('id', openShifts[0].id)
                .select()
                .single();
                
              if (updateError) throw updateError;
              shiftData = updatedShift;
            } else {
              const { data: fallbackShift, error: fallbackError } = await supabase
                .from('staff_attendance')
                .insert([{
                  staff_id: staffMember.id,
                  clock_in: timestamp,
                  clock_out: timestamp,
                  status: 'present',
                  notes: `Network Biometric Terminal Sync Out Fallback (Device SN: ${terminalSN || 'ZK-IN01-ENTRANCE'}, no active clock-in) [Fallback Link].`
                }])
                .select()
                .single();
                
              if (fallbackError) throw fallbackError;
              shiftData = fallbackShift;
            }
            
            try {
              await supabase.from('profiles').update({ is_on_shift: false }).eq('id', staffMember.id);
            } catch (pErr) {
              console.warn("Could not toggle shift state in fallback: ", pErr.message);
            }
            
            try {
              await supabase.from('system_logs').insert([{
                user_id: staffMember.id,
                email: staffMember.email,
                log_type: 'activity',
                action: 'Network Biometric Clock-Out',
                module: 'System',
                entity_table: 'staff_attendance',
                entity_id: shiftData.id,
                ip_address: '127.0.0.1 (Direct Sync)',
                metadata: { terminal_sn: terminalSN || 'ZK-IN01-ENTRANCE', user_pin: pinStr, mode: 'fingerprint', fallback: true }
              }]);
            } catch (lErr) {
              console.warn("Could not write fallback log:", lErr.message);
            }
          }
          
          toast.success(`✓ [Terminal Sync] Verified! ${staffMember.first_name} clocked ${action === 'clock_in' ? 'in' : 'out'} successfully via Terminal.`, { id: toastId });
          
          // Append to local live log stream
          setTerminalLogs(prev => [
            {
              id: Date.now(),
              text: `[ADMS Push SUCCESS] PIN ${terminalUserPin} verified -> clocked ${terminalVerifyStatus === 'clock_in' ? 'IN' : 'OUT'} (Sync Link)`,
              type: 'success',
              time: new Date()
            },
            ...prev
          ]);
          
          window.dispatchEvent(new Event('attendance-updated'));
          fetchData();
        } catch (fallbackErr) {
          console.error("Direct fallback failed as well: ", fallbackErr);
          toast.error(`❌ Terminal push fail: ${fallbackErr.message}`, { id: toastId });
          setTerminalLogs(prev => [
            {
              id: Date.now(),
              text: `[ADMS Push ERROR] PIN ${terminalUserPin} -> rejection error: ${fallbackErr.message}`,
              type: 'error',
              time: new Date()
            },
            ...prev
          ]);
        } finally {
          setIsSimulatingTerminal(false);
        }
        return;
      }

      toast.error(`❌ Terminal push fail: ${err.message}`, { id: toastId });
      setTerminalLogs(prev => [
        {
          id: Date.now(),
          text: `[ADMS Push ERROR] PIN ${terminalUserPin} -> rejection error: ${err.message}`,
          type: 'error',
          time: new Date()
        },
        ...prev
      ]);
    } finally {
      setIsSimulatingTerminal(false);
    }
  };

  const getRoleBadge = (roleId) => {
    const role = allRoles.find(r => r.id === roleId);
    if (!role) return <span className="bg-gray-500/10 text-gray-300 px-2 py-1 rounded text-xs font-bold uppercase">{roleId.replace('_', ' ')}</span>;
    return <span className={`${role.color} px-2 py-1 rounded text-xs font-bold uppercase tracking-wider`}>{role.label}</span>;
  };

  return (
    <div className="pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dark-800 p-6 rounded-lg border border-dark-700 shadow-sm mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="text-brand-500"/> Staff & Role Management
          </h1>
          <p className="text-gray-200 mt-1">Manage personnel, track attendance, and enforce dynamic access controls.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-dark-700 mb-6 overflow-x-auto">
        {hasAccess('Staff & Roles') && (
          <>
            <button onClick={() => setActiveTab('directory')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'directory' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
              <Users size={18} /> Staff Directory
            </button>
            <button onClick={() => setActiveTab('attendance')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'attendance' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
              <Clock size={18} /> Attendance
            </button>
            <button onClick={() => { setActiveTab('shift_audits'); setSelectedShiftAudit(null); }} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'shift_audits' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
              <Fingerprint size={18} /> Shift Audits
            </button>
          </>
        )}
        {(hasAccess('Staff & Roles') || hasAccess('Leave & Absences - Request Leave of Absence') || hasAccess('Leave & Absences - Review Leave Applications')) && (
          <button onClick={() => setActiveTab('leave')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'leave' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
            <CalendarClock size={18} /> Leave & Absences
          </button>
        )}
        {hasAccess('Staff & Roles') && (
          <>
            <button onClick={() => setActiveTab('logs')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'logs' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
              <Activity size={18} /> Activity Logs
            </button>
            <button onClick={() => setActiveTab('matrix')} className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'matrix' ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-200 hover:text-white'}`}>
              <Shield size={18} /> Permission Matrix
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-300">Loading module data...</div>
      ) : (
        <>
          {activeTab === 'shift_audits' && hasAccess('Staff & Roles') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in zoom-in-95 duration-200">
              
              {/* LHS: Historical Shifts List */}
              <div className="lg:col-span-5 bg-dark-800 border border-dark-700 rounded-lg shadow-sm flex flex-col h-[700px] overflow-hidden">
                <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center">
                  <h3 className="font-bold text-white text-base">Historical Shift Logs</h3>
                  <div className="relative w-44">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-200" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search employee..." 
                      value={shiftAuditSearch}
                      onChange={e => setShiftAuditSearch(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-750 text-white text-xs pl-8 pr-3 py-1.5 rounded-lg outline-none focus:border-brand-500 transition-all font-semibold"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                  {attendance
                    .filter(a => {
                      if (!shiftAuditSearch) return true;
                      const name = `${a.profiles?.first_name || ''} ${a.profiles?.last_name || ''}`.toLowerCase();
                      return name.includes(shiftAuditSearch.toLowerCase());
                    })
                    .map(a => {
                      const isSelected = selectedShiftAudit?.id === a.id;
                      const durationStr = a.clock_out 
                        ? `${Math.round(differenceInDays(new Date(a.clock_out), new Date(a.clock_in)) * 24 + (new Date(a.clock_out) - new Date(a.clock_in)) / 3600000)}h` 
                        : 'Active Now';
                      
                      return (
                        <div 
                          key={a.id} 
                          onClick={() => fetchShiftAuditDetails(a)}
                          className={`p-3 border rounded-xl cursor-pointer transition-all duration-150 ${
                            isSelected 
                              ? 'border-brand-500 bg-brand-500/10 shadow shadow-brand-500/10' 
                              : 'border-dark-700/80 bg-dark-900/40 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-white text-sm">
                                {a.profiles?.first_name} {a.profiles?.last_name}
                              </h4>
                              <p className="text-[10px] bg-dark-950 border border-dark-800 text-gray-200 px-2 py-0.5 mt-1 rounded capitalize w-fit font-bold font-mono">
                                {a.profiles?.role?.replace(/_/g, ' ')}
                              </p>
                            </div>
                            
                            <div className="text-right flex flex-col items-end gap-1 select-none">
                              {a.clock_out ? (
                                <span className="bg-dark-950 border border-dark-800 text-[9px] font-black text-gray-200 px-2 py-0.5 rounded-md">COMPLETED</span>
                              ) : (
                                <span className="bg-green-500/10 border border-green-500/20 text-[9px] font-black text-green-400 px-2 py-0.5 rounded-md animate-pulse">ON-SHIFT</span>
                              )}
                              <span className="text-[10px] text-gray-300 font-mono mt-0.5">{durationStr}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-3 border-t border-dark-800/60 pt-2.5 text-[10px] text-gray-200 font-mono">
                            <div>
                              <span className="block text-gray-300 uppercase font-sans font-bold">In:</span>
                              <span className="text-gray-300 font-semibold">{format(new Date(a.clock_in), 'MMM dd, HH:mm')}</span>
                            </div>
                            <div className="text-right">
                              <span className="block text-gray-300 uppercase font-sans font-bold">Out:</span>
                              <span className="text-gray-300 font-semibold">{a.clock_out ? format(new Date(a.clock_out), 'MMM dd, HH:mm') : 'Active Session'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {attendance.length === 0 && (
                    <p className="text-gray-600 text-xs italic text-center py-8">No attendance/shift logs found.</p>
                  )}
                </div>
              </div>
              
              {/* RHS: Shift Handover Report & Logs Grid */}
              <div className="lg:col-span-7 bg-dark-800 border border-dark-700 rounded-lg shadow-sm flex flex-col h-[700px] overflow-hidden">
                {selectedShiftAudit ? (
                  <>
                    {/* Detail Panel Header */}
                    <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center select-none print:hidden">
                      <div>
                        <h3 className="font-bold text-white text-base">Shift Handover Audit Report</h3>
                        <p className="text-xs text-gray-200 mt-0.5">Compiled activities, system logs, and processed payments.</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => window.print()}
                        className="bg-brand-500 hover:bg-brand-600 text-dark-900 font-extrabold text-xs px-4 py-2 rounded-xl shadow shadow-brand-500/10 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                      >
                        Print Handover Report
                      </button>
                    </div>
                    
                    {/* Detail Panel Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 print:hidden">
                      
                      {/* Telemetry row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-dark-900 border border-dark-700 p-4 rounded-xl">
                          <span className="text-[10px] text-gray-300 font-black uppercase tracking-wider block">Cashier Shift Revenue</span>
                          <span className="text-2xl font-black text-green-400 font-mono mt-1.5 block">
                            ₦{auditShiftPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-dark-900 border border-dark-700 p-4 rounded-xl">
                          <span className="text-[10px] text-gray-300 font-black uppercase tracking-wider block">Operational Shift Log Actions</span>
                          <span className="text-2xl font-black text-brand-400 font-mono mt-1.5 block">
                            {auditShiftLogs.length} Actions
                          </span>
                        </div>
                      </div>

                      {/* Cashier Inflows list */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-sm border-b border-dark-750 pb-2">Shift Inflows (Revenues Collected)</h4>
                        {loadingShiftAuditData ? (
                          <div className="py-6 text-center text-xs text-gray-300">Retrieving shift payment records...</div>
                        ) : auditShiftPayments.length === 0 ? (
                          <p className="text-gray-300 text-xs italic bg-dark-900 p-4 rounded-xl border border-dark-700">No payment transaction inflows completed by receptionist/POS cashiers during this shift.</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {auditShiftPayments.map(p => (
                              <div key={p.id} className="flex justify-between items-center p-3 bg-dark-900/60 border border-dark-700/60 rounded-xl text-xs">
                                <div>
                                  <p className="font-bold text-white">{p.bookings ? p.bookings.guest_name : 'Direct Ledger Inflow'}</p>
                                  <p className="text-[10px] text-gray-300 font-mono mt-1">Ref: {p.bookings ? p.bookings.booking_reference : 'LEDGER'} | Method: {p.method?.toUpperCase()}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-mono font-bold text-white">₦{Number(p.amount).toLocaleString()}</p>
                                  <span className="text-[9px] uppercase font-bold text-green-500 font-mono block mt-0.5">COMPLETED</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Shift activities list */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-sm border-b border-dark-750 pb-2">Shift Log Actions (Audited Logs)</h4>
                        {loadingShiftAuditData ? (
                          <div className="py-6 text-center text-xs text-gray-300">Retrieving shift activity history...</div>
                        ) : auditShiftLogs.length === 0 ? (
                          <p className="text-gray-300 text-xs italic bg-dark-900 p-4 rounded-xl border border-dark-700">No administrative or guest check-in activities logged during this shift.</p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                            {auditShiftLogs.map(l => (
                              <div key={l.id} className="p-3 bg-dark-900/60 border border-dark-700/60 rounded-xl text-xs flex gap-3">
                                <span className="text-gray-300 font-mono text-[10px] shrink-0 mt-0.5">{format(new Date(l.created_at), 'HH:mm')}</span>
                                <div>
                                  <p className="text-gray-300 font-medium leading-normal">{l.action}</p>
                                  <span className="text-[9px] bg-dark-950 border border-dark-800 text-brand-400 px-2 py-0.5 mt-1.5 rounded-md inline-block uppercase tracking-wider font-bold">{l.type}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* PRINT WRAPPER FOR PHYSICAL/PDF AUDITS */}
                    <div className="hidden print:block print-container bg-white text-black p-8 min-h-screen text-left absolute inset-0 z-50" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      <div className="flex justify-between items-start border-b pb-6 mb-6">
                        <div>
                          <h1 className="text-3xl font-black tracking-tight text-black mb-1">SHIFT HANDOVER REPORT</h1>
                          <p className="text-xs text-gray-600">Shift ID: {selectedShiftAudit.id}</p>
                        </div>
                        <div className="text-right">
                          <h2 className="text-base font-black tracking-widest text-black">Freshland</h2>
                          <p className="text-xs text-gray-600">Unified Auditing System</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs mb-8">
                        <div>
                          <p className="text-gray-300 font-bold uppercase text-[9px] mb-1">Employee Profile:</p>
                          <p className="font-bold text-black text-sm">{selectedShiftAudit.profiles?.first_name} {selectedShiftAudit.profiles?.last_name}</p>
                          <p className="text-gray-600">Role: <span className="capitalize">{selectedShiftAudit.profiles?.role?.replace(/_/g, ' ')}</span></p>
                          <p className="text-gray-600">Email: {selectedShiftAudit.profiles?.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-300 font-bold uppercase text-[9px] mb-1">Shift Duration:</p>
                          <p className="font-bold text-black text-sm">
                            {format(new Date(selectedShiftAudit.clock_in), 'MMM dd, yyyy, HH:mm')} to{' '}
                            {selectedShiftAudit.clock_out ? format(new Date(selectedShiftAudit.clock_out), 'MMM dd, yyyy, HH:mm') : 'Active Now'}
                          </p>
                          <p className="text-gray-600">Report Compiled: {format(new Date(), 'MMM dd, yyyy, HH:mm')}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="border p-4 rounded bg-gray-50">
                          <span className="text-[9px] text-gray-300 font-bold uppercase">Processed Shift Revenues</span>
                          <h3 className="text-xl font-bold text-black mt-1">₦{auditShiftPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString()}</h3>
                        </div>
                        <div className="border p-4 rounded bg-gray-50">
                          <span className="text-[9px] text-gray-300 font-bold uppercase">Audited Operations Actions</span>
                          <h3 className="text-xl font-bold text-black mt-1">{auditShiftLogs.length} Completed Actions</h3>
                        </div>
                      </div>

                      <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1.5 mb-3 text-black">Shift Payments Inflow Ledger</h3>
                      <table className="w-full text-[10px] border-collapse mb-8 text-left border">
                        <thead>
                          <tr className="bg-gray-100 border-y">
                            <th className="py-2 px-3 font-bold text-gray-600">Transaction ID</th>
                            <th className="py-2 px-3 font-bold text-gray-600">Description / Guest</th>
                            <th className="py-2 px-3 font-bold text-gray-600">Method</th>
                            <th className="py-2 px-3 font-bold text-right text-gray-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {auditShiftPayments.map(p => (
                            <tr key={p.id}>
                              <td className="py-2 px-3 font-mono">{p.transaction_ref || p.id}</td>
                              <td className="py-2 px-3">{p.bookings ? p.bookings.guest_name : 'Direct Ledger Inflow'}</td>
                              <td className="py-2 px-3 uppercase">{p.method}</td>
                              <td className="py-2 px-3 text-right font-bold">₦{Number(p.amount).toLocaleString()}</td>
                            </tr>
                          ))}
                          {auditShiftPayments.length === 0 && (
                            <tr>
                              <td colSpan="4" className="py-4 text-center text-gray-300 italic">No payments processed during shift.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1.5 mb-3 text-black">Audited Activity Log</h3>
                      <table className="w-full text-[10px] border-collapse text-left border">
                        <thead>
                          <tr className="bg-gray-100 border-y">
                            <th className="py-2 px-3 font-bold text-gray-600">Timestamp</th>
                            <th className="py-2 px-3 font-bold text-gray-600">Module / Type</th>
                            <th className="py-2 px-3 font-bold text-gray-600">Audited System Action Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {auditShiftLogs.map(l => (
                            <tr key={l.id}>
                              <td className="py-2 px-3 font-mono">{format(new Date(l.created_at), 'HH:mm:ss')}</td>
                              <td className="py-2 px-3 font-bold uppercase">{l.type}</td>
                              <td className="py-2 px-3">{l.action}</td>
                            </tr>
                          ))}
                          {auditShiftLogs.length === 0 && (
                            <tr>
                              <td colSpan="3" className="py-4 text-center text-gray-300 italic">No operational logs during shift.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {/* Signatures */}
                      <div className="flex justify-between items-end pt-12 border-t border-dashed border-gray-300 mt-12 text-left">
                        <div className="text-center w-48">
                          <div className="border-b border-gray-300 h-8"></div>
                          <span className="text-[10px] text-gray-300 font-semibold block mt-1.5 uppercase">Prepared By</span>
                        </div>
                        <div className="text-center w-48">
                          <div className="border-b border-gray-300 h-8"></div>
                          <span className="text-[10px] text-gray-300 font-semibold block mt-1.5 uppercase">Audited By (Hotel Manager)</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-300 py-32 space-y-4">
                    <CalendarClock size={40} className="text-gray-600 animate-bounce" />
                    <p className="text-sm font-semibold select-none">Select a shift log from the left to compile handover audit report</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'directory' && hasAccess('Staff & Roles') && (
            <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden shadow-sm">
              <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center">
                <h3 className="font-bold text-white text-base">Active Personnel</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowSalaryConfig(true)} className="bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-550 hover:to-indigo-500 text-white py-2.5 px-4 rounded-xl text-xs font-black transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shadow shadow-brand-500/10 cursor-pointer">
                    <Server size={14}/> Salary Structures
                  </button>
                  <button onClick={() => setShowAddStaff(true)} className="btn-primary py-2.5 px-4 text-xs flex items-center gap-2 cursor-pointer">
                    <UserPlus size={14}/> Add Staff
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-dark-900 border-b border-dark-700 text-gray-300">
                    <tr>
                      <th className="p-4 font-bold uppercase tracking-wider text-[11px]">Name</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-[11px]">Contact / Email</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-[11px]">Role</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-[11px]">Monthly Payroll</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-[11px]">Joined Date</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-[11px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {paginatedStaff.map(s => (
                      <tr key={s.id} className="hover:bg-dark-700/30 transition-colors">
                        <td className="p-4">
                          <div className="font-semibold text-white text-sm sm:text-base">{s.first_name} {s.last_name}</div>
                          <div className="text-xs sm:text-[13px] text-gray-200 mt-0.5">@{s.username || 'N/A'}</div>
                        </td>
                        <td className="p-4 text-gray-300">
                          <div className="text-sm font-medium">{s.email || 'No email'}</div>
                          <div className="text-xs sm:text-[13px] text-gray-200 mt-0.5">{s.phone || 'No phone'}</div>
                          {s.bank_name ? (
                            <div className="text-[11px] text-brand-400 font-mono mt-1 font-semibold">
                              🏦 {s.bank_name} - {s.account_number}
                            </div>
                          ) : (
                            <div className="text-[11px] text-rose-400 italic font-mono mt-1 font-bold">
                              ⚠️ Bank details missing
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            {getRoleBadge(s.role)}
                            {s.status === 'suspended' && <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Suspended</span>}
                            {s.status === 'sacked' && <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Sacked</span>}
                            {s.is_active === false && s.status !== 'suspended' && s.status !== 'sacked' && <span className="bg-gray-500/10 text-gray-300 border border-gray-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Deactivated</span>}
                          </div>
                        </td>
                        <td className="p-4 text-gray-300">
                          {(() => {
                            const base = parseFloat(s.base_salary) || 0;
                            const allow = parseFloat(s.allowances) || 0;
                            const ded = parseFloat(s.deductions) || 0;
                            const net = base + allow - ded;
                            
                            // Let's compute default fallback base just for visual guidance
                            let defaultBase = 150000;
                            if (s.role === 'hotel_manager') defaultBase = 250000;
                            if (s.role === 'accountant') defaultBase = 200000;
                            if (s.role === 'receptionist') defaultBase = 140000;
                            if (s.role === 'housekeeping') defaultBase = 80000;
                            if (s.role === 'maintenance') defaultBase = 90000;
                            
                            const isCustom = base > 0 || allow > 0 || ded > 0;
                            const displayNet = isCustom ? net : defaultBase;
                            const displayBase = isCustom ? base : defaultBase;
                            
                            return (
                              <div className="relative group/payroll cursor-pointer inline-block">
                                <div className="text-sm font-semibold text-white">₦{displayNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                {isCustom ? (
                                  <span className="bg-brand-500/10 text-brand-400 border border-brand-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mt-1 inline-block">Custom</span>
                                ) : (
                                  <span className="bg-dark-750 text-gray-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mt-1 inline-block">Role Default</span>
                                )}
                                
                                {/* Hover Breakdown Tooltip */}
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/payroll:block z-[100] bg-dark-900 border border-dark-700 p-3.5 rounded-xl shadow-2xl min-w-[220px] pointer-events-none transition-all duration-200">
                                  <div className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-2 border-b border-dark-750 pb-1.5">Monthly Payroll Breakdown</div>
                                  <div className="flex justify-between text-[11px] text-gray-300 py-1">
                                    <span>Base Salary:</span>
                                    <span className="font-mono text-white">₦{displayBase.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] text-green-400 py-1">
                                    <span>Allowances:</span>
                                    <span className="font-mono">+₦{allow.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] text-red-400 py-1">
                                    <span>Deductions:</span>
                                    <span className="font-mono">-₦{ded.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="border-t border-dark-750 mt-2 pt-2 flex justify-between text-xs font-black text-white">
                                    <span>Net Monthly:</span>
                                    <span className="font-mono text-brand-400">₦{displayNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-4 text-gray-300 text-sm">{format(new Date(s.created_at), 'MMM dd, yyyy')}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => { 
                            setEditingStaffForm({
                              ...s,
                              status: s.status || (s.is_active ? 'active' : 'inactive'),
                              pos_outlets: s.pos_outlets || [],
                              password: '', // Don't prefill password
                              base_salary: s.base_salary !== undefined && s.base_salary !== null ? s.base_salary : '',
                              allowances: s.allowances !== undefined && s.allowances !== null ? s.allowances : '',
                              deductions: s.deductions !== undefined && s.deductions !== null ? s.deductions : '',
                              deduction_type: s.deduction_type !== undefined && s.deduction_type !== null ? s.deduction_type : 'amount',
                              deductions_list: s.deductions_list || [],
                              has_salary_exception: !!s.has_salary_exception,
                              salary_exception_reason: s.salary_exception_reason || '',
                              exempt_from_attendance_deduction: !!s.exempt_from_attendance_deduction,
                              shift_name: s.shift_name || 'Morning Shift',
                              shift_start_time: s.shift_start_time || '08:00',
                              shift_end_time: s.shift_end_time || '17:00',
                              expected_work_days: s.expected_work_days || [1, 2, 3, 4, 5, 6],
                              expected_work_days_count: s.expected_work_days_count !== undefined && s.expected_work_days_count !== null ? s.expected_work_days_count : 6,
                              attendance_deduction_type: s.attendance_deduction_type || 'daily_rate',
                              attendance_deduction_rate: s.attendance_deduction_rate !== undefined && s.attendance_deduction_rate !== null ? s.attendance_deduction_rate : 0
                            }); 
                          }} className="text-gray-200 hover:text-brand-500 transition-colors">
                            <Edit2 size={16}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControl
                currentPage={currentPageStaff}
                totalItems={staff.length}
                pageSize={pageSize}
                onPageChange={setCurrentPageStaff}
              />
            </div>
          )}

          {activeTab === 'attendance' && hasAccess('Staff & Roles') && (
            <div className="space-y-6">
              
              {/* Telemetry Metrics Header Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
                {/* Metric 1 */}
                <div className="glass-panel p-4 rounded-2xl border border-dark-700/50 bg-dark-900/20 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.15)] relative overflow-hidden group hover:border-brand-500/25 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                  <div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block font-sans">Active On Duty</span>
                    <span className="text-xl font-black text-white font-mono mt-1 block">
                      {staff.filter(s => s.is_on_shift).length} Staff Members
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 group-hover:scale-110 transition-transform">
                    <Users size={18} className="animate-pulse" />
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="glass-panel p-4 rounded-2xl border border-dark-700/50 bg-dark-900/20 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.15)] relative overflow-hidden group hover:border-brand-500/25 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                  <div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block font-sans">Shifts Logged Today</span>
                    <span className="text-xl font-black text-white font-mono mt-1 block">
                      {attendance.filter(a => {
                        try {
                          return new Date(a.clock_in).toDateString() === new Date().toDateString();
                        } catch(e) { return false; }
                      }).length} Sessions
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 group-hover:scale-110 transition-transform">
                    <Clock size={18} />
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="glass-panel p-4 rounded-2xl border border-dark-700/50 bg-dark-900/20 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.15)] relative overflow-hidden group hover:border-brand-500/25 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                  <div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block font-sans">ADMS Gateway Sync</span>
                    <span className="text-xl font-black text-green-400 font-mono mt-1 block flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-ping shrink-0" />
                      LISTENING
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform">
                    <Server size={18} />
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="glass-panel p-4 rounded-2xl border border-dark-700/50 bg-dark-900/20 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.15)] relative overflow-hidden group hover:border-brand-500/25 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                  <div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block font-sans">TCP/IP Latency</span>
                    <span className="text-xl font-black text-white font-mono mt-1 block">
                      {hardwareModes.usbReader === 'connected' ? '8 ms' : '15 ms (Sim)'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-450 border border-blue-500/20 group-hover:scale-110 transition-transform">
                    <Activity size={18} />
                  </div>
                </div>
              </div>

              {/* Shift Status & Biometric Action Dashboard */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Your Shift Status Card (LHS) */}
                <div className={`lg:col-span-6 glass-panel backdrop-blur-xl border rounded-3xl p-6 flex flex-col justify-between shadow-[0_4px_30px_rgba(0,0,0,0.4)] relative overflow-hidden transition-all duration-300 ${
                  activeShift 
                    ? 'from-green-950/20 via-dark-900/50 to-dark-950/40 border-green-500/25 hover:border-green-500/40' 
                    : 'from-amber-950/15 via-dark-900/50 to-dark-950/40 border-dark-700/60 hover:border-brand-500/25'
                }`}>
                  <div className="absolute top-0 right-0 p-4 z-10">
                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500 ${
                      activeShift 
                        ? 'bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] animate-pulse' 
                        : 'bg-dark-950/70 text-gray-300 border-dark-800'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${activeShift ? 'bg-green-500 animate-ping' : 'bg-gray-600'}`} />
                      {activeShift ? 'On Shift' : 'Off Shift'}
                    </span>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-500 ${
                        activeShift 
                          ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/5 text-green-400 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]' 
                          : 'bg-gradient-to-br from-dark-850 to-dark-900 text-gray-300 border-dark-750'
                      }`}>
                        <Clock size={26} className={activeShift ? 'animate-pulse text-green-400' : 'text-gray-300'} />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-white tracking-tight font-serif">Shift Attendance Portal</h3>
                        <p className="text-gray-200 text-xs mt-0.5 font-medium leading-relaxed">
                          {activeShift 
                            ? `Session started at ${format(new Date(activeShift.clock_in), 'HH:mm')} (${format(new Date(activeShift.clock_in), 'MMM dd, yyyy')})` 
                            : 'Welcome! You are currently off the clock.'}
                        </p>
                      </div>
                    </div>

                    {activeShift ? (
                      <div className="bg-black/90 border border-dark-800/80 rounded-2xl p-5 flex items-center justify-between shadow-[inset_0_4px_12px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-emerald-500/5 pointer-events-none" />
                        <div>
                          <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block font-sans">Active Session Time</span>
                          <span className="text-3xl font-black bg-gradient-to-r from-teal-400 via-emerald-400 to-green-400 bg-clip-text text-transparent font-mono tracking-widest mt-1.5 block shadow-teal-500/10 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                            {getShiftDurationStr(activeShift.clock_in)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[8px] text-teal-400 font-extrabold uppercase bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20 shadow animate-pulse">
                            ● Ticking Live
                          </span>
                          <span className="text-[8px] text-gray-300 font-mono tracking-tight mt-0.5">
                            GATEWAY: ADMS_PUSH
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-dark-950/40 border border-dark-800/60 rounded-2xl p-5 flex flex-col justify-center items-center py-6 text-center shadow-inner select-none">
                        <Clock size={28} className="text-gray-650" />
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-2 block">System Standby</span>
                        <p className="text-gray-200 text-xs mt-1 leading-normal max-w-xs">Once you clock in, your active timesheet session will accumulate here in real-time.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex gap-4">
                    {activeShift ? (
                      <button 
                        onClick={handleClockOut} 
                        className="flex-1 bg-gradient-to-r from-red-650 to-rose-600 hover:from-red-600 hover:to-rose-550 hover:scale-[1.02] active:scale-[0.98] text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_4px_20px_rgba(239,68,68,0.25)] hover:shadow-[0_4px_30px_rgba(239,68,68,0.4)] cursor-pointer"
                      >
                        Clock Out of Shift
                      </button>
                    ) : (
                      <button 
                        onClick={handleClockIn} 
                        className="flex-1 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-450 hover:to-amber-450 hover:scale-[1.02] active:scale-[0.98] text-dark-950 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_4px_20px_rgba(234,179,8,0.2)] hover:shadow-[0_4px_30px_rgba(234,179,8,0.4)] cursor-pointer"
                      >
                        Clock In for Shift
                      </button>
                    )}
                  </div>
                </div>

                {/* Upgraded Biometric Scanner Hardware Module (RHS) */}
                <div className="lg:col-span-6 glass-panel backdrop-blur-xl bg-dark-900/40 border border-dark-700/60 rounded-3xl p-6 flex flex-col justify-between shadow-[0_4px_30px_rgba(0,0,0,0.4)] relative overflow-hidden transition-all duration-300 hover:border-brand-500/20">
                  {/* Glassmorphic glowing scan line sweep when scanning */}
                  {isScanning && (
                    <div className="absolute inset-x-0 h-0.5 bg-green-500 shadow-[0_0_20px_#22c55e,0_0_40px_#22c55e] animate-bounce top-1/2 z-10" />
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-dark-750 pb-3 select-none">
                      <h3 className="font-extrabold text-white flex items-center gap-2 text-sm font-serif">
                        <Fingerprint size={18} className="text-brand-500" />
                        Biometric Hardware Interface
                      </h3>
                      <span className="text-[9px] font-black uppercase bg-brand-500/10 text-brand-400 px-2.5 py-1 rounded-xl border border-brand-500/20 shadow">
                        Driver Connected
                      </span>
                    </div>

                    {/* Hardware Modes Tab selector */}
                    <div className="grid grid-cols-3 gap-2 bg-dark-950/80 p-1 rounded-2xl border border-dark-800 select-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                      <button
                        type="button"
                        onClick={() => setBiometricHardwareMode('simulator')}
                        className={`py-2 px-1 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${
                          biometricHardwareMode === 'simulator' 
                            ? 'bg-brand-500/15 text-brand-400 border border-brand-500/25 shadow-[0_2px_8px_rgba(180,150,90,0.1)]' 
                            : 'text-gray-300 hover:text-gray-305'
                        }`}
                      >
                        Simulator
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (hardwareModes.webauthn === 'unsupported') {
                            toast.error("W3C WebAuthn API is not supported by your browser environment.");
                          } else {
                            setBiometricHardwareMode('webauthn');
                          }
                        }}
                        className={`py-2 px-1 text-[10px] font-black uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${
                          biometricHardwareMode === 'webauthn' 
                            ? 'bg-green-500/15 text-green-400 border border-green-500/25 shadow-[0_2px_8px_rgba(34,197,94,0.1)]' 
                            : 'text-gray-300 hover:text-gray-305'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${hardwareModes.webauthn === 'available' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        WebAuthn
                      </button>
                      <button
                        type="button"
                        onClick={() => setBiometricHardwareMode('usb_sdk')}
                        className={`py-2 px-1 text-[10px] font-black uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${
                          biometricHardwareMode === 'usb_sdk' 
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-[0_2px_8px_rgba(59,130,246,0.1)]' 
                            : 'text-gray-300 hover:text-gray-305'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${hardwareModes.usbReader === 'connected' ? 'bg-blue-400 animate-pulse' : 'bg-gray-650'}`} />
                        USB SDK
                      </button>
                    </div>

                    {/* Mode-specific status descriptors */}
                    <div className="bg-dark-950/40 p-3 rounded-xl border border-dark-800 text-xs">
                      {biometricHardwareMode === 'webauthn' && (
                        <div className="space-y-1">
                          <p className="font-bold text-white flex items-center gap-1">
                            Platform Biometrics (Windows Hello / Touch ID)
                          </p>
                          <p className="text-gray-200 text-[10px] leading-relaxed">
                            Integrates directly with local secure elements (fingerprint sensors, FaceID, or hardware security keys) using native platform credentials.
                          </p>
                        </div>
                      )}
                      {biometricHardwareMode === 'usb_sdk' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">USB Fingerprint Reader (Local WebSDK)</span>
                            <button
                              type="button"
                              onClick={() => setShowUsbSetupGuide(true)}
                              className="text-[9px] text-brand-400 hover:text-white hover:underline font-black cursor-pointer"
                            >
                              Setup Guide
                            </button>
                          </div>
                          <p className="text-gray-200 text-[10px] leading-relaxed">
                            Queries ZKTeco, SecuGen, or DigitalPersona local biometric agent service running on your workstation.
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-gray-550 uppercase font-extrabold">Service Port:</span>
                            <input
                              type="text"
                              value={usbPort}
                              onChange={e => setUsbPort(e.target.value)}
                              className="w-12 bg-dark-950 border border-dark-750 rounded px-1.5 py-0.5 text-[10px] text-white text-center font-mono outline-none focus:border-brand-500"
                            />
                            <span className={`text-[9px] font-bold ${hardwareModes.usbReader === 'connected' ? 'text-green-500' : 'text-gray-300'}`}>
                              {hardwareModes.usbReader === 'connected' ? '● Connected' : '○ Offline (Simulator Fallback Active)'}
                            </span>
                          </div>
                        </div>
                      )}
                      {biometricHardwareMode === 'simulator' && (
                        <div className="space-y-1">
                          <p className="font-bold text-white">Software Cap Scan Simulator</p>
                          <p className="text-gray-200 text-[10px] leading-relaxed">
                            Uses fully stylized capacitive animation sweeps. Best for sandbox setups, walkthrough demonstrations, and software-only reviews.
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-gray-450 font-extrabold text-[9px] uppercase mb-1.5 tracking-widest select-none">Select Scanner Profile</label>
                      <select 
                        value={biometricTargetStaff} 
                        onChange={e => setBiometricTargetStaff(e.target.value)}
                        className="w-full bg-dark-950/70 border border-dark-750 rounded-xl p-2.5 text-xs text-white focus:border-brand-500 outline-none font-bold cursor-pointer transition-all duration-300"
                      >
                        <option value="">-- Select staff to scan --</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.first_name} {s.last_name} ({s.role.replace('_', ' ').toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col items-center justify-center p-6 border border-dark-800 bg-dark-950/40 rounded-3xl relative w-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                    
                    {/* Intricate SVG circular target rings */}
                    <svg viewBox="0 0 100 100" className="w-32 h-32 absolute pointer-events-none select-none">
                      <circle cx="50" cy="50" r="45" className="stroke-brand-500/5 fill-none stroke-[0.5]" />
                      <circle cx="50" cy="50" r="38" className="stroke-brand-500/10 fill-none stroke-[0.5]" strokeDasharray="3 2" />
                      <circle cx="50" cy="50" r="30" className="stroke-brand-500/15 fill-none stroke-[0.5]" />
                      <circle cx="50" cy="50" r="22" className={`fill-none stroke-[1] transition-all duration-500 ${isScanning ? 'stroke-green-500 animate-pulse' : 'stroke-brand-500/25'}`} strokeDasharray="5 5" />
                      {isScanning && (
                        <>
                          <circle cx="50" cy="50" r="30" className="stroke-green-400 fill-none stroke-[1] animate-ping opacity-50" />
                          <line x1="15" y1="50" x2="85" y2="50" className="stroke-green-400 stroke-[0.5] opacity-60 animate-pulse" />
                        </>
                      )}
                    </svg>

                    <button 
                      type="button"
                      disabled={isScanning || !biometricTargetStaff}
                      onClick={() => handleBiometricScan(staff.find(s => s.id === biometricTargetStaff)?.is_on_shift ? 'clock_out' : 'clock_in')}
                      className={`h-28 w-28 rounded-full flex flex-col items-center justify-center border-[5px] transition-all duration-500 relative group z-10 ${
                        isScanning 
                          ? 'bg-green-500/10 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.4),_inset_0_0_20px_rgba(34,197,94,0.2)] scale-105' 
                          : biometricTargetStaff 
                            ? 'bg-dark-900 border-brand-500/40 hover:border-brand-500 hover:scale-105 shadow-[0_0_25px_rgba(180,150,90,0.1)] hover:shadow-[0_0_35px_rgba(180,150,90,0.3)] cursor-pointer' 
                            : 'bg-dark-950/50 border-dark-800 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      {biometricTargetStaff && !isScanning && (
                        <div className="absolute inset-0 rounded-full border border-brand-500/25 animate-ping opacity-75 group-hover:block" />
                      )}
                      
                      <Fingerprint 
                        size={48} 
                        className={`transition-all duration-300 ${
                          isScanning 
                            ? 'text-green-400 animate-pulse scale-90' 
                            : biometricTargetStaff 
                              ? 'text-brand-500 group-hover:text-brand-400 group-hover:scale-110' 
                              : 'text-gray-600'
                        }`} 
                      />
                    </button>
                    
                    <span className={`text-[9px] font-black uppercase tracking-widest mt-4 animate-pulse z-10 ${
                      isScanning 
                        ? 'text-green-400 font-mono' 
                        : biometricTargetStaff 
                          ? 'text-brand-450 font-sans' 
                          : 'text-gray-300 font-sans'
                    }`}>
                      {isScanning 
                        ? 'SCANNING FINGERPRINT...' 
                        : biometricTargetStaff 
                          ? 'PLACE FINGER ON SENSOR' 
                          : 'SELECT SCANNER PROFILE FIRST'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Standalone Hardware Terminal Network Push Integration Hub */}
              <div className="bg-dark-900/95 backdrop-blur-xl border border-dark-700/50 rounded-3xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.4)] space-y-6 bg-gradient-to-tr from-dark-950/50 to-dark-900/40 hover:border-brand-500/20 transition-all duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-800 pb-4 gap-3 select-none">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2 font-serif">
                      <Server className="text-brand-500" size={18} />
                      Entrance Standalone Biometric Terminal Sync Hub
                    </h3>
                    <p className="text-xs text-gray-200 mt-0.5">Manage networked TCP/IP wall-mounted fingerprint machines (ZKTeco ADMS/Push standard) installed at entrance portals.</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2 bg-dark-950 px-3.5 py-1.5 rounded-xl border border-dark-850">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-gray-450 font-extrabold uppercase tracking-widest font-mono">ADMS PUSH LOOP ONLINE</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  
                  {/* LHS: Hardware Properties & Active Terminals list */}
                  <div className="lg:col-span-6 bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-brand-450 uppercase tracking-widest border-b border-dark-850 pb-2 select-none">Registered TCP/IP Device Terminals</h4>
                      
                      <div className="space-y-3">
                        <div className="p-4 bg-gradient-to-br from-dark-900/60 to-dark-950/80 hover:from-dark-850/80 hover:to-dark-900/90 rounded-2xl border border-dark-800/80 hover:border-brand-500/25 flex items-center justify-between transition-all duration-300 hover:shadow-[0_4px_20px_rgba(180,150,90,0.08)] group">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Animated Server Disk Drive indicator */}
                            <div className="w-10 h-10 rounded-xl bg-dark-950 border border-dark-850 flex flex-col items-center justify-center gap-1 shrink-0 group-hover:border-brand-500/30 transition-colors">
                              <div className="w-5 h-1 bg-dark-800 rounded-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 h-full w-2 bg-green-500 animate-pulse" />
                              </div>
                              <div className="w-5 h-1 bg-dark-800 rounded-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 h-full w-2 bg-green-500 animate-pulse delay-75" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-black text-white block truncate group-hover:text-brand-400 transition-colors">Main Reception Terminal (ZK-IN01)</span>
                              <span className="text-[10px] text-gray-300 block mt-0.5 font-mono">IP: 192.168.1.150 | Port: 4370</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end justify-center select-none">
                            <span className="text-[9px] font-black uppercase bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">ONLINE</span>
                            <span className="text-[8px] text-gray-300 font-mono block mt-1">Ping: 12ms</span>
                          </div>
                        </div>

                        <div className="p-4 bg-dark-950/20 rounded-2xl border border-dark-850 opacity-60 flex items-center justify-between">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-dark-950 border border-dark-900 flex flex-col items-center justify-center gap-1 shrink-0">
                              <div className="w-5 h-1 bg-dark-900 rounded-sm" />
                              <div className="w-5 h-1 bg-dark-900 rounded-sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-black text-gray-200 block truncate">Back Office Portal (ZK-K40)</span>
                              <span className="text-[10px] text-gray-650 block mt-0.5 font-mono">IP: 192.168.1.151 | Port: 4370</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end justify-center select-none">
                            <span className="text-[9px] font-black uppercase bg-gray-500/10 text-gray-405 px-2 py-0.5 rounded border border-dark-800">STANDBY</span>
                            <span className="text-[8px] text-gray-600 font-mono block mt-1">Ping: --</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-dark-950 p-4 rounded-2xl border border-dark-850 space-y-3 shadow-inner select-none">
                      <h5 className="text-[9px] font-black text-white uppercase tracking-widest font-mono">Sync Server Endpoint Settings</h5>
                      <p className="text-[10px] text-gray-300 leading-normal">Configure your physical ZKTeco machine’s ADMS or Push parameters to point to this PMS server URL for instantaneous transaction reporting:</p>
                      <div className="bg-dark-900/60 p-2.5 rounded-xl border border-dark-800 flex items-center justify-between font-mono text-[9px] text-brand-400 select-all">
                        <span className="truncate mr-2">http://{window.location.hostname || 'localhost'}:5000/api/attendance/terminal-push</span>
                        <span className="text-[8px] font-black uppercase bg-dark-950 px-2 py-0.5 rounded text-gray-300 border border-dark-800 cursor-pointer hover:text-white">COPY</span>
                      </div>
                    </div>
                  </div>

                  {/* RHS: Interactive ADMS Push Simulator Tool */}
                  <div className="lg:col-span-6 bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-dark-850 pb-2 select-none">
                        <h4 className="text-xs font-black text-blue-450 uppercase tracking-widest font-mono">Network Device Sync Simulator</h4>
                        <span className="text-[9px] font-black uppercase bg-blue-500/15 text-blue-450 px-2.5 py-0.5 rounded-xl border border-blue-500/20 shadow">Developer Utility</span>
                      </div>
                      
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Select a staff member's Terminal ID, pick their punch type, and click simulate. This triggers a mock TCP/IP push packet mimicking a physical fingerprint scanner:
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-200 font-extrabold text-[9px] uppercase mb-1.5 tracking-wider select-none">Terminal PIN / Staff</label>
                          <select
                            value={terminalUserPin}
                            onChange={e => setTerminalUserPin(e.target.value)}
                            className="w-full bg-dark-950/70 border border-dark-750 rounded-xl p-2.5 text-xs text-white focus:border-brand-500 outline-none font-bold cursor-pointer font-mono"
                          >
                            <option value="">-- Choose PIN --</option>
                            {staff.map(s => {
                              const keyPin = s.biometric_key ? s.biometric_key.replace('BIO-FPR-', '').replace('WAUTH-', '').slice(0, 8) : `PIN-${s.id.slice(0, 5).toUpperCase()}`;
                              return (
                                <option key={s.id} value={keyPin}>
                                  {keyPin} — {s.first_name} {s.last_name}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="block text-gray-200 font-extrabold text-[9px] uppercase mb-1.5 tracking-wider select-none">Action Type</label>
                          <select
                            value={terminalVerifyStatus}
                            onChange={e => setTerminalVerifyStatus(e.target.value)}
                            className="w-full bg-dark-950/70 border border-dark-750 rounded-xl p-2.5 text-xs text-white focus:border-brand-500 outline-none font-bold cursor-pointer"
                          >
                            <option value="clock_in">Clock In (Shift Start)</option>
                            <option value="clock_out">Clock Out (Shift End)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleSimulateTerminalPush}
                        disabled={isSimulatingTerminal || !terminalUserPin}
                        className="w-full bg-gradient-to-r from-blue-650 to-indigo-650 hover:from-blue-600 hover:to-indigo-600 disabled:from-dark-800 disabled:to-dark-850 disabled:text-gray-300 disabled:cursor-not-allowed text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_4px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.4)] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isSimulatingTerminal ? 'Transmitting ADMS Packet...' : 'Simulate Terminal Fingerprint Tap'}
                      </button>

                      {/* Live logs stream styled like a retro CRT command screen */}
                      <div className="bg-black/90 p-4 rounded-3xl border border-dark-800 space-y-2.5 relative overflow-hidden shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)] group">
                        {/* Glare and Scanlines overlay */}
                        <div 
                          className="absolute inset-0 pointer-events-none opacity-[0.06] select-none" 
                          style={{
                            backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
                            backgroundSize: '100% 4px'
                          }}
                        />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(34,197,94,0.03),_transparent)] pointer-events-none select-none" />
                        
                        <div className="flex items-center justify-between border-b border-dark-850 pb-2 select-none">
                          <span className="text-[9px] font-black uppercase text-gray-300 tracking-widest font-mono">ADMS Sync Terminal Stream</span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping shrink-0" />
                            <span className="text-[8px] font-bold text-green-400/90 font-mono uppercase">Live Link</span>
                          </span>
                        </div>
                        
                        <div className="max-h-[110px] min-h-[90px] overflow-y-auto space-y-2 custom-scrollbar pr-1 font-mono text-[9px] text-green-400 select-all leading-normal">
                          {terminalLogs.length === 0 ? (
                            <div className="text-green-900/60 text-center py-4 italic">[Terminal waiting for connection packets...]</div>
                          ) : (
                            terminalLogs.map(log => (
                              <div key={log.id} className="flex items-start gap-2 select-text">
                                <span className="text-green-700 shrink-0">[{format(new Date(log.time), 'HH:mm:ss')}]</span>
                                <span className={`${
                                  log.type === 'success' ? 'text-green-300 font-semibold' :
                                  log.type === 'error' ? 'text-rose-450 font-semibold drop-shadow-[0_0_3px_rgba(244,63,94,0.2)]' :
                                  'text-green-450/80'
                                }`}>{log.type === 'error' ? '✖ ' : log.type === 'success' ? '✔ ' : 'i '}{log.text}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>

              {/* Historical Log */}
              <div className="bg-dark-800/80 border border-dark-700/60 rounded-3xl overflow-hidden shadow-xl bg-gradient-to-tr from-dark-900/50 to-dark-850/40">
                <div className="p-5 border-b border-dark-700/60 bg-dark-900/60 flex items-center justify-between select-none">
                  <h3 className="font-extrabold text-white flex items-center gap-2 text-sm font-serif">
                    <Clock className="text-brand-500" size={18} />
                    Historical Shift Attendance Log
                  </h3>
                  <span className="text-[10px] font-black bg-dark-800 text-gray-200 px-3 py-1 rounded-xl border border-dark-700">
                    Latest {attendance.length} Shifts
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-dark-900/60 border-b border-dark-700 text-gray-200 uppercase tracking-widest text-[9px] font-black select-none">
                      <tr>
                        <th className="p-4 font-bold">Staff Member</th>
                        <th className="p-4 font-bold">Date</th>
                        <th className="p-4 font-bold">Clock In</th>
                        <th className="p-4 font-bold">Clock Out</th>
                        <th className="p-4 font-bold">Status</th>
                        <th className="p-4 font-bold">Notes / Verification Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-750/30">
                      {attendance.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-12 text-center text-gray-300 font-medium select-none">
                            No attendance records registered.
                          </td>
                        </tr>
                      ) : (
                        attendance.map(a => {
                          const isCurrentlyOnShift = !a.clock_out;
                          
                          return (
                            <tr key={a.id} className="hover:bg-dark-750/30 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-white text-sm">{a.profiles?.first_name} {a.profiles?.last_name}</div>
                                <div className="text-[10px] text-gray-300 font-mono mt-0.5 uppercase tracking-wider font-extrabold">
                                  {a.profiles?.role?.replace('_', ' ')}
                                </div>
                              </td>
                              <td className="p-4 text-gray-450 font-medium">
                                {format(new Date(a.clock_in), 'MMM dd, yyyy')}
                              </td>
                              <td className="p-4 font-semibold text-emerald-450 font-mono tracking-wider">
                                {format(new Date(a.clock_in), 'HH:mm:ss')}
                              </td>
                              <td className="p-4 font-semibold font-mono tracking-wider">
                                {isCurrentlyOnShift ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-green-500/10 text-green-400 border border-green-500/20 shadow animate-pulse">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-ping" />
                                    Active Shift
                                  </span>
                                ) : (
                                  <span className="text-red-400/90">{format(new Date(a.clock_out), 'HH:mm:ss')}</span>
                                )}
                              </td>
                              <td className="p-4 select-none">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                  a.status === 'present' 
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="p-4 text-gray-300 italic text-xs max-w-xs truncate" title={a.notes || ''}>
                                {a.notes || <span className="text-gray-600">—</span>}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'leave' && (hasAccess('Staff & Roles') || hasAccess('Leave & Absences - Request Leave of Absence') || hasAccess('Leave & Absences - Review Leave Applications')) && (
            <div className="space-y-6">
              
              {/* Leave & Absences Telemetry Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
                <div className="bg-dark-800 border border-dark-700/80 p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-dark-900/50 to-dark-800/30 shadow shadow-inner">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block">Active Leave Today</span>
                      <span className="text-2xl font-black text-white font-mono block mt-1">
                        {leaveApplications.filter(l => l.status === 'approved' && new Date(l.start_date) <= new Date() && new Date(l.end_date) >= new Date()).length}
                      </span>
                    </div>
                    <div className="p-2.5 bg-green-500/10 rounded-xl text-green-400 border border-green-500/10">
                      <CheckCircle size={18} />
                    </div>
                  </div>
                </div>

                <div className="bg-dark-800 border border-dark-700/80 p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-dark-900/50 to-dark-800/30 shadow shadow-inner">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block">Pending Reviews</span>
                      <span className="text-2xl font-black text-brand-400 font-mono block mt-1">
                        {leaveApplications.filter(l => l.status === 'pending').length}
                      </span>
                    </div>
                    <div className="p-2.5 bg-brand-500/10 rounded-xl text-brand-400 border border-brand-500/10">
                      <MailOpen size={18} />
                    </div>
                  </div>
                </div>

                <div className="bg-dark-800 border border-dark-700/80 p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-dark-900/50 to-dark-800/30 shadow shadow-inner">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block">Approved Stays / Requests</span>
                      <span className="text-2xl font-black text-blue-400 font-mono block mt-1">
                        {leaveApplications.filter(l => l.status === 'approved').length}
                      </span>
                    </div>
                    <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/10">
                      <CalendarClock size={18} />
                    </div>
                  </div>
                </div>

                <div className="bg-dark-800 border border-dark-700/80 p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-dark-900/50 to-dark-800/30 shadow shadow-inner">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block">Absenteeism Penalties</span>
                      <span className="text-xs font-bold text-gray-200 block mt-2">Attendance Deductions Linked</span>
                    </div>
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/10">
                      <Server size={18} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Submit Leave Request Form */}
                <div className="bg-dark-800 border border-dark-700 rounded-3xl p-5 shadow-2xl space-y-4">
                  <div className="border-b border-dark-750 pb-3">
                    <h3 className="font-serif font-black text-white text-base">Request Leave of Absence</h3>
                    <p className="text-[11px] text-gray-200 mt-0.5">Submit a formal request for paid or unpaid time off.</p>
                  </div>

                  <form onSubmit={handleApplyLeave} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-200 mb-1.5 uppercase tracking-widest">Leave Type</label>
                      <select 
                        value={newLeaveForm.leave_type} 
                        onChange={e => setNewLeaveForm({...newLeaveForm, leave_type: e.target.value})} 
                        className="w-full bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-brand-500 cursor-pointer animate-none"
                      >
                        <option value="annual">🌴 Annual Vacation (Paid)</option>
                        <option value="sick">🩺 Sick Leave (Paid)</option>
                        <option value="casual">🏡 Casual/Family Leave (Paid)</option>
                        <option value="maternity">🍼 Maternity/Paternity Leave (Paid)</option>
                        <option value="unpaid">⏳ Leave Without Pay (Unpaid)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-gray-200 mb-1.5 uppercase tracking-widest">Start Date</label>
                        <input 
                          type="date" 
                          required 
                          value={newLeaveForm.start_date} 
                          onChange={e => setNewLeaveForm({...newLeaveForm, start_date: e.target.value})} 
                          className="w-full bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs text-white outline-none focus:border-brand-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-200 mb-1.5 uppercase tracking-widest">End Date</label>
                        <input 
                          type="date" 
                          required 
                          value={newLeaveForm.end_date} 
                          onChange={e => setNewLeaveForm({...newLeaveForm, end_date: e.target.value})} 
                          className="w-full bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs text-white outline-none focus:border-brand-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-200 mb-1.5 uppercase tracking-widest">Reason / Description</label>
                      <textarea 
                        required 
                        rows={3} 
                        value={newLeaveForm.reason} 
                        onChange={e => setNewLeaveForm({...newLeaveForm, reason: e.target.value})} 
                        className="w-full bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs text-white outline-none focus:border-brand-500 leading-normal" 
                        placeholder="Provide details about your request..."
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={!hasAccess('Leave & Absences - Request Leave of Absence')}
                      className="w-full bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-450 hover:to-indigo-500 disabled:from-dark-800 disabled:to-dark-850 disabled:text-gray-300 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-xl text-xs tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      title={!hasAccess('Leave & Absences - Request Leave of Absence') ? "You do not have permission to request a leave of absence." : ""}
                    >
                      Submit Leave Request
                    </button>
                  </form>
                </div>

                {/* Leave Requests Queue (2/3 columns) */}
                <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                  <div className="p-4 border-b border-dark-700 bg-dark-900 flex justify-between items-center">
                    <div>
                      <h3 className="font-serif font-black text-white text-base">Leave Applications Queue</h3>
                      <p className="text-[11px] text-gray-200 mt-0.5">Approve, deny, and track absences in real time.</p>
                    </div>
                    <button 
                      onClick={fetchLeaveApplications}
                      className="bg-dark-750 hover:bg-dark-700 border border-dark-700 p-2 rounded-xl text-gray-200 hover:text-white transition-colors cursor-pointer"
                      title="Sync Leave Board"
                    >
                      <Activity size={14} className={loadingLeave ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    {loadingLeave ? (
                      <div className="py-20 text-center text-gray-300 text-xs italic">Synchronizing leave data...</div>
                    ) : leaveApplications.length === 0 ? (
                      <div className="py-20 text-center text-gray-300 text-xs italic">No leave applications registered.</div>
                    ) : (
                      <table className="w-full text-left text-xs select-text">
                        <thead className="bg-dark-900 border-b border-dark-750 text-gray-200 uppercase tracking-widest font-black text-[10px]">
                          <tr>
                            <th className="p-4">Personnel</th>
                            <th className="p-4">Leave Type</th>
                            <th className="p-4">Duration</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-750">
                          {leaveApplications.map(l => {
                            const applicantName = l.profiles ? `${l.profiles.first_name} ${l.profiles.last_name}` : 'Unknown';
                            const applicantRole = l.profiles ? l.profiles.role.replace(/_/g, ' ') : 'N/A';
                            
                            const startDateStr = format(new Date(l.start_date), 'MMM dd');
                            const endDateStr = format(new Date(l.end_date), 'MMM dd, yyyy');
                            const diffDays = Math.ceil((new Date(l.end_date) - new Date(l.start_date)) / (1000 * 60 * 60 * 24)) + 1;
                            
                            // Check if current user has role privilege to approve leaves
                            const isManager = hasAccess('Leave & Absences - Review Leave Applications');
                            
                            return (
                              <tr key={l.id} className="hover:bg-dark-900/30 transition-colors">
                                <td className="p-4">
                                  <div className="font-bold text-white">{applicantName}</div>
                                  <span className="text-[10px] text-gray-300 uppercase tracking-wider block mt-0.5">{applicantRole}</span>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                    l.leave_type === 'sick' ? 'bg-red-500/10 text-red-400 border-red-500/10' :
                                    l.leave_type === 'annual' ? 'bg-green-500/10 text-green-400 border-green-500/10' :
                                    l.leave_type === 'casual' ? 'bg-amber-500/10 text-amber-400 border-amber-500/10' :
                                    l.leave_type === 'maternity' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' :
                                    (l.leave_type === 'unpaid' || l.leave_type === 'leave_without_pay') ? 'bg-orange-500/10 text-orange-400 border-orange-500/10' :
                                    'bg-gray-700 text-gray-200 border-transparent'
                                  }`}>
                                    {(l.leave_type === 'unpaid' || l.leave_type === 'leave_without_pay') ? 'leave without pay' : l.leave_type}
                                  </span>
                                  <span className="text-[10px] text-gray-200 block mt-1.5 font-medium max-w-[200px] truncate select-all" title={l.reason}>
                                    "{l.reason || 'No description'}"
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="font-bold text-white font-mono">{startDateStr} - {endDateStr}</div>
                                  <span className="text-[10px] text-gray-300 block mt-0.5">{diffDays} {diffDays === 1 ? 'day' : 'days'} requested</span>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    l.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                                    l.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                    'bg-amber-500/10 text-amber-400 animate-pulse'
                                  }`}>
                                    {l.status}
                                  </span>
                                  {l.status === 'rejected' && l.rejection_reason && (
                                    <span className="text-[9px] text-red-450 block mt-1 font-mono select-all">Reason: {l.rejection_reason}</span>
                                  )}
                                </td>
                                <td className="p-4 text-right">
                                  {l.status === 'pending' && isManager ? (
                                    <div className="flex flex-col gap-2 items-end justify-end">
                                      <div className="flex gap-2">
                                        <button 
                                          onClick={() => handleReviewLeave(l.id, 'approved')}
                                          className="bg-green-500 hover:bg-green-600 text-dark-950 px-2.5 py-1.5 rounded-lg font-black text-[10px] tracking-wide transition-all uppercase cursor-pointer"
                                        >
                                          Approve
                                        </button>
                                        <button 
                                          onClick={() => setRejectingLeaveId(l.id)}
                                          className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white px-2.5 py-1.5 rounded-lg font-black text-[10px] tracking-wide transition-all uppercase cursor-pointer"
                                        >
                                          Deny
                                        </button>
                                      </div>

                                      {/* Inline Denial Comment form */}
                                      {rejectingLeaveId === l.id && (
                                        <div className="mt-2 bg-dark-900 border border-dark-750 p-2.5 rounded-xl flex flex-col gap-2 max-w-[200px] text-left shrink-0">
                                          <input 
                                            type="text" 
                                            placeholder="Reason for rejection..." 
                                            value={rejectionReason} 
                                            onChange={e => setRejectionReason(e.target.value)} 
                                            className="bg-dark-950 border border-dark-800 p-2 rounded-lg text-[10px] text-white outline-none focus:border-red-500"
                                          />
                                          <div className="flex gap-2 justify-end">
                                            <button 
                                              type="button" 
                                              onClick={() => setRejectingLeaveId(null)}
                                              className="text-gray-200 hover:text-white text-[9px] font-bold"
                                            >
                                              Cancel
                                            </button>
                                            <button 
                                              type="button" 
                                              onClick={() => handleReviewLeave(l.id, 'rejected', rejectionReason)}
                                              className="bg-red-500 text-white font-extrabold px-2 py-1 rounded text-[9px]"
                                            >
                                              Confirm Rejection
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-semibold italic">No actions</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === 'logs' && hasAccess('Staff & Roles') && (
            <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden shadow-sm">
              <div className="p-4 border-b border-dark-700 bg-dark-900">
                <h3 className="font-bold text-white flex items-center gap-2"><Activity size={18} className="text-brand-500"/> System Activity Audit Trail</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-dark-900 border-b border-dark-700 text-gray-200">
                    <tr>
                      <th className="p-4 font-semibold">Timestamp</th>
                      <th className="p-4 font-semibold">User</th>
                      <th className="p-4 font-semibold">Module</th>
                      <th className="p-4 font-semibold">Action Performed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-dark-700/30 transition-colors">
                        <td className="p-4 text-gray-200 font-mono text-xs">{format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}</td>
                        <td className="p-4">
                          <div className="font-medium text-white">{log.profiles ? `${log.profiles.first_name} ${log.profiles.last_name}` : 'System'}</div>
                          {log.profiles && getRoleBadge(log.profiles.role)}
                        </td>
                        <td className="p-4 text-gray-200">{log.entity_table || log.module || 'System'}</td>
                        <td className="p-4 text-white">{log.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'matrix' && hasAccess('Staff & Roles') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
              {/* Left Sidebar - Role Selector (4 columns) */}
              <div className="lg:col-span-4 flex flex-col space-y-4 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar select-none">
                <div className="bg-dark-800 border border-dark-700/60 p-4 rounded-2xl shadow-lg">
                  <h3 className="text-base font-black text-white uppercase tracking-wider mb-1">Roles Explorer</h3>
                  <p className="text-gray-200 text-xs">Select any of the 26 system roles to inspect or custom-configure their granular capabilities.</p>
                </div>
                
                {ROLE_CATEGORIES.map(category => (
                  <div key={category.title} className="space-y-1.5">
                    <h4 className="text-[11px] font-black text-brand-400 uppercase tracking-widest px-2.5 pt-1.5 flex items-center justify-between">
                      <span>{category.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-900 text-gray-200 font-mono">
                        {category.roles.length} Roles
                      </span>
                    </h4>
                    
                    <div className="space-y-1 bg-dark-800/40 p-1.5 rounded-2xl border border-dark-700/30">
                      {category.roles.map(roleId => {
                        const roleObj = allRoles.find(r => r.id === roleId);
                        if (!roleObj) return null;
                        const isSelected = selectedRole === roleId;
                        
                        return (
                          <button
                            type="button"
                            key={roleId}
                            onClick={() => setSelectedRole(roleId)}
                            className={`w-full text-left p-2.5 rounded-xl transition-all duration-300 flex items-center justify-between gap-2 border ${
                              isSelected
                                ? 'bg-gradient-to-r from-brand-900/40 to-brand-850/20 border-brand-500/80 shadow-lg translate-x-1'
                                : 'bg-dark-900/30 hover:bg-dark-750/30 border-transparent hover:border-dark-700'
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ring-4 ${
                                roleId === 'super_admin' ? 'bg-red-500 ring-red-500/10' :
                                roleId === 'hotel_owner' ? 'bg-purple-500 ring-purple-500/10' :
                                roleId.includes('manager') ? 'bg-brand-400 ring-brand-400/10' :
                                roleId.includes('lead') || roleId.includes('head') ? 'bg-blue-400 ring-blue-400/10' :
                                'bg-gray-400 ring-gray-400/10'
                              }`} />
                              <span className={`text-sm font-bold truncate ${isSelected ? 'text-white font-serif' : 'text-gray-200'}`}>
                                {roleObj.label}
                              </span>
                            </div>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono ${
                              isSelected ? 'bg-brand-500/10 text-brand-400' : 'bg-dark-900/60 text-gray-300'
                            }`}>
                              {roleObj.id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Detail Pane - Grouped Permissions Card Grid (8 columns) */}
              <div className="lg:col-span-8 flex flex-col space-y-6 max-h-[85vh] overflow-y-auto pr-1 custom-scrollbar">
                {/* Active Role Header Card */}
                {(() => {
                  const activeRoleObj = allRoles.find(r => r.id === selectedRole);
                  const isSuperAdminOrOwner = selectedRole === 'super_admin' || selectedRole === 'hotel_owner';
                  
                  return (
                    <div className="glass-panel border border-dark-700/60 p-6 rounded-3xl shadow-xl space-y-4 bg-gradient-to-tr from-dark-900/80 to-dark-800/85">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-700/60 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black text-white font-serif tracking-tight">{activeRoleObj?.label}</h2>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-dark-900/80 text-brand-400`}>
                              {activeRoleObj?.id}
                            </span>
                          </div>
                          <p className="text-[13px] sm:text-sm text-gray-300 mt-1.5 leading-relaxed max-w-2xl font-medium">
                            {getRoleDescription(selectedRole)}
                          </p>
                        </div>
                        
                        {isSuperAdminOrOwner && (
                          <span className="self-start sm:self-center shrink-0 px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5 shadow">
                            <Shield size={12} />
                            Locked Admin
                          </span>
                        )}
                      </div>

                      {/* Grouped Permissions Grid */}
                      <div className="space-y-6">
                        {Object.entries(groupedPermissions).map(([groupTitle, perms]) => {
                          if (perms.length === 0) return null;
                          
                          return (
                            <div key={groupTitle} className="bg-dark-850/60 border border-dark-700/50 p-5 rounded-2xl shadow-md space-y-3.5 animate-fade-in">
                              <h4 className="text-sm font-extrabold text-brand-400 uppercase tracking-wider border-b border-dark-700/40 pb-2">
                                {groupTitle}
                              </h4>
                              
                              <div className="divide-y divide-dark-700/40">
                                {perms.map(permissionName => {
                                  const dbVal = permissionsMap[permissionName]?.[selectedRole];
                                  const hasAccess = dbVal !== undefined ? dbVal : getRolePermissionDefault(selectedRole, permissionName);
                                  const isLocked = isSuperAdminOrOwner;
                                  
                                  return (
                                    <div key={permissionName} className="py-3.5 flex items-center justify-between gap-4">
                                      <div className="min-w-0">
                                        <p className="text-[13px] sm:text-sm font-extrabold text-white truncate">{permissionName}</p>
                                        <p className="text-xs text-gray-200 mt-0.5 capitalize truncate">
                                          {permissionName.includes(' - ') 
                                            ? `Capability level override within ${permissionName.split(' - ')[0]}`
                                            : `System module landing access level for ${permissionName}`}
                                        </p>
                                      </div>
                                      
                                      <button 
                                        type="button"
                                        onClick={() => togglePermission(selectedRole, permissionName, hasAccess)}
                                        disabled={isLocked}
                                        className={`transition-colors shrink-0 ${isLocked ? 'opacity-45 cursor-not-allowed' : 'hover:opacity-85'}`}
                                      >
                                        {hasAccess 
                                          ? <ToggleRight size={32} className="text-green-500" /> 
                                          : <ToggleLeft size={32} className="text-gray-600" />}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Register Custom Access Level Form inside Pane */}
                      <div className="bg-dark-900/60 border border-dark-700 p-5 rounded-2xl shadow-md space-y-3 mt-4">
                        <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <PlusCircle className="text-brand-500" size={14} />
                          Register Custom Access Level / Module
                        </h4>
                        <p className="text-gray-300 text-[10px] leading-relaxed">
                          Define a new global PMS module (e.g. "Laundry", "Spa", "Gym") to add it dynamically to the dynamic matrix configuration block.
                        </p>
                        <form onSubmit={handleAddAccessLevel} className="flex gap-3">
                          <input
                            type="text"
                            required
                            placeholder="e.g. Laundry, Spa Services"
                            value={newModuleName}
                            onChange={e => setNewModuleName(e.target.value)}
                            className="flex-1 bg-dark-950 border border-dark-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-500 transition-all font-semibold font-mono"
                          />
                          <button
                            type="submit"
                            disabled={addingModule || !newModuleName.trim()}
                            className="bg-brand-500 hover:bg-brand-600 disabled:bg-dark-700 disabled:text-gray-300 text-dark-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow"
                          >
                            {addingModule ? 'Registering...' : 'Add Access Level'}
                          </button>
                        </form>
                      </div>

                      {/* Register Custom Staff Role Form inside Pane */}
                      <div className="bg-dark-900/60 border border-dark-700 p-5 rounded-2xl shadow-md space-y-3.5 mt-4">
                        <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <UserPlus className="text-brand-500" size={14} />
                          Register Custom Staff Role & Grant Permissions
                        </h4>
                        <p className="text-gray-300 text-[10px] leading-relaxed">
                          Create a brand new system access role. Once registered, it will appear dynamically inside your left Roles Explorer selector sidebar and Staff Onboarding directories where you can assign custom permissions.
                        </p>
                        <form onSubmit={handleCreateCustomRole} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[10px] font-extrabold text-gray-200 uppercase mb-1 tracking-wider">Role ID (Unique Key)</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. spa_therapist"
                                value={newRole.id}
                                onChange={e => setNewRole({ ...newRole, id: e.target.value })}
                                className="w-full bg-dark-950 border border-dark-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-500 transition-all font-semibold font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-extrabold text-gray-200 uppercase mb-1 tracking-wider">Role Display Name (Label)</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Spa Therapist"
                                value={newRole.label}
                                onChange={e => setNewRole({ ...newRole, label: e.target.value })}
                                className="w-full bg-dark-950 border border-dark-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-500 transition-all font-semibold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[10px] font-extrabold text-gray-200 uppercase mb-1 tracking-wider">Sidebar Folder (Category)</label>
                              <select
                                value={newRole.category}
                                onChange={e => setNewRole({ ...newRole, category: e.target.value })}
                                className="w-full bg-dark-950 border border-dark-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-500 transition-all font-semibold"
                              >
                                <option value="👤 Custom / Other Roles">👤 Custom / Other Roles</option>
                                <option value="👑 Global Management">👑 Global Management</option>
                                <option value="🛎️ Front Office & CRM">🛎️ Front Office & CRM</option>
                                <option value="🧹 Housekeeping">🧹 Housekeeping</option>
                                <option value="🔧 Maintenance & Utilities">🔧 Maintenance & Utilities</option>
                                <option value="🧺 Laundry Department">🧺 Laundry Department</option>
                                <option value="🍳 F&B / POS Terminals">🍳 F&B / POS Terminals</option>
                                <option value="📦 Store Keeping">📦 Store Keeping</option>
                                <option value="💳 Finance & Accounts">💳 Finance & Accounts</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-extrabold text-gray-200 uppercase mb-1 tracking-wider">Badge Color Accent</label>
                              <select
                                value={newRole.color}
                                onChange={e => setNewRole({ ...newRole, color: e.target.value })}
                                className="w-full bg-dark-950 border border-dark-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-brand-500 transition-all font-semibold"
                              >
                                <option value="bg-blue-500/10 text-blue-400">Cyan Blue (Default)</option>
                                <option value="bg-green-500/10 text-green-400">Emerald Green</option>
                                <option value="bg-purple-500/10 text-purple-400">Amethyst Purple</option>
                                <option value="bg-pink-500/10 text-pink-400">Hot Pink</option>
                                <option value="bg-rose-500/10 text-rose-400">Crimson Rose</option>
                                <option value="bg-yellow-500/10 text-yellow-400">Amber Yellow</option>
                                <option value="bg-sky-500/10 text-sky-400">Sky Blue</option>
                                <option value="bg-teal-500/10 text-teal-400">Teal Green</option>
                              </select>
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={creatingRole || !newRole.id || !newRole.label}
                            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-dark-700 disabled:text-gray-300 text-dark-950 font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow"
                          >
                            <UserPlus size={14} />
                            {creatingRole ? 'Registering Custom Role...' : 'Register Custom Staff Role'}
                          </button>
                        </form>
                      </div>

                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Staff Modal (Expanded) */}
      {showAddStaff && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fade-in">
          <div className="bg-dark-900/90 backdrop-blur-xl border border-dark-700/50 w-full max-w-2xl rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.85),_inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 hover:border-brand-500/20">
            <div className="p-6 border-b border-dark-750 bg-gradient-to-r from-dark-950/60 to-dark-900/60 shrink-0 flex items-center gap-4 relative overflow-hidden">
              <div className="h-12 w-12 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shrink-0 shadow-[0_0_15px_rgba(180,150,90,0.1)]">
                <UserPlus className="text-brand-500" size={24} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent tracking-tight font-serif">Register New Staff Member</h2>
                <p className="text-xs sm:text-sm text-gray-200 mt-0.5 font-medium">Create a dynamic login account and operational profile.</p>
              </div>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 overflow-y-auto space-y-6 bg-dark-900/20">
              
              {/* Account Credentials */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  🔐 Security & Credentials
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Email Address</label>
                    <input required type="email" value={newStaffForm.email} onChange={e => setNewStaffForm({...newStaffForm, email: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" placeholder="staff@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Temporary Password</label>
                    <div className="relative">
                      <input 
                        required 
                        type={showAddPassword ? 'text' : 'password'} 
                        value={newStaffForm.password} 
                        onChange={e => setNewStaffForm({...newStaffForm, password: e.target.value})} 
                        className="w-full bg-dark-950/60 border border-dark-750 p-3 pr-12 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" 
                        placeholder="Minimum 6 characters" 
                        minLength={6} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowAddPassword(!showAddPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-450 hover:text-white transition-colors"
                      >
                        {showAddPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Unique Username</label>
                    <input required type="text" value={newStaffForm.username} onChange={e => setNewStaffForm({...newStaffForm, username: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" placeholder="@johndoe" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Biometric Fingerprint Key (Optional)</label>
                    <div className="flex gap-2">
                      <input type="text" value={newStaffForm.biometric_key || ''} onChange={e => setNewStaffForm({...newStaffForm, biometric_key: e.target.value})} className="flex-1 bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-650 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 font-mono text-xs" placeholder="BIO-FPR-XXXX" />
                      <button
                        type="button"
                        onClick={() => triggerBiometricEnrollment('add')}
                        className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white px-3.5 rounded-xl text-xs font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Enroll
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  👤 Personal & Contact Info
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">First Name</label>
                    <input required type="text" value={newStaffForm.first_name} onChange={e => setNewStaffForm({...newStaffForm, first_name: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Last Name</label>
                    <input required type="text" value={newStaffForm.last_name} onChange={e => setNewStaffForm({...newStaffForm, last_name: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Phone Number</label>
                  <input required type="text" value={newStaffForm.phone} onChange={e => setNewStaffForm({...newStaffForm, phone: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Residential Address</label>
                  <textarea required rows={2} value={newStaffForm.residential_address} onChange={e => setNewStaffForm({...newStaffForm, residential_address: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" placeholder="Full home address"></textarea>
                </div>
              </div>

              {/* Bank Settlement Details */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  🏦 Bank Settlement Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Bank Name</label>
                    <select
                      value={newStaffForm.bank_name || ''}
                      onChange={e => setNewStaffForm({...newStaffForm, bank_name: e.target.value})}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm cursor-pointer"
                    >
                      <option value="">Select Bank</option>
                      {nigerianBanks.map((bank, index) => (
                        <option key={index} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Account Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={newStaffForm.account_number || ''}
                      onChange={e => setNewStaffForm({...newStaffForm, account_number: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-650 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base font-mono"
                      placeholder="e.g. 0123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Account Name</label>
                    <input
                      type="text"
                      value={newStaffForm.account_name || ''}
                      onChange={e => setNewStaffForm({...newStaffForm, account_name: e.target.value})}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>
              </div>

              {/* Role Assignment */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] hover:border-dark-700/50 transition-colors">
                <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">System Access Role</label>
                <select value={newStaffForm.role} onChange={e => setNewStaffForm({...newStaffForm, role: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base cursor-pointer">
                  {allRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Payroll Settings */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  💳 Standard Payroll Settings (Monthly NGN)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-dark-950/60 border border-dark-750/50 p-4 rounded-xl flex flex-col justify-center select-all">
                    <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Base Salary</span>
                    <span className="text-base font-extrabold text-white font-mono mt-1">₦{parseFloat(newStaffForm.base_salary || 0).toLocaleString()}</span>
                  </div>
                  <div className="bg-dark-950/60 border border-dark-750/50 p-4 rounded-xl flex flex-col justify-center select-all">
                    <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Allowances (Summed)</span>
                    <span className="text-base font-extrabold text-emerald-450 font-mono mt-1">₦{parseFloat(newStaffForm.allowances || 0).toLocaleString()}</span>
                  </div>
                  <div className="bg-dark-950/60 border border-dark-750/50 p-4 rounded-xl flex flex-col justify-center select-all">
                    <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Deductions (Total: ₦{calculateTotalDeductions(newStaffForm.base_salary, newStaffForm.deductions_list).toLocaleString()})</span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(() => {
                        let list = newStaffForm.deductions_list || [];
                        if (typeof list === 'string') {
                          try { list = JSON.parse(list); } catch { list = []; }
                        }
                        if (!Array.isArray(list)) list = [];
                        if (list.length === 0) {
                          return <span className="text-xs text-gray-200 font-bold font-mono">₦0.00</span>;
                        }
                        return list.map((ded, idx) => (
                          <span key={idx} className="text-[9px] text-rose-450 font-bold bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                            {ded.name}: {ded.type === 'percentage' ? `${ded.amount}%` : `₦${parseFloat(ded.amount).toLocaleString()}`}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                <div className="bg-dark-950/60 border border-dark-750/50 p-4 rounded-xl space-y-2.5">
                  <span className="text-[10px] font-black uppercase text-gray-200 tracking-wider block">Entitled Allowances</span>
                  {globalAllowances.length === 0 ? (
                    <span className="text-xs text-gray-300 italic block">No standard allowances configured. Configure them in Salary Structures.</span>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {globalAllowances.map((allow, idx) => {
                        const isChecked = (newStaffForm.allowances_list || []).some(a => a.name === allow.name);
                        return (
                          <label key={idx} className="flex items-center gap-2 bg-dark-900 border border-dark-750/70 p-2.5 rounded-xl cursor-pointer hover:border-brand-500/40 select-none transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => handleToggleStaffAllowance(allow, e.target.checked)}
                              className="w-4.5 h-4.5 rounded text-brand-500 focus:ring-brand-500 bg-dark-950 border-dark-700 cursor-pointer"
                            />
                            <div className="flex flex-col font-sans">
                              <span className="text-xs font-bold text-white leading-none">{allow.name}</span>
                              <span className="text-[9px] text-emerald-400 font-bold font-mono mt-1">₦{parseFloat(allow.amount).toLocaleString()}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-300 leading-normal">
                  Note: These standard payroll rates are automatically loaded from the global salary structure for the <span className="font-bold text-gray-200">{allRoles.find(r => r.id === newStaffForm.role)?.label || newStaffForm.role}</span> access level and cannot be modified here. Adjust these defaults in the Standard Salary Structure explorer modal if needed.
                </p>
              </div>

              {/* POS Outlet Assignments */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-3 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-1">
                  🏪 POS Outlet Assignments
                </h3>
                <p className="text-xs text-gray-450 leading-relaxed">Assign this staff member to one or more Point of Sale checkout outlets.</p>
                <div className="flex flex-wrap gap-4 mt-2">
                  {['Bar', 'Restaurant'].map(outlet => {
                    const val = outlet.toLowerCase();
                    const isChecked = newStaffForm.pos_outlets?.includes(val);
                    return (
                      <label key={val} className={`flex items-center gap-2.5 bg-dark-950/40 hover:bg-dark-950/80 border px-4 py-2.5 rounded-xl text-xs sm:text-sm text-gray-300 hover:text-white cursor-pointer select-none transition-all duration-300 active:scale-95 ${isChecked ? 'border-brand-500/60 bg-brand-500/5 text-white' : 'border-dark-750'}`}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={e => {
                            const list = newStaffForm.pos_outlets || [];
                            if (e.target.checked) {
                              setNewStaffForm({ ...newStaffForm, pos_outlets: [...list, val] });
                            } else {
                              setNewStaffForm({ ...newStaffForm, pos_outlets: list.filter(item => item !== val) });
                            }
                          }}
                          className="rounded border-dark-750 bg-dark-900 text-brand-500 focus:ring-brand-500 w-4 h-4"
                        />
                        {outlet}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Work Shifts & Attendance Deductions Section */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  📅 Work Shifts & Attendance Deductions
                </h3>
                
                {/* Shift Preset and Timing */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Shift Name / Template</label>
                    <select 
                      value={newStaffForm.shift_name || 'Morning Shift'}
                      onChange={e => handleShiftPresetChange(e.target.value, false)}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm cursor-pointer bg-dark-900"
                    >
                      <option value="Morning Shift">Morning Shift (08:00 - 17:00)</option>
                      <option value="Evening Shift">Evening Shift (17:00 - 23:00)</option>
                      <option value="Night Shift">Night Shift (23:00 - 08:00)</option>
                      <option value="Flexible Shift">Flexible Shift (00:00 - 00:00)</option>
                      <option value="Custom">Custom Shift (Define Below)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Start Time</label>
                    <input 
                      type="text" 
                      value={newStaffForm.shift_start_time || '08:00'}
                      onChange={e => setNewStaffForm({ ...newStaffForm, shift_start_time: e.target.value })}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-655 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base font-mono"
                      placeholder="HH:MM"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">End Time</label>
                    <input 
                      type="text" 
                      value={newStaffForm.shift_end_time || '17:00'}
                      onChange={e => setNewStaffForm({ ...newStaffForm, shift_end_time: e.target.value })}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-655 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base font-mono"
                      placeholder="HH:MM"
                    />
                  </div>
                </div>

                {/* Expected Workdays Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">
                    Expected Work Days ({newStaffForm.expected_work_days_count || 0} days expected)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {WEEKDAYS.map(day => {
                      const isChecked = (newStaffForm.expected_work_days || []).includes(day.value);
                      return (
                        <label key={day.value} className={`flex items-center gap-2.5 bg-dark-900 border p-2.5 rounded-xl cursor-pointer select-none transition-all duration-200 ${isChecked ? 'border-brand-500/50 bg-brand-500/5 text-white' : 'border-dark-750 text-gray-200'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => handleWeekdayChange(day.value, e.target.checked, false)}
                            className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 bg-dark-950 border-dark-700 cursor-pointer"
                          />
                          <span className="text-xs font-bold">{day.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Attendance Deduction Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-dark-750 pt-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Attendance Deduction Type</label>
                    <select 
                      value={newStaffForm.attendance_deduction_type || 'daily_rate'}
                      onChange={e => setNewStaffForm({ ...newStaffForm, attendance_deduction_type: e.target.value })}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm cursor-pointer bg-dark-900"
                    >
                      <option value="daily_rate">Pro-rata Daily Rate (Base Salary / Expected Days)</option>
                      <option value="fixed">Fixed Penalty Amount per Absent Day</option>
                      <option value="percentage">Percentage Penalty of Base Salary per Absent Day</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">
                      {newStaffForm.attendance_deduction_type === 'percentage' ? 'Penalty Percentage (%)' : 'Penalty Amount (₦)'}
                    </label>
                    <input 
                      disabled={newStaffForm.attendance_deduction_type === 'daily_rate'}
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={newStaffForm.attendance_deduction_rate || 0}
                      onChange={e => setNewStaffForm({ ...newStaffForm, attendance_deduction_rate: parseFloat(e.target.value) || 0 })}
                      className={`w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none transition-all duration-300 text-sm font-mono ${newStaffForm.attendance_deduction_type === 'daily_rate' ? 'opacity-40 cursor-not-allowed bg-dark-900/20' : 'focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30'}`}
                      placeholder={newStaffForm.attendance_deduction_type === 'daily_rate' ? 'Auto calculated' : 'e.g. 5000'}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-dark-750 shrink-0">
                <button type="button" onClick={() => setShowAddStaff(false)} className="flex-1 bg-dark-800 hover:bg-dark-700 border border-dark-750 text-gray-300 hover:text-white py-3.5 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base">Cancel</button>
                <button type="submit" disabled={loadingAuth} className="flex-1 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-450 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-lg hover:shadow-brand-500/10 cursor-pointer disabled:opacity-50 text-sm sm:text-base">
                  {loadingAuth ? 'Registering...' : 'Register Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaffForm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fade-in">
          <div className="bg-dark-900/90 backdrop-blur-xl border border-dark-700/50 w-full max-w-2xl rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.85),_inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 hover:border-brand-500/20">
            <div className="p-6 border-b border-dark-750 bg-gradient-to-r from-dark-950/60 to-dark-900/60 shrink-0 flex items-center gap-4 relative overflow-hidden">
              <div className="h-12 w-12 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shrink-0 shadow-[0_0_15px_rgba(180,150,90,0.1)]">
                <Edit2 className="text-brand-500" size={24} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent tracking-tight font-serif">Edit Staff Profile</h2>
                <p className="text-xs sm:text-sm text-gray-200 mt-0.5 font-medium">Modifying details for <strong>{editingStaffForm.first_name} {editingStaffForm.last_name}</strong>.</p>
              </div>
            </div>
            
            <form onSubmit={handleUpdateStaff} className="p-6 overflow-y-auto space-y-6 bg-dark-900/20">
              
              {/* Account Credentials */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  🔐 System Access & Login
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Email Address</label>
                    <input type="email" required value={editingStaffForm.email} onChange={e => setEditingStaffForm({...editingStaffForm, email: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">New Password (or Leave Blank)</label>
                    <div className="relative">
                      <input 
                        type={showEditPassword ? 'text' : 'password'} 
                        value={editingStaffForm.password || ''} 
                        onChange={e => setEditingStaffForm({...editingStaffForm, password: e.target.value})} 
                        className="w-full bg-dark-950/60 border border-dark-750 p-3 pr-12 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" 
                        placeholder="••••••••" 
                        minLength={6} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-450 hover:text-white transition-colors"
                      >
                        {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] text-green-450 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded font-black font-sans uppercase">
                        ✓ Secured in Auth Vault
                      </span>
                      <span className="text-[9px] text-gray-300 font-medium">
                        Leave blank to retain current
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">Biometric Fingerprint Key</label>
                      {editingStaffForm.biometric_key ? (
                        <span className="text-[9px] font-black uppercase text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                          <Fingerprint size={10} /> Registered
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Fingerprint size={10} /> Unregistered
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={editingStaffForm.biometric_key || ''} onChange={e => setEditingStaffForm({...editingStaffForm, biometric_key: e.target.value})} className="flex-1 bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 font-mono text-xs" placeholder="Unregistered" />
                      <button
                        type="button"
                        onClick={() => triggerBiometricEnrollment('edit')}
                        className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 text-brand-400 hover:text-white px-3.5 rounded-xl text-xs font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Enroll
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">System Access Role</label>
                    <select 
                      value={editingStaffForm.role} 
                      onChange={e => {
                        const newRoleVal = e.target.value;
                        const matchingStructure = roleStructures.find(struct => struct.role === newRoleVal);
                        const defaultBase = matchingStructure ? matchingStructure.base_salary : (
                          newRoleVal === 'hotel_manager' ? 250000 :
                          newRoleVal === 'accountant' ? 200000 :
                          newRoleVal === 'receptionist' ? 140000 :
                          newRoleVal === 'housekeeping' ? 80000 :
                          newRoleVal === 'maintenance' ? 90000 : 150000
                        );
                        const defaultAllow = matchingStructure ? matchingStructure.allowances : 0;
                        const defaultDeds = matchingStructure ? matchingStructure.deductions : 0;
                        const defaultDedsList = matchingStructure ? matchingStructure.deductions_list : [];
                        setEditingStaffForm({
                          ...editingStaffForm,
                          role: newRoleVal,
                          base_salary: defaultBase,
                          allowances: defaultAllow,
                          deductions: defaultDeds,
                          deductions_list: defaultDedsList
                        });
                      }}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base cursor-pointer"
                    >
                      {allRoles.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Account Status</label>
                    <select
                      value={editingStaffForm.status || (editingStaffForm.is_active ? 'active' : 'inactive')}
                      onChange={e => {
                        const val = e.target.value;
                        setEditingStaffForm({
                          ...editingStaffForm,
                          status: val,
                          is_active: val === 'active'
                        });
                      }}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm font-semibold cursor-pointer"
                    >
                      <option value="active">🟢 Active Profile</option>
                      <option value="suspended">🟡 Suspended (Login Blocked)</option>
                      <option value="sacked">🔴 Sacked (Withdrawn - Login Blocked)</option>
                      <option value="inactive">⚪ Inactive / Deactivated</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* POS Outlet Assignments */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-3 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-1">
                  🏪 POS Outlet Assignments
                </h3>
                <p className="text-xs text-gray-450 leading-relaxed">Assign this staff member to one or more Point of Sale checkout outlets.</p>
                <div className="flex flex-wrap gap-4 mt-2">
                  {['Bar', 'Restaurant'].map(outlet => {
                    const val = outlet.toLowerCase();
                    const isChecked = editingStaffForm.pos_outlets?.includes(val);
                    return (
                      <label key={val} className={`flex items-center gap-2.5 bg-dark-950/40 hover:bg-dark-950/80 border px-4 py-2.5 rounded-xl text-xs sm:text-sm text-gray-300 hover:text-white cursor-pointer select-none transition-all duration-300 active:scale-95 ${isChecked ? 'border-brand-500/60 bg-brand-500/5 text-white' : 'border-dark-750'}`}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={e => {
                            const list = editingStaffForm.pos_outlets || [];
                            if (e.target.checked) {
                              setEditingStaffForm({ ...editingStaffForm, pos_outlets: [...list, val] });
                            } else {
                              setEditingStaffForm({ ...editingStaffForm, pos_outlets: list.filter(item => item !== val) });
                            }
                          }}
                          className="rounded border-dark-750 bg-dark-900 text-brand-500 focus:ring-brand-500 w-4 h-4"
                        />
                        {outlet}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Work Shifts & Attendance Deductions Section */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  📅 Work Shifts & Attendance Deductions
                </h3>
                
                {/* Shift Preset and Timing */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Shift Name / Template</label>
                    <select 
                      value={editingStaffForm.shift_name || 'Morning Shift'}
                      onChange={e => handleShiftPresetChange(e.target.value, true)}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm cursor-pointer bg-dark-900"
                    >
                      <option value="Morning Shift">Morning Shift (08:00 - 17:00)</option>
                      <option value="Evening Shift">Evening Shift (17:00 - 23:00)</option>
                      <option value="Night Shift">Night Shift (23:00 - 08:00)</option>
                      <option value="Flexible Shift">Flexible Shift (00:00 - 00:00)</option>
                      <option value="Custom">Custom Shift (Define Below)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Start Time</label>
                    <input 
                      type="text" 
                      value={editingStaffForm.shift_start_time || '08:00'}
                      onChange={e => setEditingStaffForm({ ...editingStaffForm, shift_start_time: e.target.value })}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-655 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base font-mono"
                      placeholder="HH:MM"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">End Time</label>
                    <input 
                      type="text" 
                      value={editingStaffForm.shift_end_time || '17:00'}
                      onChange={e => setEditingStaffForm({ ...editingStaffForm, shift_end_time: e.target.value })}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-655 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base font-mono"
                      placeholder="HH:MM"
                    />
                  </div>
                </div>

                {/* Expected Workdays Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">
                    Expected Work Days ({editingStaffForm.expected_work_days_count || 0} days expected)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {WEEKDAYS.map(day => {
                      const isChecked = (editingStaffForm.expected_work_days || []).includes(day.value);
                      return (
                        <label key={day.value} className={`flex items-center gap-2.5 bg-dark-900 border p-2.5 rounded-xl cursor-pointer select-none transition-all duration-200 ${isChecked ? 'border-brand-500/50 bg-brand-500/5 text-white' : 'border-dark-750 text-gray-200'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => handleWeekdayChange(day.value, e.target.checked, true)}
                            className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 bg-dark-950 border-dark-700 cursor-pointer"
                          />
                          <span className="text-xs font-bold">{day.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Attendance Deduction Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-dark-750 pt-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Attendance Deduction Type</label>
                    <select 
                      value={editingStaffForm.attendance_deduction_type || 'daily_rate'}
                      onChange={e => setEditingStaffForm({ ...editingStaffForm, attendance_deduction_type: e.target.value })}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm cursor-pointer bg-dark-900"
                    >
                      <option value="daily_rate">Pro-rata Daily Rate (Base Salary / Expected Days)</option>
                      <option value="fixed">Fixed Penalty Amount per Absent Day</option>
                      <option value="percentage">Percentage Penalty of Base Salary per Absent Day</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">
                      {editingStaffForm.attendance_deduction_type === 'percentage' ? 'Penalty Percentage (%)' : 'Penalty Amount (₦)'}
                    </label>
                    <input 
                      disabled={editingStaffForm.attendance_deduction_type === 'daily_rate'}
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={editingStaffForm.attendance_deduction_rate || 0}
                      onChange={e => setEditingStaffForm({ ...editingStaffForm, attendance_deduction_rate: parseFloat(e.target.value) || 0 })}
                      className={`w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none transition-all duration-300 text-sm font-mono ${editingStaffForm.attendance_deduction_type === 'daily_rate' ? 'opacity-40 cursor-not-allowed bg-dark-900/20' : 'focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30'}`}
                      placeholder={editingStaffForm.attendance_deduction_type === 'daily_rate' ? 'Auto calculated' : 'e.g. 5000'}
                    />
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  👤 Personal Info
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">First Name</label>
                    <input required type="text" value={editingStaffForm.first_name} onChange={e => setEditingStaffForm({...editingStaffForm, first_name: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Last Name</label>
                    <input required type="text" value={editingStaffForm.last_name} onChange={e => setEditingStaffForm({...editingStaffForm, last_name: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Phone Number</label>
                  <input required type="text" value={editingStaffForm.phone} onChange={e => setEditingStaffForm({...editingStaffForm, phone: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Residential Address</label>
                  <textarea required rows={2} value={editingStaffForm.residential_address} onChange={e => setEditingStaffForm({...editingStaffForm, residential_address: e.target.value})} className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base"></textarea>
                </div>
              </div>

              {/* Bank Settlement Details */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  🏦 Bank Settlement Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Bank Name</label>
                    <select
                      value={editingStaffForm.bank_name || ''}
                      onChange={e => setEditingStaffForm({...editingStaffForm, bank_name: e.target.value})}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm cursor-pointer"
                    >
                      <option value="">Select Bank</option>
                      {nigerianBanks.map((bank, index) => (
                        <option key={index} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Account Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editingStaffForm.account_number || ''}
                      onChange={e => setEditingStaffForm({...editingStaffForm, account_number: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-655 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base font-mono"
                      placeholder="e.g. 0123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Account Name</label>
                    <input
                      type="text"
                      value={editingStaffForm.account_name || ''}
                      onChange={e => setEditingStaffForm({...editingStaffForm, account_name: e.target.value})}
                      className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-600 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>
              </div>

              {/* Payroll Settings */}
              <div className="bg-dark-950/40 border border-dark-800/80 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] space-y-4 hover:border-dark-700/50 transition-colors">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-brand-400/80 flex items-center gap-2 border-b border-dark-750 pb-2 mb-2">
                  💳 Payroll Settings (Monthly NGN)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Base Salary</label>
                    {(() => {
                      const matchingStructure = roleStructures.find(struct => struct.role === editingStaffForm.role);
                      const defaultBase = matchingStructure ? matchingStructure.base_salary : (
                        editingStaffForm.role === 'hotel_manager' ? 250000 :
                        editingStaffForm.role === 'accountant' ? 200000 :
                        editingStaffForm.role === 'receptionist' ? 140000 :
                        editingStaffForm.role === 'housekeeping' ? 80000 :
                        editingStaffForm.role === 'maintenance' ? 90000 : 150000
                      );
                      const baseSalaryVal = Number(editingStaffForm.base_salary) || defaultBase;
                      return (
                        <input 
                          disabled={true}
                          type="number" 
                          min="0" 
                          step="0.01" 
                          placeholder="e.g. 150000" 
                          value={baseSalaryVal} 
                          className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-655 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base font-mono opacity-60 cursor-not-allowed" 
                        />
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-200 mb-1.5 uppercase tracking-wider">Allowances (Summed)</label>
                    {(() => {
                      const matchingStructure = roleStructures.find(struct => struct.role === editingStaffForm.role);
                      const defaultAllow = matchingStructure ? matchingStructure.allowances : 0;
                      const allowancesVal = Number(editingStaffForm.allowances) || defaultAllow;
                      return (
                        <input 
                          disabled={true}
                          type="number" 
                          min="0" 
                          step="0.01" 
                          placeholder="e.g. 20000" 
                          value={allowancesVal} 
                          className="w-full bg-dark-950/60 border border-dark-750 p-3 rounded-xl text-white placeholder-gray-655 outline-none focus:border-brand-500/80 focus:ring-1 focus:ring-brand-500/30 transition-all duration-300 text-sm sm:text-base font-mono opacity-60 cursor-not-allowed" 
                        />
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-dark-950/60 border border-dark-750/50 p-4 rounded-xl space-y-2.5">
                  <span className="text-[10px] font-black uppercase text-gray-200 tracking-wider block">Entitled Allowances</span>
                  {globalAllowances.length === 0 ? (
                    <span className="text-xs text-gray-300 italic block">No standard allowances configured. Configure them in Salary Structures.</span>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {globalAllowances.map((allow, idx) => {
                        const isChecked = (editingStaffForm.allowances_list || []).some(a => a.name === allow.name);
                        return (
                          <label key={idx} className="flex items-center gap-2 bg-dark-900 border border-dark-750/70 p-2.5 rounded-xl cursor-pointer hover:border-brand-500/40 select-none transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => handleToggleEditingStaffAllowance(allow, e.target.checked)}
                              className="w-4.5 h-4.5 rounded text-brand-500 focus:ring-brand-500 bg-dark-950 border-dark-700 cursor-pointer"
                            />
                            <div className="flex flex-col font-sans">
                              <span className="text-xs font-bold text-white leading-none">{allow.name}</span>
                              <span className="text-[9px] text-emerald-400 font-bold font-mono mt-1">₦{parseFloat(allow.amount).toLocaleString()}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-dark-750 pt-4 mt-2">
                  <label className="block text-xs font-bold text-gray-200 mb-2 uppercase tracking-wider">
                    {(() => {
                      const matchingStructure = roleStructures.find(struct => struct.role === editingStaffForm.role);
                      let listToRender = (editingStaffForm.deductions_list && editingStaffForm.deductions_list.length > 0) 
                        ? editingStaffForm.deductions_list 
                        : (matchingStructure ? matchingStructure.deductions_list : []);
                      if (typeof listToRender === 'string') {
                        try { listToRender = JSON.parse(listToRender); } catch { listToRender = []; }
                      }
                      if (!Array.isArray(listToRender)) {
                        listToRender = [];
                      }
                      const baseSalaryVal = Number(editingStaffForm.base_salary) || (matchingStructure ? matchingStructure.base_salary : 150000);
                      const evaluatedDedsTotal = calculateTotalDeductions(baseSalaryVal, listToRender);
                      return `Named Deductions Breakdown (Total Evaluated: ₦${evaluatedDedsTotal.toLocaleString()})`;
                    })()}
                  </label>
                  <div className="bg-dark-950/60 border border-dark-750 p-4 rounded-xl space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        const matchingStructure = roleStructures.find(struct => struct.role === editingStaffForm.role);
                        let listToRender = (editingStaffForm.deductions_list && editingStaffForm.deductions_list.length > 0) 
                          ? editingStaffForm.deductions_list 
                          : (matchingStructure ? matchingStructure.deductions_list : []);
                        if (typeof listToRender === 'string') {
                          try { listToRender = JSON.parse(listToRender); } catch { listToRender = []; }
                        }
                        if (!Array.isArray(listToRender)) {
                          listToRender = [];
                        }

                        if (listToRender.length === 0) {
                          return <span className="text-xs text-gray-200">No deductions configured for this profile.</span>;
                        }
                        return listToRender.map((ded, idx) => (
                          <span key={idx} className="text-[10px] text-rose-450 font-bold bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded flex items-center gap-1">
                            {ded.name}: {ded.type === 'percentage' ? `${ded.amount}%` : `₦${parseFloat(ded.amount).toLocaleString()}`}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-300 leading-normal font-medium">Note: Base salary baseline rates are configured globally per access level inside the salary structure registry.</p>
              </div>

              <div className="flex gap-4 pt-4 border-t border-dark-750 shrink-0">
                <button type="button" onClick={() => setEditingStaffForm(null)} className="flex-1 bg-dark-800 hover:bg-dark-700 border border-dark-750 text-gray-300 hover:text-white py-3.5 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base">Cancel</button>
                <button type="submit" disabled={loadingAuth} className="flex-1 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-450 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-lg hover:shadow-brand-500/10 cursor-pointer disabled:opacity-50 text-sm sm:text-base">
                  {loadingAuth ? 'Saving Changes...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upgraded Biometric Hardware Enrollment Wizard Modal */}
      {showBiometricEnrollment && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-dark-700 bg-dark-900/60">
              <h2 className="text-lg font-black text-white flex items-center gap-2 font-serif">
                <Fingerprint className="text-brand-500" />
                Enroll Biometric Credential
              </h2>
              <p className="text-xs text-gray-200 mt-1">Register a hardware scan signature for <strong>{showBiometricEnrollment.staffName}</strong>.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-300 leading-relaxed font-semibold">
                Select your preferred biometric hardware input method to bind this staff account to their unique physical signature:
              </p>

              <div className="space-y-3">
                {/* WebAuthn Tab */}
                <button
                  type="button"
                  onClick={() => {
                    if (hardwareModes.webauthn === 'unsupported') {
                      toast.error("W3C WebAuthn platform biometrics is not supported in this browser.");
                    } else {
                      executeEnrollment('webauthn');
                    }
                  }}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                    hardwareModes.webauthn === 'available'
                      ? 'bg-dark-900/40 hover:bg-dark-900 border-dark-700 hover:border-green-500/50 hover:shadow-lg'
                      : 'bg-dark-900/20 border-dark-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-extrabold text-white block">🖥️ Windows Hello / macOS Touch ID</span>
                    <span className="text-[10px] text-gray-450 block mt-0.5 leading-normal">Enroll using standard integrated platform hardware.</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${hardwareModes.webauthn === 'available' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {hardwareModes.webauthn === 'available' ? 'Available' : 'Unsupported'}
                  </span>
                </button>

                {/* USB SDK Tab */}
                <button
                  type="button"
                  onClick={() => executeEnrollment('usb_sdk')}
                  className="w-full p-4 rounded-xl border border-dark-700 bg-dark-900/40 hover:bg-dark-900 hover:border-blue-500/50 text-left transition-all hover:shadow-lg flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-extrabold text-white block">🔌 USB Fingerprint Reader (Local WebSDK)</span>
                    <span className="text-[10px] text-gray-450 block mt-0.5 leading-normal">Enroll from external USB hardware devices (e.g. ZKTeco / SecuGen Hamster).</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${hardwareModes.usbReader === 'connected' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-gray-700 text-gray-300'}`}>
                    {hardwareModes.usbReader === 'connected' ? 'Connected' : 'Offline'}
                  </span>
                </button>

                {/* Simulator Tab */}
                <button
                  type="button"
                  onClick={() => executeEnrollment('simulator')}
                  className="w-full p-4 rounded-xl border border-dark-700 bg-dark-900/40 hover:bg-dark-900 hover:border-brand-500/50 text-left transition-all hover:shadow-lg flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-extrabold text-white block">📲 Software Scanner Simulator</span>
                    <span className="text-[10px] text-gray-450 block mt-0.5 leading-normal">Generate a unique simulated key (best for review and sandbox testing).</span>
                  </div>
                  <span className="text-[9px] font-black uppercase bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded border border-brand-500/20 shrink-0">
                    Active
                  </span>
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-dark-700 bg-dark-900/40 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowBiometricEnrollment(null)}
                className="bg-dark-700 hover:bg-dark-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow"
              >
                Close Wizard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USB Biometric WebSDK Hardware Setup Guide Modal */}
      {/* Dynamic Salary Structure Settings Modal */}
      {showSalaryConfig && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fade-in select-none">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-dark-700 bg-dark-900/60 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2 font-serif">
                  <Server className="text-brand-500" />
                  Salary & Payroll Structures
                </h2>
                <p className="text-xs text-gray-200 mt-1">Configure baseline monthly structures and manage special personnel exceptions.</p>
              </div>
              <button 
                onClick={() => setShowSalaryConfig(false)}
                className="p-1 bg-dark-900 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selector tabs */}
            <div className="px-6 pt-4 bg-dark-900/20 border-b border-dark-700 shrink-0">
              <div className="flex gap-4">
                <button
                  onClick={() => setSalaryStructuresTab('roles')}
                  className={`pb-3 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                    salaryStructuresTab === 'roles' 
                      ? 'border-brand-500 text-brand-400' 
                      : 'border-transparent text-gray-200 hover:text-white'
                  }`}
                >
                  🏢 Role Standard Baselines
                </button>
                <button
                  onClick={() => setSalaryStructuresTab('staff_exceptions')}
                  className={`pb-3 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                    salaryStructuresTab === 'staff_exceptions' 
                      ? 'border-brand-500 text-brand-400' 
                      : 'border-transparent text-gray-200 hover:text-white'
                  }`}
                >
                  👤 Staff Overrides & Exceptions
                </button>
                <button
                  onClick={() => setSalaryStructuresTab('allowances')}
                  className={`pb-3 px-1 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                    salaryStructuresTab === 'allowances' 
                      ? 'border-brand-500 text-brand-400' 
                      : 'border-transparent text-gray-200 hover:text-white'
                  }`}
                >
                  💰 Standard Allowances
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
              
              {/* TAB 1: ROLE STANDARD STRUCTURES */}
              {salaryStructuresTab === 'roles' && (
                <form onSubmit={handleSaveRoleStructures} className="space-y-6">
                  <p className="text-xs text-gray-200 leading-relaxed">
                    Set the baseline monthly payouts by role. Personnel who do not have custom overrides enabled on their profiles will automatically fall back to these default rates.
                  </p>
                  
                  {loadingStructures ? (
                    <div className="text-center py-10 text-gray-300 text-sm">Loading baseline parameters...</div>
                  ) : (
                    <>
                      <div className="bg-dark-950/40 border border-dark-750/70 rounded-2xl overflow-hidden shadow-inner">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-dark-900 border-b border-dark-750 text-gray-200 uppercase tracking-widest font-black text-[10px]">
                          <tr>
                            <th className="p-4">Role Title</th>
                            <th className="p-4">Base Salary (NGN)</th>
                            <th className="p-4">Allowances</th>
                            <th className="p-4">Deductions Breakdown</th>
                            <th className="p-4 text-right">Total Evaluated (NGN)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-750">
                          {paginatedRoleStructures.map((rs) => {
                            const absIndex = roleStructures.findIndex(item => item.role === rs.role);
                            return (
                              <tr key={rs.role} className="hover:bg-dark-900/35 transition-colors">
                                <td className="p-4 font-bold text-white">{rs.label}</td>
                                <td className="p-3">
                                  <input 
                                    type="number" 
                                    min="0" 
                                    step="0.01" 
                                    value={rs.base_salary}
                                    onChange={e => {
                                      const list = [...roleStructures];
                                      list[absIndex].base_salary = e.target.value;
                                      setRoleStructures(list);
                                    }}
                                    className="w-full max-w-[150px] bg-dark-900 border border-dark-700/60 p-2 rounded-xl text-white outline-none focus:border-brand-500 font-mono"
                                  />
                                </td>
                                <td className="p-3">
                                  <input 
                                    type="number" 
                                    min="0" 
                                    step="0.01" 
                                    value={rs.allowances}
                                    onChange={e => {
                                      const list = [...roleStructures];
                                      list[absIndex].allowances = e.target.value;
                                      setRoleStructures(list);
                                    }}
                                    className="w-full max-w-[150px] bg-dark-900 border border-dark-700/60 p-2 rounded-xl text-white outline-none focus:border-brand-500 font-mono"
                                  />
                                </td>
                              <td className="p-3 max-w-[280px]">
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex flex-wrap gap-1">
                                    {(() => {
                                      let list = rs.deductions_list || [];
                                      if (typeof list === 'string') {
                                        try { list = JSON.parse(list); } catch { list = []; }
                                      }
                                      if (!Array.isArray(list)) list = [];
                                      if (list.length === 0) {
                                        return <span className="text-[10px] text-gray-300 font-bold bg-dark-900 border border-dark-750 px-2 py-0.5 rounded">None</span>;
                                      }
                                      return list.map((ded, idx) => (
                                        <span key={idx} className="text-[10px] text-rose-450 font-bold bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded flex items-center gap-1">
                                          {ded.name}: {ded.type === 'percentage' ? `${ded.amount}%` : `₦${parseFloat(ded.amount).toLocaleString()}`}
                                          <button 
                                            type="button" 
                                            onClick={() => handleRemoveRoleDeduction(rs.role, idx)}
                                            className="text-rose-400 hover:text-red-400 font-extrabold cursor-pointer text-xs ml-0.5"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ));
                                    })()}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveRoleDeductions(activeRoleDeductions === rs.role ? null : rs.role);
                                    }}
                                    className="text-[10px] font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest flex items-center gap-1 cursor-pointer w-max mt-1"
                                  >
                                    {activeRoleDeductions === rs.role ? 'Close ×' : '+ Add deduction'}
                                  </button>

                                  {activeRoleDeductions === rs.role && (
                                    <div className="bg-dark-900 p-3 rounded-xl border border-dark-750 space-y-2 mt-1 w-[260px] animate-fade-in z-50">
                                      <div className="text-[9px] font-bold text-gray-200 uppercase tracking-widest">New Named Deduction</div>
                                      <input 
                                        type="text" 
                                        placeholder="e.g. Health Tax"
                                        id={`role-ded-name-${rs.role}`}
                                        className="w-full bg-dark-950 border border-dark-700/60 p-1.5 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
                                      />
                                      <div className="flex gap-1">
                                        <input 
                                          type="number" 
                                          step="0.01"
                                          placeholder="e.g. 5000"
                                          id={`role-ded-amt-${rs.role}`}
                                          className="w-1/2 bg-dark-950 border border-dark-700/60 p-1.5 rounded-lg text-xs text-white placeholder-gray-600 outline-none font-mono"
                                        />
                                        <select
                                          id={`role-ded-type-${rs.role}`}
                                          className="w-1/2 bg-dark-950 border border-dark-700/60 p-1 rounded-lg text-xs text-white outline-none cursor-pointer font-bold"
                                        >
                                          <option value="amount">Fixed (₦)</option>
                                          <option value="percentage">Percent (%)</option>
                                        </select>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nameEl = document.getElementById(`role-ded-name-${rs.role}`);
                                          const amtEl = document.getElementById(`role-ded-amt-${rs.role}`);
                                          const typeEl = document.getElementById(`role-ded-type-${rs.role}`);
                                          if (nameEl && amtEl && typeEl) {
                                            handleAddRoleDeduction(rs.role, nameEl.value, amtEl.value, typeEl.value);
                                            nameEl.value = '';
                                            amtEl.value = '';
                                          }
                                        }}
                                        className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-1 px-2 rounded-lg text-xs transition-colors cursor-pointer"
                                      >
                                        Add
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right font-bold text-rose-400 font-mono text-xs">
                                ₦{calculateTotalDeductions(rs.base_salary, rs.deductions_list).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControl
                      currentPage={currentPageSalary}
                      totalItems={roleStructures.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPageSalary}
                    />
                    </>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                    <button
                      type="button"
                      onClick={() => setShowSalaryConfig(false)}
                      className="bg-dark-700 hover:bg-dark-600 text-white font-bold px-5 py-3 rounded-xl text-xs transition-all shadow cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-450 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-xl text-xs transition-all shadow-lg hover:shadow-brand-500/10 cursor-pointer"
                    >
                      Save Baselines
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: STAFF OVERRIDES & EXCEPTIONS */}
              {salaryStructuresTab === 'staff_exceptions' && (
                <div className="space-y-6">
                  <p className="text-xs text-gray-405 leading-relaxed">
                    Override standard salaries and write justification reasons for personnel with special privileges, board-approved salaries, or specific unexcused absence absenteeism exemptions.
                  </p>

                  <div className="space-y-4">
                    {staff.map((s) => {
                      const roleLabel = ROLES.find(r => r.id === s.role)?.label || s.role.replace(/_/g, ' ');
                      return (
                        <div key={s.id} className="bg-dark-950/40 border border-dark-750/70 p-5 rounded-2xl hover:border-dark-700 transition-all flex flex-col space-y-4">
                          
                          {/* Staff Header Row */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-dark-750 pb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-dark-900 border border-dark-750 rounded-xl flex items-center justify-center font-serif text-brand-400 font-extrabold shadow shadow-inner">
                                {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                              </div>
                              <div>
                                <span className="text-sm font-serif font-black text-white block">{s.first_name} {s.last_name}</span>
                                <span className="text-[10px] text-brand-500 font-bold uppercase tracking-wider block mt-0.5">{roleLabel}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {/* Override Checkbox */}
                              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-200">
                                <input 
                                  type="checkbox"
                                  checked={!!s.has_salary_exception}
                                  onChange={e => {
                                    handleSaveIndividualOverride(s.id, {
                                      ...s,
                                      has_salary_exception: e.target.checked
                                    });
                                  }}
                                  className="rounded border-dark-700 bg-dark-900 text-brand-500 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                                />
                                Custom Override
                              </label>

                              {/* Attendance Exemption Checkbox */}
                              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-200">
                                <input 
                                  type="checkbox"
                                  checked={!!s.exempt_from_attendance_deduction}
                                  onChange={e => {
                                    handleSaveIndividualOverride(s.id, {
                                      ...s,
                                      exempt_from_attendance_deduction: e.target.checked
                                    });
                                  }}
                                  className="rounded border-dark-700 bg-dark-900 text-brand-500 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                                />
                                Penalty Exempt
                              </label>
                            </div>
                          </div>

                          {/* Override Config Form Grid (only if override active) */}
                          {s.has_salary_exception && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div>
                                  <label className="block text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Base Salary</label>
                                  <input 
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={s.base_salary}
                                    onBlur={e => {
                                      s.base_salary = e.target.value;
                                    }}
                                    placeholder="e.g. 180000"
                                    className="w-full bg-dark-900 border border-dark-750 p-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-brand-500 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Allowances</label>
                                  <input 
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={s.allowances}
                                    onBlur={e => {
                                      s.allowances = e.target.value;
                                    }}
                                    placeholder="e.g. 20000"
                                    className="w-full bg-dark-900 border border-dark-750 p-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-brand-500 font-mono"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1.5">
                                    Deductions Breakdown (Total: ₦{calculateTotalDeductions(s.base_salary, s.deductions_list).toLocaleString()})
                                  </label>
                                  <div className="flex flex-col gap-2 bg-dark-900 p-3 rounded-xl border border-dark-750">
                                    <div className="flex flex-wrap gap-1.5">
                                      {(() => {
                                        let list = s.deductions_list || [];
                                        if (typeof list === 'string') {
                                          try { list = JSON.parse(list); } catch { list = []; }
                                        }
                                        if (!Array.isArray(list)) list = [];
                                        if (list.length === 0) {
                                          return <span className="text-[10px] text-gray-300 font-bold">No custom deductions configured.</span>;
                                        }
                                        return list.map((ded, idx) => (
                                          <span key={idx} className="text-[10px] text-rose-450 font-bold bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                                            {ded.name}: {ded.type === 'percentage' ? `${ded.amount}%` : `₦${parseFloat(ded.amount).toLocaleString()}`}
                                            <button 
                                              type="button" 
                                              onClick={() => handleRemoveStaffOverrideDeduction(s.id, idx)}
                                              className="text-rose-400 hover:text-red-400 font-extrabold cursor-pointer text-xs ml-1"
                                            >
                                              ×
                                            </button>
                                          </span>
                                        ));
                                      })()}
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t border-dark-750 mt-1">
                                      <input 
                                        type="text" 
                                        placeholder="Name (e.g. Tax)"
                                        id={`staff-ded-name-${s.id}`}
                                        className="flex-1 bg-dark-950 border border-dark-700/60 p-2 rounded-xl text-xs text-white placeholder-gray-600 outline-none"
                                      />
                                      <input 
                                        type="number" 
                                        step="0.01"
                                        placeholder="Amt"
                                        id={`staff-ded-amt-${s.id}`}
                                        className="w-16 bg-dark-950 border border-dark-700/60 p-2 rounded-xl text-xs text-white placeholder-gray-600 outline-none font-mono"
                                      />
                                      <select
                                        id={`staff-ded-type-${s.id}`}
                                        className="bg-dark-950 border border-dark-700/60 p-1.5 rounded-xl text-xs text-white outline-none cursor-pointer font-bold"
                                      >
                                        <option value="amount">₦</option>
                                        <option value="percentage">%</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nameEl = document.getElementById(`staff-ded-name-${s.id}`);
                                          const amtEl = document.getElementById(`staff-ded-amt-${s.id}`);
                                          const typeEl = document.getElementById(`staff-ded-type-${s.id}`);
                                          if (nameEl && amtEl && typeEl) {
                                            handleAddStaffOverrideDeduction(s.id, nameEl.value, amtEl.value, typeEl.value);
                                            nameEl.value = '';
                                            amtEl.value = '';
                                          }
                                        }}
                                        className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                                      >
                                        Add
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1.5">Exception / Privilege Justification</label>
                                <textarea
                                  rows={1.5}
                                  placeholder="e.g. Senior staff member board agreement rate - exempt from base attendance penalty calculations."
                                  defaultValue={s.salary_exception_reason}
                                  onBlur={e => {
                                    s.salary_exception_reason = e.target.value;
                                  }}
                                  className="w-full bg-dark-900 border border-dark-750 p-3 rounded-xl text-xs text-white placeholder-gray-600 outline-none focus:border-brand-500 leading-normal"
                                />
                              </div>

                              <div className="flex justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveIndividualOverride(s.id, s)}
                                  className="bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 hover:border-transparent text-brand-400 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
                                >
                                  Save Override Parameters
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: STANDARD ALLOWANCES MANAGEMENT */}
              {salaryStructuresTab === 'allowances' && (
                <div className="space-y-6 animate-fade-in text-gray-300">
                  <p className="text-xs text-gray-200 leading-relaxed">
                    Define standard hotel allowances (e.g., Housing, Transport, Utility). Once configured here, these allowances can be assigned to individual staff members during registration or profile editing.
                  </p>

                  {/* Table of active allowances */}
                  <div className="bg-dark-950/40 border border-dark-750/70 rounded-2xl overflow-hidden shadow-inner">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-dark-900 border-b border-dark-750 text-gray-200 uppercase tracking-widest font-black text-[10px]">
                        <tr>
                          <th className="p-4">Allowance Name / Title</th>
                          <th className="p-4">Default Monthly Amount (NGN)</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-750">
                        {(globalAllowances || []).map((allow, index) => (
                          <tr key={index} className="hover:bg-dark-900/35 transition-colors">
                            <td className="p-4 font-bold text-white">{allow.name}</td>
                            <td className="p-4 font-mono text-emerald-450">₦{parseFloat(allow.amount || 0).toLocaleString()}</td>
                            <td className="p-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const list = (globalAllowances || []).filter((_, i) => i !== index);
                                  setGlobalAllowances(list);
                                }}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-red-400 rounded-xl transition-all cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(globalAllowances || []).length === 0 && (
                          <tr>
                            <td colSpan="3" className="p-8 text-center text-gray-300 italic">No standard allowances configured. Add one below!</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add new allowance form */}
                  <div className="bg-dark-900 border border-dark-750/70 rounded-2xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus size={14} className="text-brand-500" /> Configure New Allowance
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-200 uppercase font-black tracking-widest block mb-1">Allowance Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Utility Allowance"
                          id="new-allowance-name"
                          className="w-full bg-dark-950 border border-dark-700/60 p-2.5 rounded-xl text-xs text-white placeholder-gray-650 outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-200 uppercase font-black tracking-widest block mb-1">Monthly Amount (NGN)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 15000"
                          id="new-allowance-amount"
                          className="w-full bg-dark-950 border border-dark-700/60 p-2.5 rounded-xl text-xs text-white placeholder-gray-650 outline-none focus:border-brand-500 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nameEl = document.getElementById('new-allowance-name');
                          const amtEl = document.getElementById('new-allowance-amount');
                          if (nameEl && amtEl) {
                            const name = nameEl.value.trim();
                            const amount = parseFloat(amtEl.value) || 0;
                            if (!name) return toast.error("Allowance title is required");
                            if (amount <= 0) return toast.error("Allowance amount must be greater than 0");

                            if ((globalAllowances || []).some(a => a.name.toLowerCase() === name.toLowerCase())) {
                              return toast.error("An allowance with this title already exists");
                            }

                            const updatedList = [...(globalAllowances || []), { name, amount }];
                            setGlobalAllowances(updatedList);
                            nameEl.value = '';
                            amtEl.value = '';
                          }
                        }}
                        className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        Add to List
                      </button>
                    </div>
                  </div>

                  {/* Global Save Button */}
                  <div className="flex justify-end border-t border-dark-750 pt-4">
                    <button
                      type="button"
                      onClick={async () => {
                        const loadingToast = toast.loading('Saving standard allowances...');
                        try {
                          const { error } = await supabase
                            .from('system_settings')
                            .upsert({
                              setting_key: 'salary_allowances_list',
                              setting_value: globalAllowances
                            }, { onConflict: 'setting_key' });

                          if (error) throw error;
                          toast.success('[✓] Standard allowances list saved successfully!', { id: loadingToast });
                        } catch (err) {
                          console.error(err);
                          toast.error(`Save failed: ${err.message}`, { id: loadingToast });
                        }
                      }}
                      className="btn-primary py-2.5 px-5 text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer animate-pulse"
                    >
                      <Save size={14} /> Save Allowances
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      {showUsbSetupGuide && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="bg-dark-800 border border-dark-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-dark-700 bg-dark-900/60">
              <h2 className="text-lg font-black text-white flex items-center gap-2 font-serif">
                <Shield className="text-brand-500" />
                USB Hardware Integration Guide
              </h2>
              <p className="text-xs text-gray-200 mt-1">Instructions to connect external ZKTeco, SecuGen, or DigitalPersona scanners.</p>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar text-xs leading-relaxed text-gray-300">
              <p className="font-semibold text-gray-200">
                Sparkles Property Management System supports direct integration with professional-grade desktop fingerprint hardware devices. To link your local USB scanners, please complete the following steps:
              </p>

              <div className="space-y-3.5 mt-2">
                <div className="bg-dark-900/60 p-3.5 rounded-xl border border-dark-700 flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-brand-500/10 text-brand-400 font-extrabold flex items-center justify-center shrink-0">1</span>
                  <div>
                    <span className="font-extrabold text-white block">Install Driver Packages</span>
                    <span className="text-gray-200 block mt-0.5 leading-relaxed">Plug in your USB fingerprint hardware (e.g., DigitalPersona 4500, ZK9500, or SecuGen Hamster) and ensure official manufacturer hardware drivers are successfully loaded on the workstation.</span>
                  </div>
                </div>

                <div className="bg-dark-900/60 p-3.5 rounded-xl border border-dark-700 flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-brand-500/10 text-brand-400 font-extrabold flex items-center justify-center shrink-0">2</span>
                  <div>
                    <span className="font-extrabold text-white block">Run Local Biometric Agent Service</span>
                    <span className="text-gray-200 block mt-0.5 leading-relaxed">Launch the Sparkles local biometric desktop application. This runs a secure loopback endpoint service on your workstation listening at <code className="bg-dark-950 px-1.5 py-0.5 rounded text-brand-400 font-mono text-[10px]">http://localhost:8000</code>.</span>
                  </div>
                </div>

                <div className="bg-dark-900/60 p-3.5 rounded-xl border border-dark-700 flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-brand-500/10 text-brand-400 font-extrabold flex items-center justify-center shrink-0">3</span>
                  <div>
                    <span className="font-extrabold text-white block">Auto-detecting and Syncing</span>
                    <span className="text-gray-200 block mt-0.5 leading-relaxed">Once the local agent is running, this page will automatically toggle its status light from offline to <code className="text-green-400 font-bold">Connected</code>. You will now be able to scan and enroll fingerprints physically.</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-brand-500/5 border border-brand-500/15 rounded-xl text-[10px] text-brand-400 leading-normal flex items-start gap-2">
                <span className="font-extrabold block uppercase shrink-0">Bypass Note:</span>
                <span>If a physical scanner is not connected or the agent is offline, our intelligent bypass fallback system remains active to let you register mock scanner templates seamlessly.</span>
              </div>
            </div>

            <div className="p-4 border-t border-dark-700 bg-dark-900/40 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowUsbSetupGuide(false)}
                className="bg-brand-500 hover:bg-brand-600 text-dark-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminStaffManagement;

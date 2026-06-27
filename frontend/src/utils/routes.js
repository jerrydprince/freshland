export const getDefaultAdminRoute = (role, hasAccess) => {
  if (role === 'super_admin' || role === 'hotel_owner') return '/admin';
  
  if (hasAccess) {
    if (hasAccess('Dashboard')) return '/admin';
    if (hasAccess('Front Desk')) return '/admin/frontdesk';
    if (hasAccess('Reservations')) return '/admin/reservations';
    if (hasAccess('CRM & Guests')) return '/admin/crm';
    if (hasAccess('Housekeeping')) return '/admin/housekeeping';
    if (hasAccess('Laundry')) return '/admin/laundry';
    if (hasAccess('Maintenance')) return '/admin/maintenance';
    if (hasAccess('Store Keeping')) return '/admin/store';
    if (hasAccess('POS')) return '/admin/pos';
    if (hasAccess('Restaurant Desk') || hasAccess('Kitchen Desk') || hasAccess('Order History')) return '/admin/restaurant';
    if (hasAccess('Finance & Billing')) return '/admin/billing';
    if (hasAccess('Accounting')) return '/admin/accounting';
    if (hasAccess('Rooms')) return '/admin/rooms';
    if (hasAccess('Channel Manager')) return '/admin/channel-manager';
    if (hasAccess('Staff & Roles')) return '/admin/staff';
    if (hasAccess('Website CMS')) return '/admin/cms';
    if (hasAccess('Settings')) return '/admin/settings';
    if (hasAccess('Duty Logs')) return '/admin/duty-reports';
    if (hasAccess('Reminders')) return '/admin/reminders';
    if (hasAccess('Internal Messaging')) return '/admin/messages';
    if (hasAccess('Monthly Reports')) return '/admin/monthly-reports';
  }

  // Fallback to static mapping if hasAccess is not passed or loaded yet
  switch (role) {
    case 'receptionist': 
      return '/admin/frontdesk';
    case 'housekeeping': 
    case 'head_housekeeper': 
    case 'maintenance':
      return '/admin/housekeeping';
    case 'accountant': 
      return '/admin/billing';
    case 'customer_support': 
      return '/admin/crm';
    case 'restaurant_staff':
    case 'restaurant_manager':
    case 'kitchen_staff':
    case 'kitchen_manager':
    case 'head_chef':
      return '/admin/restaurant';
    case 'super_admin':
    case 'hotel_owner':
    case 'hotel_manager':
    default:
      return '/admin';
  }
};

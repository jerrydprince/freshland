import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// NotificationContext provides counters for each service department and a tiny beep sound.
const NotificationContext = createContext();

const defaultCounters = {
  internalMessaging: 0,
  frontDesk: 0,
  housekeeping: 0,
  laundry: 0,
  maintenance: 0,
  stores: 0,
  restaurant: 0,
  servicePortals: 0,
  reservations: 0,
  schedule: 0,
  reminders: 0,
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [counters, setCounters] = useState(defaultCounters);

  const fetchInternalMessages = async () => {
    if (!user || user.role === 'guest') return;
    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .eq('is_read', false);

      if (!error && data) {
        let unreadCount = data.filter(m => 
          (m.recipient_id === user.id) || 
          (m.recipient_id === null && m.recipient_role === user.role && m.sender_id !== user.id)
        ).length;
        
        setCounters(prev => ({ ...prev, internalMessaging: unreadCount }));
      }
    } catch (e) {
      console.error('Error fetching internal messages:', e);
    }
  };

  const fetchServiceRequests = async () => {
    if (!user || user.role === 'guest') return;
    try {
      const { data, error } = await supabase
        .from('booking_services')
        .select('*, services(name, category, internal_notes)')
        .eq('status', 'pending');

      if (!error && data) {
        let restaurantCount = 0;
        let laundryCount = 0;
        let housekeepingCount = 0;
        let maintenanceCount = 0;
        let servicePortalsCount = 0;

        data.forEach(req => {
          const service = req.services;
          if (!service) return;
          
          const isMeal = service.internal_notes?.toLowerCase().trim() === 'restaurant' || (service.name && service.name.toLowerCase().includes('breakfast'));
          const isLaundry = service.category?.toLowerCase() === 'laundry' || service.name?.toLowerCase().includes('laundry') || service.name?.toLowerCase().includes('ironing');
          const isHousekeeping = service.category?.toLowerCase() === 'housekeeping' || service.name?.toLowerCase().includes('cleaning') || service.name?.toLowerCase().includes('towel');
          const isMaintenance = service.category?.toLowerCase() === 'maintenance' || service.name?.toLowerCase().includes('repair');
          const isTransport = service.category?.toLowerCase() === 'transportation' || service.name?.toLowerCase().includes('pickup');
          const isSpa = service.category?.toLowerCase() === 'wellness' && (service.name?.toLowerCase().includes('spa') || service.name?.toLowerCase().includes('massage'));
          const isPool = service.name?.toLowerCase().includes('pool');
          
          if (isMeal) {
            restaurantCount++;
          } else if (isLaundry) {
            laundryCount++;
          } else if (isHousekeeping) {
            housekeepingCount++;
          } else if (isMaintenance) {
            maintenanceCount++;
          } else if (isTransport || isSpa || isPool) {
            servicePortalsCount++;
          }
        });

        setCounters(prev => ({
          ...prev,
          restaurant: restaurantCount,
          laundry: laundryCount,
          housekeeping: housekeepingCount,
          maintenance: maintenanceCount,
          servicePortals: servicePortalsCount
        }));
      }
    } catch (e) {
      console.error('Error fetching service requests:', e);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'guest') {
      fetchInternalMessages();
      fetchServiceRequests();

      const messagesChannel = supabase
        .channel(`global-notifications-messages-${Math.random().toString(36).substring(2, 9)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages' }, () => {
          fetchInternalMessages();
        })
        .subscribe();

      const servicesChannel = supabase
        .channel(`global-notifications-services-${Math.random().toString(36).substring(2, 9)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_services' }, () => {
          fetchServiceRequests();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(servicesChannel);
      };
    }
  }, [user]);

  const increment = () => {};
  const reset = () => {};

  return (
    <NotificationContext.Provider value={{ counters, increment, reset }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);

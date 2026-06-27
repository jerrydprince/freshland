import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * useRealtimeSync
 * Custom React hook that subscribes to Supabase Realtime postgres_changes
 * events for the specified tables and triggers a callback when updates occur.
 * Includes a broadcast fallback for manual triggers.
 * 
 * @param {Array<string>} tables - List of tables to listen to (e.g. ['rooms', 'bookings'])
 * @param {Function} callback - Callback function triggered on event, called with (table, payload)
 */
export const useRealtimeSync = (tables, callback) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!tables || tables.length === 0) return;

    // Create a unique channel name based on tables
    const channelName = `realtime-sync-${tables.join('-')}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelName);

    tables.forEach(table => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          console.log(`[Realtime Sync] Change detected on table "${table}":`, payload);
          if (callbackRef.current) {
            callbackRef.current(table, payload);
          }
        }
      );
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime Sync] Subscribed to tables: ${tables.join(', ')}`);
      }
    });

    // Sub to a global broadcast channel for manual fallback triggers
    const globalChannel = supabase.channel('system_global_broadcast');
    tables.forEach(table => {
      globalChannel.on(
        'broadcast',
        { event: `refresh_${table}` },
        (payload) => {
          console.log(`[Broadcast Sync] Force refresh on table "${table}":`, payload);
          if (callbackRef.current) {
            callbackRef.current(table, payload);
          }
        }
      );
    });
    globalChannel.subscribe();

    return () => {
      console.log(`[Realtime Sync] Unsubscribing from tables: ${tables.join(', ')}`);
      supabase.removeChannel(channel);
      supabase.removeChannel(globalChannel);
    };
  }, [JSON.stringify(tables)]);
};

export const forceTableRefresh = (table) => {
  const channel = supabase.channel('system_global_broadcast');
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({
        type: 'broadcast',
        event: `refresh_${table}`,
        payload: { source: 'client_broadcast' }
      });
      setTimeout(() => supabase.removeChannel(channel), 1000);
    }
  });
};


-- Safe, Idempotent Realtime publication script for Supabase
DO $$
DECLARE
    tbl text;
    tables_to_add text[] := ARRAY[
        'rooms', 'bookings', 'booking_services', 'housekeeping_tasks', 
        'maintenance_tickets', 'payments', 'invoices', 'salary_structures', 
        'staff_attendance', 'leave_applications', 'profiles', 'system_settings', 
        'expenses', 'role_permissions', 'refund_settlements', 'maintenance_payments',
        'halls', 'hall_bookings', 'hall_meal_options', 'hall_booking_meals'
    ];
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add each table if not already in publication
    FOREACH tbl IN ARRAY tables_to_add LOOP
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_publication_rel pr
            JOIN pg_class c ON pr.prrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            JOIN pg_publication p ON pr.prpubid = p.oid
            WHERE p.pubname = 'supabase_realtime' 
              AND n.nspname = 'public' 
              AND c.relname = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        END IF;
    END LOOP;
END $$;

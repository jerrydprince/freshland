-- Create daily_closures table
CREATE TABLE IF NOT EXISTS public.daily_closures (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    room_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    pos_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    laundry_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_cash_flow DECIMAL(12,2) NOT NULL DEFAULT 0,
    arrivals INTEGER NOT NULL DEFAULT 0,
    departures INTEGER NOT NULL DEFAULT 0,
    in_house_guests INTEGER NOT NULL DEFAULT 0,
    occupancy_rate INTEGER NOT NULL DEFAULT 0,
    payment_methods JSONB NOT NULL DEFAULT '{}'::jsonb,
    pos_outlets JSONB NOT NULL DEFAULT '{}'::jsonb,
    in_house_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and setup permissive policies for prototype testing
ALTER TABLE public.daily_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for daily_closures" ON public.daily_closures;
DROP POLICY IF EXISTS "Allow all for daily_closures" ON public.daily_closures;

CREATE POLICY "Allow select for daily_closures" ON public.daily_closures FOR SELECT USING (true);
CREATE POLICY "Allow all for daily_closures" ON public.daily_closures FOR ALL USING (true);

-- =========================================================================
-- STORE KEEPING & INVENTORY MANAGEMENT SQL SCHEMAS
-- =========================================================================

-- 1. Store Master Inventory Items Table
CREATE TABLE IF NOT EXISTS store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price_ngn NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_price_ngn >= 0),
    category TEXT NOT NULL DEFAULT 'other', -- e.g., 'linen', 'toiletries', 'beverages', 'housekeeping', 'stationery'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Store Transaction logs Table
CREATE TABLE IF NOT EXISTS store_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES store_items(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL CHECK (log_type IN ('incoming', 'outgoing')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_transaction NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (price_at_transaction >= 0),
    giver_name TEXT NOT NULL,
    receiver_name TEXT, -- Nullable for incoming, required for outgoing
    department TEXT, -- Nullable for incoming, required for outgoing
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending_approval', 'approved_released', 'declined', 'approved')),
    approved_by TEXT, -- Stores the hotel manager/super admin name who released the item
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Prototyping RLS Bypass Policies (Consistent with active PMS setup)
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Prototype full access store_items" ON store_items;
CREATE POLICY "Prototype full access store_items" ON store_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE store_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Prototype full access store_logs" ON store_logs;
CREATE POLICY "Prototype full access store_logs" ON store_logs FOR ALL USING (true) WITH CHECK (true);

-- 4. Initial Seeding of Luxury Consumables & Consumables
INSERT INTO store_items (name, description, quantity, unit_price_ngn, category)
VALUES
  ('Premium Cotton Bed Linens', 'Pure Egyptian 600-thread count white flat sheets.', 45, 18000, 'linen')
  ON CONFLICT (name) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_ngn = EXCLUDED.unit_price_ngn;

INSERT INTO store_items (name, description, quantity, unit_price_ngn, category)
VALUES
  ('Plush Luxury Bath Towels', 'Extra thick high-absorbent white cotton towels.', 60, 8500, 'linen')
  ON CONFLICT (name) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_ngn = EXCLUDED.unit_price_ngn;

INSERT INTO store_items (name, description, quantity, unit_price_ngn, category)
VALUES
  ('Organic Scented Toiletries Pack', 'Premium shampoo, conditioner, and body wash set.', 150, 2500, 'toiletries')
  ON CONFLICT (name) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_ngn = EXCLUDED.unit_price_ngn;

INSERT INTO store_items (name, description, quantity, unit_price_ngn, category)
VALUES
  ('Premium Laundry Detergent (10L)', 'Heavy-duty fabric sanitizing liquid detergent.', 25, 12000, 'housekeeping')
  ON CONFLICT (name) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_ngn = EXCLUDED.unit_price_ngn;

INSERT INTO store_items (name, description, quantity, unit_price_ngn, category)
VALUES
  ('A4 Printing Paper Reams (500 sheets)', 'Double-A high-grade office printing paper.', 40, 4500, 'stationery')
  ON CONFLICT (name) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_ngn = EXCLUDED.unit_price_ngn;

INSERT INTO store_items (name, description, quantity, unit_price_ngn, category)
VALUES
  ('Mineral Bottled Water Case (24)', 'Cases of premium natural spring bottled water.', 80, 5000, 'beverages')
  ON CONFLICT (name) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_ngn = EXCLUDED.unit_price_ngn;

INSERT INTO store_items (name, description, quantity, unit_price_ngn, category)
VALUES
  ('Gourmet Coffee Pods Box (50)', 'Premium dark roast espresso coffee capsules.', 35, 15000, 'beverages')
  ON CONFLICT (name) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_ngn = EXCLUDED.unit_price_ngn;

INSERT INTO store_items (name, description, quantity, unit_price_ngn, category)
VALUES
  ('Front Desk Custom Pens', 'Engraved luxury guest welcome ballpoint pens.', 200, 350, 'stationery')
  ON CONFLICT (name) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_ngn = EXCLUDED.unit_price_ngn;

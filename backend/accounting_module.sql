-- LUXE APARTMENT PMS - ACCOUNTING & PAYROLL MODULE MIGRATION
-- This script creates tables for expenses and payroll, setups triggers, and seeds permissions.

-- 1. Create Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT CHECK (category IN ('Salaries', 'Utilities', 'Maintenance', 'Marketing', 'Supplies', 'Taxes', 'Rent', 'Other')) NOT NULL,
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE NOT NULL,
  paid_to TEXT,
  payment_method TEXT CHECK (payment_method IN ('stripe', 'paystack', 'paypal', 'bank_transfer', 'pos', 'cash')),
  status TEXT CHECK (status IN ('paid', 'pending', 'cancelled')) DEFAULT 'paid' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Staff Salaries / Payroll Table
CREATE TABLE IF NOT EXISTS staff_salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonuses DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(12,2) GENERATED ALWAYS AS (base_salary + bonuses - deductions) STORED,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  status TEXT CHECK (status IN ('paid', 'pending', 'approved')) DEFAULT 'pending' NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('stripe', 'paystack', 'paypal', 'bank_transfer', 'pos', 'cash')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS Policies
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salaries ENABLE ROW LEVEL SECURITY;

-- Dynamic bypass or full-access policies for administrative purposes
DROP POLICY IF EXISTS "Allow all selects for expenses" ON expenses;
DROP POLICY IF EXISTS "Allow all inserts for expenses" ON expenses;
DROP POLICY IF EXISTS "Allow all updates for expenses" ON expenses;
DROP POLICY IF EXISTS "Allow all deletes for expenses" ON expenses;

CREATE POLICY "Allow all selects for expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for expenses" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for expenses" ON expenses FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for expenses" ON expenses FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow all selects for staff_salaries" ON staff_salaries;
DROP POLICY IF EXISTS "Allow all inserts for staff_salaries" ON staff_salaries;
DROP POLICY IF EXISTS "Allow all updates for staff_salaries" ON staff_salaries;
DROP POLICY IF EXISTS "Allow all deletes for staff_salaries" ON staff_salaries;

CREATE POLICY "Allow all selects for staff_salaries" ON staff_salaries FOR SELECT USING (true);
CREATE POLICY "Allow all inserts for staff_salaries" ON staff_salaries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates for staff_salaries" ON staff_salaries FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes for staff_salaries" ON staff_salaries FOR DELETE USING (true);

-- 4. Automatically Sync Payroll Payments to Expense Ledger Trigger
CREATE OR REPLACE FUNCTION auto_sync_salary_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  staff_name TEXT;
  default_property_id UUID;
BEGIN
  -- Trigger action when transitioning status from pending/approved to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    -- Fetch staff name
    SELECT (first_name || ' ' || last_name) INTO staff_name FROM profiles WHERE id = NEW.staff_id;
    
    -- Fetch a default property (headquarters) to associate with this staff cost
    SELECT id INTO default_property_id FROM properties ORDER BY created_at LIMIT 1;
    
    -- Insert salary payout into the expenses log
    INSERT INTO expenses (property_id, amount, category, description, expense_date, paid_to, payment_method, status)
    VALUES (
      default_property_id,
      NEW.net_salary,
      'Salaries',
      'Salary payout for period ' || to_char(NEW.pay_period_start, 'Mon DD') || ' to ' || to_char(NEW.pay_period_end, 'Mon DD, YYYY') || '. ' || COALESCE(NEW.notes, ''),
      COALESCE(NEW.payment_date, CURRENT_DATE),
      COALESCE(staff_name, 'Staff Member'),
      NEW.payment_method,
      'paid'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_salary_expense ON staff_salaries;
CREATE TRIGGER trigger_sync_salary_expense
AFTER UPDATE ON staff_salaries
FOR EACH ROW
EXECUTE FUNCTION auto_sync_salary_to_expense();

-- 5. Seed Permissions for the 'Accounting' Module
DO $$
DECLARE
  role_item TEXT;
  roles_to_grant TEXT[] := ARRAY['super_admin', 'hotel_owner', 'hotel_manager', 'accountant'];
  roles_to_restrict TEXT[] := ARRAY['receptionist', 'head_housekeeper', 'housekeeping', 'maintenance', 'customer_support'];
BEGIN
  -- Grant permissions
  FOREACH role_item IN ARRAY roles_to_grant LOOP
    INSERT INTO role_permissions (role, module, has_access)
    VALUES (role_item::user_role, 'Accounting', true)
    ON CONFLICT (role, module) DO UPDATE SET has_access = true;
  END LOOP;

  -- Deny permissions initially for non-financial roles
  FOREACH role_item IN ARRAY roles_to_restrict LOOP
    INSERT INTO role_permissions (role, module, has_access)
    VALUES (role_item::user_role, 'Accounting', false)
    ON CONFLICT (role, module) DO NOTHING;
  END LOOP;
END $$;

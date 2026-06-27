-- LUXE APARTMENT PMS - MIGRATION FOR PROCUREMENT TO GENERAL LEDGER EXPENSE SYNC TRIGGER
-- Automatically logs Supplies Cost Outflows in the expenses ledger table when a store purchase request is retired.

-- 1. Create or replace the sync trigger function
CREATE OR REPLACE FUNCTION auto_sync_procurement_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  default_property_id UUID;
BEGIN
  -- Trigger action when transitioning status from pending_purchase to 'completed_retired'
  IF NEW.status = 'completed_retired' AND (OLD.status IS NULL OR OLD.status <> 'completed_retired') THEN
    -- Fetch a default property (headquarters) to associate with this supplies cost
    SELECT id INTO default_property_id FROM properties ORDER BY created_at LIMIT 1;
    
    -- Insert procurement payout into the expenses log
    INSERT INTO expenses (property_id, amount, category, description, expense_date, paid_to, payment_method, status)
    VALUES (
      default_property_id,
      NEW.estimated_cost,
      'Supplies',
      'Procurement fulfillment: Stocked ' || NEW.quantity || 'x "' || NEW.item_name || '" into stores. Retired by ' || COALESCE(NEW.retired_by, 'Authorized Officer') || '. Purchaser: ' || NEW.purchaser_name || '. Notes: ' || COALESCE(NEW.notes, 'None'),
      COALESCE(NEW.retired_at::date, CURRENT_DATE),
      'Procurement Vendor (Purchaser: ' || NEW.purchaser_name || ')',
      'bank_transfer',
      'paid'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind the trigger to the store_purchase_requests table
DROP TRIGGER IF EXISTS trigger_sync_procurement_expense ON store_purchase_requests;
CREATE TRIGGER trigger_sync_procurement_expense
AFTER UPDATE ON store_purchase_requests
FOR EACH ROW
EXECUTE FUNCTION auto_sync_procurement_to_expense();

-- 3. Retroactively populate expenses for all ALREADY completed_retired purchase requests
INSERT INTO expenses (property_id, amount, category, description, expense_date, paid_to, payment_method, status)
SELECT 
  (SELECT id FROM properties ORDER BY created_at LIMIT 1) AS property_id,
  pr.estimated_cost,
  'Supplies'::text AS category,
  'Procurement fulfillment (Retroactive): Stocked ' || pr.quantity || 'x "' || pr.item_name || '" into stores. Retired by ' || COALESCE(pr.retired_by, 'Authorized Officer') || '. Purchaser: ' || pr.purchaser_name || '. Notes: ' || COALESCE(pr.notes, 'None') AS description,
  COALESCE(pr.retired_at::date, pr.created_at::date, CURRENT_DATE) AS expense_date,
  'Procurement Vendor (Purchaser: ' || pr.purchaser_name || ')' AS paid_to,
  'bank_transfer'::text AS payment_method,
  'paid'::text AS status
FROM store_purchase_requests pr
WHERE pr.status = 'completed_retired'
  AND NOT EXISTS (
    -- Avoid duplicates if already logged under this description
    SELECT 1 FROM expenses e 
    WHERE e.amount = pr.estimated_cost 
      AND e.category = 'Supplies'
      AND e.description LIKE '%' || pr.item_name || '%'
  );

-- LUXE APARTMENT PMS - RESTAURANT & KITCHEN SYSTEM ADJUSTMENTS
-- This migration cleans up the 'kitchen' POS outlet and registers the new 'Restaurant & Kitchen' permissions.

BEGIN;

-- 1. Remove 'kitchen' from pos_outlets array for all profiles
UPDATE public.profiles
SET pos_outlets = array_remove(pos_outlets, 'kitchen')
WHERE 'kitchen' = ANY(pos_outlets);

-- 2. Add 'Restaurant & Kitchen' module permissions to roles
DELETE FROM public.role_permissions WHERE module = 'Restaurant & Kitchen';

INSERT INTO public.role_permissions (role, module, has_access)
VALUES
    ('super_admin', 'Restaurant & Kitchen', true),
    ('hotel_manager', 'Restaurant & Kitchen', true),
    ('receptionist', 'Restaurant & Kitchen', true);

-- 3. Ensure we have Restaurant Food & Beverage items active in services
-- Check if we have some default F&B items, if not seed a couple
INSERT INTO public.services (name, description, category, base_price_ngn, pricing_type, icon_name, is_active, internal_notes)
SELECT name, description, category, base_price, pricing_type, icon, is_active, internal_notes
FROM (
    VALUES
        ('Grilled Croaker Fish', 'Fresh croaker fish grilled with spicy sauce and served with chips.', 'Food & Beverage', 12000.00, 'fixed'::service_pricing_type, 'Utensils', true, 'restaurant'),
        ('Jollof Rice Special', 'Nigerian Jollof Rice served with seasoned chicken and plantain.', 'Food & Beverage', 8500.00, 'fixed'::service_pricing_type, 'Utensils', true, 'restaurant'),
        ('Club Sandwich & Fries', 'Double decker toasted bread with chicken, egg, bacon, lettuce, tomato and mayo.', 'Food & Beverage', 7500.00, 'fixed'::service_pricing_type, 'Utensils', true, 'restaurant'),
        ('Pepper Soup (Goat Meat)', 'Spicy traditional Nigerian soup cooked with local herbs and fresh goat meat.', 'Food & Beverage', 6000.00, 'fixed'::service_pricing_type, 'Utensils', true, 'restaurant')
) AS new_services(name, description, category, base_price, pricing_type, icon, is_active, internal_notes)
WHERE NOT EXISTS (
    SELECT 1 FROM public.services WHERE public.services.name = new_services.name
);

COMMIT;

-- Force reload PGRST cache
NOTIFY pgrst, 'reload schema';

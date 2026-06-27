-- LUXE APARTMENT PMS - LAUNDRY SERVICE DEFERRED BILLING SEED
-- This script sets the base price of the standard 'Laundry Service' to 0 (indicating deferred billing).
-- It ensures that laundry staff can enter the custom charge amount dynamically post-service.

DO $$
BEGIN
    -- 1. Ensure the Laundry Service exists and set its base price to 0 and quantity selector to true
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Laundry Service') THEN
        UPDATE services
        SET 
            base_price_ngn = 0.00,
            pricing_type = 'quantity_based'::service_pricing_type,
            quantity_selector = true,
            description = 'Professional dry cleaning, washing, pressing, and folding service. Charges are calculated and posted post-service based on clothing items processed.'
        WHERE name = 'Laundry Service';
    ELSE
        -- Insert it if it does not exist for some reason
        INSERT INTO services (name, description, category, base_price_ngn, pricing_type, icon_name, scheduling_required, quantity_selector, is_active)
        VALUES (
            'Laundry Service',
            'Professional dry cleaning, washing, pressing, and folding service. Charges are calculated and posted post-service based on clothing items processed.',
            'Laundry',
            0.00,
            'quantity_based'::service_pricing_type,
            'Shirt',
            false,
            true,
            true
        );
    END IF;

    -- 2. Update all laundry services category to 'Laundry' to align with our new Laundry Department
    UPDATE services 
    SET category = 'Laundry' 
    WHERE name ILIKE '%laundry%';

END $$;

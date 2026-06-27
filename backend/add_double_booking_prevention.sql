-- LUXE APARTMENT PMS - MIGRATION TO PREVENT OVERLAPPING/DOUBLE BOOKINGS
-- Enforces strict database-level constraints using a trigger to ensure no room can be double-booked.

CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Only perform check if the booking is active (not cancelled)
  IF NEW.status != 'cancelled' THEN
    IF EXISTS (
      SELECT 1 
      FROM bookings
      WHERE room_id = NEW.room_id
        AND id <> NEW.id  -- Ignore the current row for updates
        AND status != 'cancelled'
        AND check_in_date < NEW.check_out_date
        AND check_out_date > NEW.check_in_date
    ) THEN
      RAISE EXCEPTION 'Double Booking Alert: Room % is already occupied or reserved during this date range (From % to %). Please choose another room or date window.', 
        (SELECT room_number FROM rooms WHERE id = NEW.room_id),
        NEW.check_in_date,
        NEW.check_out_date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind the overlap constraint trigger to the bookings table
DROP TRIGGER IF EXISTS trigger_check_booking_overlap ON bookings;
CREATE TRIGGER trigger_check_booking_overlap
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION check_booking_overlap();

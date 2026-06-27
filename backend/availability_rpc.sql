-- Function to securely fetch booked room IDs for a date range without exposing guest data
-- Uses SECURITY DEFINER to bypass RLS so anonymous website visitors can check availability.

CREATE OR REPLACE FUNCTION get_booked_room_ids(req_start_date DATE, req_end_date DATE)
RETURNS TABLE (booked_room_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.room_id
  FROM bookings b
  WHERE b.status != 'cancelled'
    AND b.check_in_date < req_end_date
    AND b.check_out_date > req_start_date;
END;
$$;

-- Grant execution to everyone (including website visitors)
GRANT EXECUTE ON FUNCTION get_booked_room_ids(DATE, DATE) TO anon, authenticated;

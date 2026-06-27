-- Create an audit trigger function
CREATE OR REPLACE FUNCTION log_system_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
  ELSE
    v_entity_id := NEW.id;
  END IF;

  INSERT INTO system_logs (user_id, log_type, action, entity_table, entity_id)
  VALUES (
    auth.uid(),
    'audit',
    TG_OP,
    TG_TABLE_NAME::text,
    v_entity_id
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to important tables
DROP TRIGGER IF EXISTS bookings_audit_trigger ON bookings;
CREATE TRIGGER bookings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_system_audit();

DROP TRIGGER IF EXISTS rooms_audit_trigger ON rooms;
CREATE TRIGGER rooms_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON rooms
  FOR EACH ROW EXECUTE FUNCTION log_system_audit();


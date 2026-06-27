import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const columns = [
  'id',
  'room_number',
  'name',
  'type',
  'capacity',
  'size_sqm',
  'base_price_ngn',
  'image_url',
  'status',
  'amenities',
  'min_stay_days',
  'max_stay_days',
  'allowed_check_in_days',
  'allowed_check_out_days'
];

async function test() {
  console.log("Supabase URL:", process.env.SUPABASE_URL);

  // Connection warming
  await supabase.from('rooms').select('id').limit(1);

  // Query each column individually
  for (const col of columns) {
    const start = Date.now();
    const { data, error } = await supabase.from('rooms').select(col);
    const duration = Date.now() - start;
    if (error) {
      console.error(`Error on column ${col}:`, error);
    } else {
      // Print first record's value length if string
      const firstVal = data[0]?.[col];
      const valStr = typeof firstVal === 'string' ? `length: ${firstVal.length}` : (Array.isArray(firstVal) ? `array len: ${firstVal.length}` : `value: ${firstVal}`);
      console.log(`Column "${col}" query took (ms):`, duration, `(${valStr})`);
    }
  }
}

test();

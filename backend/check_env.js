import dotenv from 'dotenv';
dotenv.config();
console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);

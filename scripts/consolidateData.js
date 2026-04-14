const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let URL = '';
let KEY = '';

for (const line of envFile.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) URL = line.split('=')[1].trim().replace(/^"|"(?=\r?$)/g, '');
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) KEY = line.split('=')[1].trim().replace(/^"|"(?=\r?$)/g, '');
}

const { createClient } = require('@supabase/supabase-js');
// NOTE: This usually requires SERVICE_ROLE_KEY to update other users' records if RLS is on.
// But if RLS is weak or we have the right key, it might work.
const supabase = createClient(URL, KEY);

const TARGET_USER_ID = 'e92be182-0732-4ed7-876f-83237bdb860a';

async function consolidate() {
  console.log(`Consolidating all data to User: ${TARGET_USER_ID}...`);
  
  // 1. Workers
  const { data: w, error: we } = await supabase.from('workers').update({ user_id: TARGET_USER_ID }).neq('user_id', TARGET_USER_ID);
  console.log("Updated Workers:", w?.length || 0, we ? we.message : "Success");

  // 2. Transactions
  const { data: t, error: te } = await supabase.from('transactions').update({ user_id: TARGET_USER_ID }).neq('user_id', TARGET_USER_ID);
  console.log("Updated Transactions:", t?.length || 0, te ? te.message : "Success");

  // 3. Attendance
  const { data: a, error: ae } = await supabase.from('attendance').update({ user_id: TARGET_USER_ID }).neq('user_id', TARGET_USER_ID);
  console.log("Updated Attendance:", a?.length || 0, ae ? ae.message : "Success");

  console.log("Done.");
}

consolidate();

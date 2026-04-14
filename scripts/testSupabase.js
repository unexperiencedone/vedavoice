const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let URL = '';
let KEY = '';

for (const line of envFile.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) URL = line.split('=')[1].trim().replace(/^"|"(?=\r?$)/g, '');
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) KEY = line.split('=')[1].trim().replace(/^"|"(?=\r?$)/g, '');
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(URL, KEY);

async function check() {
  console.log("=== SIMPLE ATTENDANCE INSERT TEST ===");
  
  const targetUser = 'e92be182-0732-4ed7-876f-83237bdb860a';
  const { data: wk } = await supabase.from('workers').select('id').eq('user_id', targetUser).limit(1);
  
  if (!wk || wk.length === 0) {
    console.error("No workers found for target user!");
    return;
  }

  const worker_id = wk[0].id;
  const date = new Date().toISOString().split('T')[0];

  console.log(`Attempting simple insert: user=${targetUser}, worker=${worker_id}, date=${date}`);
  
  // Try simple insert first to check for RLS or FK errors
  const { data, error } = await supabase.from('attendance').insert({
    user_id: targetUser,
    worker_id: worker_id,
    date: date,
    status: 'present',
    marked_via: 'manual'
  }).select();

  if (error) {
    console.error("Insert error:", error.message, error.code, error.details);
  } else {
    console.log("Insert success!", data);
  }
}
check();

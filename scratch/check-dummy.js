const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
);

async function check() {
  const { data, error } = await supabase
    .from('shows')
    .select('*')
    .eq('captivate_show_id', '44b65556-406f-4a16-8bce-4dd25f0a1de8');
    
  console.log("DB Matches for this ID:");
  console.log(data);
  
  if (error) console.error("Error:", error);
}

check();

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
);

async function check() {
  const { data, error } = await supabase
    .from('episode_publish_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2);
    
  if (error) {
    console.error("Error fetching runs:", error);
    return;
  }
  
  console.log("Recent Publish Runs:", data);
}

check();

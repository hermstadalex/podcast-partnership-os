const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  const { data, error } = await supabase.from('shows').select('id, title, abbreviation, captivate_show_id, cover_art, youtube_reference_art, podcast_reference_art');
  console.log(JSON.stringify(data, null, 2));
}

main();

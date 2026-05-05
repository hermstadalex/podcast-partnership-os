const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = "https://ixyzyxhjcdqidsnlqwwj.supabase.co";
const supabaseKey = "dummy_key"; // getPublicUrl doesn't validate key
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Raw:", supabase.storage.from('episodes_bucket').getPublicUrl('shorts/my file.jpg').data.publicUrl);
console.log("Encoded:", supabase.storage.from('episodes_bucket').getPublicUrl(`shorts/${encodeURIComponent('my file.jpg')}`).data.publicUrl);

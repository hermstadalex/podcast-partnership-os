import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

async function upload() {
  const file = fs.readFileSync('test_audio.m4a');
  const { data, error } = await supabase.storage
    .from('episodes_bucket')
    .upload('test_audio_m4a', file, {
      contentType: 'audio/mp4',
      upsert: true
    });
    
  if (error) {
    console.error('Upload error:', error);
  } else {
    const { data: publicUrlData } = supabase.storage.from('episodes_bucket').getPublicUrl('test_audio_m4a');
    console.log('Public URL:', publicUrlData.publicUrl);
  }
}
upload();

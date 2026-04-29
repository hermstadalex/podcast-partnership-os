const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkCaptivate() {
  const token = process.env.CAPTIVATE_API_KEY;
  const userId = process.env.CAPTIVATE_USER_ID;
  const showId = '44b65556-406f-4a16-8bce-4dd25f0a1de8';
  
  try {
    const res = await fetch(`https://api.captivate.fm/shows/${showId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const text = await res.text();
    console.log("Captivate API response for this ID:");
    if (res.ok) {
        const json = JSON.parse(text);
        console.log(`Show Title: ${json.show?.title}`);
        console.log(`Show ID: ${json.show?.id}`);
    } else {
        console.log(`Error ${res.status}: ${text}`);
    }
  } catch (e) {
    console.error(e);
  }
}

checkCaptivate();

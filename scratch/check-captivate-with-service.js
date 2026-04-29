require('dotenv').config({ path: '.env.local' });

async function check() {
  const token = process.env.CAPTIVATE_API_KEY;
  const userId = process.env.CAPTIVATE_USER_ID;
  const showId = '44b65556-406f-4a16-8bce-4dd25f0a1de8';
  
  const formData = new URLSearchParams();
  formData.append('username', userId);
  formData.append('token', token);

  const authRes = await fetch('https://api.captivate.fm/authenticate/token', {
    method: 'POST',
    body: formData
  });
  
  const authJson = await authRes.json();
  const bearer = authJson.user.token;
  
  const res = await fetch(`https://api.captivate.fm/shows/${showId}`, {
    headers: { 'Authorization': `Bearer ${bearer}` }
  });
  
  const data = await res.json();
  console.log("Show Data:");
  console.log("ID:", data.show?.id);
  console.log("Title:", data.show?.title);
}

check();

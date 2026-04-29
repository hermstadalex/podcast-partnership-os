import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function authenticate() {
  const userId = process.env.CAPTIVATE_USER_ID!;
  const apiKey = process.env.CAPTIVATE_API_KEY!;
  const formData = new URLSearchParams();
  formData.append('username', userId);
  formData.append('token', apiKey);

  const authRes = await fetch('https://api.captivate.fm/authenticate/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  const authData = await authRes.json();
  if (!authData.user?.token) throw new Error("Auth failed");
  return authData.user.token;
}

async function testUpload() {
  try {
    const token = await authenticate();
    const showId = '44b65556-406f-4a16-8bce-4dd25f0a1de8';
    
    // Use the mediaId we got from the last successful upload!
    const mediaId = '5165b9dc-74a6-4f8c-af29-96ee2cfbc0fb';
    
    const formData = new FormData();
    formData.append('shows_id', showId);
    formData.append('title', 'My Demo Episode');
    formData.append('shownotes', '<h2>Demo</h2><p>This is a test</p>');
    formData.append('media_id', mediaId);
    formData.append('status', 'Scheduled');
    formData.append('date', '2027-01-01 12:00:00');
    formData.append('episode_type', 'full');
    
    console.log("[CAPTIVATE] Creating episode...");
    const postRes = await fetch(`https://api.captivate.fm/episodes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!postRes.ok) {
      const errBody = await postRes.text();
      console.error("Captivate POST error payload:", errBody);
      return;
    }

    const data = await postRes.json();
    console.log("Success! Episode created:", data);
  } catch (e) {
    console.error("Test failed:", e);
  }
}

testUpload();

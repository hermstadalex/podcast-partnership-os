import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const formData = new URLSearchParams();
    formData.append('username', process.env.CAPTIVATE_USER_ID);
    formData.append('token', process.env.CAPTIVATE_API_KEY);
    const authRes = await fetch(`https://api.captivate.fm/authenticate/token`, { method: 'POST', body: formData.toString() });
    const token = (await authRes.json()).user.token;
    
    console.log("Testing POST to root /episodes...");
    const postRes = await fetch(`https://api.captivate.fm/episodes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shows_id: "44b65556-406f-4a16-8bce-4dd25f0a1de8", title: 'Test' })
    });
    console.log("Status:", postRes.status);
    console.log("Response:", await postRes.text());
}
run();

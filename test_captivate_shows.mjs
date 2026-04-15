import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const formData = new URLSearchParams();
    formData.append('username', process.env.CAPTIVATE_USER_ID);
    formData.append('token', process.env.CAPTIVATE_API_KEY);

    const authRes = await fetch(`https://api.captivate.fm/authenticate/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const authData = await authRes.json();
    const token = authData.user.token;
    
    console.log("Testing /shows on root api.captivate.fm...");
    const rootRes = await fetch("https://api.captivate.fm/shows", { headers: { 'Authorization': `Bearer ${token}` }});
    console.log("Root /shows status:", rootRes.status);
    
    console.log("Testing /v2/shows...");
    const v2Res = await fetch("https://api.captivate.fm/v2/shows", { headers: { 'Authorization': `Bearer ${token}` }});
    console.log("v2 /shows status:", v2Res.status);
}
run();

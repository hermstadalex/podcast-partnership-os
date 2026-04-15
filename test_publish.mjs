import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fetch from 'node-fetch';

async function testCaptivate() {
    console.log("Testing Captivate Auth...");
    const res = await fetch('https://api.captivate.fm/v2/authenticate/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: process.env.CAPTIVATE_USER_ID,
            token: process.env.CAPTIVATE_API_KEY
        })
    });
    
    if (!res.ok) {
        console.error("Captivate Auth Failed: " + res.status + " " + res.statusText);
        return;
    }
    const data = await res.json();
    console.log("Captivate Auth Success! Token obtained.");
    
    console.log("Testing Captivate POST Episode...");
    const epRes = await fetch(`https://api.captivate.fm/v2/shows/44b65556-406f-4a16-8bce-4dd25f0a1de8/episodes`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.user.token}`
        },
        body: JSON.stringify({
            title: "Test Episode POST",
            shownotes: "Test Notes",
            media_url: "http://example.com/audio.mp3",
            status: "Draft"
        })
    });
    
    if (!epRes.ok) {
        console.error("Captivate Episode POST Failed: " + epRes.status + " " + epRes.statusText);
    } else {
        const epData = await epRes.json();
        console.log("Captivate Episode POST Success:", epData);
    }
}

testCaptivate();

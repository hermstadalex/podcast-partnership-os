import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Disable CSRF since this is an external webhook POST route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log("[WEBHOOK] Received from Zernio:", JSON.stringify(payload, null, 2));

    const eventId = payload.event || payload.type;
    
    // Attempt to extract the post ID from various common schema patterns, 
    // including Zernio's specific MongoDB '_id' notation.
    const zernioPostId = payload.postId || payload.id || payload._id || payload.data?.id || payload.post?.id || payload.post?._id;

    if (!eventId || !zernioPostId) {
      return NextResponse.json({ error: "Missing event or ID" }, { status: 400 });
    }

    const supabase = await createClient();

    if (eventId === 'post.published') {
      console.log(`[WEBHOOK] Zernio Post ${zernioPostId} successfully published. Updating DB.`);
      await supabase
        .from('episodes_feed')
        .update({ status: 'Published' })
        .eq('zernio_post_id', zernioPostId);
    } else if (eventId === 'post.failed' || eventId === 'post.cancelled') {
        console.warn(`[WEBHOOK] Zernio Post ${zernioPostId} failed or cancelled. Updating DB.`);
        await supabase
        .from('episodes_feed')
        .update({ status: 'Failed' })
        .eq('zernio_post_id', zernioPostId);
    } else {
        // We acknowledge other events but do not change the pipeline status
        console.log(`[WEBHOOK] Zernio Event ${eventId} ignored.`);
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err: any) {
    console.error("[WEBHOOK ERROR]:", err.message);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

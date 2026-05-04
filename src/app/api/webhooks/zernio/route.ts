import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function isValidHexSignature(signature: string) {
  return signature.length > 0 && signature.length % 2 === 0 && /^[\da-f]+$/i.test(signature);
}

type ZernioPlatformPost = {
  platform?: string;
  url?: string;
  videoUrl?: string;
  permalink?: string;
  youtubeUrl?: string;
  videoId?: string;
  externalId?: string;
  id?: string;
  _id?: string;
};

type ZernioWebhookPayload = {
  post?: {
    platformPosts?: ZernioPlatformPost[];
    partial?: boolean;
    id?: string;
    _id?: string;
  };
  data?: {
    platformPosts?: ZernioPlatformPost[];
    partial?: boolean;
    id?: string;
  };
  event?: string;
  type?: string;
  postId?: string;
  id?: string;
  _id?: string;
};

function extractYouTubeMedia(payload: ZernioWebhookPayload) {
  const platformPosts = [
    ...(Array.isArray(payload?.post?.platformPosts) ? payload.post.platformPosts : []),
    ...(Array.isArray(payload?.data?.platformPosts) ? payload.data.platformPosts : []),
  ];

  const youtubePost = platformPosts.find((entry) => entry?.platform === 'youtube');
  if (!youtubePost) {
    return null;
  }

  const youtubeVideoUrl =
    youtubePost.url ||
    youtubePost.videoUrl ||
    youtubePost.permalink ||
    youtubePost.youtubeUrl ||
    null;

  const youtubeVideoId =
    youtubePost.videoId ||
    youtubePost.externalId ||
    youtubePost.id ||
    youtubePost._id ||
    null;

  return {
    youtube_video_id: youtubeVideoId,
    youtube_video_url: youtubeVideoUrl,
  };
}

export async function POST(request: Request) {
  try {
    const rawBodyBuffer = await request.arrayBuffer();
    const rawBody = Buffer.from(rawBodyBuffer).toString('utf8');

    // HMAC SHA-256 Signature Validation
    const signatureHeader = request.headers.get('x-zernio-signature');
    const secret = process.env.ZERNIO_WEBHOOK_SECRET;

    if (!secret) {
        if (process.env.NODE_ENV !== 'development') {
            console.error("[WEBHOOK] ZERNIO_WEBHOOK_SECRET is not configured. Failing closed.");
            return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
        }
        console.warn("[WEBHOOK] ZERNIO_WEBHOOK_SECRET is missing. Bypassing validation (development mode only).");
    } else if (signatureHeader) {
        const normalizedSignature = signatureHeader.trim().replace(/^sha256=/i, '');
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(rawBody);
        const expectedSignature = hmac.digest('hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        if (!isValidHexSignature(normalizedSignature)) {
           console.warn("[WEBHOOK] Malformed Zernio Signature detected.");
           return NextResponse.json({ error: "Unauthorized: Invalid Signature" }, { status: 401 });
        }

        const providedBuffer = Buffer.from(normalizedSignature, 'hex');

        if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
           console.warn("[WEBHOOK] Invalid Zernio Signature detected.");
           return NextResponse.json({ error: "Unauthorized: Invalid Signature" }, { status: 401 });
        }
    } else {
        return NextResponse.json({ error: "Unauthorized: Missing Signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as ZernioWebhookPayload;
    console.log("[WEBHOOK] Received from Zernio:", JSON.stringify(payload, null, 2));

    const eventId = payload.event || payload.type;
    const zernioPostId = payload.postId || payload.id || payload._id || payload.data?.id || payload.post?.id || payload.post?._id;

    if (!eventId || !zernioPostId) {
      return NextResponse.json({ error: "Missing event or ID" }, { status: 400 });
    }

    // Provision a detached server-only client to bypass RLS for systemic operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: currentRun } = await supabaseAdmin
       .from('episode_publish_runs')
       .select('id, status, episode_id')
       .eq('provider', 'zernio')
       .eq('external_entity_id', zernioPostId)
       .maybeSingle();

    if (!currentRun) {
       console.warn(`[WEBHOOK] No publish run found for post ${zernioPostId}.`);
       return NextResponse.json({ success: true, ignored: true }, { status: 200 });
    }

    if (currentRun.status === 'Published' || currentRun.status === 'Failed' || currentRun.status === 'Partial') {
       console.log(`[WEBHOOK] Idempotency guard: Skipping mutation, post already terminal (${currentRun.status}).`);
       return NextResponse.json({ success: true, bypassed: true }, { status: 200 });
    }

    if (eventId === 'post.published') {
      const isPartial = payload.post?.partial === true || payload.data?.partial === true;
      const targetStatus = isPartial ? 'Partial' : 'Published';
      console.log(`[WEBHOOK] Zernio Post ${zernioPostId} transition. Status: ${targetStatus}`);
      const youtubeMedia = extractYouTubeMedia(payload);

      await supabaseAdmin
        .from('episode_publish_runs')
        .update({
          status: targetStatus,
          webhook_payload: payload,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentRun.id);

      if (youtubeMedia?.youtube_video_id || youtubeMedia?.youtube_video_url) {
        await supabaseAdmin
          .from('episodes')
          .update({
            ...youtubeMedia,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentRun.episode_id);
      }
    } else if (eventId === 'post.failed' || eventId === 'post.cancelled') {
        console.warn(`[WEBHOOK] Zernio Post ${zernioPostId} failed. Status: Failed`);
        await supabaseAdmin
        .from('episode_publish_runs')
        .update({
          status: 'Failed',
          webhook_payload: payload,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentRun.id);
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error("[WEBHOOK ERROR]:", message);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// src/pages/api/voice.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase.server';

/**
 * GET /api/voice?guest=NAME
 * Returns the voice recording record for the given guest.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const guest = url.searchParams.get('guest');

  if (!guest) {
    return new Response(JSON.stringify({ error: 'Parameter guest diperlukan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase
    .from('guest_voices')
    .select('id, url, created_at')
    .eq('guest_id', guest)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ voice: data || null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * POST /api/voice
 * Accepts multipart/form-data with fields:
 *   - guest: string (guest identifier)
 *   - audio: File (audio recording blob)
 * Stores the file in Supabase Storage bucket "disposable-camera" under "voices/"
 * and records the public URL in the guest_voices table (unique per guest).
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const guest = form.get('guest')?.toString();
    const file = form.get('audio') as File | null;

    if (!guest || !file) {
      return new Response(JSON.stringify({ error: 'guest and audio file are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Check if there's an existing voice record to clean up storage
    const { data: existingRecord } = await supabase
      .from('guest_voices')
      .select('url')
      .eq('guest_id', guest)
      .maybeSingle();

    if (existingRecord) {
      const urlParts = existingRecord.url.split('/disposable-camera/');
      if (urlParts.length >= 2) {
        const oldFilePath = decodeURIComponent(urlParts[1]);
        const { error: deleteOldError } = await supabase.storage
          .from('disposable-camera')
          .remove([oldFilePath]);
        if (deleteOldError) {
          console.warn('Failed to delete old voice file:', deleteOldError.message);
        }
      }
    }

    // 2. Convert File object to ArrayBuffer and then Node Buffer for robust serverless upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileExt = file.name.split('.').pop() || 'webm';
    // Sanitize guest name for file path
    const sanitizedGuest = guest.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = `voices/${sanitizedGuest}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('disposable-camera')
      .upload(filePath, buffer, { 
        upsert: true, 
        contentType: file.type || 'audio/webm' 
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get public URL
    const { data: publicUrlData } = supabase.storage.from('disposable-camera').getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;

    // 4. Upsert in guest_voices table (ensures only 1 record per guest due to UNIQUE constraint)
    const { data: dbData, error: insertError } = await supabase
      .from('guest_voices')
      .upsert({
        guest_id: guest,
        url: publicUrl,
        created_at: new Date().toISOString(),
      }, { onConflict: 'guest_id' })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, voice: dbData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * DELETE /api/voice?guest=NAME
 * Deletes the guest's voice recording from storage and database.
 */
export const DELETE: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const guest = url.searchParams.get('guest');

  if (!guest) {
    return new Response(JSON.stringify({ error: 'Parameter guest diperlukan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Get the voice record to retrieve file path
  const { data: record, error: fetchError } = await supabase
    .from('guest_voices')
    .select('id, url')
    .eq('guest_id', guest)
    .maybeSingle();

  if (fetchError || !record) {
    return new Response(JSON.stringify({ error: 'Rekaman suara tidak ditemukan' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Remove file from Supabase storage
  const urlParts = record.url.split('/disposable-camera/');
  if (urlParts.length >= 2) {
    const filePath = decodeURIComponent(urlParts[1]);
    const { error: storageError } = await supabase.storage
      .from('disposable-camera')
      .remove([filePath]);
    if (storageError) {
      console.warn("Warn: Failed to delete voice file from storage bucket:", storageError.message);
    }
  }

  // 3. Delete from guest_voices database table
  const { error: deleteError } = await supabase
    .from('guest_voices')
    .delete()
    .eq('guest_id', guest);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

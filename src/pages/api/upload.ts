import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// Helper to extract the filename from a Supabase Storage URL
function extractFilename(url: string) {
  if (!url) return null;
  // Check if it belongs to our photos bucket
  if (url.includes('/storage/v1/object/public/photos/')) {
    const parts = url.split('/storage/v1/object/public/photos/');
    if (parts.length > 1) {
      return parts[1];
    }
  }
  return null;
}

// POST api/upload: Upload image file to Supabase Storage and clean up old image
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const oldFileUrl = formData.get('oldFileUrl') as string;
    const password = formData.get('password') as string;

    const correctPassword = import.meta.env.ADMIN_PASSWORD;

    if (!password || password !== correctPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Password salah!' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!file || !fileName) {
      return new Response(JSON.stringify({ error: 'No file uploaded or fileName missing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Delete the old file if it exists in Supabase
    if (oldFileUrl) {
      const oldFileName = extractFilename(oldFileUrl);
      if (oldFileName) {
        await supabase.storage.from('photos').remove([oldFileName]);
      }
    }

    // 2. Convert File object to ArrayBuffer and then Node Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload buffer to Supabase bucket 'photos'
    const { data, error } = await supabase.storage
      .from('photos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Fetch the public asset URL
    const { data: publicUrlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    return new Response(JSON.stringify({ success: true, publicUrl: publicUrlData.publicUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// src/pages/api/camera.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase.server';

/**
 * GET /api/camera?guest=NAME
 * Returns an array of photo records for the given guest.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const guest = url.searchParams.get('guest');
  const adminPass = url.searchParams.get('adminPass');

  if (!guest) {
    const adminPassword = import.meta.env.ADMIN_PASSWORD;
    if (!adminPass || adminPass !== adminPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized or missing parameter' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('camera_photos')
      .select('guest_id, url, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data ?? []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase
    .from('camera_photos')
    .select('id, url, created_at')
    .eq('guest_id', guest)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Count deletions for this guest
  let deletionCount = 0;
  try {
    const { count, error: countError } = await supabase
      .from('camera_deletions')
      .select('id', { count: 'exact', head: true })
      .eq('guest_id', guest);
    if (!countError && count !== null) {
      deletionCount = count;
    }
  } catch (err) {
    console.error('Failed to fetch deletion count:', err);
  }

  return new Response(JSON.stringify({ photos: data ?? [], deletionCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * POST /api/camera
 * Accepts multipart/form-data with fields:
 *   - guest: string (guest identifier)
 *   - photos: File (single image per request)
 * Stores the file in Supabase Storage bucket "disposable-camera"
 * and records the public URL in the camera_photos table.
 */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const guest = form.get('guest')?.toString();
  const file = form.get('photos') as File | null;
  if (!guest || !file) {
    return new Response(JSON.stringify({ error: 'guest and file required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load photo limit from settings
  let photoLimit = 15;
  try {
    const { data: dbSettings } = await supabase
      .from('settings')
      .select('camera_photo_limit')
      .eq('id', 1)
      .single();
    if (dbSettings && dbSettings.camera_photo_limit !== undefined) {
      photoLimit = dbSettings.camera_photo_limit;
    }
  } catch (err) {
    console.error('Failed to load settings photo limit, using default:', err);
  }

  // Enforce limit of photos per guest
  const { count } = await supabase
    .from('camera_photos')
    .select('id', { count: 'exact', head: true })
    .eq('guest_id', guest);
  if (count !== null && count >= photoLimit) {
    return new Response(JSON.stringify({ error: `Maximum ${photoLimit} photos reached` }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Convert File object to ArrayBuffer and then Node Buffer for robust serverless upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileExt = file.name.split('.').pop() || 'jpg';
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const filePath = `${guest}/${Date.now()}_${randomSuffix}.${fileExt}`;
  const { error: uploadError, data: uploadData } = await supabase.storage
    .from('disposable-camera')
    .upload(filePath, buffer, { upsert: false, contentType: file.type });
  if (uploadError) {
    return new Response(JSON.stringify({ error: uploadError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: publicUrlData } = supabase.storage.from('disposable-camera').getPublicUrl(filePath);
  const publicUrl = publicUrlData.publicUrl;

  const { error: insertError } = await supabase.from('camera_photos').insert({
    guest_id: guest,
    url: publicUrl,
    created_at: new Date().toISOString(),
  });
  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, url: publicUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * DELETE /api/camera?id=PHOTO_ID&adminPass=PASSWORD
 * Deletes the photo from Supabase Storage and records from camera_photos database.
 */
export const DELETE: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const adminPass = url.searchParams.get('adminPass');
  const guest = url.searchParams.get('guest');

  const adminPassword = import.meta.env.ADMIN_PASSWORD;
  const isAdmin = adminPass && adminPass === adminPassword;

  if (!isAdmin && !guest) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Kredensial tidak valid' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!id) {
    return new Response(JSON.stringify({ error: 'Photo ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Get the record of the photo to extract file path and guest owner
  const { data: photoRecord, error: fetchError } = await supabase
    .from('camera_photos')
    .select('guest_id, url')
    .eq('id', id)
    .single();

  if (fetchError || !photoRecord) {
    return new Response(JSON.stringify({ error: 'Foto tidak ditemukan' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. If it is a guest deletion, perform authorization and limit checks
  if (!isAdmin) {
    // Check if the photo actually belongs to this guest
    if (photoRecord.guest_id !== guest) {
      return new Response(JSON.stringify({ error: 'Forbidden: Anda tidak memiliki akses untuk menghapus foto ini' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load delete configurations from settings
    let deleteLimit = 5;
    let allowDelete = true;
    try {
      const { data: dbSettings } = await supabase
        .from('settings')
        .select('camera_delete_limit, camera_allow_delete_photo')
        .eq('id', 1)
        .single();
      if (dbSettings) {
        if (dbSettings.camera_delete_limit !== undefined) {
          deleteLimit = dbSettings.camera_delete_limit;
        }
        if (dbSettings.camera_allow_delete_photo !== undefined) {
          allowDelete = dbSettings.camera_allow_delete_photo;
        }
      }
    } catch (err) {
      console.error('Failed to load settings delete configurations, using default:', err);
    }

    if (!allowDelete) {
      return new Response(JSON.stringify({ error: 'Forbidden: Fitur hapus foto dinonaktifkan oleh administrator' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Count how many deletions the guest has already completed
    const { count: deletionCount, error: countError } = await supabase
      .from('camera_deletions')
      .select('id', { count: 'exact', head: true })
      .eq('guest_id', guest);

    if (countError) {
      return new Response(JSON.stringify({ error: 'Gagal memverifikasi jumlah penghapusan' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (deletionCount !== null && deletionCount >= deleteLimit) {
      return new Response(JSON.stringify({ error: `Anda telah mencapai batas maksimal menghapus ${deleteLimit} foto!` }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 3. Extract and remove from Supabase Storage
  const urlParts = photoRecord.url.split('/disposable-camera/');
  if (urlParts.length >= 2) {
    const filePath = decodeURIComponent(urlParts[1]);
    const { error: storageError } = await supabase.storage
      .from('disposable-camera')
      .remove([filePath]);
    if (storageError) {
      console.warn("Warn: Failed to delete file from storage bucket:", storageError.message);
    }
  }

  // 4. Delete from database
  const { error: deleteError } = await supabase
    .from('camera_photos')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 5. Log the deletion in camera_deletions if it's a guest deletion
  if (!isAdmin) {
    const { error: logError } = await supabase
      .from('camera_deletions')
      .insert({
        guest_id: guest,
        photo_url: photoRecord.url,
        deleted_at: new Date().toISOString()
      });
    if (logError) {
      console.error('Failed to log guest deletion:', logError.message);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

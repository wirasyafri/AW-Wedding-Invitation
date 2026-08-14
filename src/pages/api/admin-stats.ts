import type { APIRoute } from 'astro';
import { supabase, getBucketStorageStats } from '../../lib/supabase.server';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const adminPass = url.searchParams.get('adminPass') || '';
    const correctPassword = import.meta.env.ADMIN_PASSWORD;

    if (!adminPass || adminPass !== correctPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Password salah!' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Fetch storage stats
    let cameraStorage = { totalSize: 0, fileCount: 0, fileList: [] as any[] };
    let photosStorage = { totalSize: 0, fileCount: 0, fileList: [] as any[] };
    try {
      const cam = await getBucketStorageStats('disposable-camera');
      cameraStorage = {
        ...cam,
        fileList: cam.fileList.map(f => ({
          ...f,
          url: supabase.storage.from('disposable-camera').getPublicUrl(f.name).data.publicUrl
        }))
      };

      const phot = await getBucketStorageStats('photos');
      photosStorage = {
        ...phot,
        fileList: phot.fileList.map(f => ({
          ...f,
          url: supabase.storage.from('photos').getPublicUrl(f.name).data.publicUrl
        }))
      };
    } catch (err: any) {
      console.error("Error fetching storage stats in API:", err);
    }

    // 2. Fetch database table counts & detailed lists
    let wishesCount = 0;
    let voicesCount = 0;
    let cameraPhotosCount = 0;
    let cameraDeletionsCount = 0;
    let deletionsList: any[] = [];
    let settingsData: any = {};

    let rsvpStats = { count: 0, attending: 0, notAttending: 0, tentative: 0, totalGuests: 0 };
    try {
      const { data: wishesData, count: dbWishesCount } = await supabase
        .from('wishes')
        .select('status, guests', { count: 'exact' });
      wishesCount = dbWishesCount || 0;
      
      const rsvpWishes = (wishesData || []).filter((w: any) => w.status);
      const rsvpCount = rsvpWishes.length;
      const rsvpAttending = rsvpWishes.filter((w: any) => w.status === 'Hadir').length;
      const rsvpNotAttending = rsvpWishes.filter((w: any) => w.status === 'Tidak Hadir').length;
      const rsvpTentative = rsvpWishes.filter((w: any) => w.status !== 'Hadir' && w.status !== 'Tidak Hadir').length;
      const rsvpTotalGuests = (wishesData || []).reduce((sum: number, w: any) => {
        if (w.status !== 'Hadir') return sum;
        return sum + (parseInt(w.guests) || 1);
      }, 0);

      rsvpStats = {
        count: rsvpCount,
        attending: rsvpAttending,
        notAttending: rsvpNotAttending,
        tentative: rsvpTentative,
        totalGuests: rsvpTotalGuests
      };
    } catch (e) {
      console.error("Error fetching wishes count in API:", e);
    }

    try {
      const { count: dbVoicesCount } = await supabase
        .from('guest_voices')
        .select('*', { count: 'exact', head: true });
      voicesCount = dbVoicesCount || 0;
    } catch (e) {
      console.error("Error fetching voices count in API:", e);
    }

    try {
      const { count: dbPhotosCount } = await supabase
        .from('camera_photos')
        .select('*', { count: 'exact', head: true });
      cameraPhotosCount = dbPhotosCount || 0;
    } catch (e) {
      console.error("Error fetching camera photos count in API:", e);
    }

    try {
      const { data: dbDeletions, count: dbDeletionsCount } = await supabase
        .from('camera_deletions')
        .select('*', { count: 'exact' })
        .order('deleted_at', { ascending: false });
      cameraDeletionsCount = dbDeletionsCount || 0;
      deletionsList = dbDeletions || [];
    } catch (e) {
      console.error("Error fetching camera deletions in API:", e);
    }

    try {
      const { data: dbSettings } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();
      settingsData = dbSettings || {};
    } catch (e) {
      console.error("Error fetching settings in API:", e);
    }

    // Build active database URLs (for photo and voice files)
    let activeDbUrls: string[] = [];
    try {
      const { data: dbPhotos } = await supabase.from('camera_photos').select('url');
      const { data: dbVoices } = await supabase.from('guest_voices').select('url');
      activeDbUrls = [
        ...(dbPhotos || []).map((p: any) => p.url),
        ...(dbVoices || []).map((v: any) => v.url)
      ];
    } catch (e) {
      console.error("Error fetching active URLs in API:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        storage: {
          camera: cameraStorage,
          photos: photosStorage
        },
        database: {
          wishesCount,
          voicesCount,
          cameraPhotosCount,
          cameraDeletionsCount,
          deletionsList,
          settings: settingsData,
          activeDbUrls,
          rsvp: rsvpStats
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// POST api/save-settings: Update dynamic CMS fields
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { password, ...settingsData } = body;

    const correctPassword = import.meta.env.ADMIN_PASSWORD;

    if (!password || password !== correctPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Password salah!' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Upsert key settings at id = 1
    const parsedSettings = {
      ...settingsData,
      // Ensure boolean for whatsapp_enabled; treat missing as false
      whatsapp_enabled:
        settingsData.whatsapp_enabled !== undefined
          ? (settingsData.whatsapp_enabled === 'true' || settingsData.whatsapp_enabled === '1')
          : false,
      camera_allow_change_guest:
        settingsData.camera_allow_change_guest !== undefined
          ? (settingsData.camera_allow_change_guest === 'true' || settingsData.camera_allow_change_guest === '1')
          : false,
      camera_allow_delete_photo:
        settingsData.camera_allow_delete_photo !== undefined
          ? (settingsData.camera_allow_delete_photo === 'true' || settingsData.camera_allow_delete_photo === '1')
          : false,
      camera_photo_limit:
        settingsData.camera_photo_limit !== undefined
          ? parseInt(settingsData.camera_photo_limit) || 15
          : 15,
      camera_delete_limit:
        settingsData.camera_delete_limit !== undefined
          ? parseInt(settingsData.camera_delete_limit) || 5
          : 5,
    };
    const { data, error } = await supabase
      .from('settings')
      .upsert({ id: 1, ...parsedSettings })
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, data: data[0] }), {
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

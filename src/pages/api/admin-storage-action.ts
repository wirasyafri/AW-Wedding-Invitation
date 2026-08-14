import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase.server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, password, bucket, filePath } = body;
    const correctPassword = import.meta.env.ADMIN_PASSWORD;

    if (!password || password !== correctPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Password salah!' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete-file') {
      if (!bucket || !filePath) {
        return new Response(JSON.stringify({ error: 'Missing bucket or filePath parameters' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase.storage.from(bucket).remove([filePath]);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'File deleted successfully', data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'clear-deletions-log') {
      const { error } = await supabase
        .from('camera_deletions')
        .delete()
        .neq('id', '0'); // deletes all rows

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Activity logs cleared successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

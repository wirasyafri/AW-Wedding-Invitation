import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase.server';

// POST api/admin-action: Handle comment toggle and delete
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, id, password } = body;

    const correctPassword = import.meta.env.ADMIN_PASSWORD;

    if (!password || password !== correctPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Password salah!' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!id || !action) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'toggle') {
      // Fetch current visibility status
      const { data: wish, error: fetchError } = await supabase
        .from('wishes')
        .select('is_visible')
        .eq('id', id)
        .single();

      if (fetchError || !wish) {
        return new Response(JSON.stringify({ error: 'Wish not found or query error' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update with toggled visibility
      const { error } = await supabase
        .from('wishes')
        .update({ is_visible: !wish.is_visible })
        .eq('id', id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Visibility toggled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'delete') {
      const { error } = await supabase
        .from('wishes')
        .delete()
        .eq('id', id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Wish deleted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Action invalid' }), {
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

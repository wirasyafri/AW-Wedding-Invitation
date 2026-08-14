import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase.server';

// GET wishes: Fetch all visible comments
export const GET: APIRoute = async () => {
  try {
    // 1. Fetch all visible wishes
    const { data: wishes, error: wishesError } = await supabase
      .from('wishes')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (wishesError) {
      return new Response(JSON.stringify({ error: wishesError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(wishes || []), {
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

// POST wishes: Add a new comment
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, status, guests, message, guest_id } = body;

    if (!name || !status || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await supabase
      .from('wishes')
      .insert([
        {
          name,
          status,
          guests: guests || '1 Orang',
          message,
          likes: 0,
          is_visible: true,
          guest_id: guest_id || null
        }
      ])
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

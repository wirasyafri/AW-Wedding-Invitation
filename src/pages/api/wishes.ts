import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// GET wishes: Fetch all visible comments
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabase
      .from('wishes')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data), {
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
    const { name, status, guests, message } = body;

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
          is_visible: true
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

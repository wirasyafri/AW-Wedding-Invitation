import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase.server';

// POST api/like: Increment likes for a wish
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing wish id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch current likes count
    const { data: wish, error: fetchError } = await supabase
      .from('wishes')
      .select('likes')
      .eq('id', id)
      .single();

    if (fetchError || !wish) {
      return new Response(JSON.stringify({ error: 'Wish not found or query error' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Increment and update
    const { data, error } = await supabase
      .from('wishes')
      .update({ likes: (wish.likes || 0) + 1 })
      .eq('id', id)
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data[0]), {
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

// DELETE api/like: Decrement likes for a wish (unlike)
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing wish id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch current likes count
    const { data: wish, error: fetchError } = await supabase
      .from('wishes')
      .select('likes')
      .eq('id', id)
      .single();

    if (fetchError || !wish) {
      return new Response(JSON.stringify({ error: 'Wish not found or query error' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const newLikes = Math.max(0, (wish.likes || 0) - 1);

    // Update likes count
    const { data, error } = await supabase
      .from('wishes')
      .update({ likes: newLikes })
      .eq('id', id)
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data[0]), {
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

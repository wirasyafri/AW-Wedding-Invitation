import { createClient } from '@supabase/supabase-js';

// Server‑side Supabase client – uses the privileged service‑role key.
const supabaseUrl = import.meta.env.SUPABASE_URL;
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing – check .env');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  serviceRoleKey || 'placeholder-service-key'
);

// Helper to recursively fetch files in a Supabase bucket and calculate statistics
export async function getBucketStorageStats(bucketName: string) {
  let totalSize = 0;
  let fileCount = 0;
  const fileList: { name: string; size: number; updated_at: string }[] = [];

  async function listFolder(path: string = '') {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(path, { limit: 100 });

    if (error) {
      console.error(`Error listing folder "${path}" in bucket "${bucketName}":`, error);
      return;
    }

    if (data) {
      for (const item of data) {
        const itemPath = path ? `${path}/${item.name}` : item.name;
        // If metadata is present, it's a file
        if (item.metadata) {
          const size = item.metadata.size || item.size || 0;
          totalSize += size;
          fileCount++;
          fileList.push({
            name: itemPath,
            size,
            updated_at: item.updated_at || item.created_at || ''
          });
        } else {
          // If metadata is absent, it's a subfolder
          await listFolder(itemPath);
        }
      }
    }
  }

  try {
    await listFolder();
  } catch (err) {
    console.error(`Error running listFolder on bucket "${bucketName}":`, err);
  }
  return { totalSize, fileCount, fileList };
}


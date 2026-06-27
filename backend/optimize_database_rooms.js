import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Jimp } from 'jimp';


dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function compressBase64Image(base64Str, maxWidth = 800, maxHeight = 800, quality = 70) {
  if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image/')) {
    return base64Str;
  }

  // Skip optimization if it is already small
  if (base64Str.length < 110000) {
    return base64Str;
  }

  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Str;
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const image = await Jimp.read(buffer);

    let width = image.bitmap.width;
    let height = image.bitmap.height;

    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    image.resize(width, height);
    image.quality(quality);

    const outputBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    return `data:image/jpeg;base64,${outputBuffer.toString('base64')}`;
  } catch (err) {
    console.error("Failed to compress image, keeping original:", err.message);
    return base64Str;
  }
}

async function run() {
  console.log("Signing in as Jerry Nosike (Super Admin) to bypass client RLS restrictions...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'jerrydprince@gmail.com',
    password: 'Jerry08283139'
  });

  if (authErr) {
    console.error("Authentication failed:", authErr.message);
    return;
  }

  console.log("Logged in successfully! User ID:", authData.user.id);
  
  // Set the session on the client
  supabase.auth.setSession(authData.session);

  console.log("Fetching rooms...");
  const { data: roomIds, error: idsErr } = await supabase.from('rooms').select('id, room_number');
  if (idsErr) {
    console.error("Failed to fetch room list:", idsErr);
    return;
  }

  console.log(`Found ${roomIds.length} rooms. Beginning optimization...`);
  
  let optimizedCount = 0;
  let skippedCount = 0;

  for (const r of roomIds) {
    console.log(`Processing Room ${r.room_number}...`);
    const { data: room, error: getErr } = await supabase
      .from('rooms')
      .select('id, room_number, name, image_url, description')
      .eq('id', r.id)
      .single();

    if (getErr || !room) {
      console.error(`- Failed to fetch room ${r.room_number}:`, getErr?.message);
      continue;
    }

    let descObj = {};
    try {
      descObj = JSON.parse(room.description || '{}');
    } catch(e) {}

    let needsUpdate = false;
    let optimizedUrl = room.image_url;
    let optimizedDescImages = descObj.images || [];

    // 1. Optimize image_url
    if (room.image_url && room.image_url.startsWith('data:image/') && room.image_url.length >= 110000) {
      console.log(`- Compressing image_url (Original Length: ${room.image_url.length})...`);
      optimizedUrl = await compressBase64Image(room.image_url, 800, 800, 70);
      console.log(`  - Optimized Length: ${optimizedUrl.length}`);
      needsUpdate = true;
    }

    // 2. Optimize description images
    if (descObj.images && descObj.images.length > 0) {
      const newImages = [];
      for (let idx = 0; idx < descObj.images.length; idx++) {
        const img = descObj.images[idx];
        if (img && img.startsWith('data:image/') && img.length >= 110000) {
          console.log(`- Compressing description image[${idx}] (Original Length: ${img.length})...`);
          const opt = await compressBase64Image(img, 800, 800, 70);
          console.log(`  - Optimized Length: ${opt.length}`);
          newImages.push(opt);
          needsUpdate = true;
        } else {
          newImages.push(img);
        }
      }
      optimizedDescImages = newImages;
    }

    if (needsUpdate) {
      const updatedDescription = JSON.stringify({
        ...descObj,
        images: optimizedDescImages
      });

      const { data, error: updateErr } = await supabase
        .from('rooms')
        .update({
          image_url: optimizedUrl,
          description: updatedDescription
        })
        .eq('id', room.id)
        .select('room_number, image_url');

      if (updateErr) {
        console.error(`- Failed to update room ${room.room_number}:`, updateErr.message);
      } else {
        console.log(`✓ Room ${room.room_number} successfully optimized!`);
        optimizedCount++;
      }
    } else {
      console.log(`- Room ${room.room_number} already optimized.`);
      skippedCount++;
    }
  }

  console.log(`\nOptimization completed.`);
  console.log(`- Total Rooms Optimized: ${optimizedCount}`);
  console.log(`- Total Rooms Skipped (Already Optimized): ${skippedCount}`);
}

run();

// Repo for garment photos in Supabase Storage (bucket `prenda-fotos`, created
// by supabase/migrations/0007_prenda_fotos_storage.sql). Same injected-client
// pattern as every other src/data/*.js module -- see prendas.js's header
// comment. The bucket is PRIVATE (RLS on storage.objects, not a public URL),
// so every read path goes through getPrendaFotoUrl()'s short-lived signed
// URL rather than a stored/public one.
const BUCKET = "prenda-fotos";

// Kept short on purpose: a signed URL is fetched fresh on every render
// (design.md-style "correctness over premature optimization" call in this
// task's brief) rather than cached, so there is no long-lived secret sitting
// in the DOM/memory to worry about expiring mid-session.
const SIGNED_URL_TTL_SECONDS = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Pure, unit-tested. Strips anything that isn't alnum/dot/dash/underscore so
// the resulting object path can never smuggle a "/" (path traversal into
// another prefix) or other characters Storage keys don't like.
function sanitizeFilename(name) {
  return (name || "foto").replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Pure, unit-tested: builds the {user_id}/{prenda_id}/{timestamp}-{filename}
// path the RLS policies in 0007_prenda_fotos_storage.sql key off of
// ((storage.foldername(name))[1] = auth.uid()::text). The timestamp prefix
// avoids collisions when the same filename is uploaded twice for one
// garment (e.g. re-uploading "foto.png" after removing the first one).
export function buildPrendaFotoPath(userId, prendaId, filename) {
  if (!userId) throw new Error("buildPrendaFotoPath: userId is required");
  if (!prendaId) throw new Error("buildPrendaFotoPath: prendaId is required");
  return `${userId}/${prendaId}/${Date.now()}-${sanitizeFilename(filename)}`;
}

// Pure, unit-tested: validates a File/Blob-like object (duck-typed on
// .type/.size so it works with both real File objects in the browser and
// plain fixtures in tests) before it's ever sent over the network. The
// file input's accept="image/*" is only a UI hint, not a guarantee.
export function validatePrendaFoto(file) {
  if (!file) return { valid: false, error: "No se selecciono ningun archivo." };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `Tipo de archivo no soportado: ${file.type || "desconocido"}.` };
  }
  if (file.size > MAX_BYTES) {
    return { valid: false, error: "El archivo supera el tamano maximo de 5MB." };
  }
  return { valid: true, error: null };
}

export function makeStorageRepo(client) {
  return {
    // Returns the stored object path (not a URL -- the bucket is private,
    // see getPrendaFotoUrl below). prendaId is the owning garment; the
    // owning user comes from the current session, not a caller-supplied
    // value, so a caller can never accidentally upload into someone else's
    // prefix (RLS would reject it anyway, but this fails before the network
    // round trip).
    async uploadPrendaFoto(prendaId, file) {
      const { valid, error: validationError } = validatePrendaFoto(file);
      if (!valid) throw new Error(validationError);

      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const userId = userData?.user?.id;
      if (!userId) throw new Error("uploadPrendaFoto: no authenticated user.");

      const path = buildPrendaFotoPath(userId, prendaId, file.name);
      const { error } = await client.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      return path;
    },

    async deletePrendaFoto(path) {
      const { error } = await client.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      return true;
    },

    // Private bucket => no public URL exists. Callers must call this on
    // every render (list card, detail gallery) rather than cache the result,
    // since the URL expires after SIGNED_URL_TTL_SECONDS.
    async getPrendaFotoUrl(path) {
      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  };
}

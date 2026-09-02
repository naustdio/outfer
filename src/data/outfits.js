// Reads go against outfit_v (the security_invoker view -- estado /
// nombre_sugerido come from Postgres, never recomputed in JS). Writes go
// against the raw outfit table, which is the only writable target.
export function makeOutfitsRepo(client) {
  return {
    async list() {
      const { data, error } = await client
        .from("outfit_v")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },

    async getById(id) {
      const { data, error } = await client.from("outfit_v").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },

    // outfit_v aggregates only a count (prendas_count), never the linked
    // garment ids themselves -- outfit-detail.js needs those ids to render
    // and unlink individual garments. Additive alongside getById() (kept
    // byte-identical above) rather than changing its shape, mirroring
    // prendasRepo.getById()'s multi-query pattern (design.md Interfaces).
    async getWithPrendas(id) {
      const [outfitRes, linksRes] = await Promise.all([
        client.from("outfit_v").select("*").eq("id", id).single(),
        client.from("outfit_prenda").select("prenda_id").eq("outfit_id", id),
      ]);
      if (outfitRes.error) throw outfitRes.error;
      if (linksRes.error) throw linksRes.error;

      return {
        outfit: outfitRes.data,
        prendaIds: linksRes.data.map((row) => row.prenda_id),
      };
    },

    // garment-catalog "Reverse Lookups on Garment Detail" has a mirror on
    // the outfit side (styling-tips "each entity's detail view MUST show
    // the tip") -- outfit-detail.js needs the tip ids linked to this outfit
    // to render its own reverse-lookup section. Additive alongside
    // getWithPrendas(), same shape/reasoning as its own header comment.
    async getLinkedTipIds(id) {
      const { data, error } = await client.from("outfit_tip").select("tip_id").eq("outfit_id", id);
      if (error) throw error;
      return data.map((row) => row.tip_id);
    },

    async create(input) {
      const { data, error } = await client.from("outfit").insert(input).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await client
        .from("outfit")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await client.from("outfit").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
  };
}

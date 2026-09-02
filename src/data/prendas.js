// Every repo in src/data/ follows this shape (see design.md Interfaces /
// Contracts): list/getById/create/update/remove, one injected client, thin
// query construction only -- no derivation, no business rules.
export function makePrendasRepo(client) {
  return {
    async list({ categoria, disponible, favorito, temporada } = {}) {
      let query = client.from("prenda").select("*");
      if (categoria !== undefined) query = query.eq("categoria", categoria);
      if (disponible !== undefined) query = query.eq("disponible", disponible);
      if (favorito !== undefined) query = query.eq("favorito", favorito);
      if (temporada !== undefined) query = query.contains("temporada", [temporada]);
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    async getById(id) {
      const [prendaRes, outfitsRes, tipsRes] = await Promise.all([
        client.from("prenda").select("*").eq("id", id).single(),
        client.from("outfit_prenda").select("outfit_id").eq("prenda_id", id),
        client.from("prenda_tip").select("tip_id").eq("prenda_id", id),
      ]);
      if (prendaRes.error) throw prendaRes.error;
      if (outfitsRes.error) throw outfitsRes.error;
      if (tipsRes.error) throw tipsRes.error;

      return { prenda: prendaRes.data, outfits: outfitsRes.data, tips: tipsRes.data };
    },

    async create(input) {
      const { data, error } = await client.from("prenda").insert(input).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await client
        .from("prenda")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await client.from("prenda").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
  };
}

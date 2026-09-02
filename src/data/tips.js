export function makeTipsRepo(client) {
  return {
    async list() {
      const { data, error } = await client
        .from("tip")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },

    async getById(id) {
      const [tipRes, outfitsRes, prendasRes] = await Promise.all([
        client.from("tip").select("*").eq("id", id).single(),
        client.from("outfit_tip").select("outfit_id").eq("tip_id", id),
        client.from("prenda_tip").select("prenda_id").eq("tip_id", id),
      ]);
      if (tipRes.error) throw tipRes.error;
      if (outfitsRes.error) throw outfitsRes.error;
      if (prendasRes.error) throw prendasRes.error;

      return { tip: tipRes.data, outfits: outfitsRes.data, prendas: prendasRes.data };
    },

    async create(input) {
      const { data, error } = await client.from("tip").insert(input).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await client
        .from("tip")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await client.from("tip").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
  };
}

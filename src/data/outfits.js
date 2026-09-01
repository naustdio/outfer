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

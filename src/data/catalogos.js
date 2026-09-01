// colores (fixed enum + metadata) and tipo_prenda (growable lookup) --
// see design.md "colores = fixed enum + metadata table; tipo_prenda =
// growable lookup table".
export function makeCatalogosRepo(client) {
  return {
    async listColores() {
      const { data, error } = await client.from("colores").select("*").order("orden");
      if (error) throw error;
      return data;
    },

    async listTiposPrenda({ categoria } = {}) {
      let query = client.from("tipo_prenda").select("*");
      if (categoria !== undefined) query = query.eq("categoria", categoria);
      query = query.order("orden");

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    async createTipoPrenda(input) {
      const { data, error } = await client.from("tipo_prenda").insert(input).select().single();
      if (error) throw error;
      return data;
    },
  };
}

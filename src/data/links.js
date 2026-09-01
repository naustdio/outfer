// Composite-FK-backed join tables: an insert with cross-user ids fails at
// the database layer (see design.md's composite-FK decision) -- this repo
// just shapes the insert/delete payloads and lets that error surface.
export function makeLinksRepo(client) {
  async function link(table, payload) {
    const { error } = await client.from(table).insert(payload);
    if (error) throw error;
    return true;
  }

  async function unlink(table, filters) {
    let query = client.from(table).delete();
    for (const [column, value] of Object.entries(filters)) {
      query = query.eq(column, value);
    }
    const { error } = await query;
    if (error) throw error;
    return true;
  }

  return {
    linkOutfitPrenda: (outfitId, prendaId) =>
      link("outfit_prenda", { outfit_id: outfitId, prenda_id: prendaId }),
    unlinkOutfitPrenda: (outfitId, prendaId) =>
      unlink("outfit_prenda", { outfit_id: outfitId, prenda_id: prendaId }),

    linkPrendaTip: (prendaId, tipId) => link("prenda_tip", { prenda_id: prendaId, tip_id: tipId }),
    unlinkPrendaTip: (prendaId, tipId) =>
      unlink("prenda_tip", { prenda_id: prendaId, tip_id: tipId }),

    linkOutfitTip: (outfitId, tipId) => link("outfit_tip", { outfit_id: outfitId, tip_id: tipId }),
    unlinkOutfitTip: (outfitId, tipId) =>
      unlink("outfit_tip", { outfit_id: outfitId, tip_id: tipId }),
  };
}

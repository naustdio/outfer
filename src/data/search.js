// One round trip via the search_all() RPC (see design.md Interfaces /
// Contracts) instead of three parallel ilike queries merged in JS.
export function makeSearchRepo(client) {
  return {
    async search(q) {
      const { data, error } = await client.rpc("search_all", { q });
      if (error) throw error;
      return data;
    },
  };
}

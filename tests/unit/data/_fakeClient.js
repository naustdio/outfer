// Shared fake Supabase client for src/data/* unit tests. Records every
// chained call so tests can assert on shape (table, method, args) without a
// network connection, per design.md's Testing Strategy for the data layer.
export function makeFakeClient({ responses = [] } = {}) {
  const calls = [];
  let responseQueue = [...responses];

  function nextResponse() {
    return responseQueue.length > 0
      ? responseQueue.shift()
      : { data: null, error: null };
  }

  function makeBuilder(record) {
    const builder = {
      select: (...args) => (record.ops.push(["select", args]), builder),
      eq: (...args) => (record.ops.push(["eq", args]), builder),
      neq: (...args) => (record.ops.push(["neq", args]), builder),
      contains: (...args) => (record.ops.push(["contains", args]), builder),
      order: (...args) => (record.ops.push(["order", args]), builder),
      limit: (...args) => (record.ops.push(["limit", args]), builder),
      insert: (...args) => (record.ops.push(["insert", args]), builder),
      update: (...args) => (record.ops.push(["update", args]), builder),
      delete: (...args) => (record.ops.push(["delete", args]), builder),
      single: (...args) => (record.ops.push(["single", args]), builder),
      then: (resolve, reject) => Promise.resolve(nextResponse()).then(resolve, reject),
    };
    return builder;
  }

  function makeStorageBucket(record) {
    return {
      upload: (...args) => (record.ops.push(["upload", args]), Promise.resolve(nextResponse())),
      remove: (...args) => (record.ops.push(["remove", args]), Promise.resolve(nextResponse())),
      download: (...args) => (record.ops.push(["download", args]), Promise.resolve(nextResponse())),
      list: (...args) => (record.ops.push(["list", args]), Promise.resolve(nextResponse())),
      createSignedUrl: (...args) =>
        (record.ops.push(["createSignedUrl", args]), Promise.resolve(nextResponse())),
    };
  }

  const client = {
    from: (table) => {
      const record = { table, ops: [] };
      calls.push(record);
      return makeBuilder(record);
    },
    storage: {
      from: (bucket) => {
        const record = { storage: bucket, ops: [] };
        calls.push(record);
        return makeStorageBucket(record);
      },
    },
    rpc: (fn, args) => {
      const record = { rpc: fn, args };
      calls.push(record);
      return {
        then: (resolve, reject) => Promise.resolve(nextResponse()).then(resolve, reject),
      };
    },
    auth: {
      signInWithPassword: (...args) => {
        calls.push({ auth: "signInWithPassword", args });
        return Promise.resolve(nextResponse());
      },
      signOut: (...args) => {
        calls.push({ auth: "signOut", args });
        return Promise.resolve(nextResponse());
      },
      getSession: (...args) => {
        calls.push({ auth: "getSession", args });
        return Promise.resolve(nextResponse());
      },
      getUser: (...args) => {
        calls.push({ auth: "getUser", args });
        return Promise.resolve(nextResponse());
      },
      onAuthStateChange: (...args) => {
        calls.push({ auth: "onAuthStateChange", args });
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    calls,
  };

  return client;
}

import { Cache, QueryInput } from "@urql/exchange-graphcache";

// Helper function to make it easy to cast types for URQL caching
export function betterUpdateQuery<Result, Query>(
  cache: Cache,
  qi: QueryInput,
  result: any,
  fn: (r: Result, q: Query) => Query
) {
  return cache.updateQuery(qi, (data) => fn(result, data as any) as any);
}

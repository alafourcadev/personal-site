// La Forja · R3 · the one place that decides whether a global ranking exists.
//
// Credentials are optional by contract (see createSupabaseRanking): with none
// configured this returns null and every caller degrades to the local-only
// game R1 already shipped. That is why the whole product still builds and
// plays in a checkout that never heard of Supabase.
import { createSupabaseRanking, type SupabaseRanking } from './supabase-adapter'

let resolved: SupabaseRanking | null | undefined

export function globalRanking(): SupabaseRanking | null {
  if (resolved === undefined) {
    resolved = createSupabaseRanking({
      url: import.meta.env.PUBLIC_SUPABASE_URL ?? '',
      anonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '',
    })
  }
  return resolved
}

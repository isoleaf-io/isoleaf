import { FEATURES, type FeatureKey } from "@/config/features";

/**
 * Returns whether a build-time feature flag is enabled. Named like a hook for
 * call-site clarity, but currently has no React-specific behaviour — it just
 * forwards the constant. Keeping the indirection (instead of reading FEATURES
 * directly) means we can add user/role-scoped gating here later without
 * touching every call site.
 */
export function useFeature(key: FeatureKey): boolean {
  return FEATURES[key];
}

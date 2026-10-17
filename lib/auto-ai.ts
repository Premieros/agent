// Server-only routing. Secrets are read exclusively from Vercel environment
// variables. No model is considered unconditionally free except OpenRouter
// models explicitly identified with :free by that provider.
// Gemini and Groq can have free-tier quotas, but may bill under paid projects.
import {
  AIProviderError, askSelectedAgent, configuredProviders,
  listAvailableTextModels, resolveAIConfig, type AIConfig, type AIProvider
} from "@/lib/ai-providers";

export type AutoTier = "free-model" | "free-tier-conditional";
export type AutoCandidate = { provider: "openrouter" | "gemini" | "groq"; model: string; tier: AutoTier; label: string };

const PRIORITY: AutoCandidate["provider"][] = ["openrouter", "gemini", "groq"];
const snapshot = new Map<string, { expires: number; candidates: AutoCandidate[] }>();
const cooling = new Map<string, number>();
const MAX_ATTEMPTS = 3;

function availableKeys() {
  return new Set<AIProvider>(configuredProviders());
}

export async function discoverAutoModels(includeFreeTier: boolean): Promise<AutoCandidate[]> {
  const cacheKey = includeFreeTier ? "conditional" : "strict";
  const cached = snapshot.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.candidates;
  const available = availableKeys();
  const found = await Promise.all(PRIORITY.map(async provider => {
    if (!available.has(provider) || (provider !== "openrouter" && !includeFreeTier)) {
      return [] as AutoCandidate[];
    }
    try {
      const config = resolveAIConfig({ provider, keySource: "server" });
      const models = await listAvailableTextModels(config);
      if (provider === "openrouter") {
        // Model IDs ending in :free are explicitly labeled as such by OpenRouter.
        return models.filter(m => m.id.endsWith(":free")).slice(0, 25).map(m => ({
          provider, model: m.id, tier: "free-model" as const, label: m.label
        }));
      }
      if (provider === "gemini") {
        // These may be available under Google's free tier, but cannot be
        // classified as zero-cost without billing info from the account.
        const eligible = models.filter(m => /^gemini-[\d.]+-flash(?:-lite)?(?:$|-)/.test(m.id))
          .filter(m => !/(image|preview|exp|tts|live|audio)/i.test(m.id));
        eligible.sort((a,b) => {
          const rank = (id:string) => /flash-lite/.test(id) ? 0 : 1;
          return rank(a.id) - rank(b.id) || b.id.localeCompare(a.id);
        });
        return eligible.slice(0, 2).map(m => ({
          provider, model:m.id, tier: "free-tier-conditional" as const, label:m.label
        }));
      }
      const eligible = models.filter(m => /llama.*(instant|8b|70b)|gemma/i.test(m.id))
        .filter(m => !/(vision|audio|guard|tool-use)/i.test(m.id));
      return eligible.slice(0, 2).map(m => ({
        provider, model:m.id, tier:"free-tier-conditional" as const, label:m.label
      }));
    } catch {
      // Discovery failure is not evidence that a key has a free quota.
      return [] as AutoCandidate[];
    }
  }));
  // Round-robin provider candidates so an exhausted OpenRouter account
  // does not consume all three attempts before Gemini/Groq gets a turn.
  const candidates: AutoCandidate[] = [];
  const maxItems = Math.max(0, ...found.map(items => items.length));
  for (let i = 0; i < maxItems; i++) {
    for (const items of found) {
      if (items[i]) candidates.push(items[i]);
    }
  }
  // Cache provider model metadata for three minutes, never cache secrets.
  if (candidates.length) snapshot.set(cacheKey, { expires: Date.now() + 180_000, candidates });
  return candidates;
}

export function autoProviderInfo(): Array<{ provider:string; configured:boolean; costClass:string }> {
  const connected = availableKeys();
  return PRIORITY.map(provider => ({
    provider, configured: connected.has(provider),
    costClass: provider === "openrouter" ? "free-model" : "free-tier-conditional"
  }));
}

export async function askAutoAgent(
  candidates: AutoCandidate[],
  role: string,
  instructions: string,
  context: string,
  tokenLimit: number
): Promise<{ text: string; model: string; tried: number }> {
  if (!candidates.length) throw new Error("AUTO_NO_FREE_MODELS");
  const retriable = new Set([
    "AI_QUOTA_EXCEEDED", "AI_MODEL_UNAVAILABLE", "AI_CREDENTIALS_REJECTED",
    "AI_ACCESS_RESTRICTED", "AI_PROVIDER_FAILURE", "AI_REQUEST_INVALID"
  ]);
  let tried = 0;
  for (const candidate of candidates) {
    if (tried >= MAX_ATTEMPTS) break;
    const key = `${candidate.provider}/${candidate.model}`;
    if ((cooling.get(key) || 0) > Date.now()) continue;
    let ai: AIConfig;
    try { ai = resolveAIConfig({ provider: candidate.provider, keySource:"server", model:candidate.model }); }
    catch { continue; }
    tried++;
    try {
      const answer = await askSelectedAgent(ai, role, instructions, context, tokenLimit);
      return { ...answer, tried };
    } catch (error) {
      const code = error instanceof AIProviderError ? error.code : error instanceof Error ? error.message : "";
      if (!retriable.has(code)) throw error;
      // Skip quota-limited/unsupported models for five minutes within this
      // server instance. No repeated requests to bypass vendor rate limits.
      cooling.set(key, Date.now() + 300_000);
    }
  }
  throw new Error("AUTO_ALL_FAILED");
}

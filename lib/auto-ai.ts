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
export type ProviderDiscovery = {
  provider: AutoCandidate["provider"];
  configured: boolean;
  status: "missing_key" | "not_selected" | "ready" | "no_candidates" | "request_failed";
  availableModels?: number;
  eligibleModels?: number;
  failureCode?: string;
  httpStatus?: number;
};
export type AutoDiscovery = { candidates: AutoCandidate[]; diagnostics: ProviderDiscovery[] };
const snapshot = new Map<string, { expires: number; result: AutoDiscovery }>();
const cooling = new Map<string, number>();
const MAX_ATTEMPTS = 3;

function availableKeys() {
  return new Set<AIProvider>(configuredProviders());
}

export async function discoverAutoModelsDetailed(includeFreeTier: boolean): Promise<AutoDiscovery> {
  const cacheKey = includeFreeTier ? "conditional" : "strict";
  const cached = snapshot.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.result;
  const available = availableKeys();
  const results = await Promise.all(PRIORITY.map(async provider => {
    const configured = available.has(provider);
    if (!configured) {
      return { candidates: [] as AutoCandidate[], diagnostic: { provider, configured, status:"missing_key" as const } };
    }
    if (provider !== "openrouter" && !includeFreeTier) {
      return { candidates: [] as AutoCandidate[], diagnostic: { provider, configured, status:"not_selected" as const } };
    }
    try {
      const config = resolveAIConfig({ provider, keySource: "server" });
      const models = await listAvailableTextModels(config);
      let eligible: Array<{id:string; label:string}> = [];
      if (provider === "openrouter") {
        // The :free suffix explicitly describes the provider's free variant.
        eligible = models.filter(m => m.id.endsWith(":free")).slice(0, 25);
      } else if (provider === "gemini") {
        // The account's free-tier eligibility cannot be established from /models.
        eligible = models.filter(m => /^gemini-[\\d.]+-flash(?:-lite)?(?:$|-)/.test(m.id))
          .filter(m => !/(image|preview|exp|tts|live|audio)/i.test(m.id));
        eligible.sort((a,b) => {
          const rank = (id:string) => /flash-lite/.test(id) ? 0 : 1;
          return rank(a.id) - rank(b.id) || b.id.localeCompare(a.id);
        });
        eligible = eligible.slice(0, 2);
      } else {
        // Groq's lineup may contain GPT-OSS, Qwen or other chat-capable
        // models in addition to Llama. Model listing is not a billing check.
        eligible = models.filter(m => /(llama|gemma|qwen|gpt-oss|compound)/i.test(m.id))
          .filter(m => !/(vision|audio|guard|tool-use|whisper|tts|moderation|embedding|distil-whisper)/i.test(m.id))
          .slice(0, 4);
      }
      const tier:AutoTier = provider === "openrouter" ? "free-model" : "free-tier-conditional";
      const candidates = eligible.map(m => ({
        provider, model:m.id, tier, label:m.label
      }));
      return {
        candidates,
        diagnostic: {
          provider, configured, status: candidates.length ? "ready" as const : "no_candidates" as const,
          availableModels: models.length, eligibleModels: eligible.length
        }
      };
    } catch (error) {
      // Only disclose a safe structured status; never pass through upstream
      // messages, credentials, request headers or payloads.
      return {
        candidates: [] as AutoCandidate[],
        diagnostic: {
          provider, configured, status:"request_failed" as const,
          failureCode: error instanceof AIProviderError ? error.code : "DISCOVERY_FAILED",
          httpStatus: error instanceof AIProviderError ? error.status : undefined
        }
      };
    }
  }));
  // Alternate providers so two Gemini models don't exhaust attempts first.
  const candidates: AutoCandidate[] = [];
  const maxItems = Math.max(0, ...results.map(x => x.candidates.length));
  for(let i = 0; i < maxItems; i++) {
    for (const x of results) if (x.candidates[i]) candidates.push(x.candidates[i]);
  }
  const result: AutoDiscovery = { candidates, diagnostics: results.map(x => x.diagnostic) };
  snapshot.set(cacheKey, { expires: Date.now() + 180_000, result });
  return result;
}

export async function discoverAutoModels(includeFreeTier:boolean):Promise<AutoCandidate[]> {
  return (await discoverAutoModelsDetailed(includeFreeTier)).candidates;
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

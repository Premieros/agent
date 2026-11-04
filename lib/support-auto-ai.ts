import "server-only";
import {askAutoAgent,discoverAutoModels} from "@/lib/auto-ai";

/**
 * The same centrally configured automatic routing used by the main assistant.
 * Strict mode routes exclusively to OpenRouter models explicitly marked :free.
 * Gemini/Groq are conditional free tiers, and must be explicitly opted in:
 * their billing cannot be determined from model discovery.
 */
export async function answerSupportWithFreeModels(
 role:string,instructions:string,context:string,
 allowConditional:boolean
):Promise<{text:string;model:string;tried:number}>{
 const candidates=await discoverAutoModels(allowConditional);
 return askAutoAgent(candidates,role,instructions,context,650,"general");
}

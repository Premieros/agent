/** Strict one-image, one-click, user-key-only policy. No stored credentials or
 * reference photos are sent. This route must never read AGENT's existing server AI keys.
 */
export type ImageRequest={provider:"openai"|"gemini";model:"gpt-image-1"|"gemini-2.5-flash-image";apiKey:string;prompt:string};
export function validateImageGenerationRequest(value:unknown):ImageRequest{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("INVALID_IMAGE_REQUEST");
 const x=value as Record<string,unknown>;
 if(x.consentToCharges!==true)throw Error("IMAGE_CONSENT_REQUIRED");
 if(x.provider!=="openai"&&x.provider!=="gemini")throw Error("INVALID_IMAGE_REQUEST");
 const expected=x.provider==="openai"?"gpt-image-1":"gemini-2.5-flash-image";
 if(x.model!==expected)throw Error("INVALID_IMAGE_REQUEST");
 if(typeof x.apiKey!=="string"||x.apiKey.length<12||x.apiKey.length>2048||/[\r\n]/.test(x.apiKey))
  throw Error("INVALID_IMAGE_REQUEST");
 if(typeof x.prompt!=="string"||x.prompt.trim().length<12||x.prompt.length>2100)
  throw Error("INVALID_IMAGE_REQUEST");
 return {provider:x.provider,model:expected,apiKey:x.apiKey,prompt:x.prompt.trim()};
}

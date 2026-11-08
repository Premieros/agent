/** Keep task suitability separate from provider discovery and billing policy.
 * Preserve all eligible candidates; only reorder them for customer chat.
 * Gemini/Groq eligibility and cost consent are enforced upstream.
 */
export function preferSupportConversationModels<T extends {model:string}>(candidates:readonly T[]):T[]{
 const coding=/(?:^|[\/_:.\-])(?:code|coder|coding|codestral|deepseek-coder)(?=$|[\/_:.\-])/i;
 const chat=/(?:^|[\/_:.\-])(?:chat|instruct|assistant|conversation)(?=$|[\/_:.\-])/i;
 const quality=(model:string)=>coding.test(model)?2:chat.test(model)?0:1;
 return candidates.map((candidate,index)=>({candidate,index,rank:quality(candidate.model)}))
  .sort((a,b)=>a.rank-b.rank||a.index-b.index)
  .map(({candidate})=>candidate);
}

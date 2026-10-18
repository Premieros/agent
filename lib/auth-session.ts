"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Always resolve a current Supabase token before authenticated API calls.
 * Supabase refreshes many sessions automatically; this also covers dormant
 * tabs resumed after the JWT expired, before any new request is dispatched.
 * Does not store credentials, expose tokens, or extend revoked sessions.
 */
export async function currentSession(db:SupabaseClient):Promise<Session|null>{
  const {data,error}=await db.auth.getSession();
  if(error||!data.session)return null;
  const session=data.session;
  const needsRefresh=!session.expires_at || session.expires_at*1000 <= Date.now()+90_000;
  if(!needsRefresh)return session;
  const {data:refreshed,error:refreshError}=await db.auth.refreshSession();
  if(refreshError||!refreshed.session)return null;
  return refreshed.session;
}

export async function currentUser(db:SupabaseClient):Promise<User|null>{
  const session=await currentSession(db);
  if(!session)return null;
  const {data,error}=await db.auth.getUser(session.access_token);
  if(error||!data.user)return null;
  return data.user;
}

export function isExpiredAuthError(error:unknown):boolean{
  const message=typeof error==="string"?error:
    error&&typeof error==="object"&&"message" in error
      ? String((error as {message?:unknown}).message||""):"";
  return /jwt.*(expired|invalid)|invalid.*jwt|token.*expired|expired.*token|refresh.*token|session.*expired/i.test(message);
}

export async function recoverExpiredSession(db:SupabaseClient):Promise<User|null>{
  const {data,error}=await db.auth.refreshSession();
  return error ? null : data.session?.user||null;
}

"use client";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// The publishable key is designed for browsers; row-level security protects the data.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mzylqxdscrhwxsazohix.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_sFaToMWx8qbtLcCL770AvQ_teyTS_dU";

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sb = supabase();
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

export async function sendMagicLink(email: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/calc/" : undefined } });
  return error ? error.message : null;
}

export async function signOut() {
  await supabase().auth.signOut();
}

export interface SavedShipment {
  id: string;
  name: string | null;
  landed_total: number | null;
  alert_on_rate_change: boolean;
  snapshot_json: unknown;
  created_at: string;
  updated_at: string;
}

export async function listShipments(): Promise<SavedShipment[]> {
  const { data, error } = await supabase()
    .from("shipments")
    .select("id,name,landed_total,alert_on_rate_change,snapshot_json,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as SavedShipment[];
}

export async function saveShipment(args: {
  id?: string;
  name: string;
  snapshot: Record<string, unknown>;
  result: unknown;
  landed_total: number;
  alert: boolean;
  rate_version: string;
}): Promise<string> {
  const { data: u } = await supabase().auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const s = args.snapshot as Record<string, unknown>;
  const row = {
    user_id: u.user.id,
    name: args.name,
    shipment_date: new Date().toISOString().slice(0, 10),
    origin_iso: s.origin_iso,
    dest_port: s.dest_port,
    currency: s.currency,
    fx_rate: s.fx_rate,
    incoterm: s.incoterm,
    freight: s.freight,
    insurance_json: { pct_of_goods: s.insurance_pct },
    local_charges_json: s.local_charges,
    allocation: "volume",
    result_json: args.result,
    snapshot_json: s,
    landed_total: args.landed_total,
    alert_on_rate_change: args.alert,
    rate_version: args.rate_version,
    updated_at: new Date().toISOString(),
  };
  const q = args.id ? supabase().from("shipments").update(row).eq("id", args.id).select("id").single() : supabase().from("shipments").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteShipment(id: string) {
  const { error } = await supabase().from("shipments").delete().eq("id", id);
  if (error) throw error;
}

export async function setAlert(id: string, on: boolean) {
  const { error } = await supabase().from("shipments").update({ alert_on_rate_change: on }).eq("id", id);
  if (error) throw error;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  old_total: number | null;
  new_total: number | null;
  read_at: string | null;
  created_at: string;
}
export async function listNotifications(): Promise<Notification[]> {
  const { data } = await supabase().from("notifications").select("id,title,body,old_total,new_total,read_at,created_at").order("created_at", { ascending: false }).limit(20);
  return (data ?? []) as Notification[];
}
export async function markRead(id: string) {
  await supabase().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export interface Profile {
  company_name: string | null;
  logo_url: string | null;
}
export async function getProfile(): Promise<Profile | null> {
  const { data } = await supabase().from("profiles").select("company_name,logo_url").maybeSingle();
  return (data as Profile) ?? null;
}
export async function saveProfile(p: Profile) {
  const { data: u } = await supabase().auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { error } = await supabase().from("profiles").upsert({ id: u.user.id, ...p });
  if (error) throw error;
}

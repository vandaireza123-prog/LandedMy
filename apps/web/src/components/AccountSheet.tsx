"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createApiKey, deleteShipment, getProfile, listApiKeys, listNotifications, listShipments, markRead, revokeApiKey, saveProfile, sendMagicLink, setAlert, signOut, type ApiKey, type Notification, type Profile, type SavedShipment } from "@/lib/supabase";
import type { AppState } from "@/lib/state";
import { rm, smallInputCls } from "./ui";

export function AccountSheet({ user, onClose, update }: { user: User | null; onClose: () => void; update: (p: Partial<AppState>) => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<SavedShipment[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);
  const [profile, setProfile] = useState<Profile>({ company_name: "", logo_url: "" });
  const [savedProfile, setSavedProfile] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");

  useEffect(() => {
    if (!user) return;
    listShipments().then(setItems).catch((e) => setErr(e.message));
    listNotifications().then(setNotes).catch(() => {});
    getProfile().then((p) => p && setProfile({ company_name: p.company_name ?? "", logo_url: p.logo_url ?? "" })).catch(() => {});
    listApiKeys().then(setKeys).catch(() => {});
  }, [user]);

  const onLogo = (f: File) => {
    const fr = new FileReader();
    fr.onload = () => setProfile({ ...profile, logo_url: String(fr.result) });
    fr.readAsDataURL(f);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-ground" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="font-display text-lg font-bold">{user ? "My shipments" : "Sign in"}</div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {!user ? (
            <>
              <p className="text-sm text-muted">Save shipments, get an alert when a Budget changes your landed cost, and put your logo on quotes. No password: we email you a sign-in link.</p>
              {sent ? (
                <p className="mt-3 rounded-lg bg-teal-tint px-3 py-2 text-sm text-teal">Link sent to {sent}. Open it on this device.</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input type="email" className={smallInputCls} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button
                    type="button"
                    disabled={!email.includes("@")}
                    onClick={async () => {
                      const e = await sendMagicLink(email);
                      if (e) setErr(e);
                      else setSent(email);
                    }}
                    className="h-10 shrink-0 rounded-lg bg-teal px-3 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    Send link
                  </button>
                </div>
              )}
              {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{user.email}</span>
                <button type="button" onClick={() => signOut().then(onClose)} className="font-semibold text-teal">
                  Sign out
                </button>
              </div>

              {notes.filter((n) => !n.read_at).length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {notes
                    .filter((n) => !n.read_at)
                    .map((n) => (
                      <div key={n.id} className="rounded-xl border border-amber bg-amber-tint p-3 text-[13px]">
                        <div className="font-semibold text-amber">{n.title}</div>
                        <div className="mt-0.5 text-ink-2">{n.body}</div>
                        <button type="button" onClick={() => markRead(n.id).then(() => setNotes(notes.map((x) => (x.id === n.id ? { ...x, read_at: "now" } : x))))} className="mt-1 text-[11px] font-semibold text-amber">
                          Dismiss
                        </button>
                      </div>
                    ))}
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {items.length === 0 && <p className="text-sm text-muted">No saved shipments yet. Use “Save to account” on the results page.</p>}
                {items.map((s) => (
                  <div key={s.id} className="rounded-xl border border-line bg-white p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 truncate text-sm font-semibold">{s.name ?? "Untitled"}</div>
                      <div className="shrink-0 text-sm font-semibold text-teal">{s.landed_total != null ? `${(s.snapshot_json as { dest_country?: string } | null)?.dest_country === "SG" ? "S$" : "RM"} ${rm(s.landed_total, 0)}` : ""}</div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">{new Date(s.updated_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-[12px]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal"
                          checked={s.alert_on_rate_change}
                          onChange={async (e) => {
                            await setAlert(s.id, e.target.checked);
                            setItems(items.map((x) => (x.id === s.id ? { ...x, alert_on_rate_change: e.target.checked } : x)));
                          }}
                        />
                        Alert me if rates change
                      </label>
                      <div className="flex gap-3 text-[12px] font-semibold">
                        <button
                          type="button"
                          className="text-teal"
                          onClick={() => {
                            update({ ...(s.snapshot_json as Partial<AppState>), step: 4, saved_id: s.id, saved_name: s.name ?? "" });
                            onClose();
                          }}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="text-muted"
                          onClick={async () => {
                            if (!confirm("Delete this saved shipment?")) return;
                            await deleteShipment(s.id);
                            setItems(items.filter((x) => x.id !== s.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-line bg-white p-3">
                <div className="text-sm font-semibold">Quote branding</div>
                <p className="mt-0.5 text-[11px] text-muted">Shown on the PDF quote.</p>
                <input className={`${smallInputCls} mt-2`} placeholder="Company name" value={profile.company_name ?? ""} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} />
                <div className="mt-2 flex items-center gap-3">
                  {profile.logo_url ? <img src={profile.logo_url} alt="Logo" className="h-10 max-w-[120px] object-contain" /> : <div className="text-[11px] text-muted">No logo</div>}
                  <label className="cursor-pointer text-[12px] font-semibold text-teal">
                    Upload logo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await saveProfile(profile);
                    setSavedProfile(true);
                    setTimeout(() => setSavedProfile(false), 1500);
                  }}
                  className="mt-2 h-9 rounded-lg bg-teal px-3 text-[12px] font-semibold text-white"
                >
                  {savedProfile ? "Saved" : "Save branding"}
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-line bg-white p-3">
                <div className="text-sm font-semibold">API keys</div>
                <p className="mt-0.5 text-[11px] text-muted">
                  For <code className="font-mono">POST /api/calc</code>. Send the key as an <code className="font-mono">x-api-key</code> header: 300 requests a minute, usage counted here. Free in beta.
                </p>
                {newKey && (
                  <div className="mt-2 rounded-lg bg-teal-tint p-2.5 text-[12px] text-teal-dark">
                    <div className="font-semibold">Copy this key now; it is shown once.</div>
                    <code className="mt-1 block break-all font-mono text-[12px]">{newKey}</code>
                    <button type="button" className="mt-1.5 text-[12px] font-semibold text-teal" onClick={() => navigator.clipboard?.writeText(newKey)}>
                      Copy
                    </button>
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <input className={smallInputCls} placeholder="Key name, e.g. forwarder portal" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
                  <button
                    type="button"
                    className="h-9 shrink-0 rounded-lg bg-teal px-3 text-[12px] font-semibold text-white"
                    onClick={async () => {
                      try {
                        const raw = await createApiKey(keyName.trim());
                        setNewKey(raw);
                        setKeyName("");
                        setKeys(await listApiKeys());
                      } catch (e) {
                        alert((e as Error).message);
                      }
                    }}
                  >
                    New key
                  </button>
                </div>
                {keys.length > 0 && (
                  <div className="mt-2 flex flex-col divide-y divide-line-2 text-[12px]">
                    {keys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between gap-2 py-1.5">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {k.name} <span className="font-mono font-normal text-muted">{k.key_prefix}…</span>
                          </div>
                          <div className="text-[11px] text-muted">
                            {k.calls_total.toLocaleString()} calls{k.last_used_at ? ` · last ${new Date(k.last_used_at).toLocaleDateString()}` : ""}
                            {k.revoked_at ? " · revoked" : ""}
                          </div>
                        </div>
                        {!k.revoked_at && (
                          <button
                            type="button"
                            className="shrink-0 text-[11px] font-semibold text-muted"
                            onClick={async () => {
                              await revokeApiKey(k.id);
                              setKeys(await listApiKeys());
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

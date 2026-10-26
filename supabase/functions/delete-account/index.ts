// Supabase Edge Function: delete-account
// Deletes the signed-in user and, by cascade, their profiles, seasons, practices,
// completion events, reviews, plan versions, legacy grants and quota rows.
//
// Deploy ONLY after approval and after storing the service role as a function secret:
//   supabase secrets set SERVICE_ROLE_KEY=<project service role key>
//   supabase functions deploy delete-account
// The app never calls this with anyone else's identity: the user id comes from the JWT.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// @ts-expect-error Deno global is provided by the Edge Runtime
const env = (key: string) => Deno.env.get(key)?.trim() ?? "";

async function verifyCaller(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: authorization },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return typeof user?.id === "string" ? (user.id as string) : null;
}

// @ts-expect-error Deno global is provided by the Edge Runtime
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS_HEADERS });
  }

  const userId = await verifyCaller(req).catch(() => null);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Sign in first." }), { status: 401, headers: CORS_HEADERS });
  }

  let confirmed = false;
  try {
    const body = await req.json();
    confirmed = body?.confirm === true;
  } catch {
    confirmed = false;
  }
  if (!confirmed) {
    return new Response(JSON.stringify({ error: "Deletion was not confirmed." }), { status: 400, headers: CORS_HEADERS });
  }

  const url = env("SUPABASE_URL");
  const secret = env("SERVICE_ROLE_KEY");
  if (!url || !secret) {
    console.error("delete-account is missing its service role secret");
    return new Response(JSON.stringify({ error: "Account deletion is unavailable right now." }), { status: 503, headers: CORS_HEADERS });
  }

  try {
    const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: secret, Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("delete-account failed", { status: res.status });
      return new Response(JSON.stringify({ error: "Your account could not be deleted. Nothing has changed." }), { status: 502, headers: CORS_HEADERS });
    }
    return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: CORS_HEADERS });
  } catch {
    return new Response(JSON.stringify({ error: "Your account could not be deleted. Nothing has changed." }), { status: 502, headers: CORS_HEADERS });
  }
});

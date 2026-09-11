// Shared CORS policy for every Recore edge function (S11, security review
// 10 Sep 2026).
//
// WHAT THE WILDCARD ACTUALLY COST. `Access-Control-Allow-Origin: *` is not a
// CSRF hole here — no `Allow-Credentials` is sent, so no browser attaches
// cookies, and Supabase authenticates by header rather than by cookie anyway.
// What it did allow is ANY web page to call these functions with a token it
// already holds, which is the delivery mechanism for S2: a page that has
// obtained a JWT can spend that account's model quota from the visitor's
// browser, and the response is readable by the page that asked.
//
// WHY THE NATIVE APP IS UNAFFECTED. React Native's fetch sends no `Origin`
// header at all — CORS is a browser mechanism and there is no browser in the
// app. A response carrying no `Access-Control-Allow-Origin` is exactly right
// for it: nothing is enforcing the header, so nothing can fail on its absence.
// This is why an allow-list can be this narrow without breaking iOS.
//
// `null` is on the list because a native WebView (and a file:// document) sends
// the literal string "null" as its origin.

const DEV_ORIGINS = [
  'http://localhost:8081', // expo start --web
  'http://localhost:19006', // the older expo web port
];

/**
 * One production web origin, set per project rather than committed:
 *   supabase secrets set ALLOWED_WEB_ORIGIN=https://app.example.com
 * Absent by default, which is the correct state while Recore is iOS-only.
 */
function allowed(): Set<string> {
  const extra = Deno.env.get('ALLOWED_WEB_ORIGIN');
  return new Set([...DEV_ORIGINS, 'null', ...(extra ? [extra] : [])]);
}

export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Without this a shared cache could hand one origin's response to another.
    Vary: 'Origin',
  };

  const origin = req.headers.get('Origin');
  // Reflected only if it is on the list, and never reflected blindly. No Origin
  // at all is the native app, and it needs no header.
  if (origin && allowed().has(origin)) headers['Access-Control-Allow-Origin'] = origin;

  return headers;
}

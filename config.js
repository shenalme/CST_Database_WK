// Connection to your Supabase database, used by dashboard.html and twin.html (digital twin).
// Leave both empty to show the built-in sample data. To show LIVE data from your database, fill in both:
//   Supabase dashboard -> Project Settings -> API -> "Project URL" and the public "anon" (or "publishable") key.
// Use ONLY the public key here, never the "service_role" / "secret" key: this file is public on GitHub Pages.
window.DASHBOARD_CONFIG = {
  SUPABASE_URL: "https://ufgbavwzdclhxhdlyosa.supabase.co",       // e.g. "https://abcdefghijkl.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_LMcZY4OPWG4F13Ts203pIw_gPmEpeKN"   // the long public key (starts with eyJ... or sb_publishable_...)
};

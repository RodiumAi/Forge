/**
 * `@forge/forms` on a published site: deliver a submission to the site owner.
 *
 * The sites gateway proxies `/_rodium/*` to the Forge API on the site's own
 * origin, so this is a same-origin POST. A `<meta name="forge:forms">` tag
 * overrides the endpoint (the ZIP export points it at the Forge API).
 *
 * @param {string} form short form name ("contact", "newsletter"...)
 * @param {Record<string, unknown> | FormData} data field values
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function submitForm(form, data) {
  const meta = typeof document !== "undefined" ? document.querySelector('meta[name="forge:forms"]') : null;
  const endpoint = (meta && meta.getAttribute("content")) || "/_rodium/v1/sites/forms";
  let fields = data || {};
  if (typeof FormData !== "undefined" && fields instanceof FormData) {
    fields = Object.fromEntries(fields.entries());
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form: String(form || "form").slice(0, 64),
        data: fields,
        page: typeof location !== "undefined" ? location.pathname : "",
      }),
    });
    if (res.ok) return { ok: true };
    let error = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") error = body.detail;
    } catch {
      /* not JSON */
    }
    return { ok: false, error };
  } catch {
    return { ok: false, error: "network" };
  }
}

export default submitForm;

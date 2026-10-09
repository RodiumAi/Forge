/**
 * `@forge/forms` in the builder preview: nothing is sent. The promise resolves
 * like a successful submission so the form's success state can be designed and
 * tested; the published site uses the real client (runtime/virtual/forge-forms.mjs).
 *
 * @param {string} form
 * @param {Record<string, unknown> | FormData} data
 * @returns {Promise<{ ok: boolean, preview: boolean }>}
 */
export async function submitForm(form, data) {
  let fields = data || {};
  if (typeof FormData !== "undefined" && fields instanceof FormData) {
    fields = Object.fromEntries(fields.entries());
  }
  await new Promise((resolve) => setTimeout(resolve, 450));
  console.info("[forge] preview form submission (not sent):", form, fields);
  return { ok: true, preview: true };
}

export default submitForm;

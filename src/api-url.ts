// Single source of truth for the API origin. Leave VITE_API_URL unset for local
// dev so requests stay same-origin and go through the Vite proxy; set it when the
// client is served from a different host than the API.
const origin = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

export const API_PREFIX = `${origin}/api/v1`;

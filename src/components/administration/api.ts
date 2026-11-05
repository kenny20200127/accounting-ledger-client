import { API_PREFIX } from '../../api-url';
import { notifyCompanyBrandingChanged } from '../../company-theme';

export async function fetchApi<T>(
  path: string,
  token: string,
  body?: unknown,
  method = 'GET',
): Promise<T> {
  const response = await fetch(API_PREFIX + '/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || 'Request failed.',
    );
  if (
    method !== 'GET' &&
    /^(?:platform\/)?companies(?:\/[^/?]+)?(?:\/logo)?$/.test(path)
  )
    notifyCompanyBrandingChanged(data.companyId ?? data.company?.companyId);
  return data;
}

export function createPortalApi(platform: boolean, companyId: string) {
  return <T,>(
    path: string,
    token: string,
    body?: unknown,
    method = 'GET',
  ): Promise<T> => {
    if (platform) {
      const [route, search] = path.split('?');
      if (route === 'companies' || route.startsWith('companies/'))
        path = 'platform/' + route + (search ? '?' + search : '');
      else if (
        ['users', 'roles', 'audit-logs'].some(
          (prefix) => route === prefix || route.startsWith(prefix + '/'),
        )
      ) {
        const params = new URLSearchParams(search);
        params.delete('companyId');
        path =
          'platform/companies/' +
          companyId +
          '/' +
          route +
          (params.size ? '?' + params.toString() : '');
      }
    }
    return fetchApi<T>(path, token, body, method);
  };
}

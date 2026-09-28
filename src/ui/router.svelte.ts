// Minimal hash router: #/closet, #/item/new, #/item/<id>, …
// Hash routing needs no server rewrites (GitHub Pages) and behaves well in iOS standalone mode.

export type Route =
  | { name: 'closet' }
  | { name: 'item'; id: string | 'new'; typeId?: string }
  | { name: 'today' }
  | { name: 'plan' }
  | { name: 'type'; id: string }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  switch (parts[0]) {
    case 'item':
      return {
        name: 'item',
        id: parts[1] ? decodeURIComponent(parts[1]) : 'new',
        typeId: params.get('type') ?? undefined,
      };
    case 'today':
      return { name: 'today' };
    case 'plan':
    case 'insights':
      return { name: 'plan' };
    case 'type':
      return parts[1] ? { name: 'type', id: decodeURIComponent(parts[1]) } : { name: 'plan' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'closet' };
  }
}

export const router = $state({ route: parseHash(location.hash) });

window.addEventListener('hashchange', () => {
  router.route = parseHash(location.hash);
  window.scrollTo(0, 0);
});

export function navigate(path: string) {
  location.hash = path;
}

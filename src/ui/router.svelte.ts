// Minimal hash router: #/closet, #/item/new, #/item/<id>, …
// Hash routing needs no server rewrites (GitHub Pages) and behaves well in iOS standalone mode.

export type Route =
  | { name: 'closet' }
  | { name: 'item'; id: string | 'new' }
  | { name: 'today' }
  | { name: 'insights' }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'item':
      return { name: 'item', id: parts[1] ? decodeURIComponent(parts[1]) : 'new' };
    case 'today':
      return { name: 'today' };
    case 'insights':
      return { name: 'insights' };
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

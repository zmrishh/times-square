import { SLOTS } from './registry';

// Rebuild destinations from a small set of app routes, never redirect to input URLs.
export function authReturnPath(value: unknown): string {
  const fallback = '/?panel=account';
  if (typeof value !== 'string' || !value.startsWith('/?') || value.length > 500) return fallback;
  const params = new URLSearchParams(value.slice(2));
  const billboard = params.get('billboard');
  const checkout = params.get('checkout');
  if (checkout && /^[a-f0-9-]{36}$/i.test(checkout)) return `/?checkout=${checkout}`;
  if (billboard && SLOTS.some(slot => slot.id === billboard))
    return `/?billboard=${billboard}${params.get('panel') === 'editor' ? '&panel=editor' : ''}`;
  return fallback;
}

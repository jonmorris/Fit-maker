import type { Category, ColorFamily, Formality, Pattern, Status } from '../engine/types';

export const CATEGORY_LABEL: Record<Category, string> = {
  top: 'Top',
  bottom: 'Bottom',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  layer: 'Layer',
  accessory: 'Accessory',
};

export const FORMALITY_LABEL: Record<Formality, string> = {
  casual: 'Casual',
  'business-casual': 'Business casual',
  dressy: 'Dressy',
};

export const PATTERN_LABEL: Record<Pattern, string> = {
  solid: 'Solid',
  stripe: 'Stripe',
  check: 'Check',
  plaid: 'Plaid',
  print: 'Print',
  texture: 'Texture',
};

export const STATUS_LABEL: Record<Status, string> = {
  active: 'Active',
  repair: 'Needs repair',
  donate: 'Donate',
};

export const WARMTH_LABEL = ['', 'Very light', 'Light', 'Medium', 'Warm', 'Very warm'] as const;

export const familyLabel = (f: ColorFamily) => f[0].toUpperCase() + f.slice(1);

export const SUBCATEGORIES: Record<Category, string[]> = {
  top: ['T-shirt', 'Polo', 'Button-down', 'Oxford', 'Dress shirt', 'Henley', 'Overshirt', 'Tank'],
  bottom: ['Chinos', 'Jeans', 'Trousers', 'Shorts', 'Joggers', 'Skirt'],
  outerwear: ['Rain jacket', 'Trench', 'Overcoat', 'Parka', 'Bomber', 'Denim jacket', 'Blazer', 'Shacket'],
  shoes: ['Sneakers', 'Loafers', 'Derbies', 'Boots', 'Chelsea boots', 'Sandals'],
  layer: ['Crewneck sweater', 'Cardigan', 'Quarter-zip', 'Hoodie', 'Vest', 'Sweatshirt'],
  accessory: ['Belt', 'Scarf', 'Hat', 'Bag', 'Watch', 'Tie'],
};

export const FABRICS = [
  'Cotton', 'Oxford cloth', 'Linen', 'Wool', 'Merino', 'Cashmere', 'Denim', 'Twill', 'Corduroy',
  'Flannel', 'Jersey', 'Fleece', 'Leather', 'Suede', 'Nylon', 'Polyester', 'Gore-Tex', 'Canvas',
];

/** Sensible starting values when you pick a category, so a quick add is only a few taps. */
export const CATEGORY_DEFAULTS: Record<Category, { warmth: 1 | 2 | 3 | 4 | 5; formality: Formality[] }> = {
  top: { warmth: 2, formality: ['business-casual'] },
  bottom: { warmth: 2, formality: ['business-casual'] },
  outerwear: { warmth: 4, formality: ['casual', 'business-casual'] },
  shoes: { warmth: 2, formality: ['business-casual'] },
  layer: { warmth: 3, formality: ['casual', 'business-casual'] },
  accessory: { warmth: 1, formality: ['casual', 'business-casual'] },
};

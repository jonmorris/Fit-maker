import { DEFAULT_FILTERS, type ClosetFilters } from './filters';

// Module-level so filters survive navigating to an item and back.
export const closet = $state<{ filters: ClosetFilters }>({ filters: { ...DEFAULT_FILTERS } });

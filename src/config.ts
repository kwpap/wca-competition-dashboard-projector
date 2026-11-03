export const WCA_ORIGIN: string =
  import.meta.env.VITE_WCA_ORIGIN || 'https://www.worldcubeassociation.org';

export const WCA_CLIENT_ID: string = import.meta.env.VITE_WCA_CLIENT_ID || '';

export const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';

export const RESULTS_POLL_MS = 20_000;
export const GET_READY_MS = 5 * 60_000;
export const RESULTS_ROWS_PER_PAGE = 13;
/** Rows per page when the results fill the screen during breaks. The bar on top takes some height. */
export const RESULTS_ROWS_PER_PAGE_WIDE = 11;
/** Length of the fade between result pages. */
export const RESULTS_FADE_MS = 500;
/** How long a row with a new result stays highlighted. */
export const RESULTS_FRESH_MS = 90_000;
/** A round with a result change this recent gets high priority in the results carousel. */
export const RESULTS_PRIORITY_MS = 10 * 60_000;
/** Every this many normal picks, the carousel shows a round from another day instead. */
export const LOW_PRIORITY_EVERY = 4;
/** How long each slide of the closing screen stays. */
export const FINALE_SLIDE_MS = 10_000;

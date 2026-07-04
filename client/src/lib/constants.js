// Canonical purchase / supply channels — must match db.js on the server.
export const SOURCE_LOCAL = 'Local Purchase';
export const SOURCE_HEAD_OFFICE = 'Head Office Purchase';
export const PURCHASE_SOURCES = [SOURCE_LOCAL, SOURCE_HEAD_OFFICE];

export const sourceShort = (src) =>
  src === SOURCE_HEAD_OFFICE ? 'Head Office' : src === SOURCE_LOCAL ? 'Local' : '';

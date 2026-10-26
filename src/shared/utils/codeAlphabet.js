// The arcade's code alphabet: room codes (hooks/useRoomCore.js) and backup
// codes (utils/cloudSave.js). No 0/O/1/I, because both get read aloud and typed
// off another screen, and those four are the ones people get wrong.
//
// Exactly 32 symbols, which cloudSave.js relies on: a random byte masked to five
// bits picks one with no bias, so a backup code's 16 characters are a full 80
// bits.
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

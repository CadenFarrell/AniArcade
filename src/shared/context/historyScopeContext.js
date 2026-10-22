import { createContext, useContext } from 'react';

// Whose results this device records (hooks/useRecordResult.js). RoomShell
// provides `{ onlyId: myPlayerId }` around every online screen: each device in
// a room records its own player, and the other devices record theirs — so
// nobody's history gains a line on somebody else's phone. Local play provides
// nothing, and a null scope means every seated profile, since every one of
// them is on this device.
export const HistoryScopeContext = createContext(null);

export const useHistoryScope = () => useContext(HistoryScopeContext);

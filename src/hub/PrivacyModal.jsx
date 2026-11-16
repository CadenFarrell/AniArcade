import { Button, Kana, Modal, SheetSection as Section } from '../shared/ui';
import { KANA } from '../shared/ui/kanaText';

// What the arcade keeps and what it sends, in plain words. Opened from the
// hub's footer, beside Feedback and Credits.
//
// EVERY SENTENCE HERE IS A CLAIM ABOUT THE CODE, and a note that has drifted
// from what the app does is worse than no note. Each one rests on:
//
//   no accounts, ads, tracking   nothing in the app loads an analytics or ad
//                                script; sign-in is Firebase's anonymous one
//                                (services/firebase.js), and only for online play
//   on this device               profiles, prefs, history and achievements are
//                                localStorage (hooks/useProfile.js and the rest);
//                                deleting a profile removes the profile and its
//                                list, NOT its play record — so the sentence
//                                promises everything only for clearing site data
//   importing a list             services/listSources.js: AniList and Kitsu
//                                directly, MyAnimeList through workers/mal-proxy
//                                (Cloudflare); a file is parsed here
//                                (utils/listImport.js) and its shows looked up
//                                on AniList. Portraits are AniList's CDN;
//                                AniTune's songs are AnimeThemes
//   playing online               the room copies each player's profile into
//                                rooms/{code} (.claude/rules/online-rooms.md);
//                                the last one out deletes it, and the next room
//                                made sweeps any a day old (useRoomCore.js)
//   crash reports and feedback   services/crashReport.js's buildCrashReport and
//                                FeedbackModal's sendReport: those fields only
//
// Change any of those — a new thing stored, a new service contacted, a new
// field on a report — and change the sentence with it.
export default function PrivacyModal({ onClose }) {
  return (
    <Modal onClose={onClose} width="md">
      <Kana className="block text-sm text-pop-pink">{KANA.privacy}</Kana>
      <h2 className="mb-2 font-display text-3xl font-bold uppercase text-fg-strong">Privacy</h2>
      <p className="mb-5 font-bold text-fg-strong">No accounts, no ads, no tracking.</p>

      <Section title="On this device">
        <li className="text-fg-body">
          Your profiles, anime lists, settings and play record are saved in this browser and
          nowhere else. Deleting a profile removes it and its list. Clearing this site’s data in
          your browser removes everything.
        </li>
      </Section>

      <Section title="Importing a list">
        <li className="text-fg-body">
          The username you enter is sent to AniList, Kitsu or MyAnimeList (through a small relay on
          Cloudflare) to fetch your public list. A list file is read on this device, and its shows
          are looked up on AniList.
        </li>
        <li className="text-fg-body">
          Portraits load from AniList, and AniTune’s songs from AnimeThemes.
        </li>
      </Section>

      <Section title="Playing online">
        <li className="text-fg-body">
          A room holds each player’s name and list while you play, stored on Google Firebase under
          an anonymous id. It is deleted when the last player leaves. A room left behind is cleared
          once it is a day old.
        </li>
      </Section>

      <Section title="Crash reports and feedback">
        <li className="text-fg-body">
          If the arcade crashes it sends the error, the game and page it happened on, and your
          browser version. Never a name or a list.
        </li>
        <li className="text-fg-body">
          Feedback sends what you write and which game it is about.
        </li>
      </Section>

      <p className="mb-5 text-sm text-fg-body">
        Like any website, the host (Google Firebase) sees your IP address when you visit.
      </p>

      <Button variant="secondary" fullWidth onClick={onClose} className="mt-2">
        Close
      </Button>
    </Modal>
  );
}

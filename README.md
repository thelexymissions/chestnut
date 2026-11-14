# Chestnut

A verse for what's on your mind. Chestnut is an installable web app for reading, saving and sharing Bible verses:

- **The cross and the name of Jesus**: a plain wooden cross on a hill at sunrise, with the name and Scripture beneath it. It opens the app and greets a new person on the welcome screen with Romans 8:1; at the top of Home it carries Romans 8:1–2; and a small cross sits above the name on shared pictures.
- **Verse feed**: full-screen cards, one verse each, grouped by topic. Swipe up for the next card; swipe left or right, or use the bar at the foot of the card, for the verse after or before it.
- **Bible**: the whole King James Version, browsable by book and chapter, searchable by reference or by words.
- **Saved and notes**: private to each person, stored on their own device.
- **Memorise**: mark verses, then review them on a fixed schedule with four exercises.
- **Trivia**: a second deck of cards with Bible facts, switched to from the feed and never mixed with the verses.
- **Welcome**: three taps about how you are, a verse for it, a first go at learning it, then a short path that introduces the rest.
- **Reflection**: one open question after every five verses; can be switched off.
- **Sound**: an instrumental pad, rain, forest and waves, generated in the app.
- **Sharing**: WhatsApp, the phone's share sheet, copy, and share-as-picture.

There is no server and no account. Everything a person saves stays in their browser.

## Run it

```bash
npm install
npm run dev
```

`npm run build` writes the site to `dist/`. Pushing to `main` publishes it through GitHub Pages (`.github/workflows/deploy.yml`); in the repository settings, Pages → Source must be set to **GitHub Actions**.

## Where the verses come from

No verse text is typed by hand anywhere in this project.

- `public/data/kjv.json` is the whole KJV (1769 standard text). `scripts/verify-kjv.mjs` built it from one public-domain copy and compared every one of the 31,102 verses, word for word, against two other independent copies. The result is recorded in `data/kjv-verification.json`.
- `data/topic-verses.json` lists the feed's verses by topic, as references only.
- `scripts/build-curated.mjs` (run by `npm run build`) looks each reference up in `kjv.json` and writes `src/data/curated.json`. It stops the build if a reference does not exist.
- `data/curated-review.md` shows every feed verse under its topic, for proofreading.

### Trivia facts

`data/facts.json` holds the trivia cards. `scripts/build-facts.mjs` (run by `npm run build`) refuses any card that is not backed in one of two ways:

- **`check`**: the claim is recomputed from `kjv.json` and must match both the expected value and the wording shown (for example, that Esther 8:9 is the longest verse at 90 words).
- **`sources`**: at least one named, linked reference, for cards about the Bible's history.

To add a card, add an entry with either a new check in that script or a source. Thumbs up and down are stored on the device; a card thumbed down moves to the end of that person's deck.

### The cross and the name

`data/cross-verses.json` names the two passages, as references only: `"opening"` for the opening moment and the welcome screen (now `"Romans 8:1"`), and `"home"` for the card at the top of Home (now `"Romans 8:1-2"`). Each is one verse or a run of verses in one chapter. `scripts/build-centre.mjs` (run by `npm run build`) copies the words from `kjv.json` into `src/data/cross.json` and stops the build on a reference that does not exist. To change either passage, edit the reference and rebuild.

The drawing is `src/components/CrossScene.tsx`; the opening moment is `src/components/Opening.tsx` and is not replayed if the page is reloaded within five minutes.

### Change the feed

Edit `data/topic-verses.json` (add or remove references such as `"John 3:16"`), then run `npm run build`. To add a topic, also add it to `src/data/topics.ts` and to the `TOPICS` table in `scripts/build-curated.mjs`.

## Swiping in the verse feed

Up and down changes the card; left and right reads on in the same passage. The two are kept apart like this (`src/screens/Feed.tsx`):

- **One direction per swipe.** The cards read every touch themselves (`touch-action: none`) and choose the direction once, after the finger has travelled 12px. Until it lifts, the other direction is off: a sideways swipe cannot change the card, and an up/down swipe cannot change the verse. A swipe within about 50° of level counts as sideways, because a thumb moves in an arc.
- **The bar under the verse** shows the verse before, the reference and the verse after, with a dot for the place in the chapter. It stays at the foot of the card whatever the verse's length. A swipe that starts on it is sideways unless it is plainly vertical, and needs less travel.
- **Up/down paging** is done by `usePager`, which moves the scroll position under the finger and settles on the next card after a flick or a pull of a quarter of the screen; anything less springs back. Mouse wheel, trackpad and keys still use the browser's own scroll snapping, as does the trivia deck.
- **The place is kept.** A card remembers how far sideways it was read until the page is reloaded, so leaving it does not lose the place. Opening a verse afresh (from Home or a link) shows that verse; coming back with Back keeps the place.

## Memorise

Nothing here is generated or judged by software; the rules are in `src/lib/memory.ts`.

- **Schedule**: a verse that passes a review moves up one stage and waits 1, 3, 7, 14, 30, 60, then 90 days. A miss moves it down one stage and brings it back the next day. A review passes when at least four in five prompts were right first time.
- **Fill in the blanks** and **First letters**: the answer is the verse's own word. Wrong choices are other real Bible words of similar length, taken from the same chapter first.
- **Name the reference** and **Find the verse**: one of four is right. Wrong choices are another verse on the list, a neighbouring verse, and the same chapter and verse numbers in a different book.
- **Recite and reveal**: the only exercise the reader marks for themselves.
- Extra practice from the list never changes the schedule.

## Layout

| Path | What it holds |
|---|---|
| `src/screens/` | Welcome, Home, Feed, Trivia, Bible, Saved, Memorise, Settings |
| `src/lib/` | Bible lookup and search, saved state, memorising rules, the welcome and path, trivia deck, sound, backgrounds, sharing, read-aloud |
| `src/data/` | Topics and the generated verse list |
| `scripts/` | Bible verification, verse list builder, trivia builder, centre-verse builder, icon generator |

## Sound

Everything heard is synthesised with the Web Audio API in `src/lib/sound.ts`; no recordings are bundled. The sound sheet also links out to Spotify and YouTube searches for worship artists, whose recordings are their own.

## Licence notes

The King James Version is in the public domain in most of the world; in the United Kingdom the Crown holds perpetual rights to it. Fonts (Cormorant Garamond, Newsreader, DM Sans) are under the SIL Open Font License.

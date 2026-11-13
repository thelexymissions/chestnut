# Chestnut

A verse for what's on your mind. Chestnut is an installable web app for reading, saving and sharing Bible verses:

- **Verse feed**: full-screen cards, one verse each, grouped by topic. Swipe up for the next card; swipe left or right for the verse after or before it.
- **Bible**: the whole King James Version, browsable by book and chapter, searchable by reference or by words.
- **Saved and notes**: private to each person, stored on their own device.
- **Memorise**: mark verses, then review them on a fixed schedule with four exercises.
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

### Change the feed

Edit `data/topic-verses.json` (add or remove references such as `"John 3:16"`), then run `npm run build`. To add a topic, also add it to `src/data/topics.ts` and to the `TOPICS` table in `scripts/build-curated.mjs`.

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
| `src/screens/` | Home (topics), Feed, Bible, Saved, Memorise, Settings |
| `src/lib/` | Bible lookup and search, saved state, memorising rules, backgrounds, sharing, read-aloud |
| `src/data/` | Topics and the generated verse list |
| `scripts/` | Bible verification, verse list builder, icon generator |

## Licence notes

The King James Version is in the public domain in most of the world; in the United Kingdom the Crown holds perpetual rights to it. Fonts (Cormorant Garamond, Newsreader, DM Sans) are under the SIL Open Font License.

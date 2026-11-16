# Localization plan (owner decision 2026-11-16)

The owner chose the Steam set for launch: **English, Simplified Chinese (`zh-Hans`), Russian (`ru`),
Spanish (`es`), Brazilian Portuguese (`pt-BR`), German (`de`), French (`fr`)**. This replaces the
English-only v1 decision recorded in `src/shared/localization-readiness.ts`.

Translations are machine drafts written by Claude agents, one per language, each against its own
glossary (the local Ollama models were gone from `E:\ollama\models` on 2026-11-16, so the local
model could not be used). They have had **no native-speaker review**; the store listings must not
claim more than the owner has checked, and Settings says so beside the language choice.

## Design

- **The English text is the key.** `tr` is a tagged template: `` tr`Floor ${n} cleared.` `` looks up
  `Floor {0} cleared.` in the active catalog and substitutes the arguments; with no catalog (English,
  tests, the soak, node scripts) it returns exactly the English it was given, so existing tests do
  not change. Plain strings use `tr.s('Descend')`.
- **Plurals** go through `plural(n, { one, few, many, other })` backed by `Intl.PluralRules`; the
  English `n === 1 ? '' : 's'` ternaries are converted, not translated.
- **The locale is fixed at boot.** `main.tsx` loads the chosen catalog (a lazily imported JSON chunk)
  before it imports the app, so module-level copy constants evaluate already translated. Changing
  the language in Settings saves it and reloads.
- **Never in rules.** The locale must not reach seeds, share keys, the journal, score names, records
  or `GAME_RULES_VERSION`. `src/shared` rule code never calls `tr`; only copy does.
- **Catalogs** live in `src/locales/<locale>.json` (`key -> translation`). `yarn i18n:extract`
  regenerates `src/locales/en.json` (the key list) from the `tr` calls; `yarn i18n:check` fails on a
  missing key, a placeholder mismatch, or a translation identical to English (except an allow-list
  of names such as "Memory Dungeon").
- **Pseudo-locale `en-XA`** (accented, ~40% longer) exists to find unwrapped strings and clipping:
  run the playtest in it and read the screenshots.
- **Fonts.** Latin-1 covers es/pt-BR/de/fr. Cyrillic subsets of Source Sans 3, Cormorant Garamond
  and Lora ship from the installed `@fontsource` packages (Cinzel has no Cyrillic and falls back), in
  `styles/fonts-cyrillic.css`, which `bootLocale.ts` imports only for Russian: preloaded for every
  player they slowed the menu by several seconds and timed out the controller e2e under load.
  Simplified Chinese uses the system CJK face (`Microsoft YaHei`, `PingFang SC`, `Noto Sans CJK SC`);
  no CJK web font is bundled.

## What holds it (all in `yarn vitest run` or `yarn ci`)

- `src/shared/i18n-catalog.test.ts`: `en.json` matches the code, every language has every key and
  plural form with the same placeholders, and no shader, CSS or selector text is a key.
- `src/shared/i18n-rules-isolation.test.ts`: the soak players play the same seeds to the same end in
  English and in the pseudo-locale. It caught the first wrap pass translating seed strings
  (`opening-layout:${seed}`), which changed every board in other languages.
- `e2e/locales.spec.ts`: menu, Settings and a board in en-XA, de, ru and zh-Hans with no console
  errors (it caught a shader fragment that had been wrapped), screenshots in
  `test-results/locales/`, and the pseudo-locale's leftover English listed.

## Adding or changing copy

Write it inside `tr` / `tr.s` / `plural` in a copy module, run `yarn i18n:extract`, and add the
new keys to every `src/locales/<locale>.json` (`yarn i18n:status` lists what is missing;
`yarn i18n:prune` drops keys no code uses). Never wrap an id, a seed string, a CSS value, a
selector or shader source; never build a sentence by gluing translated fragments, and never
inflect an English word with a ternary (`card${n === 1 ? '' : 's'}`): use `plural`. Code that
must recognise text another module made uses `isCopy`, `startsWithCopyPrefix` or `englishOf`.

## Known limits

- Some sentences are still built from fragments (a clause plus an optional tail), so word order in
  those can read stiffly; translators were told which keys are fragments.
- Lowercase one-word labels inside templates (`pinned`/`unpinned`) may still be English in a few
  announcements; the pseudo-locale playtest is how to find them.
- Card ranks, numbers and the Cinzel display face have no Cyrillic: Russian headings fall back to
  a system serif.

## Order of work (as done)

1. Infrastructure: `tr`, `plural`, locale store, boot loading, `<html lang>`, Settings picker,
   pseudo-locale, extract + check scripts, the readiness module updated on purpose.
2. Wrap the copy: `src/renderer/copy/**`, `src/renderer/ui/strings/**`, the shared catalogs
   (encyclopedia, achievements, relics, mutators, realms, patch notes), then the short inline
   labels in components. Pseudo-locale playtest after each slice.
3. Russian and Simplified Chinese end to end (plurals, fonts), then es, pt-BR, de, fr in batches.
4. uiFit and the HUD layout specs per locale; German and Russian overflow first.

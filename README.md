# Mingmo RPG Archive

GitHub Pages static reader for the Mingmo late-Ming RPG archive.

## Local Preview

Run from this repository root:

```powershell
python -m http.server 8080
```

Open:

```text
http://localhost:8080/
```

Do not open `index.html` directly with `file://`; the reader uses `fetch()` to load Markdown files.

## GitHub Pages

1. Push this repo to GitHub.
2. Open repository Settings.
3. Go to Pages.
4. Set Source to `Deploy from a branch`.
5. Choose the branch, usually `main`, and folder `/root`.
6. Save.

The site reads Markdown files from `rpg/`, including stories, options, status cards, and source state cards.

## Updating Rounds

When new round files are added, update `rpg-manifest.json`:

- `latestRound`
- `rounds`

The reader then exposes the new round in the dropdown.

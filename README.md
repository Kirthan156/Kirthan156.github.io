# kirthan156.github.io

Portfolio site for Kirthan Vivek Gada. Plain HTML, CSS and JavaScript with no build step.

- `index.html` home (the dive), `about.html`, `projects.html`, `research.html`, `404.html`
- `assets/css/ocean.css` all styles
- `assets/js/ocean.js` the animated ocean background, depth gauge and page interactions

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Hosting

- **GitHub Pages:** live at https://kirthan156.github.io and redeploys on every push to `main`.
- **Render (free static site):** `render.yaml` is a Blueprint. In Render choose New → Blueprint, pick this repo, and apply. Every push to `main` redeploys.

## Editing content

- Projects are the `PROJECTS` list at the bottom of `projects.html`.
- Research numbers are `FEAT` and `F1` at the bottom of `research.html` (Tables V and VI of the paper).

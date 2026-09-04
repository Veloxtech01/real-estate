# Public asset credits

| File            | Source                                                                 | Licence          |
| --------------- | ---------------------------------------------------------------------- | ---------------- |
| `hero-home.jpg` | Unsplash — https://unsplash.com/photos/AQl-J19ocWE (Ralph Ravi Kayden) | Unsplash Licence |

Placeholder imagery only. Replace with the agency's own photography before a client
launch — see scope §9 (the repo is copied and rebranded per client).

## Demo listing photography

The 200 demo listings (`node scripts/seed.js --demo`) are illustrated with photographs
from **Pexels** (https://www.pexels.com), hotlinked from `images.pexels.com` rather
than committed to this repo.

| | |
| ------------- | ------------------------------------------------------------------ |
| Licence       | Pexels Licence — free for commercial use, no attribution required  |
| Catalogue     | `backend/scripts/demoImages.js` (generated, do not hand-edit)      |
| Regenerate    | `cd backend && node scripts/fetchDemoImages.js` — needs `PEXELS_API_KEY` |
| Photographers | Recorded per photo in the catalogue's `photographer` field         |

Attribution is not required by the licence, but each photographer and source URL is
kept in the catalogue so credit can be given if the client wants it.

**These are demo images and must be replaced with the agency's own photography before
a client launch.** They exist so the site can be reviewed with realistic content, not
because they depict any real listing — every one of them shows a property that has
nothing to do with the agency.

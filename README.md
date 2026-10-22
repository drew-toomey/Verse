# Verse

A free verse journal that grows into your own book of poetry.

Write a verse, give it a title (or don't), and add it to your book. Each verse becomes the next page: a sepia cover with your book's title and name, a contents page, then one verse to a page, numbered in the order you wrote them.

- **Write**: a blank sheet with a title line and room for the verse. Line breaks, stanzas and indents are kept exactly as you type them. Lines can be centred or left-aligned. Everything saves as you type.
- **The book**: swipe to turn pages. Untitled verses are listed in the contents by their first line, the way old anthologies do it.
- **Loose pages**: anything you close without adding to the book waits under *Loose pages* until it's ready.
- **Make it yours**: set the book's title and author, choose Garamond or Typewriter, Sepia or Night paper, and the text size.
- **Keep it safe**: *Save a backup* writes your whole book to a file (on iPhone, choose *Save to Files*). *Restore a backup* reads one back, merging with what's already there.
- **Print the book**: lays it out as an A5 book, one verse to a page, ready to print or save as a PDF.

Your verses are stored on your phone only. They never go to this repository or any server, so save a backup now and then.

## Put it on your phone

Verse is a web app you add to your home screen. It then opens full screen like any other app and works offline. No App Store needed.

1. **Host it with GitHub Pages.** In this repository go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then save. After a minute it's live at `https://drew-toomey.github.io/Verse/`.
   GitHub Pages is free for public repositories. This repository is private, so either make it public (safe, because only the app's code is here, never your poems) or use a GitHub Pro account.
2. **Install it.** On your iPhone, open that address in **Safari**, tap **Share**, then **Add to Home Screen**. On Android, open it in Chrome and choose **Install app**.

## Making changes

There's no build step: the app is plain HTML, CSS and JavaScript.

```sh
npx serve .        # then open http://localhost:3000
```

| File | What it does |
| --- | --- |
| `index.html` | The page: top bar, book, writer and the menu sheets |
| `styles.css` | The sepia look, night paper, typewriter face and the print layout |
| `app.js` | The book, the writer, loose pages, settings, backups and printing |
| `sw.js` | Keeps a copy of the app on the phone so it opens offline |
| `manifest.webmanifest`, `icons/` | Home-screen name and icon |
| `fonts/` | EB Garamond and Courier Prime (SIL Open Font License) |

When you change any file, bump `VERSION` in `sw.js` (for example `verse-v2`) so installed copies pick up the update the next time they open.

# Verse

A journal in verse, with a shelf of books you fill yourself.

Every verse you write goes into your **journal**: dated, with how you were feeling, and whether it's about a moment, a thought or a memory. When a verse is finished, **publish** it to a **volume** on your shelf. A volume is a cloth-bound book for a topic, a season, a person or a time in your life, and each verse you publish becomes its next page.

- **Write quickly**: the quill button opens a blank page with the keyboard up. Line breaks, stanzas and indents stay exactly as you type them, lines can be centred or left-aligned, and everything saves as you write.
- **How you felt**: one tap from twelve feelings (joyful, grateful, hopeful, calm, tender, in love, wistful, lonely, sad, anxious, angry, numb), plus *a moment*, *a thought* or *a memory*.
- **Journal**: every verse, newest first, grouped by month with a row of feeling dots for each month. Search by any word or feeling, or show only what's unpublished.
- **Shelf**: your volumes as a grid of covers on pine shelves, in oxblood, burgundy, honey leather, teal, sage, bottle green, olive or ivory. Sort by most recent or by title.
- **Volumes**: open one to read it like a book: a cloth cover, a contents page, one verse to a page with its date and feeling, and room for the next verse. Edit a volume's title, what it holds and its binding, or print it as an A5 book.
- **Moving things**: move a verse to another volume, or take it out and keep it only in your journal. Deleting a volume never deletes its verses; they stay in your journal.
- **Make it yours**: your name for the covers, Garamond or Typewriter, Sepia or Night paper, and text size.
- **Keep it safe**: *Save a backup* writes everything to a file in your phone's Downloads. *Restore a backup* reads one back, merging with what's already there. Copy the file somewhere safe, such as Google Drive.

Your verses are stored on your phone only. They never go to this repository or any server, so save a backup now and then.

## Put it on your phone

Verse is built for a Pixel (or any Android phone) running Chrome. Installed from Chrome, Android packages it as a real app: it has its own icon in the app drawer and on the home screen, appears in Settings → Apps, opens full screen and works offline. No Play Store needed.

1. **Host it with GitHub Pages.** In this repository go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then save. After a minute it's live at `https://drew-toomey.github.io/Verse/`.
   GitHub Pages is free for public repositories. This repository is private, so either make it public (safe, because only the app's code is here, never your poems) or use a GitHub Pro account.
2. **Install it.** On your Pixel, open that address in **Chrome** and tap **Install** on the card at the top of the journal (or open Chrome's **⋮** menu and choose **Install app**).

Once installed:

- **Write in one step**: touch and hold the Verse icon and choose **Write a verse**. Drag that shortcut onto your home screen to keep a button that opens straight onto a blank page.
- **Share into Verse**: in Keep, Messages, Chrome or any app with a **Share** button, share some text and choose **Verse**. It lands in your journal as a new verse.
- **Themed icons**: Verse includes a monochrome icon for Android's themed icons.
- **Back gesture**: it closes the sheet, writer or volume you're in, like any other app.

It also works on an iPhone: open the address in Safari, tap **Share**, then **Add to Home Screen**.

## Making changes

There's no build step: the app is plain HTML, CSS and JavaScript.

```sh
npx serve .        # then open http://localhost:3000
```

| File | What it does |
| --- | --- |
| `index.html` | The page: journal and shelf tabs, the volume reader, the writer and the sheets |
| `styles.css` | The sepia look, book cloth and shelves, night paper, typewriter face and the print layout |
| `app.js` | Journal, shelf, volumes, the writer, feelings, settings, backups and printing |
| `sw.js` | Keeps a copy of the app on the phone so it opens offline |
| `manifest.webmanifest`, `icons/`, `screenshots/` | How Android installs it: name, icons, the *Write a verse* shortcut, the Share target and the install screenshots |
| `fonts/` | EB Garamond and Courier Prime (SIL Open Font License) |

When you change any file, bump `VERSION` in `sw.js` (for example `verse-v3`) so installed copies pick up the update the next time they open.

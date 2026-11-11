# Band Helper

A small React app for band logistics:

- **Songs**: search [LRCLIB](https://lrclib.net) for lyrics (free, no API key), preview results and add them to your library. You can also add originals or paste lyrics by hand, and edit any lyrics.
- **Lineups**: add members, then for each song list the parts and who can play each one. The first person is the usual player and the others are backups, in order.
- **Setlist & sheets**: order the setlist and print or save printable lyric sheets as a PDF. Options: cover page, text size, two columns, and who plays what on each sheet.
- **Who's here?**: mark who's missing to see which songs you can still play (with substitutions highlighted) and why the others can't be played. It also builds a **practice plan** that groups songs into rounds that can be rehearsed at the same time, plus a song-by-song compatibility grid.

Data is saved in the browser's localStorage. Use **Export / Import** to back it up or share it with bandmates.

## How the lineup logic works

Each part on a song needs available people to fill it. Finding out whether a song is playable is a bipartite matching problem (parts on one side, people on the other). Checking whether several songs can be practiced at the same time is the same problem with all of their parts combined. See `src/lib/matching.ts`.

Each part has a **player count** (min to max, default 1 to 1). With "Guitar: 1 to 3", the first three people listed all play when they're here, and the song still works with just one. Setting the min to 0 makes a part optional, so it's dropped when nobody's around. Required spots are always filled first, and extra spots never take someone a required part needs.

Each part is either **vocal** or **instrument** (guessed from the name, changeable in the editor). Within one song, a person can take one of each, so they can sing and play, but not two instruments or two vocal parts. When rehearsing songs at the same time, a person can only be in one of them. A small search handles the cases where that matters.

## Scripts

```sh
npm install
npm run dev     # start the dev server
npm test        # run the matching logic tests
npm run build   # type-check and build
```

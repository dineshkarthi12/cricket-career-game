# Live PvP asset manifest

What Live PvP shows, where it comes from, and what may be used. Since Phase 14
the match is 2D (SVG drawn by the game), so there are no 3D models or
animation files; the previous 3D inventory (procedural rig, clips, the
Khronos RiggedFigure test fixture) was removed with `src/game3d` and remains
in git history.

## Card designs

The ten reference designs uploaded to the repository are the visual source of
truth for `src/screens/pvp/cards/PlayerCard.tsx`. They live in `design/cards/`
(not `public/`, which the PWA precaches - they are ~30 MB of PNG):

| File | Design | Implemented as |
|---|---|---|
| `Commoncard.png` | Common | `common` |
| `Uncommoncard.png` | Uncommon | `uncommon` |
| `Rarecard.png` | Rare | `rare` |
| `Epiccard.png` | Epic | `epic` |
| `Legendarycard.png` | Legendary | `legendary` |
| `Iconcard.png` | Icon | `icon` |
| `Limitededitioncard.png` | Limited Edition | `limited` |
| `Teamofthetournamentcard.png` | Team of the Tournament | `tott` |
| `Playerofthematchcard.png` | Player of the Match | `potm` |
| `Legendsalltimegreats.png`, `Legendsalltimegreats1.png` | Legends / All-Time Greats (two variants) | `legends` |
| `portrait-reference.png` (uploaded as `file_00000000b0a8...png`) | A bare portrait (the art style on the cards) | not a card |

The references are mock-ups of one real cricketer. Only their **layout** is
used: rating and role box, nation, rarity tab or award emblem, hero portrait
with secondary art, name block, styles line, five-attribute bar, footer
plates. The numbers printed on them (for example the Legends card's career
figures) are not used as data. Board crests in the references are not
reproduced (project rule: no real team or association logos); cards show
simplified national flags.

## Player photos: `assets-src/players/Cricketcareer.zip`

Uploaded as `public/assets/players/Cricketcareer.zip`, moved to
`assets-src/players/` in Phase 14 because everything under `public/` is
precached by the service worker (it would have put 12 MB of photos on every
installed phone).

**Contents (inspected file by file):** 147 JPEG files, 12.4 MB, no folders and
no metadata. 146 are named with random UUIDs; one is named after its caption
("Lasith Malinga dismissed the openers in one over _ Cricinfo_com.jpeg"). They
are photographs of international cricketers: 120 action photos (batting,
bowling, celebrations) and 27 portraits (posed, trophy, one headshot). Seven
carry a press-agency watermark (Getty Images 3, PA 2, Ray Lawrence/TGS/REX 1,
"Image Courtesy: ICC" 1), so at least those are agency press photographs.

**Identification.** Nobody was identified from their face. What is visible was
recorded instead, in `src/data/pvp/zip-observations.json`: the team on the kit
(71 by the team's name printed on the shirt, 60 by kit colours only, 16 with no
team visible), the pose, the watermark. The only photo identified is the one
whose file name names the player. The other 146 are `UNIDENTIFIED` until you
label them.

| Kit | Photos |
|---|---|
| India | 27 |
| England | 20 |
| Australia | 20 |
| Pakistan | 19 |
| South Africa | 14 |
| New Zealand | 12 |
| West Indies | 10 |
| Sri Lanka | 6 |
| Afghanistan | 1 |
| T20 franchise kit | 2 |
| No team visible (whites, archive photos) | 16 |

**Rights.** Usage rights for these photos have not been confirmed. Several are
agency press photos. The game therefore publishes **no** photo by default.

## The pipeline: `npm run pvp:assets`

```
assets-src/players/Cricketcareer.zip
src/data/pvp/zip-observations.json   what each photo shows (reviewed)
src/data/pvp/zip-labels.json         YOU: who it is, and whether you hold the rights
src/data/pvp/real-players.json       verified player records (facts + sources)
        │
        ▼  node scripts/pvp-assets.mjs
src/data/pvp/asset-manifest.json     every photo: size, kit, pose, watermark, player, status
src/data/pvp/portraits.json          playerId -> photo, for approved photos only
public/assets/players/portraits/     the approved photos
```

A photo appears on a card only when it is **labelled with a known player** and
**`rightsConfirmed` is true**. The script refuses (exit 1) a label that points
at an unknown player, a label whose player's country contradicts a team name
printed on the kit, two approved photos for one player, and any photo that has
not been reviewed. `npm run pvp:assets -- --check` (also a test) fails when
the outputs are stale.

Status of each photo today: 0 `PUBLISHED`, 1 `IDENTIFIED_RIGHTS_UNCONFIRMED`
(Lasith Malinga), 146 `UNIDENTIFIED`.

### To put a photo on a card

1. Add the player to `src/data/pvp/real-players.json` with figures you have
   checked, labelled by format, and their sources (see the Malinga entry).
2. In `src/data/pvp/zip-labels.json`, set the photo's `player` to that id.
3. Once you hold the right to use the photo in the game, set
   `rightsConfirmed: true`.
4. Run `npm run pvp:assets`, then `npm test`.

Cards without an approved photo use the same neutral silhouette (real
players) or the procedural illustrated portrait (fictional players). No card
ever shows a photo of someone else, and no generated image is presented as a
photograph.

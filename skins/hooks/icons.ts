import type { Kind } from './skin'

// Vector icons and spinners for the surfaces that draw `Svg` (the desktop app). Each is a
// whole SVG document; animation is CSS, which plays in the image the desktop draws.

// cockpit patch: pixel icons. Each tool is an 8x8 bitmap drawn as square cells, so nothing is round.
const BITMAPS: Readonly<Record<Kind, readonly string[]>> = {
  run: ['#.......', '.#......', '..#.....', '.#......', '#.......', '........', '....####', '........'],
  write: ['......##', '.....###', '....###.', '...###..', '..###...', '.###....', '##......', '#.......'],
  read: ['#####...', '#....#..', '#....##.', '#.....#.', '#.###.#.', '#.....#.', '#.###.#.', '#######.'],
  search: ['.####...', '#....#..', '#....#..', '#....#..', '.####...', '....##..', '.....##.', '......##'],
  web: ['..####..', '.#.##.#.', '#..##..#', '########', '#..##..#', '#..##..#', '.#.##.#.', '..####..'],
  mcp: ['..#..#..', '..#..#..', '########', '#......#', '#......#', '.#....#.', '..#..#..', '...##...'],
  other: ['........', '........', '..####..', '..####..', '..####..', '..####..', '........', '........'],
}

const BLINK = '.blink{animation:blink .8s steps(2,end) infinite}@keyframes blink{50%{opacity:.25}}@media (prefers-reduced-motion:reduce){.blink{animation:none}}'

const svg = (size: number, style: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" shape-rendering="crispEdges"><style>${style}</style>${body}</svg>`

// A tool's icon; while it runs, it blinks in steps like a terminal cursor.
export function toolIcon(kind: Kind, color: string, isRunning: boolean): string {
  const cells = BITMAPS[kind]
    .flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `<rect x="${x * 3}" y="${y * 3}" width="3" height="3"/>` : '')))
    .join('')

  return svg(16, isRunning ? BLINK : '', `<g class="${isRunning ? 'blink' : ''}" fill="${color}">${cells}</g>`)
}

export type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

// One stepped motion per thing the turn is doing, all square: three pixels pulse while it
// thinks, a ring of pixels chases while a tool runs, blocky bars rise while it writes, and
// three pixels blink while it waits.
const PX = '@media (prefers-reduced-motion:reduce){.px{animation:none!important;opacity:1!important}}'

export function spinnerIcon(mode: SpinnerMode, color: string): string {
  const fill = `fill="${color}"`

  switch (mode) {
    case 'thinking':
      return svg(
        20,
        `.px{animation:pulse 1.2s steps(1,end) infinite}.p2{animation-delay:.2s}.p3{animation-delay:.4s}@keyframes pulse{0%,100%{opacity:.25}33%{opacity:1}}${PX}`,
        [4, 10, 16].map((x, i) => `<rect class="px p${i + 1}" x="${x}" y="9" width="5" height="5" ${fill}/>`).join(''),
      )
    case 'tool-use': {
      const ring = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]]
      return svg(
        20,
        `.px{animation:chase .8s steps(1,end) infinite}@keyframes chase{0%{opacity:1}50%{opacity:.5}87%{opacity:.2}}${PX}`,
        ring
          .map(([x, y], i) => `<rect class="px" style="animation-delay:${(i * 0.1).toFixed(1)}s" x="${3 + x * 6}" y="${3 + y * 6}" width="6" height="6" ${fill}/>`)
          .join(''),
      )
    }
    case 'responding':
      return svg(
        20,
        `.px{transform-box:fill-box;transform-origin:center bottom;animation:eq .8s steps(4,end) infinite}.b2{animation-delay:.15s}.b3{animation-delay:.3s}@keyframes eq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}${PX}`,
        [4, 10, 16].map((x, i) => `<rect class="px b${i + 1}" x="${x}" y="5" width="4" height="14" ${fill}/>`).join(''),
      )
    default:
      return svg(
        20,
        `.px{animation:wait 1.2s steps(1,end) infinite}.d2{animation-delay:.2s}.d3{animation-delay:.4s}@keyframes wait{0%,100%{opacity:.3}33%{opacity:1}}${PX}`,
        [4, 10, 16].map((x, i) => `<rect class="px d${i + 1}" x="${x}" y="11" width="4" height="4" ${fill}/>`).join(''),
      )
  }
}

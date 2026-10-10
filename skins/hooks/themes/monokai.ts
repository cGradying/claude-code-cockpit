import type { Skin } from '../skin'

const skin: Skin = {
  name: 'monokai',
  label: 'Monokai',
  palette: {
    read: '#66d9ef',
    write: '#fd971f',
    run: '#e6db74',
    search: '#ae81ff',
    web: '#f92672',
    mcp: '#a6e22e',
    other: '#f8f8f2',
    user: '#a6e22e',
    fg: '#f8f8f2',
    muted: '#75715e',
    surface: '#31322b',
    zebra: '#2c2d26',
    ok: '#a6e22e',
    err: '#f92672',
    warn: '#e6db74',
  },
  spinner: ['Tokenizing', 'Highlighting', 'Parsing', 'Lexing', 'Compiling', 'Brewing'],
  done: ['Highlighted', 'Parsed', 'Compiled', 'Shipped'],
}

export default skin

// ============================================================
//  Registry — danh sách toàn bộ slash commands của bot
// ============================================================
import play from './play.js'
import pause from './pause.js'
import resume from './resume.js'
import skip from './skip.js'
import stop from './stop.js'
import leave from './leave.js'
import queue from './queue.js'
import nowplaying from './nowplaying.js'
import volume from './volume.js'
import loop from './loop.js'
import shuffle from './shuffle.js'
import remove from './remove.js'
import seek from './seek.js'
import filter from './filter.js'
import lyrics from './lyrics.js'
import help from './help.js'

export const commands = [
  play,
  pause,
  resume,
  skip,
  stop,
  leave,
  queue,
  nowplaying,
  volume,
  loop,
  shuffle,
  remove,
  seek,
  filter,
  lyrics,
  help
]

export const commandMap = new Map(commands.map((cmd) => [cmd.data.name, cmd]))

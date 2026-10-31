// ============================================================
//  NodeLink Music Bot — entry point
//  discord.js v14 + NodeLink (Lavalink v4-compatible)
//
//  Luồng hoạt động:
//   1. Kết nối Discord Gateway + NodeLink WebSocket
//   2. Bắt raw voice events của Discord -> gửi voice tới NodeLink qua REST
//   3. Slash commands điều khiển player (queue/loop/filters...)
//   4. NodeLink phát nhạc và đẩy event về (TrackStart/TrackEnd...)
// ============================================================
import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js'
import { config } from './config.js'
import NodelinkClient from './nodelink/NodelinkClient.js'
import { PlayerManager } from './nodelink/MusicPlayer.js'
import { commands, commandMap } from './commands/index.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
})

// --- Kết nối NodeLink node ---
const nodelink = new NodelinkClient(config.nodelink)
nodelink.connect()

// --- Quản lý player từng server ---
const manager = new PlayerManager(client, nodelink, {
  defaultVolume: config.music.defaultVolume,
  maxQueueSize: config.music.maxQueueSize
})

// --- Context dùng chung cho mọi lệnh ---
const ctx = { client, nodelink, manager, config, nodeInfo: null }

client.once(Events.ClientReady, async (c) => {
  console.log('════════════════════════════════════════')
  console.log(`🤖 Bot đã đăng nhập: ${c.user.tag}`)
  console.log(`🛰️ NodeLink: ${nodelink.httpBase} (WS: ${nodelink.wsUrl})`)
  console.log('════════════════════════════════════════')

  // Đăng ký slash commands
  const body = commands.map((cmd) => cmd.data)
  try {
    if (config.discord.guildId) {
      const guild = await c.guilds.fetch(config.discord.guildId)
      await guild.commands.set(body)
      console.log(`✅ Đã đăng ký ${body.length} lệnh vào server "${guild.name}" (hiển thị ngay lập tức)`)
    } else {
      await c.application.commands.set(body)
      console.log(`✅ Đã đăng ký ${body.length} lệnh GLOBAL (Discord có thể mất tới ~1 giờ để hiển thị).`)
      console.log('   💡 Mẹo: điền GUILD_ID vào .env để lệnh hiện ngay khi test 1 server.')
    }
  } catch (err) {
    console.error('❌ Đăng ký lệnh thất bại:', err.message)
  }

  // Lấy thông tin node để hiển thị trong /help
  try {
    ctx.nodeInfo = await nodelink.getInfo()
    console.log(`✅ NodeLink v${ctx.nodeInfo.version?.semver ?? '?'} sẵn sàng (${(ctx.nodeInfo.sourceManagers ?? []).length} nguồn nhạc)`)
  } catch {
    console.warn('⚠️ Chưa lấy được thông tin node (/v4/info) — bot vẫn chạy tiếp.')
  }

  c.user.setActivity('nhạc với NodeLink • /help', { type: ActivityType.Listening })
})

client.on(Events.InteractionCreate, async (interaction) => {
  // Autocomplete cho /play, /remove
  if (interaction.isAutocomplete()) {
    const cmd = commandMap.get(interaction.commandName)
    if (cmd?.autocomplete) {
      await cmd.autocomplete(interaction, ctx).catch(() => {})
    }
    return
  }

  if (!interaction.isChatInputCommand()) return
  const command = commandMap.get(interaction.commandName)
  if (!command) return

  try {
    await command.execute(interaction, ctx)
  } catch (err) {
    console.error(`[CMD /${interaction.commandName}]`, err)
    const payload = {
      content: '❌ Có lỗi không mong muốn khi chạy lệnh. Kiểm tra log của bot để biết chi tiết.',
      ephemeral: true
    }
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {})
    } else {
      await interaction.reply(payload).catch(() => {})
    }
  }
})

client.on(Events.Error, (err) => console.error('[DISCORD] Lỗi client:', err))
client.on(Events.ShardDisconnect, () => console.warn('[DISCORD] Shard ngắt kết nối — đang thử kết nối lại...'))

process.on('unhandledRejection', (err) => console.error('[PROCESS] Unhandled rejection:', err))

client.login(config.discord.token).catch((err) => {
  console.error('❌ Đăng nhập Discord thất bại — kiểm tra DISCORD_TOKEN trong .env:', err.message)
  process.exit(1)
})

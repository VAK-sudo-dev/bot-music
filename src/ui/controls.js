// ============================================================
//  controls.js — Hàng nút điều khiển trên tin nhắn Now Playing
// ============================================================
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js'

export const BTN = {
  pause: 'np:pause',
  skip: 'np:skip',
  stop: 'np:stop',
  loop: 'np:loop',
  shuffle: 'np:shuffle'
}

const LOOP_LABELS = {
  off: { label: 'Lặp: Tắt', emoji: '🔁' },
  track: { label: 'Lặp: 1 bài', emoji: '🔂' },
  queue: { label: 'Lặp: Hàng đợi', emoji: '🔁' }
}

export function buildControlRow(player) {
  const loop = LOOP_LABELS[player.loopMode] ?? LOOP_LABELS.off
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BTN.pause)
      .setLabel(player.paused ? 'Tiếp tục' : 'Tạm dừng')
      .setEmoji(player.paused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BTN.skip)
      .setLabel('Bỏ qua')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BTN.stop)
      .setLabel('Dừng')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(BTN.loop)
      .setLabel(loop.label)
      .setEmoji(loop.emoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BTN.shuffle)
      .setLabel(player.shuffle ? 'Xáo trộn: Bật' : 'Xáo trộn: Tắt')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary)
  )
}

function inSameVoice(interaction, player) {
  const memberChannel = interaction.member?.voice?.channelId
  return Boolean(memberChannel) && memberChannel === player.voice.channelId
}

/** Gắn collector xử lý nút bấm cho tin nhắn Now Playing */
export function attachControls(player, message) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: 900_000 // tự tắt sau 15 phút không ai bấm
  })
  player._npCollector = collector

  collector.on('collect', async (interaction) => {
    if (!inSameVoice(interaction, player)) {
      return interaction
        .reply({ content: '⚠️ Bạn phải đang ở trong kênh thoại với bot để điều khiển nhạc!', ephemeral: true })
        .catch(() => {})
    }

    try {
      switch (interaction.customId) {
        case BTN.pause: {
          const nextPaused = !player.paused
          await player.setPaused(nextPaused)
          player.paused = nextPaused
          await interaction.update({ components: [buildControlRow(player)] })
          break
        }
        case BTN.skip: {
          await interaction.deferUpdate()
          await player.skip()
          break
        }
        case BTN.stop: {
          await interaction.deferUpdate()
          await player.stop()
          break
        }
        case BTN.loop: {
          player.loopMode =
            player.loopMode === 'off' ? 'track' : player.loopMode === 'track' ? 'queue' : 'off'
          await interaction.update({ components: [buildControlRow(player)] })
          break
        }
        case BTN.shuffle: {
          player.shuffle = !player.shuffle
          if (player.shuffle) player.queue.sort(() => Math.random() - 0.5)
          await interaction.update({ components: [buildControlRow(player)] })
          break
        }
        default:
          await interaction.deferUpdate()
      }
    } catch (err) {
      console.error('[CONTROLS] Lỗi xử lý nút:', err.message)
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Có lỗi khi xử lý yêu cầu.', ephemeral: true }).catch(() => {})
      }
    }
  })

  collector.on('end', async () => {
    if (player._npMessage?.id !== message.id) return
    try {
      const rows = message.components.map((row) => {
        const newRow = ActionRowBuilder.from(row)
        newRow.components.forEach((btn) => btn.setDisabled(true))
        return newRow
      })
      await message.edit({ components: rows })
    } catch {
      /* tin nhắn có thể đã bị xoá */
    }
  })
}

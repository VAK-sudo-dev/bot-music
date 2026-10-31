// /filter — hiệu ứng âm thanh (bassboost, nightcore, vaporwave, 8d, karaoke...)
// NodeLink tự tắt các filter không có trong payload -> mỗi preset là "thay thế toàn bộ".
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const PRESETS = {
  bassboost: {
    label: 'Bass Boost',
    desc: 'Tăng bass mạnh (dải trầm 0-3)',
    filters: {
      equalizer: [
        { band: 0, gain: 0.6 },
        { band: 1, gain: 0.6 },
        { band: 2, gain: 0.5 },
        { band: 3, gain: 0.4 },
        { band: 4, gain: 0.2 }
      ]
    }
  },
  nightcore: {
    label: 'Nightcore',
    desc: 'Nhanh + cao hơn (kiểu anime)',
    filters: { timescale: { speed: 1.15, pitch: 1.15, rate: 1.0 } }
  },
  vaporwave: {
    label: 'Vaporwave',
    desc: 'Chậm + trầm hơn (kiểu retro)',
    filters: { timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 } }
  },
  '8d': {
    label: '8D',
    desc: 'Âm thanh xoay quanh đầu',
    filters: { rotation: { rotationHz: 0.2 } }
  },
  karaoke: {
    label: 'Karaoke',
    desc: 'Lọc bớt giọng hát chính',
    filters: { karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220, filterGain: 11 } }
  },
  tremolo: {
    label: 'Tremolo',
    desc: 'Rung biên độ kiểu sóng',
    filters: { tremolo: { frequency: 4, depth: 0.75 } }
  },
  vibrato: {
    label: 'Vibrato',
    desc: 'Rung cao độ',
    filters: { vibrato: { frequency: 4, depth: 0.75 } }
  },
  soft: {
    label: 'Soft',
    desc: 'Mềm, êm tai (lọc cao)',
    filters: { lowpass: { smoothing: 20 } }
  },
  off: {
    label: 'Tắt tất cả',
    desc: 'Xoá toàn bộ filter đang bật',
    filters: {}
  }
}

const data = new SlashCommandBuilder()
  .setName('filter')
  .setDescription('Bật hiệu ứng âm thanh cho nhạc đang phát')
  .addStringOption((opt) =>
    opt
      .setName('hieu_ung')
      .setDescription('Chọn hiệu ứng')
      .setRequired(true)
      .addChoices(
        { name: 'Bass Boost', value: 'bassboost' },
        { name: 'Nightcore', value: 'nightcore' },
        { name: 'Vaporwave', value: 'vaporwave' },
        { name: '8D (xoay âm thanh)', value: '8d' },
        { name: 'Karaoke (lọc giọng)', value: 'karaoke' },
        { name: 'Tremolo', value: 'tremolo' },
        { name: 'Vibrato', value: 'vibrato' },
        { name: 'Soft (êm tai)', value: 'soft' },
        { name: 'Tắt tất cả', value: 'off' }
      )
  )

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return

  const key = interaction.options.getString('hieu_ung', true)
  const preset = PRESETS[key]

  try {
    await player.setFilters(preset.filters)
  } catch (err) {
    return reply(interaction, `🛰️ Không đặt được filter: \`${err.message}\``)
  }

  const embed = new EmbedBuilder().setColor(0x5865f2)
  if (key === 'off') {
    embed.setDescription('🎚️ Đã **tắt tất cả** hiệu ứng âm thanh.')
  } else {
    const later = !player.current
    embed.setDescription(
      `🎚️ Đã bật hiệu ứng **${preset.label}** — *${preset.desc}*.` +
        (later ? '\n⚠️ Hiện chưa có bài phát — hiệu ứng sẽ áp dụng cho bài tiếp theo.' : '')
    )
  }
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ embeds: [embed] }).catch(() => {})
  } else {
    await interaction.reply({ embeds: [embed] }).catch(() => {})
  }
}

export default { data: data.toJSON(), execute }

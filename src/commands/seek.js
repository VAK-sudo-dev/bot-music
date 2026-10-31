// /seek — tua bài đang phát
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'
import { parseSeek, fmtTime } from '../utils/format.js'

const data = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Tua bài hát đến một thời điểm (VD: 1:30 hoặc 90)')
  .addStringOption((opt) =>
    opt.setName('thoi_gian').setDescription('Thời điểm (mm:ss / hh:mm:ss / số giây)').setRequired(true)
  )

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  if (!player.current) return reply(interaction, '💤 Không có bài nào đang phát cả.')

  const info = player.current.track.info
  if (info.isStream) return reply(interaction, '🔴 Không tua được stream trực tiếp!')

  const ms = parseSeek(interaction.options.getString('thoi_gian', true))
  if (ms === null) {
    return reply(interaction, '⏱️ Định dạng thời gian không đúng. Ví dụ hợp lệ: `1:30`, `2:05:10` hoặc `90`.')
  }
  if (ms > (info.length ?? 0)) {
    return reply(interaction, `⏱️ Bài này chỉ dài ${fmtTime(info.length ?? 0)} — đừng tua quá xa nha!`)
  }

  await player.seek(ms)
  await reply(interaction, `⏩ Đã tua tới **${fmtTime(ms)} / ${fmtTime(info.length ?? 0)}**.`)
}

export default { data: data.toJSON(), execute }

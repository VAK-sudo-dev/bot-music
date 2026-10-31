// ============================================================
//  _shared.js — Các hàm kiểm tra dùng chung cho mọi lệnh nhạc
// ============================================================

/** Kiểm tra voice + gắn player cho guild. Trả về player hoặc null (đã tự trả lời lỗi). */
export async function ensureVoice(interaction, ctx) {
  const memberVoice = interaction.member?.voice?.channel
  if (!memberVoice) {
    await reply(interaction, '🎙️ Bạn cần vào một **kênh thoại** trước đã!')
    return null
  }

  if (!ctx.nodelink.sessionId || !ctx.nodelink.connected) {
    await reply(interaction, '🛰️ Node nhạc (NodeLink) đang kết nối hoặc mất kết nối — thử lại sau vài giây nhé!')
    return null
  }

  const guild = interaction.guild
  const botVoice = guild.members.me?.voice?.channel ?? null

  if (botVoice && botVoice.id !== memberVoice.id) {
    await reply(interaction, `🚫 Mình đang phát nhạc trong kênh **${botVoice.name}**. Hãy vào đó để điều khiển nhé!`)
    return null
  }

  const player = ctx.manager.get(guild.id)
  player.textChannelId = interaction.channelId
  if (!botVoice) {
    player.joinVoiceChannel(memberVoice.id)
  }
  return player
}

/** Trả lời an toàn kể cả khi interaction đã defer */
export async function reply(interaction, content, ephemeral = false) {
  const payload = { content, ephemeral }
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload).catch(() => {})
  } else {
    await interaction.reply(payload).catch(() => {})
  }
}

/** Cho phép bot join kênh của người dùng nếu chưa có voice */
export function userChannelName(interaction) {
  return interaction.member?.voice?.channel?.name ?? 'kênh thoại'
}

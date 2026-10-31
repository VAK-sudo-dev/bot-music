// ============================================================
//  PlayerManager + GuildMusicPlayer
//  Quản lý hàng đợi, voice, loop/shuffle/filters cho từng server,
//  và xử lý các event NodeLink gửi về qua WebSocket.
// ============================================================
import { ChannelType } from 'discord.js'
import { sendNowPlaying, stopNowPlaying } from '../ui/embeds.js'
import { fmtTime, sourceLabel } from '../utils/format.js'

/* ============================ MANAGER ============================ */

export class PlayerManager {
  constructor(client, nodelink, { defaultVolume = 100, maxQueueSize = 500 } = {}) {
    this.client = client
    this.nodelink = nodelink
    this.defaultVolume = defaultVolume
    this.maxQueueSize = maxQueueSize
    this.players = new Map()

    this._wireNodelink()
    this._wireDiscord()
  }

  get(guildId) {
    let player = this.players.get(guildId)
    if (!player) {
      player = new GuildMusicPlayer(this, guildId)
      this.players.set(guildId, player)
    }
    return player
  }

  _wireNodelink() {
    const nl = this.nodelink

    nl.on('playerUpdate', (guildId, state) => {
      this.players.get(guildId)?.onPlayerUpdate(state)
    })

    nl.on('trackStart', (guildId, track) => {
      this.players.get(guildId)?.onTrackStart(track)
    })

    nl.on('trackEnd', (guildId, track, reason) => {
      this.players.get(guildId)?.onTrackEnd(track, reason)
    })

    nl.on('trackException', (guildId, track, exception) => {
      this.players.get(guildId)?.onTrackException(exception)
    })

    nl.on('trackStuck', (guildId) => {
      this.players.get(guildId)?.onTrackStuck()
    })

    nl.on('wsClosed', (guildId, code, reason) => {
      this.players.get(guildId)?.onWsClosed(code, reason)
    })

    // WS kết nối lại và NodeLink tạo session MỚI -> dựng lại các player
    nl.on('sessionReplaced', () => {
      console.warn('[NODELINK] WS reconnect với session mới — đang dựng lại các player...')
      for (const player of this.players.values()) player.onSessionReplaced()
    })

    nl.on('resumed', () => {
      console.log('[NODELINK] Đã resume session thành công.')
    })

    nl.on('error', (err) => {
      console.error('[NODELINK] Lỗi kết nối:', err.message)
    })

    nl.on('close', (code) => {
      console.warn(`[NODELINK] WS đóng (code ${code}) — sẽ tự kết nối lại...`)
    })
  }

  _wireDiscord() {
    // Bắt các gói raw từ Discord Gateway (cần cho Lavalink/NodeLink)
    this.client.ws.on('VOICE_STATE_UPDATE', (d) => this.handleRawVoiceState(d))
    this.client.ws.on('VOICE_SERVER_UPDATE', (d) => this.handleRawVoiceServer(d))

    // Tự rời kênh nếu voice channel chỉ còn bot
    this.client.on('voiceStateUpdate', async (oldState, newState) => {
      const botMember = newState.guild?.members?.me ?? oldState.guild?.members?.me
      if (!botMember) return
      const channel =
        newState.member?.id === botMember.id ? newState.channel ?? null : null
      const target =
        channel ?? (botMember.voice?.channelId ? await newState.guild.channels.fetch(botMember.voice.channelId).catch(() => null) : null)
      if (!target || target.type !== ChannelType.GuildVoice) return
      const humans = target.members.filter((m) => !m.user.bot).size
      if (humans === 0) {
        const player = this.players.get(target.guild.id)
        if (player && (player.current || player.queue.length > 0)) {
          await player.announceText('👋 Kênh thoại đã trống, mình out đây. Hẹn gặp lại!')
          await player.destroy(true)
        }
      }
    })
  }

  /** Raw VOICE_STATE_UPDATE từ Discord Gateway */
  handleRawVoiceState(d) {
    if (d.user_id !== this.client.user?.id) return
    const player = this.players.get(d.guild_id)
    if (!player) return
    if (d.channel_id === null) {
      // Bot bị kick/ngắt khỏi voice
      player.onVoiceDisconnected()
      return
    }
    player.voice.sessionId = d.session_id
    player.voice.channelId = d.channel_id
    player.maybeAttachVoice()
  }

  /** Raw VOICE_SERVER_UPDATE từ Discord Gateway */
  handleRawVoiceServer(d) {
    const player = this.players.get(d.guild_id)
    if (!player) return
    player.voice.token = d.token
    player.voice.endpoint = d.endpoint
    player.maybeAttachVoice()
  }
}

/* ========================= GUILD PLAYER ========================= */

export class GuildMusicPlayer {
  constructor(manager, guildId) {
    this.manager = manager
    this.guildId = guildId
    this.client = manager.client
    this.nodelink = manager.nodelink

    this.queue = [] // [{ track (track object NodeLink), requester: {id, tag} }]
    this.current = null // { track, requester }
    this.pendingTrack = null // entry chờ voice sẵn sàng
    this.loopMode = 'off' // 'off' | 'track' | 'queue'
    this.shuffle = false
    this.volume = manager.defaultVolume
    this.filters = {} // filter đang bật (bot-side)
    this.paused = false

    this.voice = { token: null, endpoint: null, sessionId: null, channelId: null }
    this.positionState = { position: 0, time: Date.now(), connected: false }
    this.textChannelId = null

    this._destroyed = false
  }

  /* ------------------- voice ------------------- */

  voiceReady() {
    return Boolean(this.voice.token && this.voice.endpoint && this.voice.sessionId)
  }

  joinVoiceChannel(channelId) {
    const guild = this.client.guilds.cache.get(this.guildId)
    guild?.shard?.send({
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: channelId,
        self_mute: false,
        self_deaf: true
      }
    })
    this.voice.channelId = channelId
  }

  leaveVoiceChannel() {
    const guild = this.client.guilds.cache.get(this.guildId)
    guild?.shard?.send({ op: 4, d: { guild_id: this.guildId, channel_id: null, self_mute: false, self_deaf: true } })
  }

  /** Khi đủ token+endpoint+sessionId -> báo NodeLink qua REST PATCH voice */
  async maybeAttachVoice() {
    if (!this.voiceReady() || this._destroyed) return
    try {
      const body = {
        voice: {
          token: this.voice.token,
          endpoint: this.voice.endpoint,
          sessionId: this.voice.sessionId,
          channelId: this.voice.channelId
        }
      }
      // Có bài chờ voice thì phát luôn trong cùng 1 request
      if (this.pendingTrack) {
        body.track = { encoded: this.pendingTrack.track.encoded, userData: this.pendingTrack.userData }
        this.current = this.pendingTrack
        this.pendingTrack = null
      }
      await this.nodelink.updatePlayer(this.guildId, body)
    } catch (err) {
      console.error(`[PLAYER ${this.guildId}] Lỗi gửi voice tới NodeLink:`, err.message)
    }
  }

  onVoiceDisconnected() {
    this.voice = { token: null, endpoint: null, sessionId: null, channelId: null }
    stopNowPlaying(this)
    this.current = null
    this.pendingTrack = null
    this.queue = []
  }

  /* ------------------- queue ------------------- */

  addTrack(track, requester) {
    this.queue.push({ track, requester, userData: { requesterId: requester?.id, requesterTag: requester?.tag } })
  }

  queueDuration() {
    return this.queue.reduce((sum, e) => sum + (e.track.info?.length ?? 0), 0)
  }

  getPosition() {
    const { position, time } = this.positionState
    if (this.paused) return position
    return Math.min(position + (Date.now() - time), this.current?.track?.info?.length ?? position)
  }

  /* ------------------- playback ------------------- */

  /** Phát entry tiếp theo trong queue (gọi khi chưa có current) */
  async startNext() {
    if (this._destroyed) return
    const next = this.queue.shift()
    if (!next) {
      this.current = null
      stopNowPlaying(this)
      return
    }
    await this.playEntry(next)
  }

  /** PATCH 1 entry lên NodeLink (đi kèm voice nếu đã sẵn sàng) */
  async playEntry(entry) {
    const userData = { requesterId: entry.requester?.id, requesterTag: entry.requester?.tag }
    const body = { track: { encoded: entry.track.encoded, userData } }
    if (this.voiceReady()) {
      body.voice = {
        token: this.voice.token,
        endpoint: this.voice.endpoint,
        sessionId: this.voice.sessionId,
        channelId: this.voice.channelId
      }
    } else {
      // Voice chưa sẵn sàng -> đợi Discord gửi voice event rồi PATCH cùng lúc
      this.pendingTrack = entry
    }
    this.current = entry
    try {
      await this.nodelink.updatePlayer(this.guildId, body)
    } catch (err) {
      console.error(`[PLAYER ${this.guildId}] Lỗi PATCH track:`, err.message)
      this.current = null
      throw err
    }
  }

  async skip() {
    if (!this.current && this.queue.length === 0) return false
    const next = this.queue.shift() ?? null
    stopNowPlaying(this)
    if (!next) {
      // Hết queue -> dừng track hiện tại
      this.current = null
      await this.nodelink.updatePlayer(this.guildId, { track: null }).catch(() => {})
      return true
    }
    await this.playEntry(next)
    return true
  }

  async stop() {
    this.queue = []
    this.current = null
    this.pendingTrack = null
    stopNowPlaying(this)
    await this.nodelink.updatePlayer(this.guildId, { track: null }).catch(() => {})
  }

  async seek(ms) {
    await this.nodelink.updatePlayer(this.guildId, { position: ms })
  }

  async setVolume(volume) {
    this.volume = Math.min(1000, Math.max(0, Math.round(volume)))
    await this.nodelink.updatePlayer(this.guildId, { volume: this.volume })
  }

  async setPaused(paused) {
    this.paused = paused
    await this.nodelink.updatePlayer(this.guildId, { paused })
  }

  /** Đặt filter (NodeLink tự tắt các filter không nằm trong payload) */
  async setFilters(filters) {
    this.filters = filters
    if (this.current) await this.nodelink.updatePlayer(this.guildId, { filters })
  }

  /* ------------------- NodeLink events ------------------- */

  onPlayerUpdate(state) {
    this.positionState = {
      position: state.position ?? 0,
      time: state.time ?? Date.now(),
      connected: state.connected ?? this.positionState.connected
    }
  }

  async onTrackStart(track) {
    if (!this.current) {
      // Track start mà chưa set current (ví dụ resume) — dựng lại entry từ userData
      this.current = {
        track,
        requester: { id: track.userData?.requesterId, tag: track.userData?.requesterTag ?? 'Không rõ' }
      }
    }
    this.paused = false
    // Áp lại filter đang bật (NodeLink giữ filter theo player, gửi lại cho chắc)
    if (Object.keys(this.filters).length > 0) {
      await this.nodelink.updatePlayer(this.guildId, { filters: this.filters }).catch(() => {})
    }
    await sendNowPlaying(this)
  }

  async onTrackEnd(_track, reason) {
    if (this._destroyed) return

    // 'replaced': ta chủ động PATCH track mới -> KHÔNG advance
    // 'stopped': ta chủ động stop -> KHÔNG advance
    // 'cleanup': player node-side bị huỷ -> chỉ gỡ current
    if (reason === 'replaced' || reason === 'stopped') return
    if (reason === 'cleanup') {
      this.current = null
      stopNowPlaying(this)
      return
    }

    if (reason === 'loadFailed') {
      await this.announceText('⚠️ Bài hát lỗi khi phát, mình chuyển bài tiếp theo nhé!')
    }

    const ended = this.current
    this.current = null
    stopNowPlaying(this)

    if (this.loopMode === 'track' && ended && reason === 'finished') {
      await this.playEntry(ended)
      return
    }

    if (this.loopMode === 'queue' && ended && reason === 'finished') {
      this.queue.push(ended)
    }

    await this.startNext()
  }

  async onTrackException(exception) {
    await this.announceText(`❌ Lỗi phát nhạc từ node: \`${exception?.message ?? 'không rõ'}\``)
  }

  async onTrackStuck() {
    await this.announceText('⏸️ Bài hát bị treo, mình thử chuyển bài nhé!')
    await this.skip()
  }

  /** Discord voice server đổi (VD: bot bị chuyển kênh, region move) */
  onWsClosed(code, reason) {
    console.warn(`[PLAYER ${this.guildId}] Voice WS của Discord đóng: ${code} ${reason}`)
    // NodeLink sẽ tự kết nối lại voice; nếu không được, gửi lại op4 để lấy token mới
    if (this.voice.channelId) this.joinVoiceChannel(this.voice.channelId)
  }

  /** WS NodeLink reconnect và nhận session mới -> dựng lại player */
  async onSessionReplaced() {
    if (this._destroyed) return
    try {
      if (this.current && this.voiceReady()) {
        await this.nodelink.updatePlayer(this.guildId, {
          track: { encoded: this.current.track.encoded, userData: this.current.userData ?? { requesterId: this.current.requester?.id, requesterTag: this.current.requester?.tag } },
          position: this.getPosition(),
          voice: {
            token: this.voice.token,
            endpoint: this.voice.endpoint,
            sessionId: this.voice.sessionId,
            channelId: this.voice.channelId
          }
        })
      } else if (this.voiceReady()) {
        await this.maybeAttachVoice()
      } else if (this.current && this.voice.channelId) {
        this.pendingTrack = this.current
        this.joinVoiceChannel(this.voice.channelId)
      }
    } catch (err) {
      console.error(`[PLAYER ${this.guildId}] Lỗi dựng lại player:`, err.message)
    }
  }

  /* ------------------- helpers ------------------- */

  async announceText(content) {
    const channel = await this._textChannel()
    if (channel) await announce(channel, content)
  }

  async _textChannel() {
    if (!this.textChannelId) return null
    try {
      const guild = this.client.guilds.cache.get(this.guildId)
      const channel = await guild?.channels.fetch(this.textChannelId)
      return channel?.type === ChannelType.GuildText ? channel : null
    } catch {
      return null
    }
  }

  /** Huỷ player: gỡ NP message, rời voice, xoá player node-side */
  async destroy(disconnect = false) {
    if (this._destroyed) return
    this._destroyed = true
    stopNowPlaying(this)
    this.queue = []
    this.current = null
    this.pendingTrack = null
    await this.nodelink.destroyPlayer(this.guildId)
    if (disconnect) this.leaveVoiceChannel()
    this.manager.players.delete(this.guildId)
  }

  describeSource() {
    return sourceLabel(this.current?.track?.info?.sourceName)
  }

  durationText() {
    const info = this.current?.track?.info
    if (!info) return ''
    if (info.isStream) return '🔴 LIVE'
    return fmtTime(info.length ?? 0)
  }
}

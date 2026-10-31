// ============================================================
//  NodelinkClient — client NodeLink (Lavalink v4-compatible) tối giản
//
//  Đã đối chiếu với source NodeLink v3 (PerformanC/NodeLink):
//   • WS: ws(s)://host:port/v4/websocket
//         headers: Authorization | Client-Name | User-Id | Session-Id (resume)
//         Gateway MỘT CHIỀU (server -> client), không gửi gì qua WS.
//   • Ready payload: { op:'ready', resumed, sessionId }
//   • Events: { op:'event', type: TrackStartEvent|TrackEndEvent|... }
//             { op:'playerUpdate', guildId, state:{position,time,connected,ping} }
//   • REST: GET  /v4/loadtracks?identifier=...
//           GET  /v4/loadlyrics?encodedTrack=...
//           PATCH /v4/sessions/{sessionId}/players/{guildId}?noReplace=
//           DELETE /v4/sessions/{sessionId}/players/{guildId}
//           GET  /v4/info | /v4/stats
// ============================================================
import WebSocket from 'ws'

export default class NodelinkClient {
  constructor({ host, port, secure, password, userId, name }) {
    this.host = host
    this.port = port
    this.secure = Boolean(secure)
    this.password = password
    this.userId = userId
    this.name = name

    this.ws = null
    this.sessionId = null
    this.connected = false
    this.stats = null
    this._reconnectDelay = 2000
    this._destroyed = false
  }

  get httpBase() {
    return `http${this.secure ? 's' : ''}://${this.host}:${this.port}`
  }

  get wsUrl() {
    return `ws${this.secure ? 's' : ''}://${this.host}:${this.port}/v4/websocket`
  }

  _headers() {
    const headers = {
      Authorization: this.password,
      'Client-Name': `${this.name}/1.0.0`,
      'User-Id': this.userId,
      'Num-Shards': '1'
    }
    // NodeLink hỗ trợ resume: gửi Session-Id cũ khi kết nối lại
    if (this.sessionId) headers['Session-Id'] = this.sessionId
    return headers
  }

  connect() {
    if (this._destroyed) return
    this.ws = new WebSocket(this.wsUrl, { headers: this._headers() })

    this.ws.on('open', () => {
      this.connected = true
      this._reconnectDelay = 2000
    })

    this.ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      this._handleMessage(msg)
    })

    this.ws.on('close', (code, reason) => {
      this.connected = false
      this.emitSafe('close', code, reason.toString())
      if (!this._destroyed) {
        setTimeout(() => this.connect(), this._reconnectDelay)
        this._reconnectDelay = Math.min(this._reconnectDelay * 2, 60000)
      }
    })

    this.ws.on('error', (err) => {
      this.emitSafe('error', err)
    })
  }

  _handleMessage(msg) {
    switch (msg.op) {
      case 'ready': {
        const resumed = Boolean(msg.resumed)
        const oldSession = this.sessionId
        this.sessionId = msg.sessionId
        this.emitSafe('ready', msg.sessionId, resumed)
        if (resumed) this.emitSafe('resumed', msg.sessionId)
        else if (oldSession) this.emitSafe('sessionReplaced', msg.sessionId)
        break
      }
      case 'event':
        this._handleEvent(msg)
        break
      case 'playerUpdate':
        this.emitSafe('playerUpdate', msg.guildId, msg.state)
        break
      case 'stats':
        this.stats = msg
        this.emitSafe('stats', msg)
        break
      default:
        this.emitSafe('message', msg)
    }
  }

  _handleEvent(msg) {
    switch (msg.type) {
      case 'TrackStartEvent':
        this.emitSafe('trackStart', msg.guildId, msg.track)
        break
      case 'TrackEndEvent':
        this.emitSafe('trackEnd', msg.guildId, msg.track, msg.reason)
        break
      case 'TrackExceptionEvent':
        this.emitSafe('trackException', msg.guildId, msg.track, msg.exception)
        break
      case 'TrackStuckEvent':
        this.emitSafe('trackStuck', msg.guildId, msg.track, msg.thresholdMs)
        break
      case 'WebSocketClosedEvent':
        this.emitSafe('wsClosed', msg.guildId, msg.code, msg.reason, msg.byRemote)
        break
      default:
        // VolumeChangedEvent, FiltersChangedEvent, PauseEvent, SeekEvent... (đặc thù NodeLink)
        this.emitSafe('nodeEvent', msg)
    }
  }

  emitSafe(event, ...args) {
    if (this.listenerCount(event) > 0) this.emit(event, ...args)
  }

  /* ------------------------- REST ------------------------- */

  async _request(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${this.httpBase}${path}`, {
      method,
      headers: {
        Authorization: this.password,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }
    if (!res.ok) {
      const detail = json?.message || json?.error || text || res.statusText
      throw new Error(`NodeLink ${res.status}: ${detail}`)
    }
    return json
  }

  /** Tìm/resolve bài hát. Xem phần prefix ở README (ytsearch:, scsearch:, spsearch:, dzsearch:... hoặc URL) */
  async loadTracks(identifier) {
    return this._request(`/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`)
  }

  /** Lấy lyrics của 1 track (dựa vào track.encoded) */
  async loadLyrics(encodedTrack) {
    return this._request(`/v4/loadlyrics?encodedTrack=${encodeURIComponent(encodedTrack)}`)
  }

  /**
   * Cập nhật player (tạo mới nếu chưa có).
   * body: { track?, position?, volume?, paused?, voice?, filters?, endTime? }
   * track: { encoded, userData } hoặc null để dừng phát.
   * voice: { token, endpoint, sessionId, channelId }
   */
  async updatePlayer(guildId, body, { noReplace = false } = {}) {
    if (!this.sessionId) throw new Error('Chưa có session với NodeLink (chưa kết nối WS)')
    const path = `/v4/sessions/${this.sessionId}/players/${guildId}?noReplace=${noReplace}`
    return this._request(path, { method: 'PATCH', body })
  }

  async getPlayer(guildId) {
    if (!this.sessionId) return null
    return this._request(`/v4/sessions/${this.sessionId}/players/${guildId}`)
  }

  async destroyPlayer(guildId) {
    if (!this.sessionId) return
    try {
      await this._request(`/v4/sessions/${this.sessionId}/players/${guildId}`, { method: 'DELETE' })
    } catch {
      /* player có thể đã bị xoá — bỏ qua */
    }
  }

  async getInfo() {
    return this._request('/v4/info')
  }

  /* ------------------- EventEmitter nhỏ gọn ------------------- */

  on(event, listener) {
    this._events ??= {}
    ;(this._events[event] ??= []).push(listener)
    return this
  }

  listenerCount(event) {
    return this._events?.[event]?.length ?? 0
  }

  emit(event, ...args) {
    const listeners = this._events?.[event]
    if (!listeners) return
    for (const fn of listeners) {
      try {
        fn(...args)
      } catch (err) {
        console.error(`[NODELINK] Lỗi trong listener "${event}":`, err)
      }
    }
  }

  destroy() {
    this._destroyed = true
    try {
      this.ws?.close()
    } catch {
      /* bỏ qua */
    }
  }
}

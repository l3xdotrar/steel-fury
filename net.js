// ============================================================
// STEEL FURY — NETWORKING LAYER (net.js)
// PeerJS-based transport for public multiplayer lobbies.
// This file knows nothing about tanks/physics — it only moves
// messages around and keeps a live public lobby directory.
// Exposes a single global: window.NET
// ============================================================

(function () {
  'use strict';

  // A fixed, well-known Peer ID. Whoever claims it first becomes the
  // "directory" for this session — an in-memory public lobby list that
  // everyone else connects to. If that tab closes, the ID frees up and
  // the next browser that checks automatically claims it. This is how
  // we get a public lobby list with zero custom backend, using only
  // PeerJS's free cloud broker for signalling.
  const DIRECTORY_ID = 'steelfury-lobby-directory-v1';
  const MAX_PLAYERS = 8;
  const HEARTBEAT_INTERVAL = 8000;
  const HEARTBEAT_TIMEOUT = 22000;
  const DIR_RETRY_DELAY = 3000;

  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ]
  };

  // ---------------- core state ----------------
  let myPeer = null;
  let myId = null;
  let role = null;              // 'host' | 'client' | null
  let hostConn = null;          // client: DataConnection to the host
  let clientConns = {};         // host: { peerId: DataConnection }
  let myLobby = null;           // host: { id, name, hostName, maxPlayers }

  // ---------------- directory state ----------------
  let isDirectoryHost = false;
  let dirPeer = null;           // set only if we ARE the directory
  let dirConn = null;           // set only if we're a CLIENT of the directory
  let dirLobbies = new Map();   // meaningful only if isDirectoryHost
  let dirBrowsers = new Set();  // meaningful only if isDirectoryHost: conns currently browsing
  let dirHeartbeats = new Map();// meaningful only if isDirectoryHost: id -> last heartbeat time
  let dirPruneTimer = null;
  let heartbeatTimer = null;
  let dirRetryTimer = null;
  let wantDirectory = false;    // true while we're in the multiplayer flow

  // ---------------- events ----------------
  const handlers = {};
  function on(name, cb) { handlers[name] = cb; }
  function emit(name, ...args) { if (handlers[name]) handlers[name](...args); }

  function randomName() {
    return 'Commander' + Math.floor(100 + Math.random() * 900);
  }

  // ============================================================
  // DIRECTORY (public lobby list)
  // ============================================================

  function pushLobbyListToBrowsers() {
    const list = Array.from(dirLobbies.values());
    for (const conn of dirBrowsers) {
      if (conn.open) conn.send({ type: 'lobby-list', lobbies: list });
    }
    // If we are also browsing locally (we hold the directory ourselves).
    if (isDirectoryHost) emit('lobby-list', list);
  }

  function dirPruneStale() {
    const now = Date.now();
    let changed = false;
    for (const [id, last] of dirHeartbeats) {
      if (now - last > HEARTBEAT_TIMEOUT) {
        dirHeartbeats.delete(id);
        if (dirLobbies.delete(id)) changed = true;
      }
    }
    if (changed) pushLobbyListToBrowsers();
  }

  function handleDirectoryMessage(msg, conn) {
    switch (msg.type) {
      case 'register':
        dirLobbies.set(msg.lobby.id, msg.lobby);
        dirHeartbeats.set(msg.lobby.id, Date.now());
        pushLobbyListToBrowsers();
        break;
      case 'unregister':
        dirLobbies.delete(msg.id);
        dirHeartbeats.delete(msg.id);
        pushLobbyListToBrowsers();
        break;
      case 'update':
        if (dirLobbies.has(msg.id)) {
          dirLobbies.get(msg.id).playerCount = msg.playerCount;
          dirHeartbeats.set(msg.id, Date.now());
          pushLobbyListToBrowsers();
        }
        break;
      case 'heartbeat':
        if (dirLobbies.has(msg.id)) dirHeartbeats.set(msg.id, Date.now());
        break;
      case 'list':
        dirBrowsers.add(conn);
        if (conn.open) conn.send({ type: 'lobby-list', lobbies: Array.from(dirLobbies.values()) });
        break;
      case 'stop-browsing':
        dirBrowsers.delete(conn);
        break;
    }
  }

  // Become the directory, or fail over to connecting to whoever holds it.
  function tryClaimDirectory() {
    if (!wantDirectory) return;
    let settled = false;
    const candidate = new window.Peer(DIRECTORY_ID, { config: ICE_CONFIG, debug: 0 });

    candidate.on('open', () => {
      if (settled || !wantDirectory) { candidate.destroy(); return; }
      settled = true;
      isDirectoryHost = true;
      dirPeer = candidate;
      dirLobbies = new Map();
      dirBrowsers = new Set();
      dirHeartbeats = new Map();
      dirPeer.on('connection', conn => {
        conn.on('data', data => handleDirectoryMessage(data, conn));
        conn.on('close', () => dirBrowsers.delete(conn));
      });
      dirPeer.on('disconnected', () => { if (wantDirectory) { try { dirPeer.reconnect(); } catch (e) {} } });
      dirPeer.on('error', () => {});
      dirPruneTimer = setInterval(dirPruneStale, HEARTBEAT_INTERVAL);
      // If we created a lobby before winning the directory, list it now.
      if (myLobby) { dirLobbies.set(myLobby.id, myLobby); dirHeartbeats.set(myLobby.id, Date.now()); }
      emit('directory-ready');
    });

    candidate.on('error', err => {
      if (settled) return;
      settled = true;
      candidate.destroy();
      if (err && err.type === 'unavailable-id') {
        connectAsDirectoryClient();
      } else {
        // Broker unreachable or similar — retry shortly.
        dirRetryTimer = setTimeout(tryClaimDirectory, DIR_RETRY_DELAY);
      }
    });
  }

  function connectAsDirectoryClient() {
    if (!wantDirectory || !myPeer) return;
    const conn = myPeer.connect(DIRECTORY_ID, { reliable: true });
    let opened = false;
    conn.on('open', () => {
      opened = true;
      dirConn = conn;
      dirConn.send({ type: 'list' });
      emit('directory-ready');
      if (myLobby) dirConn.send({ type: 'register', lobby: myLobby });
    });
    conn.on('data', data => {
      if (data.type === 'lobby-list') emit('lobby-list', data.lobbies);
    });
    conn.on('close', () => {
      dirConn = null;
      if (wantDirectory) dirRetryTimer = setTimeout(tryClaimDirectory, 400);
    });
    conn.on('error', () => {
      if (!opened && wantDirectory) dirRetryTimer = setTimeout(tryClaimDirectory, DIR_RETRY_DELAY);
    });
  }

  function dirSend(msg) {
    if (isDirectoryHost) { handleDirectoryMessage(msg, null); return; }
    if (dirConn && dirConn.open) dirConn.send(msg);
  }

  function requestLobbyList() {
    if (isDirectoryHost) { pushLobbyListToBrowsers(); return; }
    if (dirConn && dirConn.open) dirConn.send({ type: 'list' });
  }

  // ============================================================
  // GAMEPLAY PEER (hosting / joining actual lobbies)
  // ============================================================

  function enterMultiplayer(onReady, onError) {
    wantDirectory = true;
    myPeer = new window.Peer(undefined, { config: ICE_CONFIG, debug: 0 });
    myPeer.on('open', id => {
      myId = id;
      myPeer.on('connection', conn => setupIncomingConnection(conn));
      myPeer.on('error', err => { emit('peer-error', err); });
      tryClaimDirectory();
      if (onReady) onReady(id);
    });
    myPeer.on('error', err => {
      if (onError) onError(err);
    });
  }

  function exitMultiplayer() {
    wantDirectory = false;
    clearTimeout(dirRetryTimer);
    clearInterval(dirPruneTimer);
    clearInterval(heartbeatTimer);
    closeLobby();
    leave();
    if (dirConn) { try { dirConn.close(); } catch (e) {} dirConn = null; }
    if (dirPeer) { try { dirPeer.destroy(); } catch (e) {} dirPeer = null; }
    isDirectoryHost = false;
    dirLobbies = new Map();
    dirBrowsers = new Set();
    dirHeartbeats = new Map();
    if (myPeer) { try { myPeer.destroy(); } catch (e) {} myPeer = null; }
    myId = null;
    role = null;
  }

  // ---------------- hosting ----------------

  function setupIncomingConnection(conn) {
    conn.on('data', data => {
      if (data.type === 'join-request') {
        emit('join-request', conn, data);
      } else if (role === 'host') {
        if (data.type === 'input') emit('client-input', conn.peer, data.input);
        else if (data.type === 'leave') emit('peer-left', conn.peer);
      }
    });
    conn.on('close', () => {
      if (role === 'host') {
        delete clientConns[conn.peer];
        emit('peer-left', conn.peer);
      }
    });
    conn.on('error', () => {});
  }

  function hostLobby(opts) {
    role = 'host';
    myLobby = {
      id: myId,
      name: (opts.name || "Commander's Lobby").slice(0, 40),
      hostName: (opts.hostName || randomName()).slice(0, 20),
      maxPlayers: MAX_PLAYERS,
      playerCount: 1,
    };
    clientConns = {};
    dirSend({ type: 'register', lobby: myLobby });
    heartbeatTimer = setInterval(() => {
      if (myLobby) dirSend({ type: 'heartbeat', id: myLobby.id });
    }, HEARTBEAT_INTERVAL);
    return myId;
  }

  function acceptJoin(conn, payload) {
    clientConns[conn.peer] = conn;
    conn.send({ type: 'join-accepted', payload });
    updateLobbyCount(Object.keys(clientConns).length + 1);
  }

  function rejectJoin(conn, reason) {
    conn.send({ type: 'join-rejected', reason });
    setTimeout(() => { try { conn.close(); } catch (e) {} }, 200);
  }

  function updateLobbyCount(n) {
    if (myLobby) { myLobby.playerCount = n; dirSend({ type: 'update', id: myLobby.id, playerCount: n }); }
  }

  function updateRoster(roster) {
    broadcastToClients({ type: 'roster-update', roster });
  }

  function startMatch(payload) {
    dirSend({ type: 'unregister', id: myId });
    clearInterval(heartbeatTimer);
    broadcastToClients({ type: 'match-start', payload });
  }

  function endMatch(reason) {
    broadcastToClients({ type: 'match-end', reason: reason || 'Host ended the match.' });
  }

  function closeLobby() {
    if (role !== 'host') return;
    if (myLobby) dirSend({ type: 'unregister', id: myLobby.id });
    clearInterval(heartbeatTimer);
    for (const id in clientConns) { try { clientConns[id].close(); } catch (e) {} }
    clientConns = {};
    myLobby = null;
    role = null;
  }

  function broadcastToClients(msg) {
    for (const id in clientConns) {
      const c = clientConns[id];
      if (c.open) c.send(msg);
    }
  }

  function sendToClient(peerId, msg) {
    const c = clientConns[peerId];
    if (c && c.open) c.send(msg);
  }

  function kickClient(peerId) {
    const c = clientConns[peerId];
    if (c) { try { c.close(); } catch (e) {} }
    delete clientConns[peerId];
  }

  // ---------------- joining ----------------

  function joinLobby(lobbyId, joinInfo) {
    role = 'client';
    const conn = myPeer.connect(lobbyId, { reliable: true });
    hostConn = conn;
    conn.on('open', () => {
      conn.send({ type: 'join-request', name: joinInfo.name, tankIdx: joinInfo.tankIdx });
    });
    conn.on('data', data => {
      switch (data.type) {
        case 'join-accepted': emit('join-accepted', data.payload); break;
        case 'join-rejected': emit('join-rejected', data.reason); role = null; hostConn = null; break;
        case 'roster-update': emit('roster-update', data.roster); break;
        case 'match-start': emit('match-start', data.payload); break;
        case 'snapshot': emit('snapshot', data.snapshot); break;
        case 'fx': emit('fx', data.fx); break;
        case 'match-end': emit('match-ended', data.reason); break;
        case 'peer-left': emit('peer-left', data.id); break;
      }
    });
    conn.on('close', () => { if (role === 'client') emit('host-closed'); });
    conn.on('error', () => { emit('join-rejected', 'Connection error.'); });
  }

  function sendToHost(msg) {
    if (hostConn && hostConn.open) hostConn.send(msg);
  }

  function sendInput(input) {
    if (hostConn && hostConn.open) hostConn.send({ type: 'input', input });
  }

  function leave() {
    if (role === 'client' && hostConn) {
      try { hostConn.send({ type: 'leave' }); hostConn.close(); } catch (e) {}
    }
    hostConn = null;
    if (role === 'client') role = null;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  window.NET = {
    on,
    enterMultiplayer,
    exitMultiplayer,
    requestLobbyList,
    hostLobby,
    acceptJoin,
    rejectJoin,
    updateRoster,
    updateLobbyCount,
    startMatch,
    endMatch,
    closeLobby,
    broadcastToClients,
    sendToClient,
    kickClient,
    joinLobby,
    sendToHost,
    sendInput,
    leave,
    get myId() { return myId; },
    get role() { return role; },
    get connectedCount() { return Object.keys(clientConns).length; },
    randomName,
    MAX_PLAYERS,
  };
})();

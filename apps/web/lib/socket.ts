"use client"

import { io, type Socket } from "socket.io-client"
import { getAccessToken } from "./api"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001"

let socket: Socket | null = null

/** Singleton socket connected to the realtime microservice (authed via JWT). */
export function getSocket(): Socket {
  if (socket) {
    if (!socket.connected) socket.connect()
    return socket
  }
  socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ["websocket"],
    auth: { token: getAccessToken() },
  })
  return socket
}

/** Refresh the auth token used by the socket (call after login / refresh). */
export function refreshSocketAuth() {
  if (socket) {
    socket.auth = { token: getAccessToken() }
    if (socket.connected) {
      socket.disconnect().connect()
    }
  }
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

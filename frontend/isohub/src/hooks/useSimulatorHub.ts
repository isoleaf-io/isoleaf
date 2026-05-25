import { useCallback, useEffect, useRef, useState } from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { HUB_URL } from "@/api/client";
import type { MessageLogEntry, SimulatorSession } from "@/types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface SimulatorHubEvents {
  onMessageReceived?: (entry: MessageLogEntry) => void;
  onMessageSent?: (entry: MessageLogEntry) => void;
  onSessionStarted?: (session: SimulatorSession) => void;
  onSessionStopped?: (session: SimulatorSession) => void;
  onError?: (payload: { sessionId: string; error: string }) => void;
}

/**
 * SignalR client for the simulator hub. Auto-reconnects with exponential backoff
 * and exposes joinSession/leaveSession for per-session subscriptions.
 */
export function useSimulatorHub(events: SimulatorHubEvents = {}) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const connectionRef = useRef<HubConnection | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    let stopped = false;

    const conn = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();

    connectionRef.current = conn;

    conn.on("OnMessageReceived", (entry: MessageLogEntry) =>
      eventsRef.current.onMessageReceived?.(entry)
    );
    conn.on("OnMessageSent", (entry: MessageLogEntry) =>
      eventsRef.current.onMessageSent?.(entry)
    );
    conn.on("OnSessionStarted", (s: SimulatorSession) =>
      eventsRef.current.onSessionStarted?.(s)
    );
    conn.on("OnSessionStopped", (s: SimulatorSession) =>
      eventsRef.current.onSessionStopped?.(s)
    );
    conn.on("OnError", (payload: { sessionId: string; error: string }) =>
      eventsRef.current.onError?.(payload)
    );

    conn.onreconnecting(() => setStatus("connecting"));
    conn.onreconnected(() => setStatus("connected"));
    conn.onclose(() => !stopped && setStatus("disconnected"));

    setStatus("connecting");
    conn
      .start()
      .then(() => !stopped && setStatus("connected"))
      .catch(() => !stopped && setStatus("error"));

    return () => {
      stopped = true;
      conn.stop().catch(() => {});
      connectionRef.current = null;
    };
  }, []);

  const joinSession = useCallback(async (sessionId: string) => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== HubConnectionState.Connected) return;
    try {
      await conn.invoke("JoinSession", sessionId);
    } catch {
      /* swallow — auto-reconnect will retry */
    }
  }, []);

  const leaveSession = useCallback(async (sessionId: string) => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== HubConnectionState.Connected) return;
    try {
      await conn.invoke("LeaveSession", sessionId);
    } catch {
      /* ignore */
    }
  }, []);

  const reconnect = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn) return;
    if (conn.state === HubConnectionState.Disconnected) {
      setStatus("connecting");
      try {
        await conn.start();
        setStatus("connected");
      } catch {
        setStatus("error");
      }
    }
  }, []);

  return { status, joinSession, leaveSession, reconnect };
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { getSimulatorHubUrl } from "@/api/client";
import { useAgentConnectionStore } from "@/store/agentConnection";
import type { MessageLogEntry, SimulatorSession } from "@/types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error" | "unconfigured";

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
 *
 * Sprint 12.2 P5+ — the hub URL is derived from the operator-configured Agent
 * base URL (Workspace page). While unconfigured the hook stays in status
 * "unconfigured" without attempting a connection; once the URL changes we
 * tear down the old connection and reconnect to the new host.
 */
export function useSimulatorHub(events: SimulatorHubEvents = {}) {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const [status, setStatus] = useState<ConnectionStatus>(
    agentUrl ? "connecting" : "unconfigured",
  );
  const connectionRef = useRef<HubConnection | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    // No Agent configured — skip the connect and reflect that in the badge.
    const hubUrl = getSimulatorHubUrl();
    if (!hubUrl) {
      setStatus("unconfigured");
      return;
    }

    let stopped = false;

    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl)
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
    // Re-run when the operator changes the Agent URL from the Workspace.
  }, [agentUrl]);

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

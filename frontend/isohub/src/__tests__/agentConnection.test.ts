import { beforeEach, describe, expect, it } from "vitest";
import {
  normalizeAgentUrl,
  useAgentConnectionStore,
} from "@/store/agentConnection";

const STORAGE_KEY = "isoleaf.agentBaseUrl";

describe("agentConnection store", () => {
  beforeEach(() => {
    // Reset both the persisted layer and the in-memory store so cases
    // don't leak state through localStorage or zustand's module cache.
    window.localStorage.removeItem(STORAGE_KEY);
    useAgentConnectionStore.setState({
      agentUrl: null,
      status: "idle",
      errorMessage: null,
    });
  });

  describe("normalizeAgentUrl", () => {
    it("trims surrounding whitespace", () => {
      expect(normalizeAgentUrl("   http://localhost:8583   ")).toBe("http://localhost:8583");
    });

    it("strips a single trailing slash", () => {
      expect(normalizeAgentUrl("http://localhost:8583/")).toBe("http://localhost:8583");
    });

    it("strips multiple trailing slashes", () => {
      expect(normalizeAgentUrl("http://localhost:8583///")).toBe("http://localhost:8583");
    });

    it("returns an empty string for a purely-whitespace input", () => {
      expect(normalizeAgentUrl("   ")).toBe("");
    });

    it("preserves the URL path when present", () => {
      // Some operators front the Agent behind a reverse proxy at /agent —
      // that path segment must survive normalisation.
      expect(normalizeAgentUrl("http://gateway.internal/agent/")).toBe(
        "http://gateway.internal/agent",
      );
    });
  });

  describe("setAgentUrl", () => {
    it("normalises before storing", () => {
      useAgentConnectionStore.getState().setAgentUrl("  http://localhost:8583/  ");
      expect(useAgentConnectionStore.getState().agentUrl).toBe("http://localhost:8583");
    });

    it("stores null when given an empty string", () => {
      useAgentConnectionStore.getState().setAgentUrl("   ");
      expect(useAgentConnectionStore.getState().agentUrl).toBeNull();
    });

    it("persists the URL to localStorage under the documented key", () => {
      useAgentConnectionStore.getState().setAgentUrl("http://localhost:8583");
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.state.agentUrl).toBe("http://localhost:8583");
    });

    it("does NOT persist the transient status or error fields", () => {
      useAgentConnectionStore.getState().setStatus("connected");
      useAgentConnectionStore.getState().setError("boom");
      useAgentConnectionStore.getState().setAgentUrl("http://localhost:8583");

      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw!);
      // partialize keeps only agentUrl — status/errorMessage must not survive a reload.
      expect(parsed.state.status).toBeUndefined();
      expect(parsed.state.errorMessage).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("resets URL, status and error simultaneously", () => {
      useAgentConnectionStore.setState({
        agentUrl: "http://localhost:8583",
        status: "connected",
        errorMessage: "prev error",
      });

      useAgentConnectionStore.getState().clear();

      const state = useAgentConnectionStore.getState();
      expect(state.agentUrl).toBeNull();
      expect(state.status).toBe("idle");
      expect(state.errorMessage).toBeNull();
    });
  });
});

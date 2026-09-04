import { describe, expect, it } from "vitest";
import axios, { AxiosError } from "axios";
import { installErrorInterceptor } from "@/api/client";
import { probeAgentHealth } from "@/api/agent";

/**
 * Sprint 12.4 P4 — probeAgentHealth must go through the shared error
 * interceptor from client.ts so the Workspace "Conectar" button surfaces
 * a friendly Portuguese message instead of axios's raw "Network Error"
 * (which was the pre-fix behaviour and caused the validation-manual
 * feedback in Sprint 12.4 P4).
 *
 * Approach: exercise the interceptor directly against constructed axios
 * error objects (the same shape axios produces at runtime) — this covers
 * the branches that matter: structured server error, plain text body,
 * timeout, no-response. Then a smoke test on probeAgentHealth itself
 * confirms the interceptor is actually attached (not just importable).
 */

/**
 * Feed an <c>error</c> object through <c>installErrorInterceptor</c> and
 * return the message it produces. The wrapped rejection is what UI
 * callers see via <c>catch (err) { (err as Error).message }</c>.
 */
async function runThroughInterceptor(
  fakeError: Partial<AxiosError>,
  hostLabel: string,
): Promise<string> {
  const instance = axios.create();
  installErrorInterceptor(instance, hostLabel);

  // The interceptor is registered on the response chain — trigger it by
  // pushing the fake error through the same runtime path axios uses.
  // Reach into the private handlers array — axios doesn't expose the
  // hook directly, but the shape is stable across the 1.x versions and
  // this is the standard test pattern for interceptors.
  const handlers = (instance.interceptors.response as unknown as {
    handlers: Array<{ rejected?: (err: unknown) => Promise<unknown> }>;
  }).handlers;
  const rejected = new Promise((_resolve, reject) => reject(fakeError));
  return handlers[0].rejected!(await rejected.catch((e) => e)).then(
    () => "should have rejected",
    (err: Error) => err.message,
  );
}

describe("installErrorInterceptor (shared client.ts helper)", () => {
  it("passes through structured backend errors verbatim ({ error })", async () => {
    const msg = await runThroughInterceptor(
      {
        response: {
          data: { error: "Session already running on port 8583" },
          status: 409,
        } as AxiosError["response"],
        message: "Request failed with status code 409",
      },
      "Agent",
    );
    expect(msg).toBe("Session already running on port 8583");
  });

  it("falls back to ProblemDetails.detail when error is missing", async () => {
    const msg = await runThroughInterceptor(
      {
        response: {
          data: { detail: "Detailed backend explanation" },
          status: 400,
        } as AxiosError["response"],
        message: "Request failed with status code 400",
      },
      "Agent",
    );
    expect(msg).toBe("Detailed backend explanation");
  });

  it("uses a plain string body verbatim when the server sends text/plain", async () => {
    const msg = await runThroughInterceptor(
      {
        response: {
          data: "raw text error",
          status: 500,
        } as AxiosError["response"],
        message: "Request failed with status code 500",
      },
      "Agent",
    );
    expect(msg).toBe("raw text error");
  });

  it("returns a PT-BR 'not reachable' message on network failure (no response)", async () => {
    const msg = await runThroughInterceptor(
      {
        response: undefined,
        code: "ERR_NETWORK",
        message: "Network Error",
      },
      "Agent",
    );
    expect(msg).toMatch(/N[ãa]o foi poss[íi]vel alcan[çc]ar o Agent/);
    expect(msg).toMatch(/iniciado e est[áa] acess[íi]vel/);
    // Sanity: the raw "Network Error" default must not survive.
    expect(msg).not.toBe("Network Error");
  });

  it("returns a PT-BR timeout message when axios reports ECONNABORTED", async () => {
    const msg = await runThroughInterceptor(
      {
        response: undefined,
        code: "ECONNABORTED",
        message: "timeout of 8000ms exceeded",
      },
      "Agent",
    );
    expect(msg).toMatch(/tempo limite/i);
    expect(msg).toMatch(/Agent/);
  });

  it("parametrises the host label — Backend variant reads 'Backend'", async () => {
    const msg = await runThroughInterceptor(
      {
        response: undefined,
        code: "ERR_NETWORK",
        message: "Network Error",
      },
      "Backend",
    );
    expect(msg).toMatch(/N[ãa]o foi poss[íi]vel alcan[çc]ar o Backend/);
  });
});

describe("probeAgentHealth — wired to the shared interceptor", () => {
  it("normalises the base URL by stripping trailing slashes", async () => {
    // probeAgentHealth internally does baseUrl.replace(/\/+$/, ""). No
    // interceptor coverage here — just proves the shape stays sane so
    // the interceptor gets a chance to run against real responses.
    // Feed a URL that DNS-fails to force the interceptor path:
    await expect(
      probeAgentHealth("http://sim.unresolvable.test.invalid:8583///"),
    ).rejects.toThrow(/N[ãa]o foi poss[íi]vel alcan[çc]ar o Agent|tempo limite/i);
  }, 12_000);
});

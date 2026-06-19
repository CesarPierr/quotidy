// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { useOnline } from "@/lib/use-online";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

afterEach(() => {
  setOnline(true);
});

describe("useOnline", () => {
  test("reflects navigator.onLine after mount (online)", () => {
    setOnline(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
  });

  test("reflects navigator.onLine after mount (offline)", () => {
    setOnline(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  test("flips to false on the window 'offline' event", () => {
    setOnline(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
  });

  test("flips back to true on the window 'online' event", () => {
    setOnline(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});

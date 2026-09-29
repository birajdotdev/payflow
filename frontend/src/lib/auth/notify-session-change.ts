"use client";
// Only a change signal goes into storage. Credentials always remain in HttpOnly cookies.
export function notifySessionChange() {
  try {
    window.localStorage.setItem("payflow-session-change", String(Date.now()));
  } catch {
    /* Storage can be disabled; navigation must still complete. */
  }
}

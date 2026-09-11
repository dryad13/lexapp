/**
 * G9 load smoke (k6).
 * Usage: API_BASE=http://127.0.0.1:8080 k6 run tests/load/smoke.js
 *
 * Expects seed user admin/admin12 and a running API.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const API_BASE = __ENV.API_BASE || "http://127.0.0.1:8080";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

export function setup() {
  const res = http.post(
    `${API_BASE}/api/auth/login`,
    JSON.stringify({ username: "admin", password: "admin12" }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(res, { "login 200": (r) => r.status === 200 });
  const cookie = res.cookies["lexassist.sid"]
    ? `lexassist.sid=${res.cookies["lexassist.sid"][0].value}`
    : "";
  const body = res.json();
  return { cookie, token: body.token || "" };
}

export default function (data) {
  const headers = { Cookie: data.cookie };
  if (data.token) headers.Authorization = `Bearer ${data.token}`;
  const res = http.get(`${API_BASE}/api/matters`, { headers });
  check(res, { "matters 200": (r) => r.status === 200 });
  sleep(0.5);
}

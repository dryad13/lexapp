import crypto from "node:crypto";
import { STRIPE_WEBHOOK_SECRET } from "./env.js";

export function signedStripeRequest(event: Record<string, unknown>, secret = STRIPE_WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const hmac = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return { payload, signature: `t=${timestamp},v1=${hmac}` };
}

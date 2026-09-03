import mongoose from "mongoose";

// Human-readable names for Mongoose's numeric connection states, so the health
// payload is legible to a monitoring dashboard (scope doc §10.4) rather than
// returning a bare integer.
const CONNECTION_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * GET /api/health — liveness/readiness probe.
 *
 * Reports whether the process is up and whether Mongoose currently holds a
 * connection, which is what an uptime monitor needs to distinguish "server down"
 * from "server up but database unreachable".
 *
 * Takes: (_req, res) — no request input.
 * Returns: nothing; sends 200 with the standard { success, data } response shape.
 */
export function getHealth(_req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      database: CONNECTION_STATES[mongoose.connection.readyState] ?? "unknown",
      timestamp: new Date().toISOString(),
    },
  });
}

type HealthResponse = {
  status: (code: number) => { json: (body: unknown) => void };
};

export default function handler(_req: unknown, res: HealthResponse) {
  return res.status(200).json({
    success: true,
    service: "niu-healthz",
    runtime: "vercel",
    build: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
  });
}

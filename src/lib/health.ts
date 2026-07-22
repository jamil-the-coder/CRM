export function getHealthStatus() {
  return {
    status: "ok" as const,
    checkedAt: new Date().toISOString(),
  };
}

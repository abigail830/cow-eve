import schedules from "@fde/schedules";

const apiBaseUrl =
  process.env.PLATFORM_API_BASE_URL?.trim() ?? "http://127.0.0.1:2000";

export default schedules({ apiBaseUrl });

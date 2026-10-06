export const DEFAULT_SETTINGS = {
  distracted_after_seconds: 60,
  idle_after_seconds: 180,
  offline_after_seconds: 90
};

export type Settings = typeof DEFAULT_SETTINGS;

export function resolveSettings(raw: any): Settings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  return {
    distracted_after_seconds: typeof raw.distracted_after_seconds === 'number' && raw.distracted_after_seconds > 0
      ? raw.distracted_after_seconds : DEFAULT_SETTINGS.distracted_after_seconds,
    idle_after_seconds: typeof raw.idle_after_seconds === 'number' && raw.idle_after_seconds > 0
      ? raw.idle_after_seconds : DEFAULT_SETTINGS.idle_after_seconds,
    offline_after_seconds: typeof raw.offline_after_seconds === 'number' && raw.offline_after_seconds > 0
      ? raw.offline_after_seconds : DEFAULT_SETTINGS.offline_after_seconds,
  };
}

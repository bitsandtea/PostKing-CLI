import { createClient } from "../client";
import { getBrandId } from "../config";

interface DayMediumConfig {
  medium: string;
  postsPerDay: number;
  voiceProfileId?: string | null;
}

interface DayConfig {
  dayOfWeek: number;
  mediums: DayMediumConfig[];
}

interface WeeklySchedule {
  id?: string;
  brandId?: string;
  enabled: boolean;
  leadTimeDays: number;
  timezone: string;
  voiceProfileId?: string | null;
  dayConfigs: DayConfig[];
}

interface GetResponse {
  schedule: WeeklySchedule | null;
  defaults: {
    dayConfigs: DayConfig[];
    leadTimeDays: number;
    timezone: string;
  };
}

const DAYS = [
  { name: "sunday",    dow: 0, short: "Sun" },
  { name: "monday",    dow: 1, short: "Mon" },
  { name: "tuesday",   dow: 2, short: "Tue" },
  { name: "wednesday", dow: 3, short: "Wed" },
  { name: "thursday",  dow: 4, short: "Thu" },
  { name: "friday",    dow: 5, short: "Fri" },
  { name: "saturday",  dow: 6, short: "Sat" },
] as const;

const MEDIUM_ALIASES: Record<string, string> = {
  twitter: "x/twitter",
  x: "x/twitter",
  "x/twitter": "x/twitter",
  linkedin: "linkedin",
  ig: "instagram",
  instagram: "instagram",
  fb: "facebook",
  facebook: "facebook",
  threads: "threads",
  tiktok: "tiktok",
  youtube: "youtube",
  blog: "blog",
};

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    console.error("Run 'pking brand set <brand_id>' first.");
    process.exit(1);
  }
  return brandId;
}

/** Parse "linkedin:2,x:1" → [{medium:"linkedin",postsPerDay:2}, {medium:"x/twitter",postsPerDay:1}]. */
function parseDaySpec(spec: string, dayName: string): DayMediumConfig[] {
  const trimmed = spec.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  const mediums: DayMediumConfig[] = [];
  for (const part of parts) {
    const [rawMedium, rawCount] = part.split(":").map((s) => s.trim());
    const canonical = MEDIUM_ALIASES[rawMedium?.toLowerCase() ?? ""];
    if (!canonical) {
      console.error(`ERROR: --${dayName} has unknown medium '${rawMedium}'. Allowed: ${Object.keys(MEDIUM_ALIASES).join(", ")}`);
      process.exit(1);
    }
    const count = parseInt(rawCount ?? "1", 10);
    if (!Number.isFinite(count) || count < 1 || count > 5) {
      console.error(`ERROR: --${dayName} medium '${rawMedium}' postsPerDay must be 1-5 (got '${rawCount}')`);
      process.exit(1);
    }
    mediums.push({ medium: canonical, postsPerDay: count });
  }
  return mediums;
}

function formatDayConfigs(cfgs: DayConfig[]): string {
  if (cfgs.length === 0) return "  (no days configured)";
  const byDow = new Map(cfgs.map((c) => [c.dayOfWeek, c]));
  return DAYS.map((d) => {
    const cfg = byDow.get(d.dow);
    if (!cfg || cfg.mediums.length === 0) return `  ${d.short}: —`;
    const parts = cfg.mediums.map((m) => `${m.medium}:${m.postsPerDay}`);
    return `  ${d.short}: ${parts.join(", ")}`;
  }).join("\n");
}

// ── Commands ─────────────────────────────────────────────────────────────────

export async function weeklyScheduleGetCommand(): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  try {
    const res = await client.get(`/api/brands/${brandId}/weekly-schedule`);
    const { schedule, defaults } = res.data as GetResponse;

    console.log(`\n📆 WEEKLY SCHEDULE — brand ${brandId}\n`);
    if (!schedule) {
      console.log("No schedule configured yet.\n");
      console.log("Suggested defaults:");
      console.log(`  Lead time:  ${defaults.leadTimeDays} days`);
      console.log(`  Timezone:   ${defaults.timezone}`);
      console.log(formatDayConfigs(defaults.dayConfigs));
      console.log("\nSet one with 'pking weekly-schedule set --monday \"linkedin:1\" …'");
      return;
    }

    console.log(`  Enabled:    ${schedule.enabled ? "YES" : "no"}`);
    console.log(`  Lead time:  ${schedule.leadTimeDays} days`);
    console.log(`  Timezone:   ${schedule.timezone}`);
    if (schedule.voiceProfileId) console.log(`  Voice:      ${schedule.voiceProfileId}`);
    console.log("");
    console.log(formatDayConfigs(schedule.dayConfigs));
    console.log("");
  } catch (err: unknown) {
    console.error("ERROR: Could not fetch weekly schedule.");
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (msg) console.error(`Reason: ${msg}`);
    process.exit(1);
  }
}

interface SetOptions {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  timezone?: string;
  leadTime?: string;
  voice?: string;
  enable?: boolean;
  disable?: boolean;
}

export async function weeklyScheduleSetCommand(options: SetOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  // Fetch current (or defaults) as the base to patch against.
  let current: WeeklySchedule | null = null;
  let fallbackDayConfigs: DayConfig[] = [];
  let fallbackLeadTime = 3;
  let fallbackTimezone = "America/New_York";
  try {
    const res = await client.get(`/api/brands/${brandId}/weekly-schedule`);
    const data = res.data as GetResponse;
    current = data.schedule;
    fallbackDayConfigs = data.defaults.dayConfigs;
    fallbackLeadTime = data.defaults.leadTimeDays;
    fallbackTimezone = data.defaults.timezone;
  } catch {
    // Continue with static fallbacks.
  }

  // Build dayConfigs: start from current (or defaults), override any day the user set.
  const baseByDow = new Map<number, DayConfig>();
  for (const cfg of (current?.dayConfigs ?? fallbackDayConfigs)) {
    baseByDow.set(cfg.dayOfWeek, cfg);
  }
  const userProvided: Record<string, string | undefined> = {
    sunday: options.sunday,
    monday: options.monday,
    tuesday: options.tuesday,
    wednesday: options.wednesday,
    thursday: options.thursday,
    friday: options.friday,
    saturday: options.saturday,
  };
  for (const d of DAYS) {
    const raw = userProvided[d.name];
    if (raw === undefined) continue;
    const mediums = parseDaySpec(raw, d.name);
    if (mediums.length === 0) baseByDow.delete(d.dow);
    else baseByDow.set(d.dow, { dayOfWeek: d.dow, mediums });
  }

  const dayConfigs: DayConfig[] = DAYS
    .map((d) => baseByDow.get(d.dow))
    .filter((c): c is DayConfig => !!c && c.mediums.length > 0);

  const leadTimeDays = options.leadTime
    ? parseInt(options.leadTime, 10)
    : current?.leadTimeDays ?? fallbackLeadTime;
  if (!Number.isFinite(leadTimeDays) || leadTimeDays < 1 || leadTimeDays > 7) {
    console.error("ERROR: --lead-time must be 1-7.");
    process.exit(1);
  }

  let enabled = current?.enabled ?? true;
  if (options.enable) enabled = true;
  if (options.disable) enabled = false;

  const body = {
    enabled,
    leadTimeDays,
    timezone: options.timezone ?? current?.timezone ?? fallbackTimezone,
    voiceProfileId: options.voice ?? current?.voiceProfileId ?? null,
    dayConfigs,
  };

  try {
    const res = await client.put(`/api/brands/${brandId}/weekly-schedule`, body);
    const schedule = res.data.schedule as WeeklySchedule;
    console.log(`\nSUCCESS: Weekly schedule ${current ? "updated" : "created"}.`);
    console.log(`  Enabled:    ${schedule.enabled ? "YES" : "no"}`);
    console.log(`  Lead time:  ${schedule.leadTimeDays} days`);
    console.log(`  Timezone:   ${schedule.timezone}`);
    if (schedule.voiceProfileId) console.log(`  Voice:      ${schedule.voiceProfileId}`);
    console.log("");
    console.log(formatDayConfigs(schedule.dayConfigs));
    console.log("");
  } catch (err: unknown) {
    console.error("ERROR: Could not save weekly schedule.");
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (msg) console.error(`Reason: ${msg}`);
    process.exit(1);
  }
}

async function toggle(enabled: boolean): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.patch(`/api/brands/${brandId}/weekly-schedule`, { enabled });
    const schedule = res.data.schedule as WeeklySchedule;
    console.log(`SUCCESS: Weekly schedule ${schedule.enabled ? "ENABLED" : "DISABLED"}.`);
  } catch (err: unknown) {
    console.error(`ERROR: Could not ${enabled ? "enable" : "disable"} weekly schedule.`);
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (msg) console.error(`Reason: ${msg}`);
    process.exit(1);
  }
}

export async function weeklyScheduleEnableCommand(): Promise<void>  { return toggle(true); }
export async function weeklyScheduleDisableCommand(): Promise<void> { return toggle(false); }

export async function weeklyScheduleDeleteCommand(): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    await client.delete(`/api/brands/${brandId}/weekly-schedule`);
    console.log("SUCCESS: Weekly schedule removed.");
  } catch (err: unknown) {
    console.error("ERROR: Could not remove weekly schedule.");
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (msg) console.error(`Reason: ${msg}`);
    process.exit(1);
  }
}

export async function weeklyScheduleRunDayCommand(options: { date?: string }): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  if (!options.date) {
    console.error("ERROR: --date <YYYY-MM-DD> is required.");
    process.exit(1);
  }
  const d = new Date(options.date);
  if (isNaN(d.getTime())) {
    console.error("ERROR: Invalid --date. Use YYYY-MM-DD.");
    process.exit(1);
  }
  try {
    const res = await client.post(`/api/brands/${brandId}/smart-week`, {
      targetDate: d.toISOString(),
    });
    console.log(`SUCCESS: Triggered smart-week for ${options.date}.`);
    if (res.data) {
      const created = res.data.postsCreated ?? res.data.createdCount ?? res.data.count;
      if (created !== undefined) console.log(`  Posts created: ${created}`);
    }
  } catch (err: unknown) {
    console.error("ERROR: Could not trigger smart-week run.");
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    if (msg) console.error(`Reason: ${msg}`);
    process.exit(1);
  }
}

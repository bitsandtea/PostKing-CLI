import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    console.error("Run 'pking brand set <brand_id>' first.");
    process.exit(1);
  }
  return brandId;
}

function validateIana(iana: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: iana });
    return true;
  } catch {
    return false;
  }
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatLocalTime(timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}

export async function timezoneGetCommand(): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}`);
    const brand = res.data as { timezone?: string | null; name?: string };
    const current = brand.timezone || "(not set)";
    const local = localTimezone();

    console.log(`\nBrand timezone:  ${current}`);
    console.log(`Machine timezone: ${local}`);
    if (current !== "(not set)") {
      console.log(`Local time in brand zone: ${formatLocalTime(current)}`);
    }
    console.log("");
  } catch (err: unknown) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function timezoneSetCommand(
  iana: string | undefined,
  options: { local?: boolean }
): Promise<void> {
  if (iana !== undefined && options.local) {
    console.error("ERROR: --local and <iana> are mutually exclusive. Pass one or the other.");
    process.exit(1);
  }

  const client = createClient();
  const brandId = requireBrand();

  let timezone: string;

  if (options.local) {
    timezone = localTimezone();
    console.log(`Detected machine timezone: ${timezone}`);
  } else if (iana !== undefined) {
    timezone = iana;
  } else {
    // Neither arg nor flag: show current timezone (read path)
    await timezoneGetCommand();
    return;
  }

  if (!validateIana(timezone)) {
    console.error(`ERROR: "${timezone}" is not a valid IANA timezone string.`);
    console.error("Examples: America/New_York, Europe/London, Asia/Tokyo, UTC");
    process.exit(1);
  }

  try {
    await client.patch(`/api/agent/v1/brands/${brandId}`, { timezone });
    console.log(`\nSUCCESS: Brand timezone set to: ${timezone}`);
    console.log(`Current local time in that zone: ${formatLocalTime(timezone)}`);
    console.log("");
  } catch (err: unknown) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

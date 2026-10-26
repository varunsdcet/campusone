/** Shared HCC / Windows-style time zone labels (instructor + student). */
export const HCC_TIME_ZONES = [
  "(UTC-11:00) Midway Island",
  "(UTC-11:00) Samoa",
  "(UTC-10:00) Hawaii",
  "(UTC-09:00) Alaska",
  "(UTC-08:00) Pacific Time (US & Canada)",
  "(UTC-07:00) Tijuana",
  "(UTC-07:00) Arizona",
  "(UTC-07:00) Chihuahua",
  "(UTC-07:00) La Paz",
  "(UTC-07:00) Mazatlan",
  "(UTC-07:00) Mountain Time (US & Canada)",
  "(UTC-06:00) Central America",
  "(UTC-06:00) Central Time (US & Canada)",
  "(UTC-06:00) Guadalajara",
  "(UTC-06:00) Mexico City",
  "(UTC-06:00) Monterrey",
  "(UTC-06:00) Saskatchewan",
  "(UTC-05:00) Bogota",
  "(UTC-05:00) Eastern Time (US & Canada)",
  "(UTC-05:00) Indiana (East)",
  "(UTC-05:00) Lima",
  "(UTC-05:00) Quito",
  "(UTC-04:00) Atlantic Time (Canada)",
  "(UTC-04:00) Caracas",
  "(UTC-04:00) La Paz",
  "(UTC-03:30) Newfoundland",
  "(UTC-03:00) Brasilia",
  "(UTC-03:00) Buenos Aires",
  "(UTC-03:00) Georgetown",
  "(UTC-03:00) Greenland",
  "(UTC+00:00) UTC",
  "(UTC+01:00) Amsterdam",
  "(UTC+01:00) Berlin",
  "(UTC+01:00) Rome",
  "(UTC+05:30) New Delhi",
] as const;

export const DEFAULT_HCC_TIME_ZONE = "(UTC-08:00) Pacific Time (US & Canada)";

/** Resolve stored preference to an IANA zone for clock display. */
export function resolveIanaTimeZone(stored: string | null | undefined): string {
  if (!stored) return "America/Vancouver";
  if (stored.includes("/")) return stored;
  const map: Record<string, string> = {
    "(UTC-11:00) Midway Island": "Pacific/Midway",
    "(UTC-11:00) Samoa": "Pacific/Samoa",
    "(UTC-10:00) Hawaii": "Pacific/Honolulu",
    "(UTC-09:00) Alaska": "America/Anchorage",
    "(UTC-08:00) Pacific Time (US & Canada)": "America/Vancouver",
    "(UTC-07:00) Tijuana": "America/Tijuana",
    "(UTC-07:00) Arizona": "America/Phoenix",
    "(UTC-07:00) Chihuahua": "America/Chihuahua",
    "(UTC-07:00) La Paz": "America/Mazatlan",
    "(UTC-07:00) Mazatlan": "America/Mazatlan",
    "(UTC-07:00) Mountain Time (US & Canada)": "America/Edmonton",
    "(UTC-06:00) Central America": "America/Guatemala",
    "(UTC-06:00) Central Time (US & Canada)": "America/Winnipeg",
    "(UTC-06:00) Guadalajara": "America/Mexico_City",
    "(UTC-06:00) Mexico City": "America/Mexico_City",
    "(UTC-06:00) Monterrey": "America/Monterrey",
    "(UTC-06:00) Saskatchewan": "America/Regina",
    "(UTC-05:00) Bogota": "America/Bogota",
    "(UTC-05:00) Eastern Time (US & Canada)": "America/Toronto",
    "(UTC-05:00) Indiana (East)": "America/Indiana/Indianapolis",
    "(UTC-05:00) Lima": "America/Lima",
    "(UTC-05:00) Quito": "America/Guayaquil",
    "(UTC-04:00) Atlantic Time (Canada)": "America/Halifax",
    "(UTC-04:00) Caracas": "America/Caracas",
    "(UTC-04:00) La Paz": "America/La_Paz",
    "(UTC-03:30) Newfoundland": "America/St_Johns",
    "(UTC-03:00) Brasilia": "America/Sao_Paulo",
    "(UTC-03:00) Buenos Aires": "America/Argentina/Buenos_Aires",
    "(UTC-03:00) Georgetown": "America/Guyana",
    "(UTC-03:00) Greenland": "America/Godthab",
    "(UTC+00:00) UTC": "UTC",
    "(UTC+01:00) Amsterdam": "Europe/Amsterdam",
    "(UTC+01:00) Berlin": "Europe/Berlin",
    "(UTC+01:00) Rome": "Europe/Rome",
    "(UTC+05:30) New Delhi": "Asia/Kolkata",
  };
  return map[stored] || "America/Vancouver";
}

export function formatCurrentTime(stored: string | null | undefined) {
  const iana = resolveIanaTimeZone(stored);
  try {
    return new Date().toLocaleString("en-US", { timeZone: iana });
  } catch {
    return new Date().toLocaleString("en-US");
  }
}

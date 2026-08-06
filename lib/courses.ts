/**
 * Course-catalog helpers, mainly the department → college mapping that
 * powers the catalog's college filter.
 *
 * HONESTY NOTE: UMN doesn't encode college in the course number, so this
 * mapping is a best-effort approximation maintained by hand (e.g. MATH
 * is administered by CSE even though everyone takes it). Unmapped
 * departments simply don't match any college filter — they still appear
 * unfiltered. If a student reports a wrong mapping, fix it here.
 */

const DEPARTMENT_TO_COLLEGE: Record<string, string> = {
  // College of Science and Engineering
  CSE: "cse", CSCI: "cse", MATH: "cse", PHYS: "cse", CHEM: "cse",
  EE: "cse", ME: "cse", AEM: "cse", STAT: "cse", BMEN: "cse", CEGE: "cse",
  CHEN: "cse", MATS: "cse", IE: "cse",
  // College of Biological Sciences
  BIOL: "cbs", GCD: "cbs", MICB: "cbs", NSCI: "cbs", PHSL: "cbs", BIOC: "cbs",
  // College of Liberal Arts
  WRIT: "cla", ECON: "cla", PSY: "cla", SOC: "cla", PHIL: "cla", HIST: "cla",
  SPAN: "cla", ENGL: "cla", POL: "cla", COMM: "cla", LING: "cla", GER: "cla",
  FREN: "cla", ART: "cla", MUS: "cla",
  // Carlson School of Management
  ACCT: "carlson", FINA: "carlson", MKTG: "carlson", MGMT: "carlson",
  SCO: "carlson", HRIR: "carlson", IDSC: "carlson",
  // Others
  DES: "design", ARCH: "design", GDES: "design", APST: "design",
  CI: "education", EPSY: "education", KIN: "education",
  NURS: "nursing",
  ANSC: "cfans", AGRO: "cfans", FSCN: "cfans", ESPM: "cfans", HORT: "cfans",
};

/** College key for a department code, or null when we don't know. */
export function collegeForDepartment(departmentCode: string): string | null {
  return DEPARTMENT_TO_COLLEGE[departmentCode.toUpperCase()] ?? null;
}

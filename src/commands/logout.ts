import { clearConfig } from "../config";

export function logoutCommand(): void {
  clearConfig();
  console.log("SUCCESS: Logged out. Local credentials have been cleared.");
  console.log("Run 'pking login' to authenticate again.");
}

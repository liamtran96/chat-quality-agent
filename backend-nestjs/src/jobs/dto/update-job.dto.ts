/**
 * UpdateJobDto is intentionally open-ended (raw JSON map).
 * The service layer applies a whitelist to filter allowed fields.
 * This mirrors the Go backend's behavior of binding to map[string]interface{}.
 */
export class UpdateJobDto {
  [key: string]: any;
}

export interface Notifier {
  send(subject: string, body: string): Promise<void>;
  healthCheck(): Promise<void>;
}

import * as nodemailer from 'nodemailer';
import { Notifier } from './notifier.interface';

export class EmailNotifier implements Notifier {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly smtpHost: string,
    private readonly smtpPort: number,
    private readonly username: string,
    private readonly password: string,
    private readonly from: string,
    private readonly to: string[],
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      auth: {
        user: this.username,
        pass: this.password,
      },
    });
  }

  async send(subject: string, body: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: this.to.join(','),
      subject,
      html: body,
    });
  }

  async healthCheck(): Promise<void> {
    await this.transporter.verify();
  }
}

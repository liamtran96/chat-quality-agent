import { DispatcherService } from './dispatcher.service';

describe('DispatcherService', () => {
  let service: DispatcherService;

  beforeEach(() => {
    // Create service with mocked dependencies
    service = new DispatcherService(
      { find: jest.fn(), update: jest.fn() } as any,
      { findOne: jest.fn() } as any,
      { save: jest.fn() } as any,
      { get: jest.fn() } as any,
    );
  });

  describe('parseOutputs', () => {
    it('should parse a valid JSON array', () => {
      const outputs = service.parseOutputs(
        JSON.stringify([{ type: 'telegram', bot_token: 'tok', chat_id: '123' }]),
      );
      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('telegram');
    });

    it('should handle double-encoded JSON string', () => {
      const inner = JSON.stringify([{ type: 'email', to: 'a@b.com' }]);
      const doubleEncoded = JSON.stringify(inner);
      const outputs = service.parseOutputs(doubleEncoded);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('email');
    });

    it('should return empty array for empty string', () => {
      expect(service.parseOutputs('')).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
      expect(service.parseOutputs('{invalid')).toEqual([]);
    });
  });

  describe('renderCustomTemplate', () => {
    it('should substitute all variables', () => {
      const tmpl =
        '<h1>{{job_name}}</h1> Total: {{total}}, Passed: {{passed}}, Failed: {{failed}}, Issues: {{issues}} <a href="{{link}}">View</a> {{content}}';
      const result = service.renderCustomTemplate(
        tmpl,
        'My Job',
        100,
        80,
        20,
        5,
        '<p>violations here</p>',
        'https://app.cqa.io/t1/jobs/j1',
      );

      expect(result).toContain('<h1>My Job</h1>');
      expect(result).toContain('Total: 100');
      expect(result).toContain('Passed: 80');
      expect(result).toContain('Failed: 20');
      expect(result).toContain('Issues: 5');
      expect(result).toContain('href="https://app.cqa.io/t1/jobs/j1"');
      expect(result).toContain('<p>violations here</p>');
    });

    it('should handle repeated variables', () => {
      const tmpl = '{{job_name}} - {{job_name}} - {{total}}/{{total}}';
      const result = service.renderCustomTemplate(
        tmpl,
        'Test',
        50,
        40,
        10,
        3,
        '',
        '',
      );

      expect(result).toBe('Test - Test - 50/50');
    });

    it('should return template as-is when no variables present', () => {
      const tmpl = '<p>Static content</p>';
      const result = service.renderCustomTemplate(tmpl, 'Job', 0, 0, 0, 0, '', '');
      expect(result).toBe('<p>Static content</p>');
    });
  });

  describe('buildNotificationBody', () => {
    it('should include up to 10 results', () => {
      const job = { name: 'Test Job' } as any;
      const results = Array.from({ length: 15 }, (_, i) => ({
        result_type: 'qc_violation',
        severity: i === 0 ? 'NGHIEM_TRONG' : 'CAN_CAI_THIEN',
        rule_name: `Rule ${i}`,
        evidence: `Evidence ${i}`,
        confidence: 0.9,
      })) as any[];

      const body = service.buildNotificationBody(job, results);

      // Should contain the first 10 rules
      for (let i = 0; i < 10; i++) {
        expect(body).toContain(`Rule ${i}`);
      }
      // Should NOT contain rules 10+
      expect(body).not.toContain('Rule 10');
      // Should mention remaining count
      expect(body).toContain('5');
    });

    it('should format qc_violation with red circle for NGHIEM_TRONG', () => {
      const job = { name: 'QC' } as any;
      const results = [
        {
          result_type: 'qc_violation',
          severity: 'NGHIEM_TRONG',
          rule_name: 'Greeting',
          evidence: 'No greeting found',
          confidence: 0.95,
        },
      ] as any[];

      const body = service.buildNotificationBody(job, results);
      expect(body).toContain('\uD83D\uDD34'); // red circle
      expect(body).toContain('<b>NGHIEM_TRONG</b>');
    });

    it('should format classification_tag with tag emoji', () => {
      const job = { name: 'Classify' } as any;
      const results = [
        {
          result_type: 'classification_tag',
          rule_name: 'Complaint',
          evidence: 'Customer complained',
          confidence: 0.85,
        },
      ] as any[];

      const body = service.buildNotificationBody(job, results);
      expect(body).toContain('\uD83C\uDFF7'); // tag emoji
      expect(body).toContain('<b>Complaint</b>');
      expect(body).toContain('85%');
    });
  });

  describe('createNotifier', () => {
    it('should create TelegramNotifier for telegram type', () => {
      const notifier = service.createNotifier({
        type: 'telegram',
        bot_token: 'test-token',
        chat_id: '-100123',
      });
      expect(notifier).toBeDefined();
    });

    it('should create EmailNotifier for email type', () => {
      const notifier = service.createNotifier({
        type: 'email',
        smtp_host: 'smtp.test.com',
        smtp_port: 587,
        smtp_user: 'user',
        smtp_pass: 'pass',
        from: 'a@b.com',
        to: 'c@d.com, e@f.com',
      });
      expect(notifier).toBeDefined();
    });

    it('should return null for unknown type', () => {
      const notifier = service.createNotifier({ type: 'sms' });
      expect(notifier).toBeNull();
    });
  });
});

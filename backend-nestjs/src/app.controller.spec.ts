import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('GET /health', () => {
    it('should return status ok with version', () => {
      const result = controller.health();
      expect(result).toEqual({
        status: 'ok',
        version: expect.any(String),
      });
      expect(result.status).toBe('ok');
      expect(result.version).toBeTruthy();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let userRepo: any;

  const mockUserRepo = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: JWT_SECRET,
            signOptions: { algorithm: 'HS256' },
          }),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return JWT_SECRET;
              if (key === 'app.env') return 'test';
              return undefined;
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { ...mockUserRepo },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    userRepo = module.get(getRepositoryToken(User));

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT with correct claims', () => {
      const token = service.generateAccessToken('user-123', 'test@example.com', true);
      expect(typeof token).toBe('string');

      const decoded = jwtService.verify(token);
      expect(decoded.user_id).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.is_admin).toBe(true);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should set 15 minute expiry', () => {
      const token = service.generateAccessToken('user-123', 'test@example.com', false);
      const decoded = jwtService.verify(token);

      const expiry = decoded.exp - decoded.iat;
      expect(expiry).toBe(900); // 15 minutes
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT with sub and token_version', () => {
      const token = service.generateRefreshToken('user-123', 5);
      const decoded = jwtService.verify(token);

      expect(decoded.sub).toBe('user-123');
      expect(decoded.token_version).toBe(5);
    });

    it('should set 7 day expiry', () => {
      const token = service.generateRefreshToken('user-123', 0);
      const decoded = jwtService.verify(token);

      const expiry = decoded.exp - decoded.iat;
      expect(expiry).toBe(7 * 24 * 3600); // 7 days
    });
  });

  describe('validatePasswordComplexity', () => {
    it('should reject passwords shorter than 8 characters', () => {
      expect(() => service.validatePasswordComplexity('Short1')).toThrow();
    });

    it('should reject passwords without uppercase letter', () => {
      expect(() => service.validatePasswordComplexity('lowercase123')).toThrow();
    });

    it('should reject passwords without digit', () => {
      expect(() => service.validatePasswordComplexity('NoDigitsHere')).toThrow();
    });

    it('should accept valid passwords', () => {
      expect(() => service.validatePasswordComplexity('ValidPass1')).not.toThrow();
      expect(() => service.validatePasswordComplexity('Abcdefg8')).not.toThrow();
    });
  });

  describe('lockout logic', () => {
    it('should not be locked initially', () => {
      expect(service.checkLockout('test@example.com:127.0.0.1')).toBe(false);
    });

    it('should lock after 5 failed attempts', () => {
      const key = 'lock-test@example.com:127.0.0.1';

      for (let i = 0; i < 5; i++) {
        service.recordFailedLogin(key);
      }

      expect(service.checkLockout(key)).toBe(true);
    });

    it('should not lock after fewer than 5 attempts', () => {
      const key = 'partial@example.com:127.0.0.1';

      for (let i = 0; i < 4; i++) {
        service.recordFailedLogin(key);
      }

      expect(service.checkLockout(key)).toBe(false);
    });

    it('should clear lockout on successful login', () => {
      const key = 'clear-test@example.com:127.0.0.1';

      for (let i = 0; i < 5; i++) {
        service.recordFailedLogin(key);
      }
      expect(service.checkLockout(key)).toBe(true);

      service.clearFailedLogin(key);
      expect(service.checkLockout(key)).toBe(false);
    });
  });

  describe('login', () => {
    const mockRes = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    it('should return invalid_credentials for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.login(
        'unknown@example.com',
        'Password1',
        '127.0.0.1',
        mockRes,
      );

      expect(result.status).toBe(401);
      expect(result.body.error).toBe('invalid_credentials');
    });

    it('should return invalid_credentials for wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPassword1', 10);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password_hash: hash,
        is_admin: false,
        token_version: 0,
      });

      const result = await service.login(
        'test@example.com',
        'WrongPassword1',
        '127.0.0.1',
        mockRes,
      );

      expect(result.status).toBe(401);
      expect(result.body.error).toBe('invalid_credentials');
    });

    it('should return access_token on successful login', async () => {
      const hash = await bcrypt.hash('ValidPass1', 10);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password_hash: hash,
        is_admin: true,
        token_version: 0,
      });

      const result = await service.login(
        'test@example.com',
        'ValidPass1',
        '127.0.0.1',
        mockRes,
      );

      expect(result.status).toBe(200);
      expect(result.body.access_token).toBeDefined();
      expect(result.body.expires_in).toBe(900);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'cqa_refresh_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          path: '/api/v1/auth',
          sameSite: 'strict',
        }),
      );
    });

    it('should return account_locked after 5 failed attempts', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const email = 'locktest@example.com';
      const ip = '10.0.0.1';

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await service.login(email, 'wrong', ip, mockRes);
      }

      // 6th attempt should be locked
      const result = await service.login(email, 'wrong', ip, mockRes);
      expect(result.status).toBe(429);
      expect(result.body.error).toBe('account_locked');
    });
  });

  describe('setup', () => {
    const mockRes = {
      cookie: jest.fn(),
    } as any;

    it('should reject setup when users already exist', async () => {
      userRepo.count.mockResolvedValue(1);

      const result = await service.setup(
        'admin@example.com',
        'AdminPass1',
        'Admin',
        mockRes,
      );

      expect(result.status).toBe(403);
      expect(result.body.error).toBe('setup_already_completed');
    });

    it('should create first admin user', async () => {
      userRepo.count.mockResolvedValue(0);
      userRepo.create.mockImplementation((data) => ({ ...data, token_version: 0 }));
      userRepo.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.setup(
        'admin@example.com',
        'AdminPass1',
        'Admin',
        mockRes,
      );

      expect(result.status).toBe(201);
      expect(result.body.access_token).toBeDefined();
      expect(result.body.expires_in).toBe(900);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@example.com',
          name: 'Admin',
          is_admin: true,
          language: 'vi',
        }),
      );
    });

    it('should default name to Admin when not provided', async () => {
      userRepo.count.mockResolvedValue(0);
      userRepo.create.mockImplementation((data) => ({ ...data, token_version: 0 }));
      userRepo.save.mockImplementation((user) => Promise.resolve(user));

      await service.setup('admin@example.com', 'AdminPass1', undefined, mockRes);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Admin' }),
      );
    });
  });

  describe('getSetupStatus', () => {
    it('should return needs_setup true when no users', async () => {
      userRepo.count.mockResolvedValue(0);
      const result = await service.getSetupStatus();
      expect(result).toEqual({ needs_setup: true });
    });

    it('should return needs_setup false when users exist', async () => {
      userRepo.count.mockResolvedValue(3);
      const result = await service.getSetupStatus();
      expect(result).toEqual({ needs_setup: false });
    });
  });

  describe('changePassword', () => {
    it('should reject wrong current password', async () => {
      const hash = await bcrypt.hash('CurrentPass1', 10);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password_hash: hash,
      });

      await expect(
        service.changePassword('user-1', 'WrongPass1', 'NewPass1'),
      ).rejects.toThrow();
    });

    it('should reject weak new password', async () => {
      const hash = await bcrypt.hash('CurrentPass1', 10);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        password_hash: hash,
      });

      await expect(
        service.changePassword('user-1', 'CurrentPass1', 'weak'),
      ).rejects.toThrow();
    });

    it('should change password successfully', async () => {
      const hash = await bcrypt.hash('CurrentPass1', 10);
      const user = {
        id: 'user-1',
        password_hash: hash,
      };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(user);

      const result = await service.changePassword(
        'user-1',
        'CurrentPass1',
        'NewPassword1',
      );

      expect(result).toEqual({ message: 'password_changed' });
      expect(userRepo.save).toHaveBeenCalled();
    });
  });
});

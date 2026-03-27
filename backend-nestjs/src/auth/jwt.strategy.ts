import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  user_id: string;
  email: string;
  is_admin: boolean;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.user_id || !payload.email) {
      throw new UnauthorizedException('Invalid token claims');
    }
    return {
      user_id: payload.user_id,
      email: payload.email,
      is_admin: payload.is_admin,
    };
  }
}

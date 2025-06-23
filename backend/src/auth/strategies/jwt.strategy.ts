import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', 'default-secret'),
    });
  }

  async validate(payload: JwtPayload) {
    // 리프레시 토큰 타입은 인증에 사용할 수 없음
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.authService.validateUser(payload);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // TODO: 토큰 블랙리스트 확인
    // const isBlacklisted = await this.redisService.get(`blacklist:${token}`);
    // if (isBlacklisted) {
    //   throw new UnauthorizedException('Token has been revoked');
    // }

    return user;
  }
} 
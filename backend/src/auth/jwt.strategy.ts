import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_COOKIE_NAME = 'smartq_access_token';

function extractJwtFromCookie(
  request: { cookies?: Record<string, unknown> } | undefined,
): string | null {
  const token = request?.cookies?.[AUTH_COOKIE_NAME];

  return typeof token === 'string' && token.trim() ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractJwtFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: { sub: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        roomId: true,
        canManageTicketIssue: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User session is no longer valid');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      roomId: user.roomId ?? null,
      canManageTicketIssue: user.canManageTicketIssue,
    };
  }
}

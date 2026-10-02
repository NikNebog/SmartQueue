import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';

const AUTH_COOKIE_NAME = 'smartq_access_token';
const AUTH_COOKIE_TTL_MS = 8 * 60 * 60 * 1000;

function useSecureCookies(): boolean {
  return process.env.NODE_ENV === 'production';
}

function shouldUseSecureCookies(request: ExpressRequest): boolean {
  const configuredValue = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();

  if (configuredValue === 'true') {
    return true;
  }

  if (configuredValue === 'false') {
    return false;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];
  const normalizedForwardedProto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto;

  if (normalizedForwardedProto?.split(',')[0]?.trim().toLowerCase() === 'https') {
    return true;
  }

  return useSecureCookies() && request.secure;
}

function setAuthCookie(request: ExpressRequest, response: Response, token: string): void {
  response.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: AUTH_COOKIE_TTL_MS,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(request),
  });
}

function clearAuthCookie(request: ExpressRequest, response: Response): void {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(request),
  });
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post('register')
  register(
    @Body() body: {
      name: string;
      email: string;
      password: string;
      role: 'admin' | 'manager' | 'specialist';
      roomId?: number;
      canManageTicketIssue?: boolean;
    },
    @Request() req: { user: { role?: 'admin' | 'manager' | 'specialist' } },
  ) {
    if (req.user?.role === 'manager' && body.role !== 'specialist') {
      throw new ForbiddenException('Менеджер может создавать только специалистов.');
    }

    return this.authService.register(
      body.name,
      body.email,
      body.password,
      body.role,
      body.roomId ? Number(body.roomId) : undefined,
      body.canManageTicketIssue ?? true,
    );
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Req() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(body.email, body.password);
    setAuthCookie(request, response, session.accessToken);

    return {
      user: session.user,
    };
  }

  @Post('logout')
  logout(
    @Req() request: ExpressRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    clearAuthCookie(request, response);

    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(
    @Req() request: ExpressRequest,
    @Request() req: { user: { id: number } },
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.authService.getMe(req.user.id);

    if (user) {
      setAuthCookie(request, response, this.authService.issueAccessToken(user.id));
    }

    return user;
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('users')
  findAll() {
    return this.authService.findAllUsers();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch('users/:id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; password?: string; role?: 'admin' | 'manager' | 'specialist'; roomId?: number; canManageTicketIssue?: boolean },
    @Request() req: { user: { role?: 'admin' | 'manager' | 'specialist' } },
  ) {
    if (req.user?.role === 'manager') {
      const existingUser = await this.authService.getMe(Number(id));

      if (!existingUser || existingUser.role !== 'specialist') {
        throw new ForbiddenException('Менеджер может изменять только специалистов.');
      }

      if (body.role && body.role !== 'specialist') {
        throw new ForbiddenException('Менеджер не может менять роль специалиста.');
      }
    }

    return this.authService.updateUser(Number(id), body);
  }
}

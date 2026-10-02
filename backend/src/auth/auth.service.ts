import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

type SafeUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'roomId' | 'canManageTicketIssue' | 'createdAt'>;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(
    name: string,
    email: string,
    password: string,
    role: Role = Role.specialist,
    roomId?: number,
    canManageTicketIssue = true,
  ): Promise<SafeUser> {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Email already exists');
    }

    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException('Invalid user role');
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        roomId: roomId ?? null,
        canManageTicketIssue,
      },
    });

    return this.toSafeUser(user);
  }

  async login(email: string, password: string): Promise<{ accessToken: string; user: SafeUser }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: this.signToken(user.id),
      user: this.toSafeUser(user),
    };
  }

  async getMe(userId: number): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        canManageTicketIssue: true,
        createdAt: true,
      },
    });
  }

  async findAllUsers(): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        canManageTicketIssue: true,
        createdAt: true,
      },
    });
  }

  async updateUser(
    id: number,
    data: { name?: string; email?: string; password?: string; role?: Role; roomId?: number; canManageTicketIssue?: boolean },
  ): Promise<SafeUser> {
    if (data.role && !Object.values(Role).includes(data.role)) {
      throw new BadRequestException('Invalid user role');
    }

    const updateData: {
      name?: string;
      email?: string;
      password?: string;
      role?: Role;
      roomId?: number | null;
      canManageTicketIssue?: boolean;
    } = {
      name: data.name,
      email: data.email,
      role: data.role,
      roomId: data.roomId ? Number(data.roomId) : null,
      canManageTicketIssue: data.canManageTicketIssue,
    };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        canManageTicketIssue: true,
        createdAt: true,
      },
    });
  }

  issueAccessToken(userId: number): string {
    return this.signToken(userId);
  }

  private signToken(userId: number): string {
    return this.jwt.sign({ sub: userId });
  }

  private toSafeUser(user: SafeUser): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roomId: user.roomId,
      canManageTicketIssue: user.canManageTicketIssue,
      createdAt: user.createdAt,
    };
  }
}

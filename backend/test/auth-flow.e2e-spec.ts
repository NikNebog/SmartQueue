import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';

type UserRecord = {
  createdAt: Date;
  email: string;
  id: number;
  name: string;
  password: string;
  role: 'admin' | 'manager' | 'specialist';
  roomId: number | null;
};

function createAuthPrismaMock() {
  let nextUserId = 1;
  const users: UserRecord[] = [];

  return {
    user: {
      create: jest.fn(({ data }) => {
        const user: UserRecord = {
          createdAt: new Date(),
          email: data.email,
          id: nextUserId++,
          name: data.name,
          password: data.password,
          role: data.role,
          roomId: data.roomId ?? null,
        };

        users.push(user);
        return Promise.resolve(user);
      }),
      findMany: jest.fn(({ select } = {}) => {
        if (!select) {
          return Promise.resolve(users);
        }

        return Promise.resolve(users.map((user) => ({
          createdAt: user.createdAt,
          email: user.email,
          id: user.id,
          name: user.name,
          role: user.role,
          roomId: user.roomId,
        })));
      }),
      findUnique: jest.fn(({ where, select }) => {
        const user = users.find((item) => (
          (where.email !== undefined && item.email === where.email) ||
          (where.id !== undefined && item.id === where.id)
        ));

        if (!user) {
          return Promise.resolve(null);
        }

        if (!select) {
          return Promise.resolve(user);
        }

        return Promise.resolve({
          createdAt: user.createdAt,
          email: user.email,
          id: user.id,
          name: user.name,
          role: user.role,
          roomId: user.roomId,
        });
      }),
      update: jest.fn(({ where, data }) => {
        const user = users.find((item) => item.id === where.id);

        if (!user) {
          throw new Error(`User ${where.id} was not found`);
        }

        Object.assign(user, data);
        return Promise.resolve(user);
      }),
    },
    __data: {
      users,
    },
  };
}

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof createAuthPrismaMock>;

  beforeEach(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    prisma = createAuthPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      imports: [
        PassportModule,
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: 604800 },
        }),
      ],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a user and returns access token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        name: 'Admin',
        password: 'password123',
        role: 'admin',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      role: 'admin',
    });
    expect(response.body.access_token).toEqual(expect.any(String));
    expect(prisma.__data.users[0].password).not.toBe('password123');
  });

  it('logs in registered user and returns access token', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'doctor@example.com',
        name: 'Doctor',
        password: 'password123',
        role: 'specialist',
        roomId: 21,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'doctor@example.com',
        password: 'password123',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      role: 'specialist',
    });
    expect(response.body.access_token).toEqual(expect.any(String));
  });

  it('returns current user by bearer token', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'manager@example.com',
        name: 'Manager',
        password: 'password123',
        role: 'manager',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${registerResponse.body.access_token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          email: 'manager@example.com',
          name: 'Manager',
          role: 'manager',
        });
        expect(body.password).toBeUndefined();
      });
  });

  it('rejects login with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'wrong-password@example.com',
        name: 'User',
        password: 'password123',
        role: 'specialist',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'wrong-password@example.com',
        password: 'bad-password',
      })
      .expect(401);
  });

  it('rejects duplicate email registration', async () => {
    const payload = {
      email: 'duplicate@example.com',
      name: 'Duplicate',
      password: 'password123',
      role: 'manager',
    };

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(409);
  });
});

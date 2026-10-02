import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TerminalRecord = {
  id: number;
  name: string;
  location: string;
  active: boolean;
  roomIds: number[];
  serviceTypeIds: number[];
  createdAt: Date;
  updatedAt: Date;
};

type TerminalPayload = {
  active?: boolean;
  isActive?: boolean;
  location?: string;
  name?: string;
  roomIds?: Array<number | string>;
  serviceTypeIds?: Array<number | string>;
};

function toIdList(values?: Array<number | string>): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
}

@Injectable()
export class TerminalsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRaw<TerminalRecord[]>`
      SELECT * FROM "terminals"
      ORDER BY "createdAt" DESC
    `;
  }

  findOne(id: number) {
    return this.prisma.$queryRaw<TerminalRecord[]>`
      SELECT * FROM "terminals"
      WHERE "id" = ${id}
      LIMIT 1
    `.then((rows) => rows[0] ?? null);
  }

  create(data: TerminalPayload) {
    return this.prisma.$queryRaw<TerminalRecord[]>`
      INSERT INTO "terminals" ("active", "location", "name", "roomIds", "serviceTypeIds", "updatedAt")
      VALUES (
        ${data.active ?? data.isActive ?? true},
        ${data.location?.trim() || ''},
        ${data.name?.trim() || 'Киоск'},
        ${toIdList(data.roomIds)},
        ${toIdList(data.serviceTypeIds)},
        NOW()
      )
      RETURNING *
    `.then((rows) => rows[0]);
  }

  async update(id: number, data: TerminalPayload) {
    const current = await this.findOne(id);

    if (!current) {
      return null;
    }

    return this.prisma.$queryRaw<TerminalRecord[]>`
      UPDATE "terminals"
      SET
        "active" = ${data.active ?? data.isActive ?? current.active},
        "location" = ${data.location !== undefined ? data.location.trim() : current.location},
        "name" = ${data.name !== undefined ? data.name.trim() : current.name},
        "roomIds" = ${data.roomIds !== undefined ? toIdList(data.roomIds) : current.roomIds},
        "serviceTypeIds" = ${data.serviceTypeIds !== undefined ? toIdList(data.serviceTypeIds) : current.serviceTypeIds},
        "updatedAt" = NOW()
      WHERE "id" = ${id}
      RETURNING *
    `.then((rows) => rows[0] ?? null);
  }

  remove(id: number) {
    return this.prisma.$executeRaw`
      DELETE FROM "terminals"
      WHERE "id" = ${id}
    `;
  }
}

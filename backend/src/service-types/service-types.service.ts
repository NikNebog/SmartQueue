import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceTypesService {
  constructor(private prisma: PrismaService) {}

  private readonly archiveServiceBaseName = 'Служебная архивная услуга';
  private readonly archiveServicePrefixCandidates = ['AR', 'AR1', 'AR2', 'AR3', 'AR4', 'ZZ1', 'ZZ2'];
  private readonly openTicketStatuses = ['created', 'waiting', 'called', 'in_service', 'postponed', 'redirected'] as const;

  private normalizeName(value: unknown): string {
    const name = String(value ?? '').trim();

    if (!name) {
      throw new BadRequestException('Укажите название услуги.');
    }

    return name;
  }

  private normalizeTicketPrefix(value: unknown): string {
    const prefix = String(value ?? '')
      .trim()
      .toLocaleUpperCase('ru-RU')
      .replace(/\s+/g, '');

    if (!prefix) {
      throw new BadRequestException('Укажите префикс талона.');
    }

    if (!/^[A-ZА-ЯЁ0-9]{1,4}$/u.test(prefix)) {
      throw new BadRequestException('Префикс талона должен содержать 1-4 буквы или цифры без пробелов.');
    }

    return prefix;
  }

  private normalizeDuration(value: unknown, fallback = 10): number {
    const duration = Number(value ?? fallback);

    if (!Number.isFinite(duration) || duration < 1) {
      throw new BadRequestException('Среднее время услуги должно быть не меньше 1 минуты.');
    }

    return Math.round(duration);
  }

  private normalizePriority(value: unknown, fallback = 1): number {
    const priority = Number(value ?? fallback);

    if (!Number.isFinite(priority) || priority < 0) {
      throw new BadRequestException('Приоритет услуги должен быть не меньше 0.');
    }

    return Math.round(priority);
  }

  private normalizeTranslation(value: unknown): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const text = String(value).trim();

    return text || null;
  }

  private getTranslation(data: Record<string, any>, language: 'kk' | 'en'): string | null | undefined {
    const directKey = language === 'kk' ? 'nameKk' : 'nameEn';

    return this.normalizeTranslation(
      data?.[directKey]
        ?? data?.translations?.[language],
    );
  }

  private mapUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');

      if (target.includes('ticketPrefix')) {
        throw new ConflictException('Префикс талона уже используется.');
      }

      if (target.includes('name')) {
        throw new ConflictException('Тип услуги с таким названием уже существует.');
      }
    }

    throw error;
  }

  private async ensureArchiveServiceType(excludeId?: number) {
    const existing = await this.prisma.serviceType.findFirst({
      where: {
        name: this.archiveServiceBaseName,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (existing) {
      return existing;
    }

    const usedPrefixes = new Set(
      (await this.prisma.serviceType.findMany({
        select: { ticketPrefix: true },
      })).map((serviceType) => serviceType.ticketPrefix),
    );

    const ticketPrefix = this.archiveServicePrefixCandidates.find((candidate) => !usedPrefixes.has(candidate))
      ?? `A${Date.now().toString().slice(-3)}`;

    return this.prisma.serviceType.create({
      data: {
        name: this.archiveServiceBaseName,
        ticketPrefix,
        averageDurationMinutes: 1,
        priorityWeight: 0,
        active: false,
      },
    });
  }

  async findAll() {
    return this.prisma.serviceType.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.serviceType.findUnique({
      where: { id },
    });
  }

  async create(data: Record<string, any>) {
    const payload = {
      active: data.active ?? true,
      averageDurationMinutes: this.normalizeDuration(data.averageDurationMinutes, 10),
      name: this.normalizeName(data.name),
      nameEn: this.getTranslation(data, 'en') ?? null,
      nameKk: this.getTranslation(data, 'kk') ?? null,
      priorityWeight: this.normalizePriority(data.priorityWeight, 1),
      ticketPrefix: this.normalizeTicketPrefix(data.ticketPrefix),
    };

    try {
      return await this.prisma.serviceType.create({
        data: payload,
      });
    } catch (error) {
      this.mapUniqueError(error);
    }
  }

  async update(id: number, data: Record<string, any>) {
    const current = await this.findOne(id);

    if (!current) {
      return null;
    }

    const nameKk = this.getTranslation(data, 'kk');
    const nameEn = this.getTranslation(data, 'en');
    const nextData = {
      active: data.active !== undefined ? Boolean(data.active) : current.active,
      averageDurationMinutes: data.averageDurationMinutes !== undefined
        ? this.normalizeDuration(data.averageDurationMinutes, current.averageDurationMinutes)
        : current.averageDurationMinutes,
      name: data.name !== undefined ? this.normalizeName(data.name) : current.name,
      nameEn: nameEn !== undefined ? nameEn : current.nameEn,
      nameKk: nameKk !== undefined ? nameKk : current.nameKk,
      priorityWeight: data.priorityWeight !== undefined
        ? this.normalizePriority(data.priorityWeight, current.priorityWeight)
        : current.priorityWeight,
      ticketPrefix: data.ticketPrefix !== undefined
        ? this.normalizeTicketPrefix(data.ticketPrefix)
        : current.ticketPrefix,
    };

    try {
      return await this.prisma.serviceType.update({
        where: { id },
        data: nextData,
      });
    } catch (error) {
      this.mapUniqueError(error);
    }
  }

  async remove(id: number) {
    const current = await this.prisma.serviceType.findUnique({
      where: { id },
    });

    if (!current) {
      return null;
    }

    const archiveServiceType = await this.ensureArchiveServiceType(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: {
          serviceTypeId: id,
          status: { in: [...this.openTicketStatuses] },
        },
        data: {
          roomId: null,
          serviceTypeId: archiveServiceType.id,
          status: 'no_show',
        },
      });

      await tx.ticket.updateMany({
        where: { serviceTypeId: id },
        data: { serviceTypeId: archiveServiceType.id },
      });

      await tx.$executeRaw`
        UPDATE "terminals"
        SET "serviceTypeIds" = array_remove("serviceTypeIds", ${id})
        WHERE ${id} = ANY("serviceTypeIds")
      `;

      await tx.roomServiceType.deleteMany({ where: { serviceTypeId: id } });
      await tx.serviceType.delete({ where: { id } });
    });

    return { success: true };
  }
}

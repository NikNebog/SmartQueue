import {
  queueApi,
  ticketApi,
  toServiceError,
  type QueueListener,
  type RoomQueueStat,
  type QueueOverloadRoom,
} from './api'
import type { AnalyticsPeriod, AnalyticsPoint, QueueSnapshot } from '@shared/types'
import { isTicketCreatedToday } from '@shared/utils'
import { withOperationalRefresh } from './syncService'
import type { QueueStats, Room, Ticket } from '../types'

export const queueService = {
  async getBoardSnapshot(roomId?: string | number): Promise<QueueSnapshot> {
    try {
      const snapshot = await queueApi.getBoardSnapshot(roomId)

      return {
        ...snapshot,
        tickets: snapshot.tickets.filter((ticket) => isTicketCreatedToday(ticket)),
      }
    } catch (error) {
      console.error('queueService.getBoardSnapshot failed', error)
      throw toServiceError(error, 'Не удалось получить данные табло')
    }
  },

  async getPeriodAnalytics(period: AnalyticsPeriod): Promise<AnalyticsPoint[]> {
    try {
      return await queueApi.getPeriodAnalytics(period)
    } catch (error) {
      console.error('queueService.getPeriodAnalytics failed', error)
      throw toServiceError(error, 'Не удалось получить аналитику за период')
    }
  },

  async getStats(): Promise<QueueStats> {
    try {
      return await queueApi.getStats()
    } catch (error) {
      console.error('queueService.getStats failed', error)
      throw toServiceError(error, 'Не удалось получить статистику')
    }
  },

  async getRoomStats(): Promise<RoomQueueStat[]> {
    try {
      return await queueApi.getRoomStats()
    } catch (error) {
      console.error('queueService.getRoomStats failed', error)
      throw toServiceError(error, 'Не удалось получить статистику кабинетов')
    }
  },

  async getQueueByRoom(roomId: string | number): Promise<Ticket[]> {
    try {
      return await queueApi.getQueueByRoom(roomId)
    } catch (error) {
      console.error('queueService.getQueueByRoom failed', error)
      throw toServiceError(error, 'Не удалось получить очередь кабинета')
    }
  },

  async getNextTicket(roomId: string | number): Promise<Ticket | undefined> {
    try {
      return await queueApi.getNextTicket(roomId)
    } catch (error) {
      console.error('queueService.getNextTicket failed', error)
      throw toServiceError(error, 'Не удалось получить следующий талон')
    }
  },

  async getHighPriority(): Promise<Ticket[]> {
    try {
      return await queueApi.getHighPriority()
    } catch (error) {
      console.error('queueService.getHighPriority failed', error)
      throw toServiceError(error, 'Не удалось получить приоритетные талоны')
    }
  },

  async checkOverload(): Promise<QueueOverloadRoom[]> {
    try {
      return await queueApi.checkOverload()
    } catch (error) {
      console.error('queueService.checkOverload failed', error)
      throw toServiceError(error, 'Не удалось проверить нагрузку кабинетов')
    }
  },

  async getQueue(): Promise<Ticket[]> {
    try {
      return await queueApi.getQueue()
    } catch (error) {
      console.error('queueService.getQueue failed', error)
      throw toServiceError(error, 'Не удалось получить очередь')
    }
  },

  async getRooms(): Promise<Room[]> {
    try {
      return await queueApi.getRooms()
    } catch (error) {
      console.error('queueService.getRooms failed', error)
      throw toServiceError(error, 'Не удалось получить кабинеты')
    }
  },

  async resolveRecommendation(id: string): Promise<QueueSnapshot> {
    try {
      return await queueApi.resolveRecommendation(id)
    } catch (error) {
      console.error('queueService.resolveRecommendation failed', error)
      throw toServiceError(error, 'Не удалось закрыть уведомление')
    }
  },

  async callNext(roomId?: string | number): Promise<Ticket | undefined> {
    try {
      return await withOperationalRefresh(async () => {
        if (!roomId) {
          const highPriorityTicket = (await queueApi.getHighPriority())[0]

          return highPriorityTicket ? ticketApi.callTicket(highPriorityTicket.id) : undefined
        }

        const nextTicket = await queueApi.getNextTicket(roomId)

        return nextTicket ? ticketApi.callTicket(nextTicket.id) : undefined
      }, 'Пациент вызван')
    } catch (error) {
      console.error('queueService.callNext failed', error)
      throw toServiceError(error, 'Не удалось вызвать следующего пациента')
    }
  },

  async startService(ticketId: string): Promise<Ticket | undefined> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.startTicket(ticketId),
        'Приём начат',
      )
    } catch (error) {
      console.error('queueService.startService failed', error)
      throw toServiceError(error, 'Не удалось начать приём')
    }
  },

  async completeService(ticketId: string): Promise<Ticket | undefined> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.completeTicket(ticketId),
        'Приём завершён',
      )
    } catch (error) {
      console.error('queueService.completeService failed', error)
      throw toServiceError(error, 'Не удалось завершить приём')
    }
  },

  subscribeQueue(listener: QueueListener): () => void {
    return queueApi.subscribeQueue(listener)
  },

  replaceQueue(nextTickets: Ticket[]): void {
    queueApi.replaceQueue(nextTickets)
  },
}

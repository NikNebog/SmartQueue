import {
  ticketApi,
  toServiceError,
  type TicketCreateSettingsPayload,
  type TicketSettingsOptions,
  type TicketSettingsPayload,
} from './api'
import { withOperationalRefresh } from './syncService'
import type { Ticket as SharedTicket } from '@shared/types'
import type {
  CreateTicketInput,
  Ticket,
  UpdateTicketStatusInput,
} from '../types'

export const ticketService = {
  async getTickets(): Promise<Ticket[]> {
    try {
      return await ticketApi.getTickets()
    } catch (error) {
      console.error('ticketService.getTickets failed', error)
      throw toServiceError(error, 'Не удалось получить талоны')
    }
  },

  async getTicketById(id: string): Promise<Ticket | undefined> {
    try {
      return await ticketApi.getTicketById(id)
    } catch (error) {
      console.error('ticketService.getTicketById failed', error)
      throw toServiceError(error, 'Не удалось получить талон')
    }
  },

  async getTicketHistory(id: string): Promise<SharedTicket | undefined> {
    try {
      return await ticketApi.getTicketHistory(id)
    } catch (error) {
      console.error('ticketService.getTicketHistory failed', error)
      throw toServiceError(error, 'Не удалось получить историю талона')
    }
  },

  async createTicket(input: CreateTicketInput): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.createTicket(input),
        'Талон успешно создан',
      )
    } catch (error) {
      console.error('ticketService.createTicket failed', error)
      throw toServiceError(error, 'Не удалось создать талон')
    }
  },

  async createTicketWithSettings(input: TicketCreateSettingsPayload): Promise<SharedTicket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.createTicketWithSettings(input),
        'Талон успешно создан',
      )
    } catch (error) {
      console.error('ticketService.createTicketWithSettings failed', error)
      throw toServiceError(error, 'Не удалось создать талон')
    }
  },

  async arriveTicket(id: string): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.arriveTicket(id),
        'Талон возвращён в очередь',
      )
    } catch (error) {
      console.error('ticketService.arriveTicket failed', error)
      throw toServiceError(error, 'Не удалось вернуть талон в очередь')
    }
  },

  async callTicket(id: string): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.callTicket(id),
        'Пациент вызван',
      )
    } catch (error) {
      console.error('ticketService.callTicket failed', error)
      throw toServiceError(error, 'Не удалось вызвать пациента')
    }
  },

  async startTicket(id: string): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.startTicket(id),
        'Приём начат',
      )
    } catch (error) {
      console.error('ticketService.startTicket failed', error)
      throw toServiceError(error, 'Не удалось начать приём')
    }
  },

  async completeTicket(id: string): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.completeTicket(id),
        'Приём завершён',
      )
    } catch (error) {
      console.error('ticketService.completeTicket failed', error)
      throw toServiceError(error, 'Не удалось завершить приём')
    }
  },

  async cancelTicket(id: string): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.cancelTicket(id),
        'Талон отменён',
      )
    } catch (error) {
      console.error('ticketService.cancelTicket failed', error)
      throw toServiceError(error, 'Не удалось отменить талон')
    }
  },

  async noShowTicket(id: string): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.noShowTicket(id),
        'Талон отмечен как неявка',
      )
    } catch (error) {
      console.error('ticketService.noShowTicket failed', error)
      throw toServiceError(error, 'Не удалось отметить неявку')
    }
  },

  async skipTicket(id: string): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.skipTicket(id),
        'Талон отмечен как неявка',
      )
    } catch (error) {
      console.error('ticketService.skipTicket failed', error)
      throw toServiceError(error, 'Не удалось отметить неявку')
    }
  },

  async returnTicket(id: string, roomId?: string | number): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.returnTicket(id, roomId),
        'Талон возвращён в очередь',
      )
    } catch (error) {
      console.error('ticketService.returnTicket failed', error)
      throw toServiceError(error, 'Не удалось вернуть талон в очередь')
    }
  },

  async redirectTicket(id: string, newRoomId: string | number): Promise<Ticket> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.redirectTicket(id, newRoomId),
        'Талон перенаправлен',
      )
    } catch (error) {
      console.error('ticketService.redirectTicket failed', error)
      throw toServiceError(error, 'Не удалось перенаправить талон')
    }
  },

  async updateTicketStatus(input: UpdateTicketStatusInput): Promise<Ticket | undefined> {
    try {
      return await withOperationalRefresh(
        () => ticketApi.updateTicketStatus(input),
        'Статус талона обновлён',
      )
    } catch (error) {
      console.error('ticketService.updateTicketStatus failed', error)
      throw toServiceError(error, 'Не удалось обновить статус талона')
    }
  },

  async getTicketSettingsOptions(): Promise<TicketSettingsOptions> {
    try {
      return await ticketApi.getTicketSettingsOptions()
    } catch (error) {
      console.error('ticketService.getTicketSettingsOptions failed', error)
      throw toServiceError(error, 'Не удалось получить настройки талона')
    }
  },

  async updateTicketSettings(id: string, payload: TicketSettingsPayload): Promise<void> {
    try {
      await withOperationalRefresh(
        () => ticketApi.updateTicketSettings(id, payload),
        'Талон успешно сохранён',
      )
    } catch (error) {
      console.error('ticketService.updateTicketSettings failed', error)
      throw toServiceError(error, 'Не удалось сохранить настройки талона')
    }
  },
}

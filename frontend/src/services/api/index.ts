import { API_MODE } from './apiProvider'
import { backendAdminApi } from './backend/backendAdminApi'
import { backendAuthApi } from './backend/backendAuthApi'
import { backendKioskApi } from './backend/backendKioskApi'
import { backendQueueApi } from './backend/backendQueueApi'
import { backendTicketApi } from './backend/backendTicketApi'
import { mockAdminApi } from './mock/mockAdminApi'
import { mockAuthApi } from './mock/mockAuthApi'
import { mockKioskApi } from './mock/mockKioskApi'
import { mockQueueApi } from './mock/mockQueueApi'
import { mockTicketApi } from './mock/mockTicketApi'

export const ticketApi = API_MODE === 'backend' ? backendTicketApi : mockTicketApi
export const queueApi = API_MODE === 'backend' ? backendQueueApi : mockQueueApi
export const authApi = API_MODE === 'backend' ? backendAuthApi : mockAuthApi
export const adminApi = API_MODE === 'backend' ? backendAdminApi : mockAdminApi
export const kioskApi = API_MODE === 'backend' ? backendKioskApi : mockKioskApi

export { socketClient } from './socketClient'
export { getApiErrorMessage, toServiceError } from './errors'
export type {
  AdminApi,
  AdminRecord,
  AdminRecordInput,
  AdminServiceTypeInput,
  AdminTerminalInput,
  AdminTerminalRecord,
  AdminUserInput,
  AuthApi,
  BoardScreen,
  BoardPromoImageItem,
  BoardPromoMedia,
  BoardPromoVideoItem,
  BoardSettings,
  BoardSettingsProfile,
  BoardTemplate,
  KioskApi,
  QueueApi,
  QueueListener,
  QueueOverloadRoom,
  RoomQueueStat,
  TicketApi,
  TicketCreateSettingsPayload,
  TicketSettingsOptions,
  TicketSettingsPayload,
  TicketSettingsRoomOption,
  TicketSettingsServiceTypeOption,
  TicketSettingsUserOption,
} from './types'

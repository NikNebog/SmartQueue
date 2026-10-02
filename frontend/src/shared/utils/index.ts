export { deepClone } from './deepClone'
export { formatDuration, formatEta, formatTime } from './format'
export { createMockTicket, createQueueEvent, generateTicketNumber } from './mockGenerators'
export {
  formatPeopleAhead,
  getRoomQueuePeopleAhead,
  getTicketPeopleAhead,
} from './queuePosition'
export { planRoomLoads } from './queuePlanning'
export {
  formatRoomName,
  formatRoomVoiceTarget,
  getRoomBoardId,
  getRoomClosedLabel,
  getRoomPlaceNumber,
  getRoomPlaceType,
  getRoomPlaceTypeLabel,
  isValidRoomNumber,
  normalizeRoomLookupValue,
  roomMatchesIdentifier,
} from './room'
export {
  formatWaitingTime,
  getAverageWaitingMinutes,
  getWaitingMinutes,
  isTicketCreatedToday,
} from './time'
export { useCurrentTime } from './useCurrentTime'
export {
  activeWorkloadStatuses,
  createRoomWorkTimeRecommendation,
  getActiveTicketsForRoom,
  getRemainingWorkMinutes,
  getRoomWorkloadRisk,
  hasWorkHours,
  isWithinTicketIssueHours,
  isWithinWorkHours,
  normalizeWorkTime,
  parseWorkTimeMinutes,
} from './workingHours'
export {
  fallbackServiceDurationMinutes,
  getAverageServiceDurationStats,
  getAverageServiceMinutesForTicket,
  getQueueServiceDurationMinutes,
} from './serviceDuration'
export {
  getPriorityMeta,
  getServiceTypeLabel,
  getTicketStatusMeta,
  getWaitSeverity,
  isActiveTicket,
  priorityMeta,
  serviceTypeLabel,
  ticketStatusMeta,
} from './status'

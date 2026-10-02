import type { VoiceSettings } from '@services/voiceSettingsService'
import type { Room, Ticket } from '@shared/types'
import {
  getRoomPlaceNumber,
  getRoomPlaceType,
} from '@shared/utils'

type TicketRoom = Room | {
  id?: string
  name?: string
  number?: string | number
  placeType?: string
}

const englishAudioBasePath = '/audio/en'
const englishAudioBoost = 4.5
const letterAnnouncementPlaybackRate = 1
const announcementPlaybackRate = 1.5625
const numberAnnouncementPlaybackRate = 1.775
const fallbackBeepDurationMs = 300

const latinLetterAudioNames: Record<string, string> = {
  A: 'latin_a',
  B: 'latin_b',
  C: 'latin_c',
  D: 'latin_d',
  E: 'latin_e',
  F: 'latin_f',
  G: 'latin_g',
  H: 'latin_h',
  I: 'latin_i',
  J: 'latin_j',
  K: 'latin_k',
  L: 'latin_l',
  M: 'latin_m',
  N: 'latin_n',
  O: 'latin_o',
  P: 'latin_p',
  Q: 'latin_q',
  R: 'latin_r',
  S: 'latin_s',
  T: 'latin_t',
  U: 'latin_u',
  V: 'latin_v',
  W: 'latin_w',
  X: 'latin_x',
  Y: 'latin_y',
  Z: 'latin_z',
}

function warnAudioIssue(message: string, details?: unknown) {
  if (import.meta.env.DEV) {
    console.warn(message, details)
  }
}

function toAudioPath(kind: 'letters' | 'numbers' | 'phrases', name: string | number): string {
  return `${englishAudioBasePath}/${kind}/${name}.wav`
}

function normalizeTicketNumber(value: string): string {
  return value.trim().replace(/\s+/g, '').replace(/-/g, '')
}

function getLetterAudioPart(letter: string): string | null {
  const normalizedLetter = letter.toLocaleUpperCase('en-US')
  const fileName = latinLetterAudioNames[normalizedLetter]

  if (fileName) {
    return toAudioPath('letters', fileName)
  }

  warnAudioIssue(`Unknown letter for English offline board audio: ${letter}`)
  return null
}

function getTicketNumberAudioParts(ticketNumber: string): string[] {
  const normalizedNumber = normalizeTicketNumber(ticketNumber)
  const match = normalizedNumber.match(/^([A-Za-z]+)?(\d+)?/u)
  const letters = (match?.[1] ?? '').replace(/[Cc]/g, '')
  const numericPart = match?.[2] ?? normalizedNumber.replace(/\D/g, '')
  const files = letters
    .split('')
    .filter(Boolean)
    .map(getLetterAudioPart)
    .filter((file): file is string => Boolean(file))

  if (!numericPart) {
    return files
  }

  const leadingZeroMatch = numericPart.match(/^0+/)
  const leadingZeroCount = leadingZeroMatch?.[0].length ?? 0
  const rest = numericPart.slice(leadingZeroCount)

  for (let index = 0; index < leadingZeroCount; index += 1) {
    files.push(toAudioPath('numbers', 0))
  }

  if (rest) {
    const numberValue = Number(rest)

    if (Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= 999) {
      files.push(toAudioPath('numbers', numberValue))
    } else {
      rest.split('').forEach((digit) => files.push(toAudioPath('numbers', digit)))
    }
  }

  if (!rest && leadingZeroCount === 0) {
    files.push(toAudioPath('numbers', 0))
  }

  return files
}

function getPlaceNumberAudioPart(place?: TicketRoom): string | undefined {
  const placeNumber = getRoomPlaceNumber(place) || (place?.id ? String(place.id) : '')
  const numericPlaceNumber = placeNumber.replace(/\D/g, '')

  if (placeNumber && numericPlaceNumber !== placeNumber) {
    warnAudioIssue(
      `Letters in service place number are not supported by English offline board audio yet: ${placeNumber}. Numeric part will be used.`,
    )
  }

  if (!numericPlaceNumber) {
    return undefined
  }

  const numberValue = Number(numericPlaceNumber)

  return Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= 999
    ? toAudioPath('numbers', numberValue)
    : undefined
}

function getPlacePhrase(place: TicketRoom | undefined, voiceSettings: VoiceSettings): string {
  const placeType = getRoomPlaceType(place)
  const actionPrefix = voiceSettings.action === 'enter' ? 'proceed' : 'come'

  if (placeType === 'window') return `${actionPrefix}_window`
  if (placeType === 'desk') return `${actionPrefix}_desk`

  return `${actionPrefix}_room`
}

export function buildEnglishCallAudioSequence(
  ticket: Ticket,
  place: TicketRoom | undefined,
  voiceSettings: VoiceSettings,
): string[] {
  const audiencePhrase = voiceSettings.audience === 'client' ? 'client' : 'patient'
  const placeNumber = getPlaceNumberAudioPart(place)

  return [
    toAudioPath('phrases', audiencePhrase),
    toAudioPath('phrases', 'ticket_number'),
    ...getTicketNumberAudioParts(ticket.number),
    toAudioPath('phrases', getPlacePhrase(place, voiceSettings)),
    ...(placeNumber ? [placeNumber] : []),
  ]
}

async function playFallbackBeep(): Promise<void> {
  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextConstructor) {
    return
  }

  const audioContext = new AudioContextConstructor()

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gain.gain.setValueAtTime(0.001, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.216, audioContext.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.32)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.34)

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, fallbackBeepDurationMs)
  })
  await audioContext.close().catch(() => undefined)
}

function playAudioFile(src: string): Promise<'played' | 'skipped' | 'blocked'> {
  return new Promise((resolve) => {
    const audio = new Audio(src)
    let settled = false
    let sourceNode: MediaElementAudioSourceNode | null = null
    let audioContext: AudioContext | null = null

    const finish = (result: 'played' | 'skipped' | 'blocked') => {
      if (settled) {
        return
      }

      settled = true
      audio.onended = null
      audio.onerror = null
      audio.onabort = null
      sourceNode?.disconnect()
      resolve(result)
    }

    audio.preload = 'auto'
    audio.playbackRate = src.includes('/letters/')
      ? letterAnnouncementPlaybackRate
      : src.includes('/numbers/')
        ? numberAnnouncementPlaybackRate
        : announcementPlaybackRate
    audio.volume = 1

    const AudioContextConstructor = window.AudioContext
      ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (AudioContextConstructor) {
      audioContext = new AudioContextConstructor()

      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => undefined)
      }

      const gainNode = audioContext.createGain()

      gainNode.gain.value = englishAudioBoost
      sourceNode = audioContext.createMediaElementSource(audio)
      sourceNode.connect(gainNode)
      gainNode.connect(audioContext.destination)
    }

    audio.onended = () => {
      void audioContext?.close().catch(() => undefined)
      finish('played')
    }
    audio.onerror = () => {
      warnAudioIssue(`English offline audio file is missing or unreadable: ${src}`)
      void audioContext?.close().catch(() => undefined)
      finish('skipped')
    }
    audio.onabort = () => {
      void audioContext?.close().catch(() => undefined)
      finish('blocked')
    }

    audio.play().catch((error) => {
      warnAudioIssue(`Browser blocked or failed to play English offline audio file: ${src}`, error)
      void audioContext?.close().catch(() => undefined)
      finish('blocked')
    })
  })
}

export async function playAudioSequence(files: string[]): Promise<void> {
  if (files.length === 0) {
    await playFallbackBeep()
    return
  }

  let playedAny = false
  let blocked = false

  for (const file of files) {
    const result = await playAudioFile(file)

    if (result === 'played') {
      playedAny = true
    }
    if (result === 'blocked') {
      blocked = true
    }
  }

  if (blocked || !playedAny) {
    await playFallbackBeep().catch((error) => {
      warnAudioIssue('Browser blocked fallback sound for English offline board audio', error)
    })
  }
}

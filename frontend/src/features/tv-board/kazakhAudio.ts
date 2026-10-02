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

const kazakhAudioBasePath = '/audio/kk'
const kazakhAudioBoost = 4.5
const letterAnnouncementPlaybackRate = 1
const announcementPlaybackRate = 1.5625
const numberAnnouncementPlaybackRate = 1.775
const fallbackBeepDurationMs = 255

const russianLetterAudioNames: Record<string, string> = {
  '\u0410': 'a_ru',
  '\u0411': 'be_ru',
  '\u0412': 've_ru',
  '\u0413': 'ge_ru',
  '\u0414': 'de_ru',
  '\u0415': 'e_ru',
  '\u0401': 'yo_ru',
  '\u0416': 'zhe_ru',
  '\u0417': 'ze_ru',
  '\u0418': 'i_ru',
  '\u0419': 'short_i_ru',
  '\u041a': 'ka_ru',
  '\u041b': 'el_ru',
  '\u041c': 'em_ru',
  '\u041d': 'en_ru',
  '\u041e': 'o_ru',
  '\u041f': 'pe_ru',
  '\u0420': 'er_ru',
  '\u0421': 'es_ru',
  '\u0422': 'te_ru',
  '\u0423': 'u_ru',
  '\u0424': 'ef_ru',
  '\u0425': 'ha_ru',
  '\u0426': 'tse_ru',
  '\u0427': 'che_ru',
  '\u0428': 'sha_ru',
  '\u0429': 'sha2_ru',
  '\u042a': 'hard_ru',
  '\u042b': 'y_ru',
  '\u042c': 'soft_ru',
  '\u042d': 'ae_ru',
  '\u042e': 'yu_ru',
  '\u042f': 'ya_ru',
}

const latinLetterAudioNames: Record<string, string> = {
  A: 'a_ru',
  B: 'be_ru',
  C: 'es_ru',
  D: 'de_ru',
  E: 'e_ru',
  F: 'ef_ru',
  G: 'ge_ru',
  H: 'ha_ru',
  I: 'i_ru',
  J: 'zhe_ru',
  K: 'ka_ru',
  L: 'el_ru',
  M: 'em_ru',
  N: 'en_ru',
  O: 'o_ru',
  P: 'pe_ru',
  Q: 'ka_ru',
  R: 'er_ru',
  S: 'es_ru',
  T: 'te_ru',
  U: 'u_ru',
  V: 've_ru',
  W: 've_ru',
  X: 'ha_ru',
  Y: 'y_ru',
  Z: 'ze_ru',
}

function warnAudioIssue(message: string, details?: unknown) {
  if (import.meta.env.DEV) {
    console.warn(message, details)
  }
}

function toAudioPath(kind: 'letters' | 'numbers' | 'phrases', name: string | number): string {
  return `${kazakhAudioBasePath}/${kind}/${name}.mp3`
}

function normalizeTicketNumber(value: string): string {
  return value.trim().replace(/\s+/g, '').replace(/-/g, '')
}

export function getKazakhRussianLetterAudio(letter: string): string | null {
  const upperLetter = letter.toLocaleUpperCase('ru-RU')
  const fileName = russianLetterAudioNames[upperLetter]

  if (!fileName) {
    warnAudioIssue(`Unknown Kazakh letter audio mapping: ${letter}`)
    return null
  }

  return toAudioPath('letters', fileName)
}

function getTicketLetterAudioPart(letter: string): string | null {
  if (/^[\u0410-\u042f\u0401\u0430-\u044f\u0451]$/u.test(letter)) {
    return getKazakhRussianLetterAudio(letter)
  }

  if (/^[A-Za-z]$/.test(letter)) {
    const fileName = latinLetterAudioNames[letter.toLocaleUpperCase('en-US')]

    if (fileName) {
      return toAudioPath('letters', fileName)
    }
  }

  warnAudioIssue(`Unknown ticket letter for Kazakh audio: ${letter}`)
  return null
}

function getTicketNumberAudioParts(ticketNumber: string): string[] {
  const normalizedNumber = normalizeTicketNumber(ticketNumber)
  const match = normalizedNumber.match(/^([A-Za-z\u0410-\u042f\u0401\u0430-\u044f\u0451]+)?(\d+)?/u)
  const letters = (match?.[1] ?? '').replace(/[\u0421\u0441Cc]/g, '')
  const numericPart = match?.[2] ?? normalizedNumber.replace(/\D/g, '')
  const files = letters
    .split('')
    .filter(Boolean)
    .map(getTicketLetterAudioPart)
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

    if (Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= 1000) {
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

  if (!numericPlaceNumber) {
    return undefined
  }

  const numberValue = Number(numericPlaceNumber)

  return Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= 1000
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

export function buildKazakhCallAudioSequence(
  ticket: Ticket,
  place: TicketRoom | undefined,
  voiceSettings: VoiceSettings,
): string[] {
  const audiencePhrase = voiceSettings.audience === 'client' ? 'client' : 'patient'
  const placeNumber = getPlaceNumberAudioPart(place)

  return [
    toAudioPath('phrases', 'ticket_number'),
    ...getTicketNumberAudioParts(ticket.number),
    toAudioPath('phrases', audiencePhrase),
    ...(placeNumber ? [placeNumber] : []),
    toAudioPath('phrases', getPlacePhrase(place, voiceSettings)),
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
  gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.28)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.3)

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
      void audioContext?.close().catch(() => undefined)
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

      gainNode.gain.value = kazakhAudioBoost
      sourceNode = audioContext.createMediaElementSource(audio)
      sourceNode.connect(gainNode)
      gainNode.connect(audioContext.destination)
    }

    audio.onended = () => finish('played')
    audio.onerror = () => finish('skipped')
    audio.onabort = () => finish('blocked')

    audio.play().catch((error) => {
      warnAudioIssue(`Kazakh audio playback was blocked: ${src}`, error)
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
      warnAudioIssue('Kazakh fallback beep failed', error)
    })
  }
}

import { useEffect, useMemo, useRef } from 'react'
import { Printer } from 'lucide-react'
import { getLocale, type SmartQLanguage } from '@shared/locales/useLocale'
import { Button } from '@shared/ui/components'
import { formatPeopleAhead } from '@shared/utils'

export type TicketPrintData = {
  date: Date
  doctorName?: string
  estimatedWaitMinutes?: number
  language?: SmartQLanguage
  organizationName?: string
  peopleAhead?: number
  priorityLabel: string
  roomName: string
  serviceName: string
  ticketNumber: string
}

type TicketPrintPreviewProps = {
  autoPrint?: boolean
  data?: TicketPrintData
  screenHidden?: boolean
  showPrintButton?: boolean
}

const intlLocaleByLanguage: Record<SmartQLanguage, string> = {
  en: 'en-US',
  kk: 'kk-KZ',
  ru: 'ru-RU',
}

function copyHeadStyles(targetDocument: Document) {
  const sourceNodes = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))

  sourceNodes.forEach((node) => {
    targetDocument.head.appendChild(node.cloneNode(true))
  })
}

function printInHiddenFrame(contentNode: HTMLElement) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.opacity = '0'
  frame.style.pointerEvents = 'none'
  frame.style.border = '0'

  document.body.appendChild(frame)

  const frameWindow = frame.contentWindow
  const frameDocument = frame.contentDocument

  if (!frameWindow || !frameDocument) {
    frame.remove()
    return
  }

  frameDocument.open()
  frameDocument.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
  frameDocument.close()

  copyHeadStyles(frameDocument)
  frameDocument.body.appendChild(contentNode.cloneNode(true))

  window.setTimeout(() => {
    frameWindow.focus()
    frameWindow.print()
    window.setTimeout(() => frame.remove(), 1200)
  }, 80)
}

export function formatTicketDuration(minutes: number, language: SmartQLanguage): string {
  const roundedMinutes = Math.max(0, Math.floor(minutes))

  if (roundedMinutes < 1) {
    if (language === 'en') return 'now'
    if (language === 'kk') return 'Қазір'
    return 'сейчас'
  }

  if (roundedMinutes < 60) {
    if (language === 'en') return `${roundedMinutes} min`
    return `${roundedMinutes} мин`
  }

  const hours = Math.floor(roundedMinutes / 60)
  const restMinutes = roundedMinutes % 60

  if (language === 'en') {
    return restMinutes > 0 ? `${hours} h ${restMinutes} min` : `${hours} h`
  }

  if (language === 'kk') {
    return restMinutes > 0 ? `${hours} сағ ${restMinutes} мин` : `${hours} сағ`
  }

  return restMinutes > 0 ? `${hours} ч ${restMinutes} мин` : `${hours} ч`
}

export function TicketPrintPreview({
  autoPrint = false,
  data,
  screenHidden = false,
  showPrintButton = true,
}: TicketPrintPreviewProps) {
  const interfaceLocale = getLocale('ru')
  const printedTicketRef = useRef<string | null>(null)
  const printableNodeRef = useRef<HTMLDivElement | null>(null)

  const ticketLanguage = data?.language ?? 'ru'
  const locale = useMemo(() => getLocale(ticketLanguage), [ticketLanguage])

  useEffect(() => {
    if (!data) {
      printedTicketRef.current = null
      return
    }

    if (!autoPrint || printedTicketRef.current === data.ticketNumber) {
      return
    }

    printedTicketRef.current = data.ticketNumber
    const printFrameId = window.requestAnimationFrame(() => {
      if (printableNodeRef.current) {
        printInHiddenFrame(printableNodeRef.current)
      }
    })

    return () => window.cancelAnimationFrame(printFrameId)
  }, [autoPrint, data])

  if (!data) {
    return (
      <div className="ticket-print-empty">
        <span className="eyebrow">{interfaceLocale.ticketPrint.title}</span>
        <h2>{interfaceLocale.ticketPrint.emptyTitle}</h2>
        <p>{interfaceLocale.ticketPrint.emptyDescription}</p>
      </div>
    )
  }

  const labels = locale.ticketPrint
  const intlLocale = intlLocaleByLanguage[ticketLanguage]
  const formattedDate = new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data.date)
  const formattedTime = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(data.date)
  const formattedDateTime = `${formattedDate}: ${formattedTime}`
  const hasEstimatedWait = data.estimatedWaitMinutes !== undefined
    && Number.isFinite(data.estimatedWaitMinutes)

  function handlePrint() {
    if (printableNodeRef.current) {
      printInHiddenFrame(printableNodeRef.current)
    }
  }

  return (
    <section className={screenHidden ? 'ticket-print-panel ticket-print-screen-hidden' : 'ticket-print-panel'}>
      <div className="ticket-print ticket-print-preview" ref={printableNodeRef}>
        {data.organizationName ? (
          <strong className="ticket-print-brand">{data.organizationName}</strong>
        ) : null}
        <div className="ticket-print-number">
          <span>{labels.ticketNumber}</span>
          <strong>{data.ticketNumber}</strong>
        </div>

        <dl>
          <div>
            <dt>{labels.service}</dt>
            <dd>{data.serviceName}</dd>
          </div>
          <div>
            <dt>{labels.servicePlace}</dt>
            <dd>{data.roomName}</dd>
          </div>
          {data.peopleAhead !== undefined ? (
            <div>
              <dt>{labels.queue}</dt>
              <dd>{formatPeopleAhead(data.peopleAhead, data.language)}</dd>
            </div>
          ) : null}
          {hasEstimatedWait ? (
            <div>
              <dt>{labels.estimatedWait}</dt>
              <dd>{formatTicketDuration(data.estimatedWaitMinutes ?? 0, ticketLanguage)}</dd>
            </div>
          ) : null}
          {data.doctorName ? (
            <div>
              <dt>{labels.doctor}</dt>
              <dd>{data.doctorName}</dd>
            </div>
          ) : null}
          <div>
            <dt>{labels.dateTime}</dt>
            <dd>{formattedDateTime}</dd>
          </div>
        </dl>

        <p>{labels.waitBoard}</p>
      </div>

      {showPrintButton ? (
        <Button
          className="ticket-print-button no-print"
          icon={<Printer size={17} />}
          onClick={handlePrint}
          variant="secondary"
        >
          {interfaceLocale.ticketPrint.printButton}
        </Button>
      ) : null}
    </section>
  )
}

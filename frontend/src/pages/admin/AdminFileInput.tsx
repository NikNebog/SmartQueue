import type { ChangeEvent } from 'react'
import { X } from 'lucide-react'
import { useLocale } from '@shared/locales/useLocale'
import { Button } from '@shared/ui/components'

type AdminFileInputProps = {
  accept?: string
  buttonLabel?: string
  fileName?: string
  hint?: string
  id: string
  multiple?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onClear?: () => void
}

export function AdminFileInput({
  accept,
  buttonLabel,
  fileName,
  hint,
  id,
  multiple = false,
  onChange,
  onClear,
}: AdminFileInputProps) {
  const t = useLocale()
  const hasFile = Boolean(fileName)

  return (
    <div className="admin-file-input">
      <div className="admin-file-input-row">
        <label className="button button-secondary button-sm" htmlFor={id}>
          {buttonLabel ?? (hasFile ? t.file.change : t.file.choose)}
        </label>
        <span className="admin-file-input-name">
          {hasFile ? fileName : t.file.notSelected}
        </span>
        {hasFile && onClear ? (
          <Button
            icon={<X size={14} />}
            onClick={onClear}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t.file.clear}
          </Button>
        ) : null}
      </div>
      {hint ? <small className="field-help">{hint}</small> : null}
      <input
        accept={accept}
        id={id}
        multiple={multiple}
        onChange={(event) => {
          onChange(event)
          event.currentTarget.value = ''
        }}
        type="file"
      />
    </div>
  )
}

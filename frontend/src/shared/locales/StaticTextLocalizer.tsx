import { useEffect } from 'react'
import { translateStaticText } from './staticText'
import { useLanguage } from './useLocale'
import type { SmartQLanguage } from './types'

const translatedAttributes = ['aria-label', 'placeholder', 'title', 'alt'] as const
const originalTextByNode = new WeakMap<Text, string>()

function translateTextNode(node: Text, language: SmartQLanguage) {
  const originalText = originalTextByNode.get(node) ?? node.nodeValue ?? ''
  const translatedText = translateStaticText(originalText, language)

  if (translatedText !== originalText) {
    originalTextByNode.set(node, originalText)
  }

  if (node.nodeValue !== translatedText) {
    node.nodeValue = translatedText
  }
}

function translateElementAttributes(element: Element, language: SmartQLanguage) {
  translatedAttributes.forEach((attributeName) => {
    const attributeValue = element.getAttribute(attributeName)

    if (!attributeValue) {
      return
    }

    const originalAttributeName = `data-smartq-i18n-${attributeName}`
    const originalValue = element.getAttribute(originalAttributeName) ?? attributeValue
    const translatedValue = translateStaticText(originalValue, language)

    if (translatedValue !== originalValue) {
      element.setAttribute(originalAttributeName, originalValue)
      element.setAttribute(attributeName, translatedValue)
    }
  })
}

function translateNode(node: Node, language: SmartQLanguage) {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text

    if (textNode.nodeValue?.trim()) {
      translateTextNode(textNode, language)
    }

    return
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return
  }

  const element = node as Element

  if (element.closest('[data-smartq-no-i18n]')) {
    return
  }

  translateElementAttributes(element, language)

  element.childNodes.forEach((childNode) => translateNode(childNode, language))
}

export function StaticTextLocalizer() {
  const language = useLanguage()

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const root = document.getElementById('root')

    if (!root) {
      return undefined
    }

    translateNode(root, language)

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => translateNode(node, language))

        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          translateNode(mutation.target, language)
        }
      })
    })

    observer.observe(root, {
      characterData: true,
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [language])

  return null
}

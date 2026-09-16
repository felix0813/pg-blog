import React from 'react'
import { useBlocker } from 'react-router-dom'
import { postSnapshot } from './postSnapshot.js'

export function useUnsavedPostChanges(meta, content) {
  const snapshot = postSnapshot(meta, content)
  const [baseline, setBaseline] = React.useState(snapshot)
  const currentSnapshot = React.useRef(snapshot)
  const dirty = React.useRef(false)
  const savedNavigation = React.useRef(false)
  currentSnapshot.current = snapshot
  dirty.current = snapshot !== baseline

  const blocker = useBlocker(React.useCallback(({ currentLocation, nextLocation }) => (
    !savedNavigation.current && dirty.current && (
      currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search ||
      currentLocation.hash !== nextLocation.hash
    )
  ), []))

  React.useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('文章有未保存的更改，离开将丢失这些更改。确定离开吗？')) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])

  React.useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!dirty.current || savedNavigation.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  function markBaseline(savedMeta, savedContent) {
    setBaseline(postSnapshot(savedMeta, savedContent))
  }

  function finishSave(savedMeta, savedContent) {
    const savedSnapshot = postSnapshot(savedMeta, savedContent)
    setBaseline(savedSnapshot)
    // Do not silently discard edits made while the save request was in flight.
    const unchanged = currentSnapshot.current === savedSnapshot
    if (unchanged) {
      dirty.current = false
      savedNavigation.current = true
    }
    return unchanged
  }

  return { isDirty: snapshot !== baseline, markBaseline, finishSave }
}

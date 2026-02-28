import React, { useEffect, useRef, useState } from 'react'

/**
 * LazyRender
 * Renders its children only after the wrapper enters the viewport.
 * Uses IntersectionObserver for efficient lazy loading of heavy components.
 */
function LazyRender({
  children,
  placeholder = null,
  rootMargin = '200px',
  threshold = 0
}) {
  const containerRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isVisible || !containerRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin, threshold }
    )

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [isVisible, rootMargin, threshold])

  return (
    <div ref={containerRef}>
      {isVisible ? children : placeholder}
    </div>
  )
}

export default LazyRender



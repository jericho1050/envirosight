"use client"

import React, { ReactNode, useState, useRef, useEffect } from "react"

interface DraggableWrapperProps {
  children: ReactNode
  handle?: string
  bounds?: string
  defaultPosition?: { x: number; y: number }
}

export default function DraggableWrapper({ 
  children, 
  handle, 
  bounds, 
  defaultPosition = { x: 0, y: 0 } 
}: DraggableWrapperProps) {
  const [position, setPosition] = useState(defaultPosition)
  const [isDragging, setIsDragging] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const elementStartPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    // Add event listeners for mousemove and mouseup to handle dragging
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      // Calculate new position
      const dx = e.clientX - dragStartPos.current.x
      const dy = e.clientY - dragStartPos.current.y
      
      let newX = elementStartPos.current.x + dx
      let newY = elementStartPos.current.y + dy
      
      // Apply bounds if specified and element is available
      if (bounds === "parent" && wrapperRef.current && wrapperRef.current.parentElement) {
        const parent = wrapperRef.current.parentElement
        const parentRect = parent.getBoundingClientRect()
        const elementRect = wrapperRef.current.getBoundingClientRect()
        
        // Ensure the element stays within the parent bounds
        newX = Math.max(0, Math.min(newX, parentRect.width - elementRect.width))
        newY = Math.max(0, Math.min(newY, parentRect.height - elementRect.height))
      }
      
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, bounds])

  const handleMouseDown = (e: React.MouseEvent<Element, MouseEvent>) => {
    if (handle) {
      // If handle is specified, check if the event target is the handle
      const target = e.target as Element
      // Check if the clicked element or any of its parents matches the handle selector
      let currentElement = target
      let isHandle = false
      while (currentElement instanceof Element) {
        if (currentElement.matches(handle)) {
          isHandle = true
          break
        }
        if (currentElement.parentElement) {
          currentElement = currentElement.parentElement
        } else {
          break
        }
      }
      if (!isHandle) return
    }
    
    // Prevent default to avoid text selection during drag
    e.preventDefault()
    
    // Store the starting position of the cursor and the element
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    elementStartPos.current = { ...position }
    
    setIsDragging(true)
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : handle ? 'default' : 'grab',
        userSelect: 'none',
        touchAction: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  )
}
import { useState, useRef } from 'react';

export function useDragScroll() {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const startDrag = (e) => {
    if (!ref.current) return;
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const endDrag = () => {
    setIsDragging(false);
  };

  const onDrag = (e) => {
    if (!isDragging || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll speed multiplier
    ref.current.scrollLeft = scrollLeft - walk;
  };

  return {
    ref,
    isDragging,
    dragProps: {
      onMouseDown: startDrag,
      onMouseLeave: endDrag,
      onMouseUp: endDrag,
      onMouseMove: onDrag,
      style: {
        cursor: isDragging ? 'grabbing' : 'grab',
        overflowX: 'auto',
        userSelect: 'none',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }
    }
  };
}

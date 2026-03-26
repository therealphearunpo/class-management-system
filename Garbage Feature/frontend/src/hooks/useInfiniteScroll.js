import { useState, useCallback, useRef } from 'react';

export function useInfiniteScroll(loadMore, hasMore = true, threshold = 100) {
  const [loading, setLoading] = useState(false);
  const observerRef = useRef(null);
  const lastElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();
      
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setLoading(true);
          loadMore().finally(() => setLoading(false));
        }
      }, { threshold });
      
      if (node) observerRef.current.observe(node);
    },
    [loading, hasMore, loadMore, threshold]
  );

  return { lastElementRef, loading };
}

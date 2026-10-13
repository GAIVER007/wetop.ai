'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function SiteMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const elements = [
      ...document.querySelectorAll(
        'main .public-intro, main .section, main .hotel-hero, main .salon-hero',
      ),
    ];
    let observer: IntersectionObserver | undefined;
    const update = () => {
      observer?.disconnect();
      elements.forEach((el) => el.removeAttribute('data-site-enter'));
      if (media.matches || !('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.setAttribute('data-site-enter', '');
            observer?.unobserve(entry.target);
          });
        },
        { threshold: 0.08 },
      );
      elements.forEach((el) => observer?.observe(el));
    };
    update();
    media.addEventListener('change', update);
    return () => {
      observer?.disconnect();
      media.removeEventListener('change', update);
      elements.forEach((el) => el.removeAttribute('data-site-enter'));
    };
  }, [pathname]);
  return null;
}

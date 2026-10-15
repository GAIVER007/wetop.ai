import Link from 'next/link';
import type { ReactNode } from 'react';

/** Знак WETOP на экранах входа: ведёт на вход, как и прежде */
function Brand() {
  return (
    <Link className="workspace-brand" href="/login">
      <span className="workspace-mark">W</span>
      <span className="brand-name">
        WETOP<span>.AI</span>
      </span>
    </Link>
  );
}

/**
 * Каркас экранов входа, подтверждения почты, пароля, приглашения и завершения регистрации (мастер-проход UI,
 * этап 3). До него одна и та же разметка была скопирована в каждый экран, а приглашение и завершение регистрации
 * жили без знака. С `story` слева знак и надпись, справа форма; без неё одна колонка, знак над формой.
 */
export function AuthShell({
  story,
  className,
  children,
}: {
  story?: { eyebrow: string; title: ReactNode; text: ReactNode } | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <main
      className={['login-page', story ? '' : 'login-page--single', className]
        .filter(Boolean)
        .join(' ')}
      id="main-content"
    >
      {story && (
        <section className="login-story">
          <Brand />
          <div className="login-message">
            <span className="eyebrow">{story.eyebrow}</span>
            <h1>{story.title}</h1>
            <p>{story.text}</p>
          </div>
        </section>
      )}
      <section className="login-form-panel">
        <div className="login-form">
          {!story && <Brand />}
          {children}
        </div>
      </section>
    </main>
  );
}

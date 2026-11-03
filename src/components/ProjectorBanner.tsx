import { useEffect, useState } from 'react';

export interface BannerMessage {
  key: string;
  text: string;
  kind: 'ready' | 'info' | 'quiet';
}

interface ProjectorBannerProps {
  messages: BannerMessage[];
  /** How long each message stays. */
  rotateMs: number;
}

/** Shows one message at a time and rotates through them in order. */
export function ProjectorBanner({ messages, rotateMs }: ProjectorBannerProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    const timer = setInterval(() => setIndex((i) => i + 1), rotateMs);
    return () => clearInterval(timer);
  }, [messages.length, rotateMs]);

  if (messages.length === 0) return <div className="pj-banner" />;

  const message = messages[index % messages.length];
  return (
    <div key={message.key} className={`pj-banner banner-${message.kind}`}>
      {message.text}
    </div>
  );
}

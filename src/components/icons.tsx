interface IconProps {
  size?: number;
}

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconPlay = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M7 4.5L19 12L7 19.5V4.5Z" />
  </svg>
);
export const IconPause = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M8 5V19M16 5V19" />
  </svg>
);
export const IconRestart = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 12a8 8 0 1 1 2.5 5.8M4 12V6M4 12H10" />
  </svg>
);
export const IconBack = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M15 5L8 12L15 19" />
  </svg>
);
export const IconShare = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" />
  </svg>
);
export const IconSettings = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);
export const IconFlame = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 3C12 3 6 8.5 6 14a6 6 0 0 0 12 0c0-2.2-1-3.8-2-5-.4 1.2-1.2 2-2.2 2.3C14.2 8.6 13.4 5.3 12 3Z" />
  </svg>
);
export const IconShield = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" />
  </svg>
);
export const IconSoundOn = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 9.5V14.5H7.5L12.5 18.5V5.5L7.5 9.5H4Z" />
    <path d="M16.5 9C17.5 10 18 11 18 12C18 13 17.5 14 16.5 15" />
  </svg>
);
export const IconSoundOff = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 9.5V14.5H7.5L12.5 18.5V5.5L7.5 9.5H4Z" />
    <path d="M16.5 10L20.5 14M20.5 10L16.5 14" />
  </svg>
);
export const IconVibrate = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="8" y="4" width="8" height="16" rx="2" />
    <path d="M4 9v6M20 9v6" />
  </svg>
);
export const IconMoon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
);
export const IconSun = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </svg>
);
export const IconBolt = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7Z" />
  </svg>
);

// SVG icon system — replaces all emoji usage
// Each icon is a 20×20 viewBox, designed on a 20px grid

const Icon = ({ children, size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const IconHome = (p) => (
  <Icon {...p}>
    <path d="M3 8L10 2L17 8V17C17 17.6 16.6 18 16 18H4C3.4 18 3 17.6 3 17V8Z" />
    <path d="M8 18V10H12V18" />
  </Icon>
);

export const IconBuilding = (p) => (
  <Icon {...p}>
    <rect x="2" y="6" width="16" height="12" rx="1.5" />
    <path d="M6 18V4C6 3.4 6.4 3 7 3H13C13.6 3 14 3.4 14 4V18" />
    <line x1="9" y1="9" x2="11" y2="9" />
    <line x1="9" y1="13" x2="11" y2="13" />
  </Icon>
);

export const IconCalendar = (p) => (
  <Icon {...p}>
    <rect x="2" y="4" width="16" height="14" rx="2" />
    <path d="M2 8H18" />
    <path d="M6 2L6 5" />
    <path d="M14 2L14 5" />
    <line x1="7" y1="11" x2="7.01" y2="11" />
    <line x1="10" y1="11" x2="10.01" y2="11" />
    <line x1="13" y1="11" x2="13.01" y2="11" />
  </Icon>
);

export const IconCheckCircle = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <path d="M6.5 10.5L9 13L13.5 7.5" />
  </Icon>
);

export const IconDollar = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 6V14" />
    <path d="M7.5 8.5C7.5 7.7 8.2 7 9 7H11.5C12.3 7 13 7.7 13 8.5C13 9.3 12.3 10 11.5 10H8.5C7.7 10 7 10.7 7 11.5C7 12.3 7.7 13 8.5 13H11C11.8 13 12.5 12.3 12.5 11.5" />
  </Icon>
);

export const IconPlus = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 6.5V13.5" />
    <path d="M6.5 10H13.5" />
  </Icon>
);

export const IconSparkle = (p) => (
  <Icon {...p}>
    <path d="M10 2L10.8 7.2C11.1 8.5 12.5 9.9 13.8 10.2L19 11L13.8 11.8C12.5 12.1 11.1 13.5 10.8 14.8L10 20L9.2 14.8C8.9 13.5 7.5 12.1 6.2 11.8L1 11L6.2 10.2C7.5 9.9 8.9 8.5 9.2 7.2L10 2Z" />
  </Icon>
);

export const IconChart = (p) => (
  <Icon {...p}>
    <rect x="2" y="2" width="16" height="16" rx="1.5" />
    <path d="M6 14L9 10L12 12L14 7" />
    <circle cx="14" cy="7" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconUsers = (p) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="3" />
    <path d="M13 19C13 15.7 10.3 13 7 13C3.7 13 1 15.7 1 19" />
    <path d="M18.5 8C18.5 9.7 17.2 11 15.5 11" />
    <path d="M19 19C19 16.5 17.4 14.5 15.3 13.7" />
  </Icon>
);

export const IconFile = (p) => (
  <Icon {...p}>
    <path d="M6 2H13L18 7V18C18 18.6 17.6 19 17 19H6C5.4 19 5 18.6 5 18V3C5 2.4 5.4 2 6 2Z" />
    <path d="M13 2V7H18" />
    <line x1="8" y1="12" x2="14" y2="12" />
    <line x1="8" y1="15" x2="12" y2="15" />
  </Icon>
);

export const IconEye = (p) => (
  <Icon {...p}>
    <path d="M1 10C3.5 5 7 2.5 10 2.5C13 2.5 16.5 5 19 10C16.5 15 13 17.5 10 17.5C7 17.5 3.5 15 1 10Z" />
    <circle cx="10" cy="10" r="3" />
  </Icon>
);

export const IconSettings = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="3" />
    <path d="M17.4 12C17.7 11.4 17.8 10.7 17.8 10C17.8 9.3 17.7 8.6 17.4 8L19.3 6.8C19.5 6.6 19.6 6.4 19.5 6.2L17.7 3.1C17.6 2.9 17.4 2.8 17.2 2.9L14.8 3.9C14 3.4 13.1 3.1 12.2 3L11.8 0.4C11.8 0.2 11.6 0 11.4 0H8.6C8.4 0 8.2 0.2 8.2 0.4L7.8 3C6.8 3.1 6 3.4 5.2 3.9L2.8 2.9C2.6 2.8 2.4 2.9 2.3 3.1L0.5 6.2C0.4 6.4 0.5 6.6 0.7 6.8L2.6 8C2.3 8.6 2.2 9.3 2.2 10C2.2 10.7 2.3 11.4 2.6 12L0.7 13.2C0.5 13.4 0.4 13.6 0.5 13.8L2.3 16.9C2.4 17.1 2.6 17.2 2.8 17.1L5.2 16.1C6 16.6 6.9 16.9 7.8 17L8.2 19.6C8.2 19.8 8.4 20 8.6 20H11.4C11.6 20 11.8 19.8 11.8 19.6L12.2 17C13.1 16.9 14 16.6 14.8 16.1L17.2 17.1C17.4 17.2 17.6 17.1 17.7 16.9L19.5 13.8C19.6 13.6 19.5 13.4 19.3 13.2L17.4 12Z" />
  </Icon>
);

export const IconLogout = (p) => (
  <Icon {...p}>
    <path d="M8 17H4C3.4 17 3 16.6 3 16V4C3 3.4 3.4 3 4 3H8" />
    <path d="M13 14L18 10L13 6" />
    <path d="M18 10H8" />
  </Icon>
);

export const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M12.5 12.5L18 18" />
  </Icon>
);

export const IconPencil = (p) => (
  <Icon {...p}>
    <path d="M13 3L17 7L7 17H3V13L13 3Z" />
    <line x1="10.5" y1="5.5" x2="14.5" y2="9.5" />
  </Icon>
);

export const IconTrash = (p) => (
  <Icon {...p}>
    <path d="M4 5H16" />
    <path d="M7 5V3.5C7 3.2 7.2 3 7.5 3H12.5C12.8 3 13 3.2 13 3.5V5" />
    <path d="M5 5L5.8 16.5C5.9 17.3 6.5 18 7.3 18H12.7C13.5 18 14.1 17.3 14.2 16.5L15 5" />
    <line x1="8" y1="9" x2="8" y2="14" />
    <line x1="12" y1="9" x2="12" y2="14" />
  </Icon>
);

export const IconArrowLeft = (p) => (
  <Icon {...p}>
    <path d="M15 18L8 10L15 2" />
  </Icon>
);

export const IconArrowRight = (p) => (
  <Icon {...p}>
    <path d="M5 18L12 10L5 2" />
  </Icon>
);

export const IconX = (p) => (
  <Icon {...p}>
    <path d="M3 3L17 17" />
    <path d="M17 3L3 17" />
  </Icon>
);

export const IconAlert = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <line x1="10" y1="6" x2="10" y2="11" />
    <circle cx="10" cy="14" r="0.8" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconInfo = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <line x1="10" y1="14" x2="10" y2="14.01" />
    <path d="M10 6V11" />
  </Icon>
);

export const IconMenu = (p) => (
  <Icon {...p}>
    <line x1="2" y1="5" x2="18" y2="5" />
    <line x1="2" y1="10" x2="18" y2="10" />
    <line x1="2" y1="15" x2="18" y2="15" />
  </Icon>
);

export const IconSun = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="4" />
    <line x1="10" y1="1" x2="10" y2="3" />
    <line x1="10" y1="17" x2="10" y2="19" />
    <line x1="1" y1="10" x2="3" y2="10" />
    <line x1="17" y1="10" x2="19" y2="10" />
    <line x1="2.5" y1="2.5" x2="4.5" y2="4.5" />
    <line x1="15.5" y1="15.5" x2="17.5" y2="17.5" />
    <line x1="2.5" y1="17.5" x2="4.5" y2="15.5" />
    <line x1="15.5" y1="4.5" x2="17.5" y2="2.5" />
  </Icon>
);

export const IconMoon = (p) => (
  <Icon {...p}>
    <path d="M17 12.5C15.5 13.2 13.8 13.2 12.3 12.7C9.5 11.7 7.8 9.2 7.8 6.5C7.8 4.8 8.5 3.2 9.7 2C6 2.8 3.2 5.9 3.2 9.8C3.2 14.3 6.9 18 11.4 18C14.2 18 16.7 16.4 18 14C16.8 14.7 15.4 15.1 13.9 14.8C11.3 14.2 9.3 12.2 8.7 9.6C8.3 7.9 8.7 6.2 9.7 4.8C8.1 6.1 7.2 8.1 7.2 10.2C7.2 14 10.5 17.3 14.3 17.3C15.3 17.3 16.2 17.1 17 16.7C17 16.8 17 16.9 17 17C17 15 17 14 17 12.5Z" />
  </Icon>
);

export const IconChevronDown = (p) => (
  <Icon {...p}>
    <path d="M4 7L10 13L16 7" />
  </Icon>
);

export const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="8" />
    <path d="M10 6V10.5L13 13" />
  </Icon>
);

export const IconMapPin = (p) => (
  <Icon {...p}>
    <path d="M10 18C14 14 17 10.9 17 7.5C17 3.9 13.9 1 10 1C6.1 1 3 3.9 3 7.5C3 10.9 6 14 10 18Z" />
    <circle cx="10" cy="7.5" r="2" />
  </Icon>
);

export const IconTag = (p) => (
  <Icon {...p}>
    <path d="M2 11L9 18L17 10L17 3H10L2 11Z" />
    <circle cx="14" cy="6" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconLayout = (p) => (
  <Icon {...p}>
    <rect x="2" y="2" width="6" height="7" rx="1" />
    <rect x="11" y="2" width="7" height="4" rx="1" />
    <rect x="11" y="9" width="7" height="4" rx="1" />
    <rect x="2" y="12" width="6" height="6" rx="1" />
  </Icon>
);

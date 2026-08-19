import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  Circle,
  CircleCheck,
  Clock3,
  Cloud,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Laptop,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  QrCode,
  Copy,
  Share2,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  getGetChatPartnerQueryKey,
  getGetCurrentUserQueryKey,
  getGetJourneyQueryKey,
  getGetSettingsQueryKey,
  getGetTaskSummaryQueryKey,
  getListDevicesQueryKey,
  getListMessagesQueryKey,
  getListTasksQueryKey,
  getHealthCheckQueryKey,
  useCreateTask,
  useDeleteMessage,
  useDeleteTask,
  useEditMessage,
  useGetChatPartner,
  useGetCurrentUser,
  useGetJourney,
  useGetSettings,
  useGetTaskSummary,
  useHealthCheck,
  useListDevices,
  useListMessages,
  useListTasks,
  useLogin,
  useLogout,
  useLogoutEverywhere,
  useSendMessage,
  useUpdateSettings,
  useUpdateTask,
  type AppSettings,
  type Message,
  type Task,
  type User,
} from '@/api-client';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
const initials = (name?: string | null) => (name || 'IU').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value)) : '';
const timeLabel = (value: string) => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const relativeTimeLabel = (isoDate: string): string => {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  if (diffSec < 30) return 'just now';
  if (diffMin < 1) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return timeLabel(isoDate);
  return dateLabel(isoDate) + ', ' + timeLabel(isoDate);
};
const triggerSystemNotification = (title: string, body: string) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const fire = () => {
    try { new Notification(title, { body, icon: '/favicon.ico' }); } catch { /* ignore */ }
  };
  if (Notification.permission === 'granted') {
    fire();
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => { if (p === 'granted') fire(); });
  }
};

const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
};

const subscribeToPushNotifications = async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const registration = await navigator.serviceWorker.ready;
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existingSub),
      });
      return;
    }
    const vapidKeyRes = await fetch('/api/push/vapid-public-key');
    if (!vapidKeyRes.ok) throw new Error('Failed to fetch VAPID key');
    const { publicKey } = await vapidKeyRes.json();
    if (!publicKey) return;

    const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
    const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: outputArray,
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
  }
};

const unsubscribeFromPushNotifications = async () => {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
  }
};

const smartReadLabel = (message: { createdAt: string; readAt: string | null; deliveryStatus: string }): string => {
  if (message.readAt) {
    const now = Date.now();
    const readTime = new Date(message.readAt).getTime();
    const diffMin = Math.floor((now - readTime) / 60000);
    const diffHr = Math.floor(diffMin / 60);
    if (diffMin < 1) return 'Read just now';
    if (diffMin < 60) return `Read ${diffMin} min ago`;
    if (diffHr < 24) return `Read at ${timeLabel(message.readAt)}`;
    return `Read ${dateLabel(message.readAt)}, ${timeLabel(message.readAt)}`;
  }
  if (message.deliveryStatus === 'delivered') return 'Delivered';
  if (message.deliveryStatus === 'sent') return 'Sent';
  return 'Read';
};

function AppLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/app-logo.png"
      alt="Daily Tasks Logo"
      style={{ width: size, height: size }}
      className={cx('rounded-[18px] shadow-md object-cover ring-1 ring-border/40', className)}
    />
  );
}
const getThemedEmojis = (text: string): string => {
  const clean = text.toLowerCase();
  if (clean.includes('love') || clean.includes('miss') || clean.includes('heart') || clean.includes('dear') || clean.includes('sweet')) {
    return '❤️✨💌';
  }
  if (clean.includes('night') || clean.includes('sleep') || clean.includes('dream') || clean.includes('star') || clean.includes('bed')) {
    return '🌙💫✨';
  }
  if (clean.includes('think') || clean.includes('wonder') || clean.includes('why') || clean.includes('how') || clean.includes('maybe')) {
    return '🤔💭🔮';
  }
  if (clean.includes('hello') || clean.includes('hey') || clean.includes('hi') || clean.includes('good') || clean.includes('morning')) {
    return '👋😊✨';
  }
  const emojis = ['🤐🔒✨', '🤫💬💫', '🔑💎✨', '📦🤫🔮', '💌🔐✨', '🌟💬💖'];
  let sum = 0;
  for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);
  return emojis[sum % emojis.length];
};

function Avatar({ user, small = false }: { user?: User | null; small?: boolean }) {
  return user?.profilePhotoUrl ? (
    <img data-testid={`img-avatar-${user.id}`} src={user.profilePhotoUrl} alt={user.displayName} className={cx('rounded-full object-cover ring-2 ring-background', small ? 'h-8 w-8' : 'h-10 w-10')} />
  ) : (
    <div data-testid={`avatar-fallback-${user?.id || 'shared'}`} className={cx('flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold tracking-wide ring-2 ring-background', small ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs')}>{initials(user?.displayName)}</div>
  );
}

function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-[1.35rem] glass-card shadow-[0_15px_40px_hsl(var(--foreground)/.035)]', className)}>{children}</section>;
}

function Button({ children, className = '', variant = 'primary', style, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' }) {
  const variantStyles = 
    variant === 'primary' ? { backgroundColor: 'hsl(217, 89%, 60%)', color: '#ffffff' } :
    variant === 'danger' ? { backgroundColor: 'hsl(4, 72%, 56%)', color: '#ffffff' } :
    variant === 'outline' ? { backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' } : {};

  return (
    <button
      {...props}
      style={{ ...variantStyles, ...style }}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-transform active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 shadow-sm hover:brightness-95 cursor-pointer',
        variant === 'quiet' && 'text-foreground/80 hover:bg-muted hover:text-foreground',
        variant === 'outline' && 'border border-border hover:bg-muted',
        className
      )}
    >
      {children}
    </button>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 30_000 } });
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Request browser notification permission as soon as the app is loaded and
  // the user has notifications enabled in settings.
  useEffect(() => {
    if (settings?.notifications !== false) {
      requestNotificationPermission().then((permission) => {
        if (permission === 'granted') {
          void subscribeToPushNotifications();
        }
      });
    }
  }, [settings?.notifications]);

  // Global background notifier — fires even when NOT on /chat
  useGlobalMessageNotifier();

  useEffect(() => {
    const theme = settings?.theme;
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', Boolean(dark));
    setIsDark(Boolean(dark));
  }, [settings?.theme]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    updateSettings.mutate({ data: { theme: nextDark ? 'dark' : 'light' } }, {
      onSuccess: (next) => queryClient.setQueryData(getGetSettingsQueryKey(), next)
    });
  };

  const privateArea = location !== '/';
  const startPress = () => {
    longPress.current = setTimeout(() => setLocation(`/pin?next=${encodeURIComponent('/chat')}`), 850);
  };
  const endPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
  };
  const signOut = () => {
    void unsubscribeFromPushNotifications().finally(() => {
      logout.mutate(undefined, { onSuccess: () => { queryClient.removeQueries(); setLocation('/login'); } });
    });
  };

  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[60dvh] w-[60dvh] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[50dvh] w-[50dvh] rounded-full bg-accent/6 blur-[100px]" />
      </div>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar/85 backdrop-blur-xl px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <AppLogo size={38} className="rounded-[12px]" />
          <div>
            <p className="font-serif-display text-xl leading-none">Daily Tasks</p>
            <p className="font-mono-ui mt-1 text-[9px] uppercase tracking-[.22em] text-sidebar-foreground/55">private / room</p>
          </div>
        </div>
        <div className="my-8 h-px bg-sidebar-border" />
        <nav className="space-y-1">
          <NavItem href="/" active={location === '/'} icon={<Check size={16} />} label="Today" testId="link-today" />
          <NavItem href="/chat" active={location === '/chat'} icon={<MessageCircle size={16} />} label="Private room" testId="link-private-room" />
          <NavItem href="/journey" active={location === '/journey'} icon={<Sparkles size={16} />} label="Our journey" testId="link-journey" />
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className={cx('h-2 w-2 rounded-full', health?.status === 'ok' ? 'bg-primary' : 'bg-accent')} />
              {health?.status === 'ok' ? 'In sync' : 'Checking sync'}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/60">A small shared space for the two of you.</p>
          </div>
          <Link href="/settings" data-testid="link-settings" className={cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground', location === '/settings' && 'bg-sidebar-accent text-sidebar-foreground')}><Settings size={17} /> Settings</Link>
          <button type="button" data-testid="button-logout" onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/55 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut size={17} /> Sign out</button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/40 bg-background/60 px-5 backdrop-blur-xl md:px-8">
          <button type="button" data-testid="button-long-press-title" className="group flex select-none items-center gap-2 text-left lg:cursor-default" onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onContextMenu={(event) => event.preventDefault()}>
            <span className="font-serif-display text-[22px] tracking-tight group-active:text-primary">Important Updates</span>
            <span className="hidden rounded-full border border-border px-2 py-0.5 font-mono-ui text-[9px] uppercase tracking-widest text-muted-foreground sm:inline">shared</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="button-top-theme-toggle"
              onClick={toggleTheme}
              title="Toggle Theme"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-muted transition"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-primary" />}
            </button>
            <Link href="/settings" data-testid="link-header-profile" className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-muted transition cursor-pointer">
              <span className="hidden text-xs font-semibold text-foreground md:inline">{user?.displayName || 'My Profile'}</span>
              <Avatar user={user} small />
            </Link>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100dvh-72px)] max-w-6xl px-5 py-7 pb-28 md:px-8 md:py-10 lg:pb-10 relative z-10">{children}</main>
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-border/40 bg-background/60 px-3 pt-2 backdrop-blur-xl lg:hidden">
          <BottomNav href="/" active={location === '/'} icon={<Check size={18} />} label="Today" testId="link-bottom-today" />
          <BottomNav href="/chat" active={location === '/chat'} icon={<MessageCircle size={18} />} label="Private" testId="link-bottom-chat" />
          <BottomNav href="/journey" active={location === '/journey'} icon={<Sparkles size={18} />} label="Journey" testId="link-bottom-journey" />
          <BottomNav href="/settings" active={location === '/settings'} icon={<Settings size={18} />} label="Settings" testId="link-bottom-settings" />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ href, active, icon, label, testId, onClick }: { href: string; active: boolean; icon: ReactNode; label: string; testId: string; onClick?: () => void }) {
  return <Link href={href} onClick={onClick} data-testid={testId} className={cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition', active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/58 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground')}><span className={active ? 'text-sidebar-primary' : ''}>{icon}</span>{label}</Link>;
}
function BottomNav({ href, active, icon, label, testId }: { href: string; active: boolean; icon: ReactNode; label: string; testId: string }) {
  return <Link href={href} data-testid={testId} className={cx('flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-semibold', active ? 'text-primary' : 'text-muted-foreground')}><span className={cx('rounded-xl p-1.5', active && 'bg-primary/10')}>{icon}</span>{label}</Link>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError, refetch } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  useEffect(() => { if (isError) setLocation('/login'); }, [isError, setLocation]);
  if (isLoading) return <LoadingScreen label="Opening your shared space" />;
  if (!user) return <LoadingScreen label="Checking your sign-in" action={refetch} />;
  return <>{children}</>;
}

function useAutoLock() {
  const [, setLocation] = useLocation();
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });

  useEffect(() => {
    const hasPin = Boolean(localStorage.getItem('iu_pin'));
    if (!hasPin || !settings?.autoLock || settings.autoLock === 'never') return;

    const timeoutMs = settings.autoLock === 'one_minute' ? 60 * 1000 : 5 * 60 * 1000;
    let lastActivity = Date.now();

    const onActivity = () => {
      lastActivity = Date.now();
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    const timer = setInterval(() => {
      const isUnlocked = sessionStorage.getItem('iu_private_unlocked') === 'true';
      if (isUnlocked && Date.now() - lastActivity >= timeoutMs) {
        sessionStorage.removeItem('iu_private_unlocked');
        const currentPath = window.location.pathname;
        if (currentPath === '/chat' || currentPath === '/journey' || currentPath === '/settings') {
          setLocation(`/pin?next=${encodeURIComponent(currentPath)}`);
        }
      }
    }, 4000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
      clearInterval(timer);
    };
  }, [settings?.autoLock, setLocation]);
}

function PrivateGate({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const hasPin = Boolean(localStorage.getItem('iu_pin'));
  const unlocked = sessionStorage.getItem('iu_private_unlocked') === 'true';

  useAutoLock();

  useEffect(() => {
    if (hasPin && !unlocked) {
      setLocation(`/pin?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [hasPin, setLocation, unlocked]);

  if (hasPin && !unlocked) return <LoadingScreen label="Preparing private room" />;
  return <>{children}</>;
}

function LoadingScreen({ label, action }: { label: string; action?: () => void }) {
  return <div className="flex min-h-[70dvh] items-center justify-center"><div className="w-full max-w-xs text-center">
    <div className="mx-auto mb-5 h-12 w-12 animate-pulse rounded-2xl bg-muted" />
    <div className="mx-auto h-3 w-40 animate-pulse rounded bg-muted" />
    <p className="mt-4 text-sm text-muted-foreground">{label}</p>
    {action && <Button variant="outline" className="mt-5" onClick={action} data-testid="button-retry-loading"><RefreshCw size={15} /> Try again</Button>}
  </div></div>;
}

function GetStartedPage() {
  const [, setLocation] = useLocation();
  const start = () => { localStorage.setItem('iu_visited', 'true'); setLocation('/signup'); };
  const signIn = () => { localStorage.setItem('iu_visited', 'true'); setLocation('/login'); };

  return <div className="grain paper-grid flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-8 relative overflow-hidden text-foreground">
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -left-1/4 -top-1/4 h-[60dvh] w-[60dvh] rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[50dvh] w-[50dvh] rounded-full bg-accent/10 blur-[100px]" />
      <div className="absolute left-1/2 top-1/3 h-[40dvh] w-[40dvh] -translate-x-1/2 rounded-full bg-primary/8 blur-[90px]" />
    </div>

    <div className="w-full max-w-md animate-rise-in text-center relative z-10 space-y-8">
      <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 animate-pulse-ring rounded-[32px] bg-primary/20" />
        <AppLogo size={96} className="relative rounded-[28px] shadow-[0_16px_48px_hsl(217_89%_60%/.35)]" />
      </div>

      <div>
        <p className="font-mono-ui text-[11px] uppercase tracking-[.25em] text-primary font-semibold">Private & Sealed for Two</p>
        <h1 className="mt-3 font-serif-display text-5xl leading-[.95] tracking-tight md:text-6xl text-foreground">A Quiet Room.</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">Your private, encrypted workspace built exclusively for two. Manage daily tasks, sealed messages, and shared moments.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-left">
        <div className="rounded-xl border border-border bg-card/60 p-3.5 shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2"><LockKeyhole size={15} /></div>
          <p className="text-xs font-bold text-foreground">2 Seats Only</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Strictly private space</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3.5 shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2"><CheckSquare size={15} /></div>
          <p className="text-xs font-bold text-foreground">Daily Tasks</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Simple shared to-dos</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3.5 shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2"><Sparkles size={15} /></div>
          <p className="text-xs font-bold text-foreground">Emoji Ciphers</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Sealed message reveals</p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Button data-testid="button-splash-get-started" onClick={start} className="w-full text-base min-h-12">
          Create Account <ArrowUpRight size={18} />
        </Button>
        <Button data-testid="button-splash-sign-in" variant="outline" onClick={signIn} className="w-full text-base min-h-12">
          Sign In to Existing Account
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">Private by design · No third-party data tracking</p>
    </div>
  </div>;
}

function SignUpPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();

    if (!cleanName) return setError('Please enter your full display name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError('Please enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters long.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: cleanName, email: cleanEmail, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        return setError(data.error || 'Registration failed. Please try again.');
      }
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      setLocation('/');
    } catch {
      setLoading(false);
      setError('Registration failed. Please check your connection and try again.');
    }
  };

  return (
    <div className="grain paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8 relative overflow-hidden text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[60dvh] w-[60dvh] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[50dvh] w-[50dvh] rounded-full bg-accent/6 blur-[100px]" />
      </div>

      <div className="w-full max-w-[420px] animate-rise-in relative z-10">
        <div className="mb-8 flex flex-col items-center justify-center text-center">
          <Link href="/welcome" className="flex flex-col items-center gap-2.5 hover:opacity-90 transition group">
            <AppLogo size={56} className="group-hover:scale-105 transition-transform" />
            <span className="font-serif-display text-3xl text-foreground tracking-tight">Daily Tasks</span>
          </Link>
        </div>

        <Surface className="p-6 shadow-xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-serif-display text-3xl leading-tight text-foreground">Join Your Room</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter your details to create your private account.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Name</span>
              <input data-testid="input-signup-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex / Sam" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</span>
              <input data-testid="input-signup-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password (min 6 chars)</span>
              <div className="relative">
                <input data-testid="input-signup-password" required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</span>
              <input data-testid="input-signup-confirm" required minLength={6} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
            </label>

            {error && <p data-testid="status-signup-error" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive font-medium">{error}</p>}

            <Button data-testid="button-signup-submit" type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? 'Creating Account…' : 'Create Account'} <ArrowUpRight size={16} />
            </Button>
          </form>

          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-primary hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    login.mutate({ data: { email, password } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/'); }, onError: () => setError('Incorrect email or password.') });
  };
  return <div className="grain paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8 relative overflow-hidden text-foreground">
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -left-1/4 -top-1/4 h-[60dvh] w-[60dvh] rounded-full bg-primary/8 blur-[120px]" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[50dvh] w-[50dvh] rounded-full bg-accent/6 blur-[100px]" />
    </div>
    <div className="w-full max-w-[420px] animate-rise-in relative z-10">
      <div className="mb-8 flex flex-col items-center justify-center text-center">
        <Link href="/welcome" className="flex flex-col items-center gap-2.5 hover:opacity-90 transition group">
          <AppLogo size={56} className="group-hover:scale-105 transition-transform" />
          <span className="font-serif-display text-3xl text-foreground tracking-tight">Daily Tasks</span>
        </Link>
      </div>
      <Surface className="p-6 shadow-xl sm:p-8">
        <div className="mb-6 text-center">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary font-semibold">Welcome Back</p>
          <h1 className="mt-2 font-serif-display text-4xl leading-tight tracking-tight text-foreground">Sign In</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your email and password to access your private room.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</span>
            <input data-testid="input-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
          </label>
          <label className="block">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">Forgot password?</Link>
            </div>
            <div className="relative">
              <input data-testid="input-password" required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
              <button type="button" data-testid="button-toggle-password" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </label>
          {error && <p data-testid="status-login-error" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive font-medium">{error}</p>}
          <Button data-testid="button-sign-in" type="submit" disabled={login.isPending} className="mt-2 w-full">{login.isPending ? 'Signing in…' : 'Sign In'} <ArrowUpRight size={16} /></Button>
        </form>



        <div className="mt-6 border-t border-border/60 pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Don't have an account yet?{' '}
            <Link href="/signup" className="font-bold text-primary hover:underline">
              Create New Account
            </Link>
          </p>
        </div>
      </Surface>
    </div>
  </div>;
}

function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      await res.json();
      setLoading(false);
      setSent(true);
    } catch {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="grain paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8 relative overflow-hidden text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[60dvh] w-[60dvh] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[50dvh] w-[50dvh] rounded-full bg-accent/6 blur-[100px]" />
      </div>
      <div className="w-full max-w-[420px] animate-rise-in relative z-10">
        <div className="mb-8 flex flex-col items-center justify-center text-center">
          <Link href="/welcome" className="flex flex-col items-center gap-2.5 hover:opacity-90 transition group">
            <AppLogo size={56} className="group-hover:scale-105 transition-transform" />
            <span className="font-serif-display text-3xl text-foreground tracking-tight">Daily Tasks</span>
          </Link>
        </div>
        <Surface className="p-6 shadow-xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-serif-display text-3xl leading-tight text-foreground">Forgot Password?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter your email address and we'll send you instructions to reset your password.</p>
          </div>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/10 p-4 text-sm text-primary font-medium">
                We have sent a password reset link to <span className="font-bold">{email}</span>. Please check your inbox.
              </div>
              <Button onClick={() => setLocation('/login')} className="w-full">Return to Sign In</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</span>
                <input data-testid="input-forgot-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </label>
              <Button data-testid="button-send-reset" type="submit" disabled={loading} className="mt-2 w-full">{loading ? 'Sending…' : 'Send Reset Link'} <ArrowUpRight size={16} /></Button>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft size={13} /> Back to Sign In</Link>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters long.');
    if (password !== confirm) return setError('Passwords do not match.');

    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');
    if (!token) return setError('Invalid password reset token. Please request a new link.');

    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        return setError(data.error || 'Password reset failed.');
      }
      setSuccess(true);
      setTimeout(() => setLocation('/login'), 2000);
    } catch {
      setLoading(false);
      setError('Password reset failed. Please try again.');
    }
  };

  return (
    <div className="grain paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8 relative overflow-hidden text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[60dvh] w-[60dvh] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[50dvh] w-[50dvh] rounded-full bg-accent/6 blur-[100px]" />
      </div>
      <div className="w-full max-w-[420px] animate-rise-in relative z-10">
        <div className="mb-8 flex flex-col items-center justify-center text-center">
          <Link href="/welcome" className="flex flex-col items-center gap-2.5 hover:opacity-90 transition group">
            <AppLogo size={56} className="group-hover:scale-105 transition-transform" />
            <span className="font-serif-display text-3xl text-foreground tracking-tight">Daily Tasks</span>
          </Link>
        </div>
        <Surface className="p-6 shadow-xl sm:p-8">
          <div className="mb-6">
            <h1 className="font-serif-display text-3xl leading-tight">Create New Password</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter a new strong password for your account.</p>
          </div>
          {success ? (
            <div className="rounded-xl bg-primary/10 p-4 text-sm text-primary font-medium text-center">
              Your password has been updated successfully! Redirecting to Sign In...
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</span>
                <div className="relative">
                  <input data-testid="input-reset-password" required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</span>
                <div className="relative">
                  <input data-testid="input-reset-confirm" required minLength={6} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground">{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </label>
              {error && <p data-testid="status-reset-error" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
              <Button data-testid="button-update-password" type="submit" disabled={loading} className="mt-2 w-full">{loading ? 'Updating…' : 'Update Password'} <ArrowUpRight size={16} /></Button>
            </form>
          )}
        </Surface>
      </div>
    </div>
  );
}

function PinPage() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '/chat';
  const existingPin = localStorage.getItem('iu_pin');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const creating = !existingPin;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(pin)) return setMessage('PIN must be 4, 6, or 8 digits.');
    if (creating && pin !== confirm) return setMessage('PINs do not match.');
    if (creating) localStorage.setItem('iu_pin', pin);
    if (!creating && pin !== existingPin) return setMessage('Incorrect PIN.');
    sessionStorage.setItem('iu_private_unlocked', 'true');
    setLocation(next);
  };
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5 text-foreground relative overflow-hidden">
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -left-1/4 -top-1/4 h-[60dvh] w-[60dvh] rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[50dvh] w-[50dvh] rounded-full bg-accent/12 blur-[100px]" />
    </div>
    <div className="w-full max-w-sm animate-rise-in text-center relative z-10">
      <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-[22px] border border-border bg-card text-primary"><KeyRound size={26} strokeWidth={1.6} /></div>
      <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-primary">App Lock</p>
      <h1 className="mt-3 font-serif-display text-4xl">{creating ? 'Set App PIN' : 'Enter PIN'}</h1>
      <p className="mx-auto mt-4 max-w-[280px] text-sm leading-relaxed text-muted-foreground">{creating ? 'Set a 4, 6, or 8-digit PIN to secure your app.' : 'Enter your 4, 6, or 8-digit PIN to unlock.'}</p>
      <form onSubmit={submit} className="mx-auto mt-8 max-w-[260px] space-y-3">
        <div className="relative"><input data-testid="input-pin" autoFocus inputMode="numeric" maxLength={8} type={showPin ? 'text' : 'password'} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="••••" className="h-16 w-full rounded-2xl border border-input bg-card text-center font-mono-ui text-2xl tracking-[.35em] text-foreground outline-none focus:border-primary" /><button type="button" data-testid="button-toggle-pin" onClick={() => setShowPin((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground">{showPin ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        {creating && <div className="relative"><input data-testid="input-pin-confirm" required inputMode="numeric" maxLength={8} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ''))} placeholder="Repeat PIN" className="h-12 w-full rounded-xl border border-input bg-card px-4 pr-12 text-center font-mono-ui text-sm tracking-[.25em] text-foreground outline-none focus:border-primary" /><button type="button" data-testid="button-toggle-pin-confirm" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground">{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>}
        {message && <p data-testid="status-pin-error" className="text-xs text-destructive">{message}</p>}
        <button data-testid="button-unlock" type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition active:scale-[.98]">{creating ? 'Save PIN' : 'Unlock'} <ArrowUpRight size={16} /></button>
      </form>
      <Link href="/" data-testid="link-back-to-today" className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Back to Dashboard</Link>
    </div>
  </div>;
}

function HomePage() {
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: tasks, isLoading, isError, refetch } = useListTasks(undefined, { query: { queryKey: getListTasksQueryKey() } });
  const { data: summary } = useGetTaskSummary({ query: { queryKey: getGetTaskSummaryQueryKey() } });
  const { data: partner } = useGetChatPartner({ query: { queryKey: getGetChatPartnerQueryKey() } });
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const client = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'complete'>('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const list = useMemo(() => (Array.isArray(tasks) ? tasks : []).filter((task) => filter === 'all' || task.status === filter), [tasks, filter]);
  const openCreate = () => { setEditing(null); setTitle(''); setDescription(''); setDueDate(''); setAssignedTo(current.data?.id || ''); setDialogOpen(true); };
  const openEdit = (task: Task) => { setEditing(task); setTitle(task.title); setDescription(task.description || ''); setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : ''); setAssignedTo(task.assignedTo || ''); setDialogOpen(true); };
  const refreshTasks = () => { client.invalidateQueries({ queryKey: getListTasksQueryKey() }); client.invalidateQueries({ queryKey: getGetTaskSummaryQueryKey() }); };
  
  const saveTask = (event: FormEvent) => {
    event.preventDefault();
    const data = { title: title.trim(), description: description.trim() || null, dueDate: dueDate || null, assignedTo: assignedTo || null };
    if (!data.title) return;
    if (editing) {
      updateTask.mutate({ id: editing.id, data }, {
        onSuccess: () => {
          refreshTasks();
          setDialogOpen(false);
          if (settings?.notifications !== false) {
            toast({ title: 'Task Updated', description: `Saved changes to “${data.title}”.` });
          }
        }
      });
    } else {
      createTask.mutate({ data }, {
        onSuccess: () => {
          refreshTasks();
          setDialogOpen(false);
          if (settings?.notifications !== false) {
            toast({ title: 'Task Created ✨', description: `Added “${data.title}” to your list.` });
          }
        }
      });
    }
  };

  const removeTask = (task: Task) => {
    if (window.confirm(`Delete “${task.title}”?`)) {
      deleteTask.mutate({ id: task.id }, {
        onSuccess: () => {
          refreshTasks();
          if (settings?.notifications !== false) {
            toast({ title: 'Task Deleted', description: `“${task.title}” was removed.` });
          }
        }
      });
    }
  };

  const cycleStatus = (task: Task) => {
    const status = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'complete' : 'pending';
    const statusText = status === 'complete' ? 'Completed 🎉' : status === 'in_progress' ? 'In Progress ⏳' : 'Not Started 📝';
    updateTask.mutate({ id: task.id, data: { status } }, {
      onSuccess: () => {
        refreshTasks();
        if (settings?.notifications !== false) {
          toast({ title: `Task ${statusText}`, description: `“${task.title}” status updated.` });
        }
      }
    });
  };
  const statusCount = summary || {
    total: Array.isArray(tasks) ? tasks.length : 0,
    pending: Array.isArray(tasks) ? tasks.filter((t) => t.status === 'pending').length : 0,
    inProgress: Array.isArray(tasks) ? tasks.filter((t) => t.status === 'in_progress').length : 0,
    complete: Array.isArray(tasks) ? tasks.filter((t) => t.status === 'complete').length : 0
  };
  return <div className="animate-rise-in">
    <div className="flex flex-col items-center justify-center text-center gap-4 mb-2">
      <div><p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-primary">Task Dashboard</p><h1 className="mt-2 font-serif-display text-5xl leading-none tracking-tight md:text-6xl text-foreground">My Tasks</h1><p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground mx-auto">Manage your daily tasks and to-do list.</p></div>
      <Button data-testid="button-new-task" onClick={openCreate} className="w-full sm:w-auto"><Plus size={17} /> Add Task</Button>
    </div>
    <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCell label="All Tasks" value={statusCount.total} active={filter === 'all'} onClick={() => setFilter('all')} testId="filter-all" />
      <SummaryCell label="Not Started" value={statusCount.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} testId="filter-pending" />
      <SummaryCell label="In Progress" value={statusCount.inProgress} active={filter === 'in_progress'} onClick={() => setFilter('in_progress')} testId="filter-in-progress" />
      <SummaryCell label="Completed" value={statusCount.complete} active={filter === 'complete'} onClick={() => setFilter('complete')} testId="filter-complete" />
    </div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_280px]">
      <Surface className="overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 md:px-6"><div><h2 className="text-sm font-bold text-foreground">Task List</h2><p className="mt-1 text-xs text-muted-foreground">{list.length ? `${list.length} task${list.length === 1 ? '' : 's'} total` : 'No tasks in this view.'}</p></div><span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">today</span></div>
        {isLoading ? <TaskSkeleton /> : isError ? <ErrorState label="Tasks could not be loaded." action={refetch} /> : list.length === 0 ? <EmptyTasks onAdd={openCreate} /> : <div className="divide-y divide-border/65">{list.map((task, index) => <TaskRow key={task.id} task={task} index={index} onCycle={() => cycleStatus(task)} onEdit={() => openEdit(task)} onDelete={() => removeTask(task)} onStatusChange={(status) => { updateTask.mutate({ id: task.id, data: { status } }, { onSuccess: refreshTasks }); }} partner={partner} currentUser={current.data} />)}</div>}
      </Surface>
      <div className="space-y-4">
        <div style={{ backgroundColor: 'hsl(217, 89%, 60%)', color: '#ffffff' }} className="relative overflow-hidden rounded-[1.35rem] p-6 shadow-xl">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border-[18px] border-white/20" />
          <div className="relative">
            <div className="flex items-center justify-between text-white/90">
              <Lightbulb size={18} />
              <span className="font-mono-ui text-[9px] uppercase tracking-[.2em] font-semibold">Daily Tip</span>
            </div>
            <p className="mt-8 font-serif-display text-2xl leading-tight text-white font-bold">Focus on one task at a time.</p>
            <p className="mt-3 text-xs leading-relaxed text-white/90">Small, consistent progress leads to big wins.</p>
          </div>
        </div>
        <Surface className="p-5 shadow-xl"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team</p><UsersRound size={16} className="text-primary" /></div><div className="mt-4 flex items-center"><Avatar user={current.data} /><div className="-ml-2"><Avatar user={partner} /></div><div className="ml-3"><p data-testid="text-shared-people" className="text-sm font-semibold text-foreground">{current.data?.displayName || 'You'} + {partner?.displayName || 'Partner'}</p><p className="mt-0.5 text-xs text-muted-foreground">Shared workspace</p></div></div></Surface>
      </div>
    </div>
    {dialogOpen && <TaskDialog editing={editing} title={title} description={description} dueDate={dueDate} assignedTo={assignedTo} partner={partner} currentUser={current.data} saving={createTask.isPending || updateTask.isPending} onTitle={setTitle} onDescription={setDescription} onDueDate={setDueDate} onAssignedTo={setAssignedTo} onClose={() => setDialogOpen(false)} onSubmit={saveTask} />}
  </div>;
}

function SummaryCell({ label, value, active, onClick, testId }: { label: string; value: number; active: boolean; onClick: () => void; testId: string }) {
  return <button type="button" data-testid={`button-${testId}`} onClick={onClick} className={cx('rounded-2xl border p-4 text-left transition hover:-translate-y-0.5', active ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border bg-card hover:bg-muted')}><p className={cx('font-mono-ui text-2xl font-bold', active ? 'text-primary' : 'text-foreground')}>{value}</p><p className={cx('mt-1 text-[11px] font-bold uppercase tracking-wider', active ? 'text-primary' : 'text-foreground/80')}>{label}</p></button>;
}
function TaskSkeleton() { return <div className="space-y-4 p-6">{[1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4"><div className="h-10 w-10 animate-pulse rounded-full bg-muted" /><div className="flex-1"><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-muted" /></div></div>)}</div>; }
function ErrorState({ label, action }: { label: string; action: () => void }) { return <div className="p-10 text-center"><p className="text-sm font-semibold">{label}</p><p className="mt-2 text-xs text-muted-foreground">Give it another moment, then try again.</p><Button data-testid="button-retry" variant="outline" className="mt-5" onClick={action}><RefreshCw size={14} /> Retry</Button></div>; }
function EmptyTasks({ onAdd }: { onAdd: () => void }) { return <div className="p-10 text-center md:p-16"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Check size={23} /></div><h3 className="mt-5 font-serif-display text-2xl">Nothing pressing.</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Add the first small thing you want to keep between you today.</p><Button data-testid="button-empty-add-task" className="mt-6" onClick={onAdd}><Plus size={16} /> Add first task</Button></div>; }
function TaskStatusSelect({ task, onStatusChange }: { task: Task; onStatusChange: (status: 'pending' | 'in_progress' | 'complete') => void }) {
  return (
    <select
      data-testid={`select-status-${task.id}`}
      value={task.status}
      onChange={(e) => onStatusChange(e.target.value as 'pending' | 'in_progress' | 'complete')}
      className={cx(
        'rounded-lg border px-2.5 py-1 text-xs font-medium outline-none transition bg-card text-foreground cursor-pointer',
        task.status === 'complete' ? 'border-primary/40 text-primary font-semibold' : task.status === 'in_progress' ? 'border-accent/40 text-foreground font-semibold' : 'border-border text-muted-foreground'
      )}
    >
      <option value="pending">Not Started</option>
      <option value="in_progress">In Progress</option>
      <option value="complete">Completed</option>
    </select>
  );
}
function TaskRow({ task, index, onCycle, onEdit, onDelete, onStatusChange, partner, currentUser }: { task: Task; index: number; onCycle: () => void; onEdit: () => void; onDelete: () => void; onStatusChange: (status: 'pending' | 'in_progress' | 'complete') => void; partner?: User; currentUser?: User }) {
  const person = task.assignedTo === partner?.id ? partner : task.assignedTo === currentUser?.id ? currentUser : undefined;
  return <div data-testid={`row-task-${task.id}`} className="group flex items-start gap-3 px-5 py-4 transition hover:bg-muted/45 md:px-6" style={{ animationDelay: `${index * 45}ms` }}><button type="button" data-testid={`button-status-${task.id}`} onClick={onCycle} className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition', task.status === 'complete' ? 'border-primary bg-primary text-primary-foreground' : task.status === 'in_progress' ? 'border-accent bg-accent/20 text-foreground' : 'border-border text-muted-foreground hover:border-primary')}>{task.status === 'complete' ? <Check size={16} /> : task.status === 'in_progress' ? <Clock3 size={16} /> : <Circle size={16} />}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p data-testid={`text-task-title-${task.id}`} className={cx('text-sm font-semibold text-foreground', task.status === 'complete' && 'text-muted-foreground line-through')}>{task.title}</p></div>{task.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{task.description}</p>}<div className="mt-2"><TaskStatusSelect task={task} onStatusChange={onStatusChange} /></div><div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-medium text-muted-foreground">{task.dueDate && <span className="flex items-center gap-1"><Clock3 size={11} /> {dateLabel(task.dueDate)}</span>}{person && <span className="flex items-center gap-1"><Avatar user={person} small /> {person.displayName}</span>}</div></div><div className="flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100"><button type="button" data-testid={`button-edit-task-${task.id}`} onClick={onEdit} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /></button><button type="button" data-testid={`button-delete-task-${task.id}`} onClick={onDelete} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15} /></button></div></div>;
}
function TaskDialog({ editing, title, description, dueDate, assignedTo, partner, currentUser, saving, onTitle, onDescription, onDueDate, onAssignedTo, onClose, onSubmit }: { editing: Task | null; title: string; description: string; dueDate: string; assignedTo: string; partner?: User; currentUser?: User; saving: boolean; onTitle: (value: string) => void; onDescription: (value: string) => void; onDueDate: (value: string) => void; onAssignedTo: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="w-full max-w-lg rounded-t-[1.6rem] border border-border bg-card p-6 shadow-2xl sm:rounded-[1.6rem]"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">{editing ? 'edit task' : 'new task'}</p><h2 className="mt-2 font-serif-display text-3xl">{editing ? 'Make it clearer.' : 'What needs doing?'}</h2></div><button data-testid="button-close-task-dialog" type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button></div><form onSubmit={onSubmit} className="mt-6 space-y-4"><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Title</span><input data-testid="input-task-title" required maxLength={160} autoFocus value={title} onChange={(event) => onTitle(event.target.value)} placeholder="A small, specific thing" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Note <span className="font-normal">optional</span></span><textarea data-testid="input-task-description" maxLength={500} value={description} onChange={(event) => onDescription(event.target.value)} rows={3} placeholder="Anything that makes this easier to pick up…" className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Due date</span><input data-testid="input-task-due-date" type="date" value={dueDate} onChange={(event) => onDueDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">For</span><select data-testid="select-task-assignee" value={assignedTo} onChange={(event) => onAssignedTo(event.target.value)} className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"><option value="">Both of us</option>{currentUser && <option value={currentUser.id}>{currentUser.displayName}</option>}{partner && <option value={partner.id}>{partner.displayName}</option>}</select></label></div><div className="flex gap-3 pt-2"><Button data-testid="button-cancel-task" type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button><Button data-testid="button-save-task" type="submit" disabled={saving} className="flex-1">{saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}</Button></div></form></div></div>;
}

function PartnerConnectCard({ onConnected }: { onConnected: () => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [myCode, setMyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/chat/partner/code', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.inviteCode) setMyCode(data.inviteCode);
      })
      .catch(() => {});

    const searchParams = new URLSearchParams(window.location.search);
    const paramCode = searchParams.get('code');
    if (paramCode) setCode(paramCode.toUpperCase());
  }, []);

  const shareUrl = `${window.location.origin}/chat?code=${encodeURIComponent(myCode)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;

  const copyCode = () => {
    navigator.clipboard.writeText(myCode);
    setCopied(true);
    toast({ title: 'Code Copied!', description: `Share “${myCode}” with your partner.` });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Connect with me on Daily Tasks',
          text: `Join my private room on Daily Tasks! Enter code: ${myCode}`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback
      }
    }
    navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Invite Link Copied!', description: 'Link copied to clipboard. Send it to your partner.' });
  };

  const submitConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat/partner/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Connection Failed', description: data.error || 'Invalid code.' });
        setLoading(false);
        return;
      }
      toast({ title: 'Second Half Connected', description: `Connected with ${data.displayName}. Welcome to your room!` });
      onConnected();
    } catch {
      toast({ title: 'Error', description: 'Could not connect. Please try again.' });
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md animate-rise-in text-center py-4">
      <Surface className="p-6 sm:p-8 shadow-2xl space-y-6">
        <div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary/10 text-primary">
            <QrCode size={28} />
          </div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-primary font-semibold">2-Seat Room Pairing</p>
          <h2 className="mt-2 font-serif-display text-3xl text-foreground">Connect Second Half</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Scan the QR code or share your invite code to link your private room with your partner.
          </p>
        </div>

        <div className="mx-auto flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 shadow-sm">
          {myCode ? (
            <img src={qrUrl} alt="Partner QR Code" className="h-44 w-44 rounded-xl object-contain bg-white p-2 shadow-inner" />
          ) : (
            <div className="h-44 w-44 animate-pulse rounded-xl bg-muted" />
          )}
          <p className="mt-3 text-[11px] font-mono-ui text-muted-foreground">Scan with phone camera to connect instantly</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-input bg-background p-3">
            <span className="font-mono-ui text-lg font-bold tracking-widest text-primary">{myCode || 'PAIR-XXXX'}</span>
            <Button type="button" variant="outline" className="min-h-9 px-3 text-xs" onClick={copyCode}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Code'}
            </Button>
          </div>
          <Button type="button" variant="quiet" className="w-full text-xs gap-2" onClick={shareLink}>
            <Share2 size={14} /> Share Invite Link or QR
          </Button>
        </div>

        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
          <span className="relative bg-card px-3 font-mono-ui text-[10px] uppercase text-muted-foreground">OR ENTER PARTNER'S CODE</span>
        </div>

        <form onSubmit={submitConnect} className="space-y-3 text-left">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner Invite Code</span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. PAIR-8K92"
              className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-center font-mono-ui text-lg tracking-widest text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <Button type="submit" disabled={loading} className="w-full font-bold">
            {loading ? 'Connecting Room…' : 'Connect Room'} <ArrowUpRight size={16} />
          </Button>
        </form>
      </Surface>
    </div>
  );
}

/**
 * Global background message poller — fires notifications even when the user
 * is NOT on the /chat page. Mounted once inside AppShell so it's always active.
 */
function useGlobalMessageNotifier() {
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: partner } = useGetChatPartner({ query: { queryKey: getGetChatPartnerQueryKey(), retry: false } });
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const client = useQueryClient();
  const { toast } = useToast();
  const lastMsgCount = useRef<number | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    if (!partner || settings?.notifications === false) return;
    // Poll every 5 s when NOT on the chat page; chat page has its own 3 s interval
    const interval = setInterval(async () => {
      const msgs = client.getQueryData<{ id: string; senderId: string }[]>(getListMessagesQueryKey());
      if (!msgs) return;
      if (lastMsgCount.current !== null && msgs.length > lastMsgCount.current) {
        const latest = msgs[msgs.length - 1];
        if (latest && latest.senderId !== current.data?.id) {
          toast({
            title: 'New sealed message ✉️',
            description: 'A message has arrived in your private room.',
          });
          triggerSystemNotification('New sealed message', 'A message has arrived in your private room.');
        }
      }
      lastMsgCount.current = msgs.length;
    }, 5000);
    return () => clearInterval(interval);
  }, [partner, settings?.notifications, current.data?.id, client, toast, location]);
}

function ChatPage() {
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: partner, isLoading: partnerLoading, isError: partnerError, refetch: refetchPartner } = useGetChatPartner({
    query: { queryKey: getGetChatPartnerQueryKey(), retry: false },
  });
  const { data: messages, isLoading, isError, refetch } = useListMessages({
    query: { queryKey: getListMessagesQueryKey(), refetchInterval: 3000, enabled: !!partner },
  });
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });

  const send = useSendMessage();
  const edit = useEditMessage();
  const remove = useDeleteMessage();
  const client = useQueryClient();
  const { toast } = useToast();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [localTempMsg, setLocalTempMsg] = useState<{ content: string; stage: 'text' | 'emojis' | 'symbols' } | null>(null);
  // Chat page tracks its own count independently; global notifier handles cross-page
  const lastMsgCount = useRef<number | null>(null);

  useEffect(() => {
    if (!messages) return;
    if (lastMsgCount.current !== null && messages.length > lastMsgCount.current) {
      const latest = messages[messages.length - 1];
      if (latest && latest.senderId !== current.data?.id && settings?.notifications !== false) {
        toast({
          title: 'New sealed message ✉️',
          description: 'A message has arrived in your private room. Tap to reveal!',
        });
        triggerSystemNotification('New sealed message', 'A message has arrived in your private room.');
      }
    }
    lastMsgCount.current = messages.length;
  }, [messages, current.data?.id, settings?.notifications, toast]);

  if (!partnerLoading && (!partner || partnerError)) {
    return <PartnerConnectCard onConnected={() => { refetchPartner(); refetch(); }} />;
  }

  const reveal = (id: string) => setRevealed((previous) => new Set(previous).add(id));
  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    const clean = content.trim();
    if (!clean) return;
    
    setContent('');
    setLocalTempMsg({ content: clean, stage: 'text' });
    
    setTimeout(() => {
      setLocalTempMsg({ content: clean, stage: 'emojis' });
      setTimeout(() => {
        setLocalTempMsg({ content: clean, stage: 'symbols' });
        setTimeout(() => {
          send.mutate({ data: { content: clean } }, {
            onSuccess: () => {
              setLocalTempMsg(null);
              client.invalidateQueries({ queryKey: getListMessagesQueryKey() });
            },
            onError: () => {
              setLocalTempMsg(null);
            }
          });
        }, 250);
      }, 250);
    }, 250);
  };

  const handleDisconnectPartner = async () => {
    if (!window.confirm(`Disconnect from ${partner?.displayName || 'your partner'}? You will need to re-scan a QR code to pair again.`)) return;
    try {
      const res = await fetch('/api/chat/partner/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Partner Disconnected', description: 'You have disconnected from your partner.' });
        client.invalidateQueries({ queryKey: getGetChatPartnerQueryKey() });
        client.invalidateQueries({ queryKey: getListMessagesQueryKey() });
        refetchPartner();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to disconnect.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not disconnect. Check your connection.' });
    }
  };

  const saveEdit = (id: string) => { const clean = editingContent.trim(); if (!clean) return; edit.mutate({ id, data: { content: clean } }, { onSuccess: () => { setEditingId(null); client.invalidateQueries({ queryKey: getListMessagesQueryKey() }); } }); };
  const deleteMessage = (id: string) => { if (window.confirm('Delete this message for me?')) remove.mutate({ id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListMessagesQueryKey() }) }); };
  return <div className="mx-auto max-w-3xl animate-rise-in">
    <div className="mb-7 flex flex-col items-center justify-center text-center gap-2 relative"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-primary">private & two seats only</p><h1 className="mt-1 font-serif-display text-5xl text-foreground">A quiet room.</h1><p className="mt-1 text-sm text-muted-foreground">Send and receive messages in real-time.</p><div className="mt-2 flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" /><span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">online</span></div></div>
    <Surface className="overflow-hidden border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 md:px-7">
        <div className="flex items-center gap-3"><Avatar user={partner} /><div><p data-testid="text-chat-partner" className="text-sm font-semibold text-foreground">{partnerLoading ? 'Finding partner…' : partner?.displayName || 'Chat Partner'}</p><p className="mt-0.5 text-xs text-muted-foreground">Shared room</p></div></div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="button-disconnect-partner"
            onClick={handleDisconnectPartner}
            title="Disconnect Partner"
            className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition cursor-pointer"
          >
            <LogOut size={13} /> Disconnect
          </button>
        </div>
      </div>
      <div className="min-h-[430px] space-y-5 px-4 py-6 md:px-7">
        {isLoading ? <ChatSkeleton /> : isError ? <ErrorState label="Messages could not be loaded." action={refetch} /> : (messages || []).length === 0 && !localTempMsg ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageCircle size={24} /></div><p className="mt-5 font-serif-display text-2xl text-foreground">No messages yet.</p><p className="mt-2 max-w-xs text-sm text-muted-foreground">Type a message below to start the conversation.</p></div> : (
          <>
            {(messages || []).map((message) => <MessageBubble key={message.id} message={message} mine={message.senderId === current.data?.id} revealed={revealed.has(message.id)} onReveal={() => reveal(message.id)} onEdit={() => { setEditingId(message.id); setEditingContent(message.content); reveal(message.id); }} onDelete={() => deleteMessage(message.id)} editing={editingId === message.id} editContent={editingContent} onEditContent={setEditingContent} onSaveEdit={() => saveEdit(message.id)} onCancelEdit={() => setEditingId(null)} bubbleStyle={settings?.bubbleStyle} />)}
            {localTempMsg && (
              <div className="flex justify-end gap-3 animate-pulse">
                <div className="max-w-[86%] sm:max-w-[76%] items-end">
                  <div className="relative rounded-[1.25rem] px-4 py-3 rounded-br-md bg-primary text-primary-foreground">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {localTempMsg.stage === 'text' && localTempMsg.content}
                      {localTempMsg.stage === 'emojis' && '✨🤐💖💬'}
                      {localTempMsg.stage === 'symbols' && '&#*%?$'}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center justify-end text-[10px] text-muted-foreground">
                    <span>Sending…</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <form onSubmit={sendMessage} className="border-t border-border/60 bg-muted/30 p-4 md:p-5"><div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-2 pl-4 focus-within:border-primary"><textarea data-testid="input-message" rows={1} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a message…" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" /><button data-testid="button-send-message" type="submit" disabled={!content.trim() || send.isPending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-95 disabled:opacity-40"><ArrowUpRight size={17} /></button></div><div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground"><span>{send.isPending ? 'Sending message…' : 'Messages are end-to-end synchronized.'}</span></div></form>
    </Surface>
  </div>;
}
function ChatSkeleton() { return <div className="space-y-5 py-6">{[1, 2, 3].map((item) => <div key={item} className={cx('h-16 animate-pulse rounded-2xl bg-muted', item % 2 === 0 ? 'ml-auto w-3/5' : 'w-2/3')} />)}</div>; }
function MessageBubble({ message, mine, revealed, bubbleStyle = 'emoji', onReveal, onEdit, onDelete, editing, editContent, onEditContent, onSaveEdit, onCancelEdit }: { message: Message; mine: boolean; revealed: boolean; bubbleStyle?: string; onReveal: () => void; onEdit: () => void; onDelete: () => void; editing: boolean; editContent: string; onEditContent: (value: string) => void; onSaveEdit: () => void; onCancelEdit: () => void }) {
  const deleted = Boolean(message.deletedAt);
  const [animText, setAnimText] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const handleReveal = () => {
    if (isDecrypting) return;
    setIsDecrypting(true);
    let step = 0;
    const maxSteps = 12;
    const chars = '!@#$%^&*()_+{}[]:;<>,.?/~';
    const emojis = ['🔑', '✨', '🔒', '🤐', '🤫', '🌙', '💫', '💖', '🤔', '💬', '💌', '🔮'];
    const textLen = message.content.length;

    setAnimText(getThemedEmojis(message.content));

    const interval = setInterval(() => {
      step++;
      let currentString = '';
      const revealLimit = Math.floor((step / maxSteps) * textLen);
      
      for (let i = 0; i < textLen; i++) {
        if (i < revealLimit) {
          currentString += message.content[i];
        } else if (i < revealLimit + 2) {
          currentString += emojis[Math.floor(Math.random() * emojis.length)];
        } else {
          currentString += chars[Math.floor(Math.random() * chars.length)];
        }
      }

      setAnimText(currentString.slice(0, 16) + (textLen > 16 ? '...' : ''));

      if (step >= maxSteps) {
        clearInterval(interval);
        setIsDecrypting(false);
        onReveal();
      }
    }, 55);
  };

  return <div data-testid={`bubble-message-${message.id}`} className={cx('group flex gap-3', mine ? 'justify-end' : 'justify-start')}><div className={cx('max-w-[86%] sm:max-w-[76%]', mine && 'items-end')}><div className={cx('relative rounded-[1.25rem] px-4 py-3 cursor-pointer select-none transition active:scale-[0.98]', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border bg-card text-card-foreground')} onClick={!revealed && !deleted && !mine ? handleReveal : () => setShowInfo((v) => !v)}>{!revealed && !deleted && !mine ? (
    <div data-testid={`button-reveal-message-${message.id}`} className="font-mono-ui text-sm flex items-center justify-center gap-1.5 min-h-[20px] py-0.5">
      <span>
        {isDecrypting ? animText : `${getThemedEmojis(message.content)} 🔒%#`}
      </span>
    </div>
  ) : editing ? <div className="min-w-[220px]"><textarea data-testid={`input-edit-message-${message.id}`} value={editContent} onChange={(event) => onEditContent(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-current/20 bg-transparent p-2 text-sm outline-none" /><div className="mt-2 flex justify-end gap-2"><button type="button" data-testid={`button-cancel-edit-message-${message.id}`} onClick={onCancelEdit} className="rounded-lg px-2 py-1 text-xs opacity-70">Cancel</button><button type="button" data-testid={`button-save-edit-message-${message.id}`} onClick={onSaveEdit} className="rounded-lg bg-foreground/10 px-2 py-1 text-xs font-bold">Save</button></div></div> : <p data-testid={`text-message-content-${message.id}`} className={cx('whitespace-pre-wrap text-sm leading-relaxed', deleted && 'italic opacity-55')}>{deleted ? 'Message removed.' : message.content}</p>}</div>{showInfo && !deleted && <div className={cx('mt-1.5 rounded-lg bg-muted/50 px-3 py-2 text-[10px] font-medium text-muted-foreground animate-rise-in space-y-0.5', mine ? 'text-right' : 'text-left')}><p>Sent {relativeTimeLabel(message.createdAt)}</p>{mine && <p>{smartReadLabel(message)}</p>}{!mine && message.readAt && <p>Opened {relativeTimeLabel(message.readAt)}</p>}{message.editedAt && <p>Edited {relativeTimeLabel(message.editedAt)}</p>}</div>}<div className={cx('mt-1 flex items-center gap-1.5 text-[10px]', mine ? 'justify-end text-primary' : 'text-muted-foreground')}><span>{relativeTimeLabel(message.createdAt)}{message.editedAt && !deleted ? ' · edited' : ''}</span>{mine && <span className="flex items-center gap-0.5">{message.deliveryStatus === 'read' ? <><CheckCheck size={13} /><span className="opacity-70">{message.readAt ? relativeTimeLabel(message.readAt) : ''}</span></> : message.deliveryStatus === 'delivered' ? <CheckCheck size={13} className="opacity-60" /> : <Check size={13} className="opacity-60" />}</span>}{!mine && revealed && !deleted && <span className="opacity-60">read</span>}</div>{mine && revealed && !editing && !deleted && <div className="mt-1 flex justify-end gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100"><button type="button" data-testid={`button-edit-message-${message.id}`} onClick={onEdit} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><Edit3 size={13} /></button><button type="button" data-testid={`button-delete-message-${message.id}`} onClick={onDelete} className="rounded-md p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button></div>}</div></div>;
}


function JourneyPage() {
  const { data: journey, isLoading, isError, refetch } = useGetJourney({ query: { queryKey: getGetJourneyQueryKey() } });
  if (isLoading) return <LoadingScreen label="Loading journey" />;
  if (isError || !journey) return <ErrorState label="The journey is unavailable right now." action={refetch} />;
  return <div className="mx-auto max-w-2xl animate-rise-in text-center">
    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary/10 text-primary">
      <Globe size={32} />
    </div>
    <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-primary">Special moments of us</p>
    <h1 data-testid="text-journey-title" className="mt-3 font-serif-display text-5xl leading-tight tracking-tight">{journey.title || 'Our Shared Journey'}</h1>
    <p data-testid="text-journey-description" className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">{journey.description || 'A special web link to visit together.'}</p>
    <Surface className="mx-auto mt-8 p-6 shadow-xl max-w-md">
      <a data-testid="link-journey-external" href="http://you.palashrai.me/" target="_blank" rel="noreferrer" style={{ backgroundColor: 'hsl(217, 89%, 60%)', color: '#ffffff' }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold shadow-sm transition hover:brightness-95">
        Visit Website <ExternalLink size={16} />
      </a>
    </Surface>
  </div>;
}

function SettingsPage() {
  const { data: settings, isLoading, isError, refetch } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: currentUser } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: devices } = useListDevices({ query: { queryKey: getListDevicesQueryKey() } });
  const update = useUpdateSettings();
  const logout = useLogout();
  const logoutEverywhere = useLogoutEverywhere();
  const client = useQueryClient();
  const [, setLocation] = useLocation();

  const [pinNew, setPinNew] = useState('');
  const [pinConfirmNew, setPinConfirmNew] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [showPinNew, setShowPinNew] = useState(false);

  if (isLoading) return <LoadingScreen label="Loading shared settings" />;
  if (isError || !settings) return <ErrorState label="Settings could not be loaded." action={refetch} />;

  const patch = (data: Partial<AppSettings>) => update.mutate({ data }, { onSuccess: (next) => client.setQueryData(getGetSettingsQueryKey(), next) });
  const signOut = () => {
    void unsubscribeFromPushNotifications().finally(() => {
      logout.mutate(undefined, { onSuccess: () => { client.clear(); setLocation('/login'); } });
    });
  };
  const hasPin = Boolean(localStorage.getItem('iu_pin'));

  const savePin = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(pinNew)) return setPinMsg('PIN must be 4, 6, or 8 digits.');
    if (pinNew !== pinConfirmNew) return setPinMsg('PINs do not match.');
    localStorage.setItem('iu_pin', pinNew);
    setPinNew(''); setPinConfirmNew(''); setPinMsg('PIN saved successfully!');
  };
  const clearPin = () => { localStorage.removeItem('iu_pin'); sessionStorage.removeItem('iu_private_unlocked'); setPinMsg('PIN removed.'); };

  return (
    <div className="mx-auto max-w-3xl animate-rise-in">
      <div className="mb-8 text-center">
        <p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-primary">Preferences</p>
        <h1 className="mt-2 font-serif-display text-5xl tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your profile, app preferences, and security options.</p>
      </div>

      <div className="space-y-4">
        {/* 1. My Profile */}
        <SettingsGroup icon={<UserRound size={18} />} title="My Profile" note="Manage display name, password, email & sign out" defaultOpen={true}>
          <MyProfileSection user={currentUser} onSignOut={signOut} />
        </SettingsGroup>

        {/* 2. App Settings */}
        <SettingsGroup icon={<Settings size={18} />} title="App Settings" note="Theme, notifications & journey link">
          <div className="space-y-6 divide-y divide-border/60">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Color Theme</p>
              <SettingChoice label="Light Theme" detail="Clean blue accents on light background" active={settings.theme === 'light'} onClick={() => patch({ theme: 'light' })} testId="theme-light" />
              <SettingChoice label="Dark Theme" detail="Deep midnight blue background" active={settings.theme === 'dark'} onClick={() => patch({ theme: 'dark' })} testId="theme-dark" />
              <SettingChoice label="System Theme" detail="Match system settings" active={settings.theme === 'system'} onClick={() => patch({ theme: 'system' })} testId="theme-system" />
            </div>

            <div className="pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Notifications</p>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
                <div>
                  <p className="text-sm font-semibold">{settings.notifications ? 'Notifications Enabled' : 'Notifications Disabled'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Receive alerts for new incoming messages.</p>
                  {'Notification' in window && Notification.permission === 'denied' && settings.notifications && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                      <BellOff size={12} /> Browser blocked — allow notifications in your browser settings.
                    </p>
                  )}
                  {'Notification' in window && Notification.permission === 'default' && settings.notifications && (
                    <button
                      type="button"
                      data-testid="button-request-notification-permission"
                      onClick={() => {
                        requestNotificationPermission().then((permission) => {
                          if (permission === 'granted') void subscribeToPushNotifications();
                        });
                      }}
                      className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <Bell size={12} /> Tap to allow browser notifications
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="button-toggle-notifications"
                  onClick={() => {
                    const next = !settings.notifications;
                    patch({ notifications: next });
                    if (next) {
                      requestNotificationPermission().then((permission) => {
                        if (permission === 'granted') void subscribeToPushNotifications();
                      });
                    } else {
                      void unsubscribeFromPushNotifications();
                    }
                  }}
                  className={cx('relative h-7 w-12 rounded-full transition', settings.notifications ? 'bg-primary' : 'bg-muted')}
                >
                  <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform', settings.notifications ? 'translate-x-6' : 'translate-x-1')} />
                </button>
              </div>
            </div>

            <div className="pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Journey Website Link</p>
              <div className="flex flex-col gap-2 sm:flex-row items-center">
                <div className="relative w-full">
                  <input data-testid="input-journey-url" disabled readOnly value="http://you.palashrai.me/" className="min-h-12 w-full rounded-xl border border-input bg-muted px-4 pr-10 text-sm font-mono-ui text-muted-foreground cursor-not-allowed opacity-80" />
                  <LockKeyhole size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
                <a href="http://you.palashrai.me/" target="_blank" rel="noreferrer" className="inline-flex min-h-12 w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:brightness-95">Visit <ExternalLink size={15} /></a>
              </div>
            </div>
          </div>
        </SettingsGroup>

        {/* 3. Security & App Lock */}
        <SettingsGroup icon={<Shield size={18} />} title="Security & App Lock" note="PIN passcode, auto-lock & active device sessions">
          <div className="space-y-6 divide-y divide-border/60">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">App Lock PIN</p>
              <form onSubmit={savePin} className="space-y-3">
                <div className="relative">
                  <input data-testid="input-settings-pin" inputMode="numeric" maxLength={8} type={showPinNew ? 'text' : 'password'} value={pinNew} onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ''))} placeholder={hasPin ? 'New PIN (4, 6, or 8 digits)' : 'Set PIN (4, 6, or 8 digits)'} className="min-h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  <button type="button" onClick={() => setShowPinNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground">{showPinNew ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
                <input data-testid="input-settings-pin-confirm" inputMode="numeric" maxLength={8} type="password" value={pinConfirmNew} onChange={(e) => setPinConfirmNew(e.target.value.replace(/\D/g, ''))} placeholder="Confirm PIN" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                {pinMsg && <p className={cx('text-xs font-medium', pinMsg.includes('successfully') || pinMsg.includes('removed') ? 'text-primary' : 'text-destructive')}>{pinMsg}</p>}
                <div className="flex gap-2">
                  <Button data-testid="button-save-pin" type="submit" className="flex-1">Save PIN</Button>
                  {hasPin && <Button data-testid="button-clear-pin" type="button" variant="danger" onClick={clearPin} className="flex-1">Remove PIN</Button>}
                </div>
              </form>
            </div>

            <div className="pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Auto-Lock Duration</p>
              <SettingChoice label="Immediately" active={settings.autoLock === 'immediate'} onClick={() => patch({ autoLock: 'immediate' })} testId="lock-immediate" />
              <SettingChoice label="After 1 minute" active={settings.autoLock === 'one_minute'} onClick={() => patch({ autoLock: 'one_minute' })} testId="lock-one-minute" />
              <SettingChoice label="After 5 minutes" active={settings.autoLock === 'five_minutes'} onClick={() => patch({ autoLock: 'five_minutes' })} testId="lock-five-minutes" />
              <SettingChoice label="Never" active={settings.autoLock === 'never'} onClick={() => patch({ autoLock: 'never' })} testId="lock-never" />
            </div>

            <div className="pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Connected Devices</p>
              <div className="space-y-2">
                {(devices || []).length ? devices?.map((device) => (
                  <div data-testid={`row-device-${device.id}`} key={device.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Laptop size={16} /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{device.label}</p><p className="mt-1 text-xs text-muted-foreground">{device.current ? 'This device' : `Active ${dateLabel(device.lastActiveAt)}`}</p></div>
                    {device.current && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">current</span>}
                  </div>
                )) : <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No other devices connected.</p>}
                <Button data-testid="button-logout-everywhere" variant="outline" className="mt-2 w-full" disabled={logoutEverywhere.isPending} onClick={() => { if (window.confirm('Sign out on all other devices?')) logoutEverywhere.mutate(undefined, { onSuccess: () => client.invalidateQueries({ queryKey: getListDevicesQueryKey() }) }); }}><Shield size={15} /> Sign out other devices</Button>
              </div>
            </div>
          </div>
        </SettingsGroup>

        {/* 4. Privacy Policy */}
        <SettingsGroup icon={<LockKeyhole size={18} />} title="Privacy Policy & Security" note="Read how your account and data are protected">
          <PrivacyPolicySection />
        </SettingsGroup>
      </div>
    </div>
  );
}

function SettingsGroup({ icon, title, note, children, defaultOpen = false }: { icon: ReactNode; title: string; note: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Surface className="overflow-hidden shadow-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between p-5 md:p-6 text-left transition hover:bg-muted/40 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
          </div>
        </div>
        <div className={cx('flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-transform duration-200', open && 'rotate-180 bg-muted')}>
          <ChevronDown size={18} />
        </div>
      </button>
      {open && <div className="border-t border-border/60 p-5 md:p-6 bg-card/40 animate-rise-in">{children}</div>}
    </Surface>
  );
}

function MyProfileSection({ user, onSignOut }: { user?: User | null; onSignOut: () => void }) {
  const [name, setName] = useState(user?.displayName || '');
  const [savedNameMsg, setSavedNameMsg] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passMsg, setPassMsg] = useState('');

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavedNameMsg('Display name updated!');
    setTimeout(() => setSavedNameMsg(''), 2500);
  };

  const updatePassword = (e: FormEvent) => {
    e.preventDefault();
    if (pass.length < 6) return setPassMsg('Password must be at least 6 characters.');
    if (pass !== confirmPass) return setPassMsg('Passwords do not match.');
    setPass('');
    setConfirmPass('');
    setPassMsg('Password updated successfully!');
    setTimeout(() => setPassMsg(''), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
        <Avatar user={user} />
        <div>
          <p className="text-sm font-bold text-foreground">{user?.displayName || 'My Profile'}</p>
          <p className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</p>
        </div>
      </div>

      <form onSubmit={saveName} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display Name</span>
          <div className="flex gap-2">
            <input data-testid="input-profile-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            <Button type="submit" className="shrink-0">Save Name</Button>
          </div>
        </label>
        {savedNameMsg && <p className="text-xs font-medium text-primary">{savedNameMsg}</p>}
      </form>

      <div className="block">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"><LockKeyhole size={11} /> Locked</span>
        </div>
        <div className="relative">
          <input data-testid="input-profile-email" disabled readOnly value={user?.email || 'user@example.com'} className="min-h-11 w-full rounded-xl border border-input bg-muted px-4 pr-10 text-sm font-mono-ui text-muted-foreground cursor-not-allowed opacity-80" />
          <LockKeyhole size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <form onSubmit={updatePassword} className="space-y-3 pt-2 border-t border-border/60">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground">Change Password</p>
        <div className="relative">
          <input data-testid="input-profile-password" type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="New password (min 6 chars)" className="min-h-11 w-full rounded-xl border border-input bg-background px-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <input data-testid="input-profile-confirm-password" type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Confirm new password" className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
        {passMsg && <p className={cx('text-xs font-medium', passMsg.includes('successfully') ? 'text-primary' : 'text-destructive')}>{passMsg}</p>}
        <Button type="submit" className="w-full">Update Password</Button>
      </form>

      <div className="pt-4 border-t border-border/60">
        <Button data-testid="button-profile-logout" variant="danger" className="w-full flex items-center justify-center gap-2" onClick={onSignOut}>
          <LogOut size={16} /> Sign Out
        </Button>
      </div>
    </div>
  );
}

function PrivacyPolicySection() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
        <p className="font-serif-display text-lg text-primary">A Personal Promise & Privacy Commitment</p>
        <p className="mt-1 text-xs text-muted-foreground">Built exclusively for two with complete respect, trust, and zero compromise on data security.</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-background p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 font-bold text-xs">1</div>
          <div>
            <p className="font-bold text-foreground">Built to Keep Us Connected</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              First of all, this app is built for us. It does not go away from you — its sole purpose is to keep me connected with you. It does not want to harm any feelings or anything regarding you.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 pt-3 border-t border-border/60">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 font-bold text-xs">2</div>
          <div>
            <p className="font-bold text-foreground">Complete Respect & Kindness</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              This app does not want to defame you, disrespect you, or destroy you. The main reason for this app is simply to connect with you in a peaceful, quiet space.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 pt-3 border-t border-border/60">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 font-bold text-xs">3</div>
          <div>
            <p className="font-bold text-foreground">I Always Respect Your Decisions</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              I always respect you and your decisions. I don’t ever want to force you into anything — your space and boundaries are always honored.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 pt-3 border-t border-border/60">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 font-bold text-xs">4</div>
          <div>
            <p className="font-bold text-foreground">Strict Data Privacy & Zero Leakage</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              There is zero data leakage. Data privacy is strictly committed and all communications are totally private — so don’t worry about anything, nothing goes away.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 pt-3 border-t border-border/60">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 font-bold text-xs">5</div>
          <div>
            <p className="font-bold text-foreground">Always Here For You</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed font-medium text-foreground">
              The last and most important point: I’m always here for you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
function SettingChoice({ label, detail, active, onClick, testId }: { label: string; detail?: string; active: boolean; onClick: () => void; testId: string }) { return <button type="button" data-testid={`button-${testId}`} onClick={onClick} className={cx('flex w-full items-center gap-3 border-b border-border/60 py-3 text-left last:border-0', active ? 'text-foreground font-semibold' : 'text-muted-foreground')}><span className={cx('flex h-5 w-5 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{active && <Check size={12} />}</span><span className="flex-1"><span className="block text-sm font-semibold">{label}</span>{detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}</span></button>; }

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function Router() {
  const hasVisited = localStorage.getItem('iu_visited') === 'true';
  return <RoutedErrorBoundary><Switch>
    <Route path="/splash" component={GetStartedPage} />
    <Route path="/welcome" component={GetStartedPage} />
    <Route path="/signup" component={SignUpPage} />
    <Route path="/login"><LoginPage /></Route>
    <Route path="/pin" component={PinPage} />
    <Route path="/forgot-password" component={ForgotPasswordPage} />
    <Route path="/reset-password" component={ResetPasswordPage} />
    <Route path="/"><AuthGate><AppShell><HomePage /></AppShell></AuthGate></Route>
    <Route path="/chat"><AuthGate><PrivateGate><AppShell><ChatPage /></AppShell></PrivateGate></AuthGate></Route>
    <Route path="/journey"><AuthGate><PrivateGate><AppShell><JourneyPage /></AppShell></PrivateGate></AuthGate></Route>
    <Route path="/settings"><AuthGate><PrivateGate><AppShell><SettingsPage /></AppShell></PrivateGate></AuthGate></Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;
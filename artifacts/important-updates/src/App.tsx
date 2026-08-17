import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  CircleCheck,
  Clock3,
  Cloud,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
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
  Sparkles,
  Trash2,
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
} from '@workspace/api-client-react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
const initials = (name?: string | null) => (name || 'IU').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value)) : '';
const timeLabel = (value: string) => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));

function Avatar({ user, small = false }: { user?: User | null; small?: boolean }) {
  return user?.profilePhotoUrl ? (
    <img data-testid={`img-avatar-${user.id}`} src={user.profilePhotoUrl} alt={user.displayName} className={cx('rounded-full object-cover ring-2 ring-background', small ? 'h-8 w-8' : 'h-10 w-10')} />
  ) : (
    <div data-testid={`avatar-fallback-${user?.id || 'shared'}`} className={cx('flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold tracking-wide ring-2 ring-background', small ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs')}>{initials(user?.displayName)}</div>
  );
}

function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-[1.35rem] border border-border/80 bg-card shadow-[0_15px_40px_hsl(var(--foreground)/.035)]', className)}>{children}</section>;
}

function Button({ children, className = '', variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' }) {
  return <button {...props} className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-transform active:scale-[.98] disabled:pointer-events-none disabled:opacity-45', variant === 'primary' && 'bg-primary text-primary-foreground shadow-[0_7px_18px_hsl(var(--primary)/.18)] hover:brightness-95', variant === 'quiet' && 'text-muted-foreground hover:bg-muted hover:text-foreground', variant === 'outline' && 'border border-border bg-card text-foreground hover:bg-muted', variant === 'danger' && 'bg-destructive/10 text-destructive hover:bg-destructive/15', className)} />;
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

  useEffect(() => {
    const theme = settings?.theme;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', Boolean(isDark));
  }, [settings?.theme]);

  const privateArea = location !== '/';
  const startPress = () => {
    longPress.current = setTimeout(() => setLocation(`/pin?next=${encodeURIComponent('/chat')}`), 850);
  };
  const endPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
  };
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { queryClient.removeQueries(); setLocation('/login'); } });

  return (
    <div className={cx('grain min-h-[100dvh] bg-background text-foreground', privateArea && 'private-shell')}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-sidebar-primary text-sidebar-primary-foreground">
            <Archive size={18} strokeWidth={1.8} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" />
          </div>
          <div>
            <p className="font-serif-display text-xl leading-none">Important</p>
            <p className="font-mono-ui mt-1 text-[9px] uppercase tracking-[.22em] text-sidebar-foreground/55">updates / shared</p>
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
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/60 bg-background/90 px-5 backdrop-blur-xl md:px-8">
          <button type="button" data-testid="button-long-press-title" className="group flex select-none items-center gap-2 text-left lg:cursor-default" onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onContextMenu={(event) => event.preventDefault()}>
            <span className="font-serif-display text-[22px] tracking-tight group-active:text-primary">Important Updates</span>
            <span className="hidden rounded-full border border-border px-2 py-0.5 font-mono-ui text-[9px] uppercase tracking-widest text-muted-foreground sm:inline">shared</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:inline">{user?.displayName || 'Shared account'}</span>
            <Avatar user={user} small />
            <button type="button" data-testid="button-mobile-menu" onClick={() => setMobileOpen((open) => !open)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted lg:hidden"><Menu size={20} /></button>
          </div>
        </header>
        {mobileOpen && <div className="fixed inset-x-0 top-[72px] z-20 border-b border-border bg-background p-4 shadow-lg lg:hidden">
          <div className="grid gap-1">
            <NavItem href="/" active={location === '/'} icon={<Check size={16} />} label="Today" testId="link-mobile-today" onClick={() => setMobileOpen(false)} />
            <NavItem href="/chat" active={location === '/chat'} icon={<MessageCircle size={16} />} label="Private room" testId="link-mobile-chat" onClick={() => setMobileOpen(false)} />
            <NavItem href="/journey" active={location === '/journey'} icon={<Sparkles size={16} />} label="Our journey" testId="link-mobile-journey" onClick={() => setMobileOpen(false)} />
            <NavItem href="/settings" active={location === '/settings'} icon={<Settings size={16} />} label="Settings" testId="link-mobile-settings" onClick={() => setMobileOpen(false)} />
          </div>
        </div>}
        <main className="mx-auto min-h-[calc(100dvh-72px)] max-w-6xl px-5 py-7 pb-28 md:px-8 md:py-10 lg:pb-10">{children}</main>
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-border/80 bg-background/95 px-3 pt-2 backdrop-blur-xl lg:hidden">
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

function PrivateGate({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const unlocked = sessionStorage.getItem('iu_private_unlocked') === 'true';
  useEffect(() => { if (!unlocked) setLocation(`/pin?next=${encodeURIComponent(window.location.pathname)}`); }, [setLocation, unlocked]);
  if (!unlocked) return <LoadingScreen label="Preparing private room" />;
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

function LoginPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    login.mutate({ data: { email, password } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/'); }, onError: () => setError('Those details did not match either trusted account.') });
  };
  return <div className="grain paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8">
    <div className="w-full max-w-[420px] animate-rise-in">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-primary text-primary-foreground"><Archive size={19} /></div>
        <div><p className="font-serif-display text-2xl">Important Updates</p><p className="font-mono-ui text-[9px] uppercase tracking-[.2em] text-muted-foreground">a shared daily ritual</p></div>
      </div>
      <Surface className="p-6 shadow-[0_25px_70px_hsl(var(--foreground)/.08)] sm:p-8">
        <div className="mb-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">two seats only</p><h1 className="mt-3 font-serif-display text-[40px] leading-[.98] tracking-tight">Good to see you.</h1><p className="mt-4 max-w-[290px] text-sm leading-relaxed text-muted-foreground">Sign in to pick up where your shared day left off.</p></div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</span><input data-testid="input-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span><input data-testid="input-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
          {error && <p data-testid="status-login-error" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">{error}</p>}
          <Button data-testid="button-sign-in" type="submit" disabled={login.isPending} className="mt-2 w-full">{login.isPending ? 'Checking…' : 'Enter shared space'} <ArrowUpRight size={16} /></Button>
        </form>
      </Surface>
      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">This space is private by design.<br />There are only two people here.</p>
    </div>
  </div>;
}

function PinPage() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '/chat';
  const existingPin = localStorage.getItem('iu_pin');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const creating = !existingPin;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return setMessage('Use four digits for your local PIN.');
    if (creating && pin !== confirm) return setMessage('The two PINs need to match.');
    if (creating) localStorage.setItem('iu_pin', pin);
    if (!creating && pin !== existingPin) return setMessage('That PIN is not quite right.');
    sessionStorage.setItem('iu_private_unlocked', 'true');
    setLocation(next);
  };
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(226_30%_10%)] px-5 text-[hsl(36_28%_92%)]">
    <div className="w-full max-w-sm animate-rise-in text-center">
      <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[hsl(225_20%_25%)] bg-[hsl(226_27%_14%)] text-[hsl(170_38%_57%)]"><KeyRound size={26} strokeWidth={1.6} /></div>
      <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(170_38%_57%)]">private room</p>
      <h1 className="mt-3 font-serif-display text-4xl">{creating ? 'Set a local lock.' : 'Just the two of us.'}</h1>
      <p className="mx-auto mt-4 max-w-[280px] text-sm leading-relaxed text-[hsl(225_14%_63%)]">{creating ? 'A PIN keeps the quiet part of your day close to the device.' : 'Enter your four-digit PIN to continue.'}</p>
      <form onSubmit={submit} className="mx-auto mt-8 max-w-[260px] space-y-3">
        <input data-testid="input-pin" autoFocus inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="••••" className="h-16 w-full rounded-2xl border border-[hsl(225_20%_25%)] bg-[hsl(226_27%_14%)] text-center font-mono-ui text-2xl tracking-[.45em] text-[hsl(36_28%_92%)] outline-none focus:border-[hsl(170_38%_57%)]" />
        {creating && <input data-testid="input-pin-confirm" required inputMode="numeric" maxLength={4} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ''))} placeholder="repeat PIN" className="h-12 w-full rounded-xl border border-[hsl(225_20%_25%)] bg-[hsl(226_27%_14%)] px-4 text-center font-mono-ui text-sm tracking-[.25em] text-[hsl(36_28%_92%)] outline-none focus:border-[hsl(170_38%_57%)]" />}
        {message && <p data-testid="status-pin-error" className="text-xs text-[hsl(14_64%_68%)]">{message}</p>}
        <button data-testid="button-unlock" type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(170_38%_57%)] px-4 text-sm font-bold text-[hsl(228_28%_8%)] transition active:scale-[.98]">{creating ? 'Save local PIN' : 'Unlock'} <ArrowUpRight size={16} /></button>
      </form>
      <Link href="/" data-testid="link-back-to-today" className="mt-8 inline-flex items-center gap-2 text-xs text-[hsl(225_14%_63%)] hover:text-[hsl(36_28%_92%)]"><ArrowLeft size={14} /> Back to today</Link>
    </div>
  </div>;
}

function HomePage() {
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: tasks, isLoading, isError, refetch } = useListTasks(undefined, { query: { queryKey: getListTasksQueryKey() } });
  const { data: summary } = useGetTaskSummary({ query: { queryKey: getGetTaskSummaryQueryKey() } });
  const { data: partner } = useGetChatPartner({ query: { queryKey: getGetChatPartnerQueryKey() } });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const client = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'complete'>('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const list = useMemo(() => (tasks || []).filter((task) => filter === 'all' || task.status === filter), [tasks, filter]);
  const openCreate = () => { setEditing(null); setTitle(''); setDescription(''); setDueDate(''); setAssignedTo(current.data?.id || ''); setDialogOpen(true); };
  const openEdit = (task: Task) => { setEditing(task); setTitle(task.title); setDescription(task.description || ''); setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : ''); setAssignedTo(task.assignedTo || ''); setDialogOpen(true); };
  const refreshTasks = () => { client.invalidateQueries({ queryKey: getListTasksQueryKey() }); client.invalidateQueries({ queryKey: getGetTaskSummaryQueryKey() }); };
  const saveTask = (event: FormEvent) => {
    event.preventDefault();
    const data = { title: title.trim(), description: description.trim() || null, dueDate: dueDate || null, assignedTo: assignedTo || null };
    if (!data.title) return;
    if (editing) updateTask.mutate({ id: editing.id, data }, { onSuccess: () => { refreshTasks(); setDialogOpen(false); } });
    else createTask.mutate({ data }, { onSuccess: () => { refreshTasks(); setDialogOpen(false); } });
  };
  const removeTask = (task: Task) => { if (window.confirm(`Delete “${task.title}”?`)) deleteTask.mutate({ id: task.id }, { onSuccess: refreshTasks }); };
  const cycleStatus = (task: Task) => { const status = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'complete' : 'pending'; updateTask.mutate({ id: task.id, data: { status } }, { onSuccess: refreshTasks }); };
  const statusCount = summary || { total: tasks?.length || 0, pending: tasks?.filter((t) => t.status === 'pending').length || 0, inProgress: tasks?.filter((t) => t.status === 'in_progress').length || 0, complete: tasks?.filter((t) => t.status === 'complete').length || 0 };
  return <div className="animate-rise-in">
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div><p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-primary">Tuesday, October 15</p><h1 className="mt-2 font-serif-display text-5xl leading-none tracking-tight md:text-6xl">The day, shared.</h1><p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">A short list for the things that make the rest of the day easier.</p></div>
      <Button data-testid="button-new-task" onClick={openCreate} className="w-full md:w-auto"><Plus size={17} /> Add a task</Button>
    </div>
    <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCell label="All things" value={statusCount.total} active={filter === 'all'} onClick={() => setFilter('all')} testId="filter-all" />
      <SummaryCell label="To do" value={statusCount.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} testId="filter-pending" />
      <SummaryCell label="In motion" value={statusCount.inProgress} active={filter === 'in_progress'} onClick={() => setFilter('in_progress')} testId="filter-in-progress" />
      <SummaryCell label="Done" value={statusCount.complete} active={filter === 'complete'} onClick={() => setFilter('complete')} testId="filter-complete" />
    </div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_280px]">
      <Surface className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 md:px-6"><div><h2 className="text-sm font-bold">Shared list</h2><p className="mt-1 text-xs text-muted-foreground">{list.length ? `${list.length} item${list.length === 1 ? '' : 's'} in view` : 'A clear desk is a kind desk.'}</p></div><span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">today</span></div>
        {isLoading ? <TaskSkeleton /> : isError ? <ErrorState label="The list could not be opened." action={refetch} /> : list.length === 0 ? <EmptyTasks onAdd={openCreate} /> : <div className="divide-y divide-border/65">{list.map((task, index) => <TaskRow key={task.id} task={task} index={index} onCycle={() => cycleStatus(task)} onEdit={() => openEdit(task)} onDelete={() => removeTask(task)} partner={partner} currentUser={current.data} />)}</div>}
      </Surface>
      <div className="space-y-4">
        <Surface className="relative overflow-hidden bg-[hsl(173_31%_33%)] p-6 text-[hsl(40_33%_98%)]"><div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border-[18px] border-[hsl(14_55%_68%)/.4]" /><div className="relative"><div className="flex items-center justify-between"><Lightbulb size={18} /><span className="font-mono-ui text-[9px] uppercase tracking-[.2em] opacity-70">small ritual</span></div><p className="mt-9 font-serif-display text-3xl leading-[.95]">Leave one thing easier for tomorrow.</p><p className="mt-4 text-xs leading-relaxed text-[hsl(40_33%_98%)/.72]">The quiet wins count too.</p></div></Surface>
        <Surface className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">The two of you</p><UsersRound size={16} className="text-primary" /></div><div className="mt-5 flex items-center"><Avatar user={current.data} /><div className="-ml-2"><Avatar user={partner} /></div><div className="ml-3"><p data-testid="text-shared-people" className="text-sm font-semibold">{current.data?.displayName || 'You'} + {partner?.displayName || 'your person'}</p><p className="mt-1 text-xs text-muted-foreground">One shared list</p></div></div></Surface>
      </div>
    </div>
    {dialogOpen && <TaskDialog editing={editing} title={title} description={description} dueDate={dueDate} assignedTo={assignedTo} partner={partner} currentUser={current.data} saving={createTask.isPending || updateTask.isPending} onTitle={setTitle} onDescription={setDescription} onDueDate={setDueDate} onAssignedTo={setAssignedTo} onClose={() => setDialogOpen(false)} onSubmit={saveTask} />}
  </div>;
}

function SummaryCell({ label, value, active, onClick, testId }: { label: string; value: number; active: boolean; onClick: () => void; testId: string }) {
  return <button type="button" data-testid={`button-${testId}`} onClick={onClick} className={cx('rounded-2xl border p-4 text-left transition hover:-translate-y-0.5', active ? 'border-primary/35 bg-primary/8' : 'border-border bg-card hover:bg-muted')}><p className="font-mono-ui text-2xl text-foreground">{value}</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p></button>;
}
function TaskSkeleton() { return <div className="space-y-4 p-6">{[1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4"><div className="h-10 w-10 animate-pulse rounded-full bg-muted" /><div className="flex-1"><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-muted" /></div></div>)}</div>; }
function ErrorState({ label, action }: { label: string; action: () => void }) { return <div className="p-10 text-center"><p className="text-sm font-semibold">{label}</p><p className="mt-2 text-xs text-muted-foreground">Give it another moment, then try again.</p><Button data-testid="button-retry" variant="outline" className="mt-5" onClick={action}><RefreshCw size={14} /> Retry</Button></div>; }
function EmptyTasks({ onAdd }: { onAdd: () => void }) { return <div className="p-10 text-center md:p-16"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Check size={23} /></div><h3 className="mt-5 font-serif-display text-2xl">Nothing pressing.</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Add the first small thing you want to keep between you today.</p><Button data-testid="button-empty-add-task" className="mt-6" onClick={onAdd}><Plus size={16} /> Add first task</Button></div>; }
function TaskRow({ task, index, onCycle, onEdit, onDelete, partner, currentUser }: { task: Task; index: number; onCycle: () => void; onEdit: () => void; onDelete: () => void; partner?: User; currentUser?: User }) {
  const person = task.assignedTo === partner?.id ? partner : task.assignedTo === currentUser?.id ? currentUser : undefined;
  return <div data-testid={`row-task-${task.id}`} className="group flex items-start gap-3 px-5 py-4 transition hover:bg-muted/45 md:px-6" style={{ animationDelay: `${index * 45}ms` }}><button type="button" data-testid={`button-status-${task.id}`} onClick={onCycle} className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition', task.status === 'complete' ? 'border-primary bg-primary text-primary-foreground' : task.status === 'in_progress' ? 'border-accent bg-accent/20 text-foreground' : 'border-border text-muted-foreground hover:border-primary')}>{task.status === 'complete' ? <Check size={16} /> : task.status === 'in_progress' ? <Clock3 size={16} /> : <Circle size={16} />}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p data-testid={`text-task-title-${task.id}`} className={cx('text-sm font-semibold', task.status === 'complete' && 'text-muted-foreground line-through')}>{task.title}</p>{task.status === 'in_progress' && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">in motion</span>}</div>{task.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{task.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-medium text-muted-foreground">{task.dueDate && <span className="flex items-center gap-1"><Clock3 size={11} /> {dateLabel(task.dueDate)}</span>}{person && <span className="flex items-center gap-1"><Avatar user={person} small /> {person.displayName}</span>}</div></div><div className="flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100"><button type="button" data-testid={`button-edit-task-${task.id}`} onClick={onEdit} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /></button><button type="button" data-testid={`button-delete-task-${task.id}`} onClick={onDelete} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15} /></button></div></div>;
}
function TaskDialog({ editing, title, description, dueDate, assignedTo, partner, currentUser, saving, onTitle, onDescription, onDueDate, onAssignedTo, onClose, onSubmit }: { editing: Task | null; title: string; description: string; dueDate: string; assignedTo: string; partner?: User; currentUser?: User; saving: boolean; onTitle: (value: string) => void; onDescription: (value: string) => void; onDueDate: (value: string) => void; onAssignedTo: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="w-full max-w-lg rounded-t-[1.6rem] border border-border bg-card p-6 shadow-2xl sm:rounded-[1.6rem]"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">{editing ? 'edit task' : 'new task'}</p><h2 className="mt-2 font-serif-display text-3xl">{editing ? 'Make it clearer.' : 'What needs doing?'}</h2></div><button data-testid="button-close-task-dialog" type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button></div><form onSubmit={onSubmit} className="mt-6 space-y-4"><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Title</span><input data-testid="input-task-title" required maxLength={160} autoFocus value={title} onChange={(event) => onTitle(event.target.value)} placeholder="A small, specific thing" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Note <span className="font-normal">optional</span></span><textarea data-testid="input-task-description" maxLength={500} value={description} onChange={(event) => onDescription(event.target.value)} rows={3} placeholder="Anything that makes this easier to pick up…" className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Due date</span><input data-testid="input-task-due-date" type="date" value={dueDate} onChange={(event) => onDueDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">For</span><select data-testid="select-task-assignee" value={assignedTo} onChange={(event) => onAssignedTo(event.target.value)} className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"><option value="">Both of us</option>{currentUser && <option value={currentUser.id}>{currentUser.displayName}</option>}{partner && <option value={partner.id}>{partner.displayName}</option>}</select></label></div><div className="flex gap-3 pt-2"><Button data-testid="button-cancel-task" type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button><Button data-testid="button-save-task" type="submit" disabled={saving} className="flex-1">{saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}</Button></div></form></div></div>;
}

function ChatPage() {
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: partner, isLoading: partnerLoading } = useGetChatPartner({ query: { queryKey: getGetChatPartnerQueryKey() } });
  const { data: messages, isLoading, isError, refetch } = useListMessages({ query: { queryKey: getListMessagesQueryKey() } });
  const send = useSendMessage();
  const edit = useEditMessage();
  const remove = useDeleteMessage();
  const client = useQueryClient();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const reveal = (id: string) => setRevealed((previous) => new Set(previous).add(id));
  const sendMessage = (event: FormEvent) => { event.preventDefault(); const clean = content.trim(); if (!clean) return; send.mutate({ data: { content: clean } }, { onSuccess: () => { setContent(''); client.invalidateQueries({ queryKey: getListMessagesQueryKey() }); } }); };
  const saveEdit = (id: string) => { const clean = editingContent.trim(); if (!clean) return; edit.mutate({ id, data: { content: clean } }, { onSuccess: () => { setEditingId(null); client.invalidateQueries({ queryKey: getListMessagesQueryKey() }); } }); };
  const deleteMessage = (id: string) => { if (window.confirm('Remove this message from the room?')) remove.mutate({ id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListMessagesQueryKey() }) }); };
  return <div className="mx-auto max-w-3xl animate-rise-in">
    <div className="mb-7 flex items-end justify-between gap-4"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(170_38%_57%)]">private / two seats</p><h1 className="mt-2 font-serif-display text-5xl text-[hsl(36_28%_92%)]">A quiet room.</h1><p className="mt-3 text-sm text-[hsl(225_14%_63%)]">Tap a sealed note when you are ready for it.</p></div><div className="hidden items-center gap-2 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(170_38%_57%)]" /><span className="font-mono-ui text-[10px] uppercase tracking-wider text-[hsl(225_14%_63%)]">together now</span></div></div>
    <Surface className="overflow-hidden border-[hsl(225_20%_22%)] bg-[hsl(226_27%_14%)] shadow-[0_24px_80px_hsl(228_28%_5%/.25)]">
      <div className="flex items-center justify-between border-b border-[hsl(225_20%_22%)] px-5 py-4 md:px-7"><div className="flex items-center gap-3"><Avatar user={partner} /><div><p data-testid="text-chat-partner" className="text-sm font-semibold text-[hsl(36_28%_92%)]">{partnerLoading ? 'Finding your person…' : partner?.displayName || 'Your person'}</p><p className="mt-0.5 text-xs text-[hsl(225_14%_63%)]">private conversation</p></div></div><LockKeyhole size={17} className="text-[hsl(170_38%_57%)]" /></div>
      <div className="min-h-[430px] space-y-5 px-4 py-6 md:px-7">{isLoading ? <ChatSkeleton /> : isError ? <ErrorState label="The private room is quiet right now." action={refetch} /> : (messages || []).length === 0 ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full border border-[hsl(225_20%_25%)] text-[hsl(170_38%_57%)]"><MessageCircle size={22} /></div><p className="mt-5 font-serif-display text-2xl text-[hsl(36_28%_92%)]">Start the thread.</p><p className="mt-2 max-w-xs text-sm text-[hsl(225_14%_63%)]">The first note can be ordinary. It can also not be.</p></div> : (messages || []).map((message) => <MessageBubble key={message.id} message={message} mine={message.senderId === current.data?.id} revealed={revealed.has(message.id)} onReveal={() => reveal(message.id)} onEdit={() => { setEditingId(message.id); setEditingContent(message.content); reveal(message.id); }} onDelete={() => deleteMessage(message.id)} editing={editingId === message.id} editContent={editingContent} onEditContent={setEditingContent} onSaveEdit={() => saveEdit(message.id)} onCancelEdit={() => setEditingId(null)} />)}</div>
      <form onSubmit={sendMessage} className="border-t border-[hsl(225_20%_22%)] bg-[hsl(228_28%_8%/.35)] p-4 md:p-5"><div className="flex items-end gap-2 rounded-2xl border border-[hsl(225_20%_27%)] bg-[hsl(226_27%_14%)] p-2 pl-4 focus-within:border-[hsl(170_38%_57%)/.65]"><textarea data-testid="input-message" rows={1} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write something only they should read…" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm text-[hsl(36_28%_92%)] outline-none placeholder:text-[hsl(225_14%_63%)]" /><button data-testid="button-send-message" type="submit" disabled={!content.trim() || send.isPending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(170_38%_57%)] text-[hsl(228_28%_8%)] transition hover:brightness-95 disabled:opacity-40"><ArrowUpRight size={17} /></button></div><div className="mt-2 flex items-center justify-between px-1 text-[10px] text-[hsl(225_14%_63%)]"><span>{send.isPending ? 'Sending quietly…' : 'Messages stay between the two seats.'}</span><span className="font-mono-ui">{content.length}/2000</span></div></form>
    </Surface>
  </div>;
}
function ChatSkeleton() { return <div className="space-y-5 py-6">{[1, 2, 3].map((item) => <div key={item} className={cx('h-20 animate-pulse rounded-2xl bg-[hsl(225_23%_18%)]', item % 2 === 0 ? 'ml-auto w-3/5' : 'w-2/3')} />)}</div>; }
function MessageBubble({ message, mine, revealed, onReveal, onEdit, onDelete, editing, editContent, onEditContent, onSaveEdit, onCancelEdit }: { message: Message; mine: boolean; revealed: boolean; onReveal: () => void; onEdit: () => void; onDelete: () => void; editing: boolean; editContent: string; onEditContent: (value: string) => void; onSaveEdit: () => void; onCancelEdit: () => void }) {
  const deleted = Boolean(message.deletedAt);
  return <div data-testid={`bubble-message-${message.id}`} className={cx('group flex gap-3', mine ? 'justify-end' : 'justify-start')}><div className={cx('max-w-[86%] sm:max-w-[76%]', mine && 'items-end')}><div className={cx('relative rounded-[1.25rem] px-4 py-3', mine ? 'rounded-br-md bg-[hsl(170_38%_57%)] text-[hsl(228_28%_8%)]' : 'rounded-bl-md border border-[hsl(225_20%_24%)] bg-[hsl(225_23%_18%)] text-[hsl(36_28%_92%)]')}>{!revealed && !deleted ? <button type="button" data-testid={`button-reveal-message-${message.id}`} onClick={onReveal} className="flex min-h-[44px] min-w-[170px] items-center gap-3 text-left"><span className={cx('flex h-9 w-9 items-center justify-center rounded-full border text-lg', mine ? 'border-[hsl(228_28%_8%/.2)]' : 'border-[hsl(170_38%_57%/.35)] text-[hsl(170_38%_57%)]')}>{mine ? '◌' : '▦'}</span><span><span className="block text-sm font-semibold">Sealed note</span><span className={cx('mt-0.5 block text-[10px]', mine ? 'text-[hsl(228_28%_8%/.62)]' : 'text-[hsl(225_14%_63%)]')}>Tap to reveal</span></span></button> : editing ? <div className="min-w-[220px]"><textarea data-testid={`input-edit-message-${message.id}`} value={editContent} onChange={(event) => onEditContent(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-current/20 bg-transparent p-2 text-sm outline-none" /><div className="mt-2 flex justify-end gap-2"><button type="button" data-testid={`button-cancel-edit-message-${message.id}`} onClick={onCancelEdit} className="rounded-lg px-2 py-1 text-xs opacity-70">Cancel</button><button type="button" data-testid={`button-save-edit-message-${message.id}`} onClick={onSaveEdit} className="rounded-lg bg-foreground/10 px-2 py-1 text-xs font-bold">Save</button></div></div> : <p data-testid={`text-message-content-${message.id}`} className={cx('whitespace-pre-wrap text-sm leading-relaxed', deleted && 'italic opacity-55')}>{deleted ? 'Message removed.' : message.content}</p>}</div><div className={cx('mt-1 flex items-center gap-2 text-[10px]', mine ? 'justify-end text-[hsl(170_38%_57%)]' : 'text-[hsl(225_14%_63%)]')}><span>{timeLabel(message.createdAt)}{message.editedAt && !deleted ? ' · edited' : ''}</span>{mine && <span>{message.deliveryStatus === 'read' ? <CheckCheck size={13} /> : message.deliveryStatus === 'delivered' ? <CheckCheck size={13} className="opacity-60" /> : <Check size={13} className="opacity-60" />}</span>}{revealed && !deleted && <span className="opacity-60">read</span>}</div>{mine && revealed && !editing && !deleted && <div className="mt-1 flex justify-end gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100"><button type="button" data-testid={`button-edit-message-${message.id}`} onClick={onEdit} className="rounded-md p-1 text-[hsl(225_14%_63%)] hover:text-[hsl(36_28%_92%)]"><Edit3 size={13} /></button><button type="button" data-testid={`button-delete-message-${message.id}`} onClick={onDelete} className="rounded-md p-1 text-[hsl(225_14%_63%)] hover:text-[hsl(14_64%_68%)]"><Trash2 size={13} /></button></div>}</div></div>;
}

function JourneyPage() {
  const { data: journey, isLoading, isError, refetch } = useGetJourney({ query: { queryKey: getGetJourneyQueryKey() } });
  if (isLoading) return <LoadingScreen label="Opening the next chapter" />;
  if (isError || !journey) return <ErrorState label="The journey is unavailable right now." action={refetch} />;
  return <div className="animate-rise-in"><div className="mx-auto max-w-2xl text-center"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-primary">a place to return to</p><h1 data-testid="text-journey-title" className="mt-4 font-serif-display text-6xl leading-[.92] tracking-tight md:text-8xl">{journey.title}</h1><p data-testid="text-journey-description" className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">{journey.description}</p></div><div className="relative mx-auto mt-12 max-w-3xl overflow-hidden rounded-[1.8rem] border border-border bg-[hsl(14_55%_68%)] p-7 shadow-[0_25px_70px_hsl(14_55%_68%/.2)] md:p-12"><div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[24px] border-[hsl(40_33%_98%/.35)]" /><div className="absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-[hsl(173_31%_33%/.15)]" /><div className="relative min-h-[230px]"><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(222_28%_17%/.65)]">the external chapter</span><p className="mt-16 max-w-sm font-serif-display text-4xl leading-none text-[hsl(222_28%_17%)] md:text-6xl">Some things are better visited together.</p><a data-testid="link-journey-external" href={journey.url} target="_blank" rel="noreferrer" className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[hsl(222_28%_17%)] px-5 text-sm font-bold text-[hsl(40_33%_98%)] transition hover:-translate-y-0.5">Visit the place <ExternalLink size={16} /></a></div></div></div>;
}

function SettingsPage() {
  const { data: settings, isLoading, isError, refetch } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: devices } = useListDevices({ query: { queryKey: getListDevicesQueryKey() } });
  const update = useUpdateSettings();
  const logoutEverywhere = useLogoutEverywhere();
  const client = useQueryClient();
  const [journeyUrl, setJourneyUrl] = useState('');
  useEffect(() => { if (settings) setJourneyUrl(settings.journeyUrl); }, [settings]);
  if (isLoading) return <LoadingScreen label="Loading shared settings" />;
  if (isError || !settings) return <ErrorState label="Settings could not be loaded." action={refetch} />;
  const patch = (data: Partial<AppSettings>) => update.mutate({ data }, { onSuccess: (next) => client.setQueryData(getGetSettingsQueryKey(), next) });
  const saveJourney = (event: FormEvent) => { event.preventDefault(); patch({ journeyUrl }); };
  return <div className="mx-auto max-w-3xl animate-rise-in"><div className="mb-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-primary">shared preferences</p><h1 className="mt-2 font-serif-display text-5xl tracking-tight">Keep it yours.</h1><p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">These choices belong to both of you, on every device.</p></div><div className="space-y-4">
    <SettingsGroup icon={<Lightbulb size={17} />} title="The atmosphere" note="How the app meets you"><SettingChoice label="Daylight" detail="Warm paper and soft edges" active={settings.theme === 'light'} onClick={() => patch({ theme: 'light' })} testId="theme-light" /><SettingChoice label="Midnight" detail="A darker room for private time" active={settings.theme === 'dark'} onClick={() => patch({ theme: 'dark' })} testId="theme-dark" /><SettingChoice label="Follow device" detail="Let the device decide" active={settings.theme === 'system'} onClick={() => patch({ theme: 'system' })} testId="theme-system" /></SettingsGroup>
    <SettingsGroup icon={<MessageCircle size={17} />} title="Reveal style" note="How sealed notes look"><SettingChoice label="Soft seals" detail="A simple closed bubble" active={settings.bubbleStyle === 'emoji'} onClick={() => patch({ bubbleStyle: 'emoji' })} testId="bubble-soft" /><SettingChoice label="Newsprint" detail="A little more editorial" active={settings.bubbleStyle === 'newspaper'} onClick={() => patch({ bubbleStyle: 'newspaper' })} testId="bubble-newsprint" /></SettingsGroup>
    <SettingsGroup icon={<LockKeyhole size={17} />} title="Auto-lock" note="When private routes ask for your PIN"><SettingChoice label="Right away" active={settings.autoLock === 'immediate'} onClick={() => patch({ autoLock: 'immediate' })} testId="lock-immediate" /><SettingChoice label="After one minute" active={settings.autoLock === 'one_minute'} onClick={() => patch({ autoLock: 'one_minute' })} testId="lock-one-minute" /><SettingChoice label="After five minutes" active={settings.autoLock === 'five_minutes'} onClick={() => patch({ autoLock: 'five_minutes' })} testId="lock-five-minutes" /><SettingChoice label="Never" active={settings.autoLock === 'never'} onClick={() => patch({ autoLock: 'never' })} testId="lock-never" /></SettingsGroup>
    <SettingsGroup icon={settings.notifications ? <Bell size={17} /> : <BellOff size={17} />} title="Notifications" note="A gentle nudge when something arrives"><div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4"><div><p className="text-sm font-semibold">{settings.notifications ? 'Notifications are on' : 'Notifications are off'}</p><p className="mt-1 text-xs text-muted-foreground">Only for new private messages.</p></div><button type="button" data-testid="button-toggle-notifications" onClick={() => patch({ notifications: !settings.notifications })} className={cx('relative h-7 w-12 rounded-full transition', settings.notifications ? 'bg-primary' : 'bg-muted')}><span className={cx('absolute top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform', settings.notifications ? 'translate-x-6' : 'translate-x-1')} /></button></div></SettingsGroup>
    <SettingsGroup icon={<ArrowUpRight size={17} />} title="Journey link" note="The one place beyond this app"><form onSubmit={saveJourney} className="flex flex-col gap-2 sm:flex-row"><input data-testid="input-journey-url" value={journeyUrl} onChange={(event) => setJourneyUrl(event.target.value)} className="min-h-12 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="https://…" /><Button data-testid="button-save-journey-url" type="submit" disabled={update.isPending}>Save link</Button></form></SettingsGroup>
    <SettingsGroup icon={<Laptop size={17} />} title="Devices" note="Signed-in places"><div className="space-y-2">{(devices || []).length ? devices?.map((device) => <div data-testid={`row-device-${device.id}`} key={device.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Laptop size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{device.label}</p><p className="mt-1 text-xs text-muted-foreground">{device.current ? 'This device' : `Active ${dateLabel(device.lastActiveAt)}`}</p></div>{device.current && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">current</span>}</div>) : <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No other devices are connected.</p>}<Button data-testid="button-logout-everywhere" variant="outline" className="mt-2 w-full" disabled={logoutEverywhere.isPending} onClick={() => { if (window.confirm('Sign out everywhere except this device?')) logoutEverywhere.mutate(undefined, { onSuccess: () => client.invalidateQueries({ queryKey: getListDevicesQueryKey() }) }); }}><Shield size={15} /> Sign out other devices</Button></div></SettingsGroup>
  </div></div>;
}
function SettingsGroup({ icon, title, note, children }: { icon: ReactNode; title: string; note: string; children: ReactNode }) { return <Surface className="p-5 md:p-6"><div className="mb-5 flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><div><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{note}</p></div></div>{children}</Surface>; }
function SettingChoice({ label, detail, active, onClick, testId }: { label: string; detail?: string; active: boolean; onClick: () => void; testId: string }) { return <button type="button" data-testid={`button-${testId}`} onClick={onClick} className={cx('flex w-full items-center gap-3 border-b border-border/60 py-3 text-left last:border-0', active ? 'text-foreground' : 'text-muted-foreground')}><span className={cx('flex h-5 w-5 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{active && <Check size={12} />}</span><span className="flex-1"><span className="block text-sm font-semibold">{label}</span>{detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}</span></button>; }

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/login" component={LoginPage} />
    <Route path="/pin" component={PinPage} />
    <Route path="/"><AuthGate><AppShell><HomePage /></AppShell></AuthGate></Route>
    <Route path="/chat"><AuthGate><PrivateGate><AppShell><ChatPage /></AppShell></PrivateGate></AuthGate></Route>
    <Route path="/journey"><AuthGate><PrivateGate><AppShell><JourneyPage /></AppShell></PrivateGate></AuthGate></Route>
    <Route path="/settings"><AuthGate><PrivateGate><AppShell><SettingsPage /></AppShell></PrivateGate></AuthGate></Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;
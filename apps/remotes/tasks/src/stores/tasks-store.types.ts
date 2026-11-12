import type { TaskDifficulty } from '../domain/game-config';
import type {
  ActivityEvent,
  BoardPlayerProfile,
  CoinTransaction,
  DailyState,
  FamilyMember,
  FamilyReward,
  FamilyTask,
  InventoryItem,
  NewTaskInput,
  RewardRequest,
  SprintBoss,
  SprintHistoryItem,
  TaskStatus,
  UpdateTaskInput,
} from '../domain/task';

export type BoardFilter = 'all' | 'mine' | 'authored' | 'reviewing' | 'free' | 'today' | 'overdue' | 'blocked' | 'review' | 'recurring' | 'sprint' | TaskDifficulty;
export type AppSection = 'board' | 'history' | 'achievements' | 'shop' | 'bestiary' | 'profile';
export type SyncState = 'loading' | 'live' | 'denied' | 'error';

export interface PlayerState {
  level: number;
  totalXp: number;
  xp: number;
  xpToNext: number;
  coins: number;
  reservedCoins: number;
  streaks: BoardPlayerProfile['streaks'];
  streakFreezes: number;
  dailyRerollTokens: number;
  mysteryChests: number;
  openedChests: number;
  shopPurchases: number;
  claimedMilestones: number[];
  achievementIds: string[];
  activeTitle?: string;
  activeFrame?: string;
  activeEffect?: string;
  activeBackground?: string;
  avatarOverride?: string;
}

export interface ToastState {
  id: number;
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'neutral';
}

export interface CelebrationState {
  id: number;
  kind: 'level' | 'achievement' | 'chest';
  title: string;
  detail: string;
}

export interface RemoteBoardPayload {
  tasks: FamilyTask[];
  profile: BoardPlayerProfile;
  boss: SprintBoss;
  history: SprintHistoryItem[];
  daily: DailyState;
  profiles: BoardPlayerProfile[];
  activity: ActivityEvent[];
  familyRewards: FamilyReward[];
  inventory: InventoryItem[];
  rewardRequests: RewardRequest[];
  coinTransactions: CoinTransaction[];
  members: FamilyMember[];
  currentUserId: string;
  canEdit: boolean;
}

export interface TasksState {
  tasks: FamilyTask[];
  members: FamilyMember[];
  currentUserId: string;
  player: PlayerState;
  daily: DailyState | null;
  profiles: BoardPlayerProfile[];
  activity: ActivityEvent[];
  familyRewards: FamilyReward[];
  inventory: InventoryItem[];
  rewardRequests: RewardRequest[];
  coinTransactions: CoinTransaction[];
  sprintHistory: SprintHistoryItem[];
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  bossDescription: string;
  bossQuote: string;
  bossIcon: string;
  bossTraits: string[];
  bossSeason: string;
  bossArchetype: string;
  bossFinalHitUserId?: string;
  activeSprintId: string;
  sprintNumber: number;
  sprintEndsAt?: string;
  syncState: SyncState;
  syncError: string | null;
  canEdit: boolean;
  pendingTaskIds: string[];
  dailyPending: boolean;
  shopPending: boolean;
  activeSection: AppSection;
  filter: BoardFilter;
  query: string;
  createModalOpen: boolean;
  editingTaskId: string | null;
  toast: ToastState | null;
  celebration: CelebrationState | null;
  setActiveSection: (section: AppSection) => void;
  setFilter: (filter: BoardFilter) => void;
  setQuery: (query: string) => void;
  openCreateModal: () => void;
  openEditModal: (taskId: string) => void;
  closeTaskModal: () => void;
  dismissToast: () => void;
  dismissCelebration: () => void;
  setSyncState: (state: SyncState, error?: string) => void;
  hydrateRemoteBoard: (payload: RemoteBoardPayload) => void;
  moveTask: (taskId: string, target: TaskStatus) => Promise<boolean>;
  agreeDifficulty: (taskId: string) => Promise<void>;
  proposeDifficulty: (taskId: string, difficulty: TaskDifficulty) => Promise<void>;
  declineDifficulty: (taskId: string) => Promise<void>;
  takeTask: (taskId: string) => Promise<void>;
  acceptTransfer: (taskId: string) => Promise<void>;
  rejectTransfer: (taskId: string) => Promise<void>;
  leaveTask: (taskId: string) => Promise<void>;
  createTask: (input: NewTaskInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  claimDaily: (questId: string) => Promise<void>;
  rerollDaily: () => Promise<void>;
  buySystemItem: (itemId: string) => Promise<void>;
  openChest: () => Promise<void>;
  buyFamilyReward: (rewardId: string) => Promise<void>;
  createFamilyReward: (input: { title: string; description?: string; price: number; quantity?: number; cooldownHours?: number }) => Promise<void>;
  resolveRewardRequest: (requestId: string, decision: 'approved' | 'rejected') => Promise<void>;
  redeemInventoryItem: (inventoryId: string) => Promise<void>;
  equipProfileItem: (inventoryId: string) => Promise<void>;
}

import { dailyRerollPrice } from '../domain/daily';
import { useTasksStore } from '../stores/tasks-store';
import { Icon } from './Icon';

function resetLabel(nextResetAt: string) {
  const milliseconds = Math.max(0, new Date(nextResetAt).getTime() - Date.now());
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return `${hours}ч ${minutes}м`;
}

export function DailyQuests() {
  const daily = useTasksStore((state) => state.daily);
  const pending = useTasksStore((state) => state.dailyPending);
  const coins = useTasksStore((state) => state.player.coins);
  const freezes = useTasksStore((state) => state.player.streakFreezes);
  const rerollTokens = useTasksStore((state) => state.player.dailyRerollTokens);
  const claimDaily = useTasksStore((state) => state.claimDaily);
  const rerollDaily = useTasksStore((state) => state.rerollDaily);
  if (!daily) return null;
  const cataloguePrice = dailyRerollPrice(daily.rerollCount);
  const rerollPrice = cataloguePrice > 0 && rerollTokens > 0 ? 0 : cataloguePrice;
  const completed = daily.quests.filter((quest) => quest.claimed).length;
  return (
    <section className="daily-quests">
      <header>
        <span><Icon name="sparkles" size={17} />ЕЖЕДНЕВНЫЕ КВЕСТЫ <b>{completed}/3</b></span>
        <div><small>Обновятся через {resetLabel(daily.nextResetAt)}</small><button type="button" disabled={pending || rerollPrice > coins || completed > 0} onClick={() => void rerollDaily()}>Reroll · {cataloguePrice > 0 && rerollTokens > 0 ? 'жетон' : rerollPrice === 0 ? 'бесплатно' : `${rerollPrice} ◈`}</button></div>
      </header>
      <div>{daily.quests.map((quest) => {
        const complete = quest.progress >= quest.target;
        return <article key={quest.id} className={quest.claimed ? 'complete claimed' : complete ? 'complete' : undefined}>
          <span className="daily-icon">{quest.icon}</span>
          <div><b>{quest.title}</b><p>{quest.description}</p><span className="quest-progress"><i style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }} /></span><small>{quest.progress} / {quest.target}</small></div>
          <button type="button" disabled={pending || !complete || quest.claimed} onClick={() => void claimDaily(quest.id)}>{quest.claimed ? 'Получено' : `+${quest.rewardCoins} ◈`}</button>
        </article>;
      })}</div>
      <footer><span>Сундук дня: {daily.chestClaimed ? 'получен' : `${completed}/3`}</span><span>🧊 Freeze ×{freezes} · 🎲 ×{rerollTokens}</span></footer>
    </section>
  );
}

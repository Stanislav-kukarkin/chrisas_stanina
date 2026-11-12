import { useState } from 'react';
import { AnimatedNumber } from '@chrisasstanina/ui';
import { Icon } from './Icon';
import { taskReward } from '../domain/task';
import { useTasksStore } from '../stores/tasks-store';

export function BossPanel() {
  const hp = useTasksStore((state) => state.bossHp);
  const maxHp = useTasksStore((state) => state.bossMaxHp);
  const bossName = useTasksStore((state) => state.bossName);
  const bossDescription = useTasksStore((state) => state.bossDescription);
  const bossQuote = useTasksStore((state) => state.bossQuote);
  const bossIcon = useTasksStore((state) => state.bossIcon);
  const bossTraits = useTasksStore((state) => state.bossTraits);
  const bossSeason = useTasksStore((state) => state.bossSeason);
  const bossArchetype = useTasksStore((state) => state.bossArchetype);
  const activity = useTasksStore((state) => state.activity);
  const sprintEndsAt = useTasksStore((state) => state.sprintEndsAt);
  const tasks = useTasksStore((state) => state.tasks);
  const members = useTasksStore((state) => state.members);
  const [openedAt] = useState(() => Date.now());
  const progress = Math.max(0, Math.min(1, hp / maxHp));
  const bossWords = bossName.toLocaleUpperCase('ru-RU').split(' ');
  const bossLastWord = bossWords.pop() ?? '';
  const bossFirstLine = bossWords.join(' ');
  const daysLeft = sprintEndsAt
    ? Math.max(0, Math.ceil((new Date(sprintEndsAt).getTime() - openedAt) / 86_400_000))
    : 6;
  const damageByMember = new Map<string, number>();
  tasks.forEach((task) => {
    if (!task.bossDamageSettledAt || task.assigneeIds.length === 0) return;
    const share = taskReward(task).bossDamage / task.assigneeIds.length;
    task.assigneeIds.forEach((memberId) => {
      damageByMember.set(memberId, (damageByMember.get(memberId) ?? 0) + share);
    });
  });
  const hunters = [...damageByMember.entries()]
    .map(([memberId, damage]) => ({
      member: members.find((candidate) => candidate.id === memberId),
      damage: Math.round(damage),
    }))
    .filter((hunter) => hunter.member)
    .sort((left, right) => right.damage - left.damage)
    .slice(0, 2);
  const lastAttack = activity.find((event) => event.type === 'task_completed' && event.bossDamage);

  return (
    <section className="boss-panel" aria-labelledby="boss-name">
      <div className="boss-copy">
        <div className="boss-eyebrow"><span /><b>БОСС СПРИНТА</b><span /></div>
        <h2 id="boss-name">{bossFirstLine}<br /><em>{bossLastWord}</em></h2>
        {bossDescription && <p className="boss-description">{bossDescription}</p>}
        <blockquote>«{bossQuote}»</blockquote>
        <div className="boss-tags"><span>◈ {bossSeason}</span><span>⚔ {bossArchetype}</span></div>
      </div>

      <div className="boss-art" aria-hidden="true">
        {lastAttack && <strong key={lastAttack.id} className="boss-damage-pop">−{lastAttack.bossDamage}</strong>}
        <span className="ember ember-a" /><span className="ember ember-b" /><span className="ember ember-c" />
        <div className="boss-aura" />
        <div className={`generated-boss ${bossTraits.map((trait) => `trait-${trait}`).join(' ')}`}><i /><span>{bossIcon}</span><b>✦</b></div>
      </div>

      <div className="boss-stats">
        <div className="boss-hp-label"><span><b>❤</b> ЗДОРОВЬЕ</span><strong><AnimatedNumber key="boss-hp" value={hp} format={(value) => String(Math.round(value))} aria-label={`${Math.round(hp)} здоровья`} /> <small>/ {maxHp} HP</small></strong></div>
        <div className="boss-hp-track"><i style={{ width: `${progress * 100}%` }}><span /></i></div>
        <div className="boss-meta">
          <div><Icon name="clock" size={17} /><span>До конца спринта</span><strong>{daysLeft} дн.</strong></div>
          <div><Icon name="shield" size={17} /><span>Нанесено урона</span><strong>{maxHp - hp} DMG</strong></div>
        </div>
        <div className="hunter-row">
          <span>ЛУЧШИЕ ОХОТНИКИ</span>
          {hunters.length === 0 ? <small>Урон ещё не нанесён</small> : hunters.map(({ member, damage }) => member && (
            <div key={member.id}>
              <span className="avatar" style={{ background: member.color }}>{member.initials}</span>
              <b>{member.name}</b><i /> <strong>{damage}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

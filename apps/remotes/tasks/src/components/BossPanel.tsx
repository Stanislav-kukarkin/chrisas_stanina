import { useState } from 'react';
import { AnimatedNumber } from '@chrisasstanina/ui';
import { Icon } from './Icon';
import { taskReward } from '../domain/task';
import { useTasksStore } from '../stores/tasks-store';

export function BossPanel() {
  const hp = useTasksStore((state) => state.bossHp);
  const maxHp = useTasksStore((state) => state.bossMaxHp);
  const bossName = useTasksStore((state) => state.bossName);
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

  return (
    <section className="boss-panel" aria-labelledby="boss-name">
      <div className="boss-copy">
        <div className="boss-eyebrow"><span /><b>БОСС СПРИНТА</b><span /></div>
        <h2 id="boss-name">{bossFirstLine}<br /><em>{bossLastWord}</em></h2>
        <blockquote>«Я уже почти начал. Ещё пять минут…»</blockquote>
        <div className="boss-tags"><span>◈ Осенний</span><span>⚔ Лень</span></div>
      </div>

      <div className="boss-art" aria-hidden="true">
        <span className="ember ember-a" /><span className="ember ember-b" /><span className="ember ember-c" />
        <div className="boss-aura" />
        <div className="pumpkin-boss">
          <div className="boss-horns"><i /><i /></div>
          <div className="boss-head">
            <i className="boss-eye eye-left" /><i className="boss-eye eye-right" />
            <span className="boss-nose" /><span className="boss-mouth" />
          </div>
          <div className="boss-body"><span className="boss-buckle">◇</span></div>
          <span className="boss-arm arm-left" /><span className="boss-arm arm-right" />
        </div>
      </div>

      <div className="boss-stats">
        <div className="boss-hp-label"><span><b>❤</b> ЗДОРОВЬЕ</span><strong><AnimatedNumber value={hp} format={(value) => Math.round(value).toString()} /> <small>/ {maxHp} HP</small></strong></div>
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

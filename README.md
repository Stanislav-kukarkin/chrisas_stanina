# Chrisasstanina

Семейный microfrontend hub — приложения для быта на React + Module Federation, Firebase Auth/Firestore, деплой на GitHub Pages.

## Стек

- **Host**: Vite + React 19 + TypeScript + Tailwind
- **Microfrontends**: Module Federation (`@originjs/vite-plugin-federation`)
- **UI главной**: компоненты в стиле [React Bits](https://www.reactbits.dev/) (BlurText, Aurora, SpotlightCard)
- **Backend**: Firebase Authentication + Firestore
- **State**: TanStack Query + Zustand + Auth Context
- **Deploy**: GitHub Pages (`username.github.io`)

## Структура

```
apps/shell/           — host: главная, login, routing
apps/remotes/tasks/   — /apps/tasks
apps/remotes/shopping/
apps/remotes/recipes/
apps/remotes/budget/
apps/remotes/cashback/ — placeholder для Expo Web
packages/firebase/    — Firebase init, paths, query hooks
packages/auth/        — AuthProvider, LoginForm, ProtectedRoute
packages/shared-federation/ — federation config
```

## Быстрый старт

```bash
# Node 22 (см. .nvmrc)
npm install

# Скопируйте env
cp .env.example .env
# Заполните Firebase config (см. ниже)

# Dev: shell + все remotes
npm run dev

# Только shell (remotes должны быть собраны)
npm run dev:shell
```

## Firebase — создание проекта

1. Откройте [Firebase Console](https://console.firebase.google.com)
2. **Create project** → имя `chrisasstanina` (или своё)
3. **Authentication** → Sign-in method → **Email/Password** → Enable
4. **Firestore Database** → Create database → Production mode
5. **Project settings** → Your apps → Web → скопируйте config в `.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_DEFAULT_FAMILY_ID=main
```

6. **Authentication** → Users → **Add user** — создайте аккаунты семьи вручную (UI регистрации нет)
7. Установите Firebase CLI и задеployьте rules:

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # выберите проект
firebase deploy --only firestore:rules
```

### Firestore paths

```
users/{uid}                                      — профиль (имя, emoji, цвет)
families/{familyId}/members/{uid}                — участник семьи
families/{familyId}/apps/shopping/items/{id}   — товары
families/{familyId}/apps/shopping/favorites/{id} — избранное
```

Rules проверяют membership: `families/{familyId}/members/{auth.uid}` must exist.

После обновления rules:
```bash
firebase deploy --only firestore:rules
```

### Список покупок

1. Добавьте всех участников в Authentication → Users
2. Каждый логинится → заполняет профиль (модалка или `/settings`)
3. Откройте `/apps/shopping` — общий список семьи

## Сборка

```bash
npm run build
```

Pipeline: build remotes → copy в `apps/shell/public/remotes/` → build shell → `apps/shell/dist`

## GitHub Pages

1. Repo → Settings → Pages → Source: **GitHub Actions**
2. Добавьте secrets (Settings → Secrets → Actions):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_DEFAULT_FAMILY_ID` (optional, default `main`)
3. Push в `main` → автодеплой

## React Bits — добавление компонентов

Shell настроен под copy-paste модель React Bits:

```bash
cd apps/shell
npx shadcn@latest init
npx shadcn@latest add @react-bits/BlurText-TS-TW
```

Компоненты landing page уже есть в `apps/shell/src/components/react-bits/` как стартовый набор.

## Новое приложение

1. Скопируйте `apps/remotes/tasks` → `apps/remotes/{name}`
2. Обновите `packages/shared-federation/src/index.ts` (`REMOTE_NAMES`, ports, labels)
3. Добавьте loader в `apps/shell/src/pages/RemoteAppPage.tsx`
4. Добавьте карточку на главной через `APP_CARDS`

## Cashback / Expo Web

Remote `cashback` — заглушка. Когда найдёте RN/Expo проект:

1. `expo export:web` в существующем проекте
2. Адаптируйте entry для Module Federation expose `./App`
3. Замените содержимое `apps/remotes/cashback`

## Angular (будущее)

См. `.cursor/rules/microfrontend-conventions.mdc` — Angular remote через `@angular-architects/module-federation`, тот же expose `./App`.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Shell + все remotes |
| `npm run dev:shell` | Только shell |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

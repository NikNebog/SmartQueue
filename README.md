# ProQ / SmartQ

Единый monorepo для системы электронной очереди SmartQ.

## Структура

- `frontend` - React/Vite клиент, порт `5173`
- `backend` - NestJS/Prisma API, порт `3000`
- `docker-compose.yml` - локальный PostgreSQL
- `scripts` - локальные команды запуска
- `docs` - архитектурные заметки

Frontend и backend остаются отдельными приложениями, но живут в одном репозитории и управляются из корня через npm workspaces.

## Первый запуск

```powershell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
npm.cmd run setup
npm.cmd run dev
```

После запуска:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Swagger: http://localhost:3000/api/docs

## Основные команды

```powershell
npm.cmd run db:up
npm.cmd run db:down
npm.cmd run setup
npm.cmd run backend:seed
npm.cmd run dev
npm.cmd run build
npm.cmd run audit:all
```

Отдельный запуск:

```powershell
npm.cmd run backend:dev
npm.cmd run frontend:dev
```

## Переменные окружения

Не коммитьте реальные `.env` файлы. В репозитории хранятся только примеры:

- `backend/.env.example`
- `frontend/.env.example`

## Архитектура

См. [docs/architecture.md](docs/architecture.md).

## Последние работы SmartQMain

- Проект поднят как Docker Compose project `smartqmain`; контейнеры переименованы в `smartqmain-postgres`, `smartqmain-backend`, `smartqmain-frontend`, приложение проверено на `http://localhost`.
- Для демо-стенда созданы пользователи `admin`, `manager`, `doctor`, `lab`, `reception` с паролем `Demo12345`.
- В админке табло добавлена кнопка `Выбрать все видео`; настройки шаблона, бегущей строки и медиа изолированы по профилям табло.
- Фронтенд табло собирается с поддержкой Chrome 79 через `@vitejs/plugin-legacy`, `build.target: chrome79` и `cssTarget: chrome79`; в Docker-сборке присутствуют legacy-бандлы `index-legacy` и `polyfills-legacy`.
- Добавлена казахская озвучка табло: фразы, буквы и числа теперь проигрываются для талонов с языком `kk`.
- Для врача добавлено право `canManageTicketIssue`: backend запрещает прямое изменение выдачи талонов без права, а frontend скрывает управление выдачей в панели специалиста.
- В разделе `Персонал` управление закрытием выдачи талонов вынесено в общую кнопку для всех врачей.
- В панели специалиста фоновое обновление очереди переведено в тихий режим, чтобы кнопки не мигали при polling.
- Статистика и график места обслуживания перенесены в нижнюю часть sidebar специалиста, блок уплотнен и работает без внутреннего скролла.
- Исправлена битая надпись `Индивидуальное` в настройках типа табло.

## Демо-данные

Команда `npm.cmd run backend:seed` наполняет локальную базу демо-набором:

- услуги, кабинеты, окна обслуживания и терминал;
- пользователи ролей `admin`, `manager`, `specialist`;
- талоны в статусах `waiting`, `called`, `in_service`, `completed`, `postponed`, `no_show`;
- рекомендации и настройки табло.

Демо-пароль для всех пользователей:

```text
Demo12345
```

Демо-логины:

- `admin@smartq.local`
- `manager@smartq.local`
- `doctor@smartq.local`
- `lab@smartq.local`
- `reception@smartq.local`

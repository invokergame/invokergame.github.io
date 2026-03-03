# Awakening System LitRPG

Минимально готовый проект на Next.js для текстовой LitRPG-игры.

## Запуск

1. Установи зависимости:
   ```bash
   npm install
   ```
2. Получи API-ключ в OpenRouter: https://openrouter.ai/keys
3. Создай `.env.local` на основе `.env.example` и заполни `PONY_ALPHA_API_KEY`.
4. (Опционально) Укажи `OPENROUTER_REFERER` и `OPENROUTER_TITLE` для OpenRouter Leaderboard.
5. Запусти:
   ```bash
   npm run dev
   ```

## Что реализовано

- UI игрового терминала + чат.
- Системный промпт с фазой калибровки.
- Парсинг JSON-стейта из ответа модели.
- Локальное сохранение/загрузка (`/api/game`).
- Интеграция с OpenRouter-моделью `openrouter/pony-alpha` через серверный маршрут (`/api/pony`).

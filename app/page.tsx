'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, User, Terminal, Loader2, Zap, RotateCcw, Brain, Heart, Star, Sword, Backpack } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SYSTEM_PROMPT = `Ты — Система и Гейм-Мастер в текстовой RPG. Твой стиль — смесь корейских манхв (Solo Leveling) и классического фэнтези.

World Setting: Мир, где современность столкнулась с «Искажением». Появились «Разломы» и «Пробужденные».

PHASE 1: CALIBRATION (Начало игры)
1. Сначала спроси имя Игрока.
2. Затем проведи "Калибровку": задай 3 уникальных метафоричных вопроса для определения сущности.
3. Проведи "Церемонию Пробуждения". Выдай уникальный пафосный класс и начальный навык.

CORE MECHANICS:
- Статы: Сила (STR), Ловкость (AGI), Интеллект (INT), Выносливость (VIT), Воля (WILL).
- Титулы: За великие достижения или безумный гринд выдавай Игроку Титулы. Титулы должны давать бонусы к статам.
- Репутация: Мир должен реагировать на Игрока. Его имя должно начать внушать трепет или страх.
- Интерфейс: Оформляй системные сообщения в блоки кода [SYSTEM: ... ].

ВАЖНО: В конце каждого сообщения, если данные изменились, выводи их в формате JSON:
{
  "name": "...",
  "class": "...",
  "level": 1,
  "titles": ["..."],
  "hp": 100,
  "maxHp": 100,
  "mp": 100,
  "maxMp": 100,
  "stats": { "STR": 10, "AGI": 10, "INT": 10, "VIT": 10, "WILL": 10 },
  "inventory": []
}`;

type Stats = { STR: number; AGI: number; INT: number; VIT: number; WILL: number };
type GameState = {
  name: string;
  level: number;
  class: string;
  titles: string[];
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Stats;
  inventory: string[];
};

type Message = { id: string; role: 'user' | 'model'; text: string };

const defaultState: GameState = {
  name: 'Неизвестный',
  level: 1,
  class: 'Не пробужден',
  titles: [],
  hp: 100,
  maxHp: 100,
  mp: 100,
  maxMp: 100,
  stats: { STR: 10, AGI: 10, INT: 10, VIT: 10, WILL: 10 },
  inventory: []
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [gameState, setGameState] = useState<GameState>(defaultState);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const loadGame = async () => {
    try {
      const res = await fetch('/api/game');
      if (!res.ok) return false;
      const data = await res.json();
      if (!Array.isArray(data.messages) || data.messages.length === 0) return false;
      setMessages(data.messages);
      if (data.gameState) {
        setGameState((prev) => ({
          ...prev,
          ...data.gameState,
          stats: { ...prev.stats, ...(data.gameState.stats || {}) },
          titles: Array.isArray(data.gameState.titles) ? data.gameState.titles : [],
          inventory: Array.isArray(data.gameState.inventory) ? data.gameState.inventory : []
        }));
      }
      return true;
    } catch {
      return false;
    }
  };

  const saveGame = async (msgs: Message[], state: GameState) => {
    try {
      await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, gameState: state })
      });
    } catch {
      // no-op
    }
  };

  const parseGameState = (text: string): GameState | null => {
    const match = text.match(/\{[\s\S]*?"stats"[\s\S]*?\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      const nextState = {
        ...gameState,
        ...parsed,
        stats: parsed.stats ? { ...gameState.stats, ...parsed.stats } : gameState.stats,
        titles: Array.isArray(parsed.titles) ? parsed.titles : gameState.titles,
        inventory: Array.isArray(parsed.inventory) ? parsed.inventory : gameState.inventory
      };
      setGameState(nextState);
      return nextState;
    } catch {
      return null;
    }
  };

  const callModel = async (history: Message[], userMessage: string) => {
    const response = await fetch('/api/pony', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, message: userMessage, systemPrompt: SYSTEM_PROMPT })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Ошибка связи с Pony Alpha');
    return data.text as string;
  };

  const initChat = async (forceRestart = false) => {
    setIsInitializing(true);
    if (!forceRestart) {
      const loaded = await loadGame();
      if (loaded) {
        setIsInitializing(false);
        return;
      }
    }

    setMessages([]);
    setGameState(defaultState);

    try {
      const modelText = await callModel([], 'Начни калибровку. Опиши мир кратко и задай первые вопросы для определения класса.');
      const firstMsg = { id: Date.now().toString(), role: 'model' as const, text: modelText || '[SYSTEM: ОШИБКА ЗАГРУЗКИ]' };
      setMessages([firstMsg]);
      await saveGame([firstMsg], defaultState);
    } catch (error: any) {
      setMessages([{ id: 'err', role: 'model', text: `[SYSTEM: КРИТИЧЕСКАЯ ОШИБКА]\n\n${error?.message || 'Не удалось подключиться к Системе.'}` }]);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initChat();
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || isInitializing) return;

    const userMsg = input.trim();
    setInput('');

    const newMessages: Message[] = [...messages, { id: Date.now().toString(), role: 'user', text: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const modelText = await callModel(messages, userMsg);
      const parsedState = parseGameState(modelText) ?? gameState;
      const finalMessages: Message[] = [...newMessages, { id: (Date.now() + 1).toString(), role: 'model', text: modelText || '[SYSTEM: ПУСТОЙ ОТВЕТ]' }];
      setMessages(finalMessages);
      await saveGame(finalMessages, parsedState);
    } catch {
      setMessages([...newMessages, { id: 'err', role: 'model', text: '[SYSTEM: ОШИБКА СВЯЗИ]' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-system-dark text-slate-200 flex flex-col font-sans selection:bg-system-blue/30 overflow-hidden">
      <header className="h-14 border-b border-system-border bg-system-dark/90 backdrop-blur-xl flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-sm bg-system-blue/10 border border-system-blue/30 flex items-center justify-center text-system-blue">
            <Zap size={16} />
          </div>
          <h1 className="font-bold text-sm tracking-[0.2em] text-white">AWAKENING SYSTEM</h1>
        </div>
        <button onClick={() => initChat(true)} className="group flex items-center gap-2 text-[10px] font-mono text-slate-500 hover:text-system-blue transition-all">
          <RotateCcw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
          RESTART_WORLD
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-system-border bg-system-panel/50 p-6 flex-col gap-8 hidden lg:flex overflow-y-auto">
          <section>
            <p className="text-xl font-black text-white tracking-tighter uppercase italic glitch-text">{gameState.name || 'Неизвестный'}</p>
            <div className="text-[10px] font-mono text-system-blue mt-2">LVL.{gameState.level}</div>
            <div className="system-window p-3 rounded-sm mt-3">
              <p className="text-[10px] text-slate-500 uppercase font-mono">Class</p>
              <p className="text-sm font-bold text-white tracking-wide uppercase">{gameState.class}</p>
            </div>
          </section>

          <section className="space-y-2">
            {[
              { label: 'STR', val: gameState.stats.STR, icon: Sword, color: 'text-orange-400' },
              { label: 'AGI', val: gameState.stats.AGI, icon: Zap, color: 'text-yellow-400' },
              { label: 'INT', val: gameState.stats.INT, icon: Brain, color: 'text-system-blue' },
              { label: 'VIT', val: gameState.stats.VIT, icon: Heart, color: 'text-red-400' },
              { label: 'WILL', val: gameState.stats.WILL, icon: Star, color: 'text-purple-400' }
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between p-2 bg-white/5 border border-white/5 rounded-sm">
                <div className="flex items-center gap-2">
                  <stat.icon size={12} className={cn(stat.color)} />
                  <span className="text-[10px] font-mono text-slate-400">{stat.label}</span>
                </div>
                <span className="text-xs font-bold text-white font-mono">{stat.val}</span>
              </div>
            ))}
          </section>

          <section className="mt-auto">
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600 mb-2">
              <Backpack size={12} /> INVENTORY
            </div>
            <ul className="text-xs text-slate-300 space-y-1">
              {gameState.inventory.length ? gameState.inventory.map((item) => <li key={item}>• {item}</li>) : <li>Пусто</li>}
            </ul>
          </section>
        </aside>

        <main className="flex-1 flex flex-col relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
            {isInitializing ? (
              <div className="h-full flex flex-col items-center justify-center gap-6">
                <Loader2 className="w-12 h-12 text-system-blue animate-spin" />
                <p className="font-mono text-[10px] tracking-[0.3em] text-system-blue animate-pulse uppercase">System_Initialization_Sequence...</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} className={cn('flex gap-6', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn('shrink-0 w-10 h-10 rounded-sm flex items-center justify-center border', msg.role === 'user' ? 'bg-slate-900 border-slate-700 text-slate-500' : 'system-window border-system-blue/40 text-system-blue')}>
                      {msg.role === 'user' ? <User size={18} /> : <Terminal size={18} />}
                    </div>
                    <div className={cn('max-w-[80%] p-6 rounded-sm', msg.role === 'user' ? 'bg-slate-900/40 border border-slate-800 text-slate-300' : 'system-window text-slate-200')}>
                      {msg.role === 'user' ? <p className="text-sm leading-relaxed">{msg.text}</p> : <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown></div>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {isLoading && <div className="text-system-blue text-xs font-mono">Processing_Data...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-system-dark via-system-dark/95 to-transparent">
            <form onSubmit={handleSend} className="system-window p-1 flex items-end gap-2 max-w-3xl mx-auto">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Введите команду или действие..."
                className="flex-1 max-h-32 min-h-[48px] bg-transparent border-none resize-none focus:ring-0 text-white placeholder:text-slate-700 p-4 text-sm outline-none"
                rows={1}
                disabled={isLoading || isInitializing}
              />
              <button type="submit" disabled={!input.trim() || isLoading || isInitializing} className="w-12 h-12 rounded-sm bg-system-blue/10 text-system-blue hover:bg-system-blue/20 flex items-center justify-center disabled:opacity-20 transition-all mb-1 mr-1 border border-system-blue/20">
                <Send size={18} />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

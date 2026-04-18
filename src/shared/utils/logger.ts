import { PROJECT_ENV } from "@/shared/constants/constant";

const isDev = () => PROJECT_ENV === 'dev'

const createLogger = (method: keyof Console, prefix: string) => {
  if (!isDev) return () => {};

  const fn = console[method];

  return Function.prototype.bind.call(fn, console, prefix);
};

export const logger = {
  info: createLogger("log", "ℹ️"),
  success: createLogger("log", "✅"),
  warn: createLogger("warn", "⚠️"),
  error: createLogger("error", "❌"),

  api: ((method: string, url: string, data?: any) => {
    if (!isDev) return;

    console.log(
      `🌐 [API] ${method}`,
      `${url}`,
      data || ""
    );
  }) as (method: string, url: string, data?: any) => void,

  group: createLogger("group", "🔹"),
  groupEnd: console.groupEnd.bind(console),
};
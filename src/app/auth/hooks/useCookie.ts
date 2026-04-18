import { useState, useCallback } from 'react'

export const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

export const setCookie = (name: string, value: any, days = 1) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
};

export const deleteCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

const useCookie = (key: string, defaultValue: any) => {
  const [cookie, setCookieState] = useState(() => {
    const existingCookie = getCookie(key);
    return existingCookie || defaultValue;
  });

  const updateCookie = useCallback((newValue: any, days: number) => {
    setCookie(key, newValue, days);
    setCookieState(newValue);
  }, [key]);

  const removeCookie = useCallback(() => {
    deleteCookie(key);
    setCookieState(null);
  }, [key]);

  return [cookie, updateCookie, removeCookie];
};

export default useCookie;

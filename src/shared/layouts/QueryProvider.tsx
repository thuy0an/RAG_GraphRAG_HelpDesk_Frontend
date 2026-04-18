import { queryClient, QueryClientProvider } from '@/shared/lib/ReactQuery';

export function QueryProvider({ children }: any) {
  return (
    <>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </>
  );
}
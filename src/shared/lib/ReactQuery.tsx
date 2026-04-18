import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query';

const queryClient = new QueryClient();

function getOriginURL(): string | undefined {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return undefined;
}

export {
  queryClient,
  getOriginURL,
  QueryClientProvider,
  useMutation,
  useQuery,
};
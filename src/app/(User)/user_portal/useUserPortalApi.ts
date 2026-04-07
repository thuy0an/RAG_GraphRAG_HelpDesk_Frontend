import { PUBLIC_API_BASE_URL } from "@/constants/constant";
import { queryClient, useMutation, useQuery } from "@/lib/ReactQuery";
import { useAuthStore } from "../../auth/authStore";
import { logger } from "@/utils/logger";

type SearchParams = {
  page: number;
  page_size: number;
  status?: string;
};

type UserTicketsParams = {
  page: number;
  page_size: number;
  status?: string;
  user_id: string;
};

const buildQuery = (params: SearchParams) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
};

const authHeader = (token?: string | null): HeadersInit => {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

async function fetchTicketsByUserId(params: UserTicketsParams) {
  const { user_id, ...rest } = params;
  
  const query = buildQuery(rest);
  logger.info(query)

  const response = await fetch(`${PUBLIC_API_BASE_URL}/tickets/user/${user_id}?${query}`);

  let data = await response.json()

  if (data.status_code !== 200) {
    throw new Error(data.message);
  }

  return data
}

async function fetchDepartments(token?: string | null) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/departments/?page=1&page_size=100`, {
    headers: authHeader(token),
  });

  if (!response.ok) {
    throw new Error("Không thể tải danh sách phòng ban");
  }

  return response.json();
}

async function createTicket(payload: FormData, token?: string | null) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/tickets/`, {
    method: "POST",
    headers: authHeader(token),
    body: payload,
  });

  if (!response.ok) {
    throw new Error("Tạo ticket thất bại");
  }

  return response.json();
}

type FeedbackPayload = {
  ticket_id: string;
  satisfaction_rating: number;
  customer_feedback?: string;
};

async function submitTicketFeedback(payload: FeedbackPayload, token?: string | null) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/tickets/${payload.ticket_id}/feedback`, {
    method: "POST",
    headers: {
      ...authHeader(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      satisfaction_rating: payload.satisfaction_rating,
      customer_feedback: payload.customer_feedback,
    }),
  });

  let data = await response.json();

  if (data.status_code !== 200) {
    throw new Error(data.message || "Gửi đánh giá thất bại");
  }

  return data;
}

export function useUserTickets(params: SearchParams) {
  const { token, payload } = useAuthStore();
  const user_id = payload?.user_id;
  
  logger.info(params)

  return useQuery(
    {
      queryKey: ["user_tickets", params, user_id],
      queryFn: () => fetchTicketsByUserId({ ...params, user_id: user_id }),
      enabled: !!user_id,
    },
    queryClient,
  );
}

export function useDepartments() {
  const { token } = useAuthStore();
  return useQuery(
    {
      queryKey: ["user_departments"],
      queryFn: () => fetchDepartments(token),
    },
    queryClient,
  );
}

export function useCreateUserTicket() {
  const { token } = useAuthStore();
  return useMutation(
    {
      mutationFn: (payload: FormData) => createTicket(payload, token),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
      },
    },
    queryClient,
  );
}

export function useSubmitTicketFeedback() {
  const { token } = useAuthStore();
  return useMutation(
    {
      mutationFn: (payload: FeedbackPayload) => submitTicketFeedback(payload, token),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
      },
    },
    queryClient,
  );
}


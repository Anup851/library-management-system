import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AuthUser,
  Book,
  CreateBookInput,
  CreateReviewInput,
  DashboardData,
  Notification,
  Reservation,
  Review,
  Transaction,
  TransactionStatus,
  User,
} from "@shared/schema";

const BOOTSTRAP_QUERY_KEY = ["/api/bootstrap"];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/";
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export type BootstrapPayload = {
  user: AuthUser;
  branches: Array<{ _id: string; name: string; code: string; address: string }>;
  users: User[];
  books: Book[];
  transactions: Transaction[];
  reservations: Reservation[];
  reviews: Review[];
  notifications: Notification[];
  auditLogs: Array<{
    _id: string;
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
  dashboard: DashboardData;
  recommendations: Book[];
};

export function useBootstrap(enabled: boolean) {
  return useQuery<BootstrapPayload, Error>({
    queryKey: BOOTSTRAP_QUERY_KEY,
    queryFn: () => request<BootstrapPayload>("/api/bootstrap"),
    enabled,
    refetchInterval: enabled ? 2000 : false,
    refetchOnWindowFocus: true,
  });
}

export function useLibraryActions() {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: BOOTSTRAP_QUERY_KEY });
    await queryClient.refetchQueries({ queryKey: BOOTSTRAP_QUERY_KEY, type: "active" });
  };
  const updateBootstrap = (updater: (current: BootstrapPayload) => BootstrapPayload) => {
    queryClient.setQueryData<BootstrapPayload>(BOOTSTRAP_QUERY_KEY, (current) => (current ? updater(current) : current));
  };

  const createBook = useMutation({
    mutationFn: (payload: CreateBookInput) =>
      request<Book>("/api/books", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: refresh,
  });

  const deleteBook = useMutation({
    mutationFn: (bookId: string) =>
      request<void>(`/api/books/${bookId}`, {
        method: "DELETE",
      }),
    onSuccess: refresh,
  });

  const issueBook = useMutation({
    mutationFn: (payload: { userId: string; branchId: string; bookId?: string; scanCode?: string; dueDate: string }) =>
      request<Transaction>("/api/transactions/issue", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: refresh,
  });

  const returnBook = useMutation({
    mutationFn: (payload: { transactionId?: string; scanCode?: string }) =>
      request<Transaction>("/api/transactions/return", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onMutate: async (payload) => {
      const previous = queryClient.getQueryData<BootstrapPayload>(BOOTSTRAP_QUERY_KEY);
      if (payload.transactionId) {
        updateBootstrap((current) => {
          const transactions = current.transactions.map((transaction) =>
            transaction._id === payload.transactionId
              ? { ...transaction, status: "RETURNED" as TransactionStatus, returnedAt: new Date().toISOString() }
              : transaction,
          );
          const returnedTransaction = current.transactions.find((transaction) => transaction._id === payload.transactionId);
          const books = returnedTransaction
            ? current.books.map((book) =>
                book._id === returnedTransaction.bookId
                  ? { ...book, availableCopies: Math.min(book.totalCopies, book.availableCopies + 1) }
                  : book,
              )
            : current.books;

          return { ...current, transactions, books };
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BOOTSTRAP_QUERY_KEY, context.previous);
      }
    },
    onSuccess: refresh,
  });

  const reserveBook = useMutation({
    mutationFn: (bookId: string) =>
      request<Reservation>(`/api/reservations/${bookId}`, {
        method: "POST",
      }),
    onSuccess: refresh,
  });

  const approveReservation = useMutation({
    mutationFn: (reservationId: string) =>
      request<Reservation>(`/api/reservations/${reservationId}/approve`, {
        method: "POST",
      }),
    onMutate: async (reservationId) => {
      const previous = queryClient.getQueryData<BootstrapPayload>(BOOTSTRAP_QUERY_KEY);
      updateBootstrap((current) => ({
        ...current,
        reservations: current.reservations.map((reservation) =>
          reservation._id === reservationId
            ? { ...reservation, status: "READY", notifiedAt: new Date().toISOString() }
            : reservation,
        ),
      }));
      return { previous };
    },
    onError: (_error, _reservationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BOOTSTRAP_QUERY_KEY, context.previous);
      }
    },
    onSuccess: refresh,
  });

  const declineReservation = useMutation({
    mutationFn: (reservationId: string) =>
      request<Reservation>(`/api/reservations/${reservationId}/decline`, {
        method: "POST",
      }),
    onMutate: async (reservationId) => {
      const previous = queryClient.getQueryData<BootstrapPayload>(BOOTSTRAP_QUERY_KEY);
      updateBootstrap((current) => ({
        ...current,
        reservations: current.reservations.map((reservation) =>
          reservation._id === reservationId
            ? { ...reservation, status: "CANCELLED" }
            : reservation,
        ),
      }));
      return { previous };
    },
    onError: (_error, _reservationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BOOTSTRAP_QUERY_KEY, context.previous);
      }
    },
    onSuccess: refresh,
  });

  const addReview = useMutation({
    mutationFn: (payload: CreateReviewInput) =>
      request<Review>("/api/reviews", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: refresh,
  });

  const deleteReview = useMutation({
    mutationFn: (reviewId: string) =>
      request<void>(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      }),
    onSuccess: refresh,
  });

  const updateRole = useMutation({
    mutationFn: (payload: { userId: string; role: "admin" | "librarian" | "student"; branchId?: string }) =>
      request<User>(`/api/users/${payload.userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: payload.role, branchId: payload.branchId }),
      }),
    onSuccess: refresh,
  });

  const askAssistant = useMutation({
    mutationFn: (message: string) =>
      request<{ reply: string; suggestedBooks: Book[] }>(`/api/chatbot?message=${encodeURIComponent(message)}`),
  });

  const deleteNotification = useMutation({
    mutationFn: (notificationId: string) =>
      request<void>(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      }),
    onSuccess: refresh,
  });

  const deleteAllNotifications = useMutation({
    mutationFn: () =>
      request<void>("/api/notifications", {
        method: "DELETE",
      }),
    onSuccess: refresh,
  });

  return {
    createBook,
    deleteBook,
    issueBook,
    returnBook,
    reserveBook,
    approveReservation,
    declineReservation,
    addReview,
    deleteReview,
    updateRole,
    askAssistant,
    deleteNotification,
    deleteAllNotifications,
  };
}

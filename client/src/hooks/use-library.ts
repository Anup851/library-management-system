import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type {
  AuthUser,
  Book,
  CreateBookInput,
  CreateReviewInput,
  CreateReturnRequestInput,
  DashboardData,
  Notification,
  Reservation,
  ReturnRequest,
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
  returnRequests: ReturnRequest[];
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
    refetchInterval: enabled ? 1000 : false,
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
  const withRealtimeDashboard = (current: BootstrapPayload): BootstrapPayload => {
    const activeTransactions = current.transactions.filter((transaction) => transaction.status !== "RETURNED");
    const overdueItems = activeTransactions.filter((transaction) => transaction.status === "OVERDUE");
    const borrowCounts = new Map<string, number>();
    const activeUsers = new Map<string, number>();

    for (const transaction of current.transactions) {
      borrowCounts.set(transaction.bookId, (borrowCounts.get(transaction.bookId) || 0) + 1);
      activeUsers.set(transaction.userId, (activeUsers.get(transaction.userId) || 0) + 1);
    }

    const topReaderReward = [...activeUsers.entries()]
      .map(([userId, borrowCount]) => {
        const user = current.users.find((candidate) => candidate._id === userId && candidate.role === "student");
        if (!user) return null;
        return {
          userId,
          name: user.name,
          registrationNumber: user.registrationNumber,
          borrowCount,
          rewardTitle: "Top Reader Award",
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.borrowCount - a!.borrowCount)[0] || current.dashboard.topReaderReward;

    return {
      ...current,
      dashboard: {
        ...current.dashboard,
        totals: {
          ...current.dashboard.totals,
          books: current.books.length,
          users: current.users.length,
          activeLoans: activeTransactions.length,
          overdueBooks: overdueItems.length,
          reservations: current.reservations.filter((reservation) => reservation.status === "WAITING" || reservation.status === "READY").length,
          digitalTitles: current.books.filter((book) => book.format !== "physical").length,
          fineRevenue: current.transactions.reduce((sum, transaction) => sum + transaction.fineAmount, 0),
        },
        mostBorrowedBooks: [...borrowCounts.entries()]
          .map(([bookId, borrowCount]) => ({
            bookId,
            title: current.books.find((book) => book._id === bookId)?.title || "Unknown title",
            borrowCount,
          }))
          .sort((a, b) => b.borrowCount - a.borrowCount)
          .slice(0, 5),
        activeUsers: [...activeUsers.entries()]
          .map(([userId, borrowCount]) => ({
            userId,
            name: current.users.find((user) => user._id === userId)?.name || "Unknown user",
            borrowCount,
          }))
          .sort((a, b) => b.borrowCount - a.borrowCount)
          .slice(0, 5),
        topReaderReward,
        overdueItems,
      },
    };
  };
  const showMutationError = (error: unknown, fallback: string) => {
    toast({
      variant: "destructive",
      title: "Action failed",
      description: error instanceof Error ? error.message : fallback,
    });
  };
  const showMutationSuccess = (title: string, description: string) => {
    toast({ title, description });
  };

  const createBook = useMutation({
    mutationFn: (payload: CreateBookInput) =>
      request<Book>("/api/books", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      showMutationSuccess("Book added", "The catalog was updated.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to create book."),
  });

  const updateBook = useMutation({
    mutationFn: (payload: { bookId: string; updates: Partial<Book> }) =>
      request<Book>(`/api/books/${payload.bookId}`, {
        method: "PUT",
        body: JSON.stringify(payload.updates),
      }),
    onSuccess: async () => {
      showMutationSuccess("Book updated", "Availability changed successfully.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to update book."),
  });

  const deleteBook = useMutation({
    mutationFn: (bookId: string) =>
      request<void>(`/api/books/${bookId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      showMutationSuccess("Book deleted", "The book was removed successfully.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to delete book."),
  });

  const issueBook = useMutation({
    mutationFn: (payload: { userId: string; branchId: string; bookId?: string; scanCode?: string; dueDate: string }) =>
      request<Transaction>("/api/transactions/issue", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      showMutationSuccess("Book issued", "The loan was created and synced.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to issue book."),
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

          return withRealtimeDashboard({ ...current, transactions, books });
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BOOTSTRAP_QUERY_KEY, context.previous);
      }
      showMutationError(_error, "Unable to return book.");
    },
    onSuccess: async () => {
      showMutationSuccess("Book returned", "Inventory and loan status updated.");
      await refresh();
    },
  });

  const reserveBook = useMutation({
    mutationFn: (bookId: string) =>
      request<Reservation>(`/api/reservations/${bookId}`, {
        method: "POST",
      }),
    onSuccess: async () => {
      showMutationSuccess("Book reserved", "Your reservation request was submitted.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to reserve book."),
  });

  const requestReturn = useMutation({
    mutationFn: (payload: CreateReturnRequestInput) =>
      request<ReturnRequest>("/api/return-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      showMutationSuccess("Return request sent", "The library team can now review your return request.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to create return request."),
  });

  const approveReturnRequest = useMutation({
    mutationFn: (requestId: string) =>
      request<ReturnRequest>(`/api/return-requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      showMutationSuccess("Return approved", "The book was marked as returned.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to approve return request."),
  });

  const declineReturnRequest = useMutation({
    mutationFn: (requestId: string) =>
      request<ReturnRequest>(`/api/return-requests/${requestId}/decline`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      showMutationSuccess("Return declined", "The request was rejected.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to decline return request."),
  });

  const approveReservation = useMutation({
    mutationFn: (reservationId: string) =>
      request<Reservation>(`/api/reservations/${reservationId}/approve`, {
        method: "POST",
      }),
    onMutate: async (reservationId) => {
      const previous = queryClient.getQueryData<BootstrapPayload>(BOOTSTRAP_QUERY_KEY);
      updateBootstrap((current) => withRealtimeDashboard({
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
      showMutationError(_error, "Unable to approve reservation.");
    },
    onSuccess: async () => {
      showMutationSuccess("Reservation approved", "The member can now collect the book.");
      await refresh();
    },
  });

  const declineReservation = useMutation({
    mutationFn: (reservationId: string) =>
      request<Reservation>(`/api/reservations/${reservationId}/decline`, {
        method: "POST",
      }),
    onMutate: async (reservationId) => {
      const previous = queryClient.getQueryData<BootstrapPayload>(BOOTSTRAP_QUERY_KEY);
      updateBootstrap((current) => withRealtimeDashboard({
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
      showMutationError(_error, "Unable to decline reservation.");
    },
    onSuccess: async () => {
      showMutationSuccess("Reservation declined", "The request was updated.");
      await refresh();
    },
  });

  const addReview = useMutation({
    mutationFn: (payload: CreateReviewInput) =>
      request<Review>("/api/reviews", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      showMutationSuccess("Review added", "Your review is now visible.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to add review."),
  });

  const deleteReview = useMutation({
    mutationFn: (reviewId: string) =>
      request<void>(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      showMutationSuccess("Review deleted", "The review was removed.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to delete review."),
  });

  const updateRole = useMutation({
    mutationFn: (payload: { userId: string; role: "admin" | "librarian" | "student"; branchId?: string }) =>
      request<User>(`/api/users/${payload.userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: payload.role, branchId: payload.branchId }),
      }),
    onSuccess: async () => {
      showMutationSuccess("Role updated", "The member role was changed.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to update role."),
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
    onSuccess: async () => {
      showMutationSuccess("Notification deleted", "The notification was removed.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to delete notification."),
  });

  const deleteAllNotifications = useMutation({
    mutationFn: () =>
      request<void>("/api/notifications", {
        method: "DELETE",
      }),
    onSuccess: async () => {
      showMutationSuccess("Notifications cleared", "The notification list was refreshed.");
      await refresh();
    },
    onError: (error) => showMutationError(error, "Unable to delete notifications."),
  });

  return {
    createBook,
    updateBook,
    deleteBook,
    issueBook,
    returnBook,
    reserveBook,
    requestReturn,
    approveReturnRequest,
    declineReturnRequest,
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

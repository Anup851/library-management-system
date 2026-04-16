import { useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { MobileSidebar, Sidebar } from "@/components/Sidebar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useBootstrap, useLibraryActions } from "@/hooks/use-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function LoginScreen() {
  const { loginMutation, registerMutation } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"Admin" | "Librarian" | "Student">("Student");
  const presets: Array<{
    role: "Admin" | "Librarian" | "Student";
    note: string;
  }> = [
    {
      role: "Admin",
      note: "Can add books and assign roles.",
    },
    {
      role: "Librarian",
      note: "Can issue and return books.",
    },
    {
      role: "Student",
      note: "Can reserve books and add reviews.",
    },
  ];

  const applyPreset = (preset: (typeof presets)[number]) => {
    setMode("login");
    setSelectedRole(preset.role);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="inline-block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            LibraryHub
          </p>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight">
            Full-stack Library Management System
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Role-based access, catalog management, circulation, fines, reservations, digital books, recommendations, analytics, and an assistant-driven search experience.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {["RBAC", "Circulation", "Smart Discovery"].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="font-semibold">{item}</p>
                <p className="mt-2 text-sm text-slate-300">Built for real library workflows, not a demo-only dashboard.</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {presets.map((preset) => (
              <button
                key={preset.role}
                type="button"
                className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-left transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                onClick={() => applyPreset(preset)}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">{preset.role}</p>
                <p className="mt-3 text-sm text-slate-300">{preset.note}</p>
                <p className="mt-4 text-sm text-cyan-300">Continue as {preset.role.toLowerCase()}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/30 p-1">
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${mode === "login" ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${mode === "signup" ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`}
              onClick={() => setMode("signup")}
            >
              Student signup
            </button>
          </div>
          {mode === "login" ? (
            <>
              <h2 className="mt-6 text-3xl font-semibold">Sign in</h2>
              <p className="mt-2 text-sm text-slate-300">
                Selected role: <span className="font-medium text-cyan-300">{selectedRole}</span>. Sign in with your real account credentials.
              </p>
              <div className="mt-6 space-y-4">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border-white/10 bg-slate-950/60 text-white" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="border-white/10 bg-slate-950/60 text-white" />
                <Button
                  className="w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  disabled={loginMutation.isPending || !email || !password}
                  onClick={() => loginMutation.mutate({ email, password })}
                >
                  {loginMutation.isPending ? "Signing in..." : "Open workspace"}
                </Button>
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
                <p className="font-medium text-white">Staff accounts</p>
                <p className="mt-2">Admin can assign roles in the Members page and add books from Catalog.</p>
                <p>Librarian can manage circulation and member support.</p>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-6 text-3xl font-semibold">Create student account</h2>
              <p className="mt-2 text-sm text-slate-300">Self-signup is only for students. Admin and librarian accounts stay controlled by staff.</p>
              <div className="mt-6 space-y-4">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="border-white/10 bg-slate-950/60 text-white" />
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border-white/10 bg-slate-950/60 text-white" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="border-white/10 bg-slate-950/60 text-white" />
                <Button
                  className="w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  disabled={registerMutation.isPending || !name || !email || !password}
                  onClick={() => registerMutation.mutate({ name, email, password, role: "student" })}
                >
                  {registerMutation.isPending ? "Creating account..." : "Create student account"}
                </Button>
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
                <p className="font-medium text-white">Who creates staff users?</p>
                <p className="mt-2">Admin and librarian users should be created by an existing admin in Supabase, then their roles can be managed from the app.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Dashboard({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Books", data.dashboard.totals.books],
          ["Active Loans", data.dashboard.totals.activeLoans],
          ["Overdue", data.dashboard.totals.overdueBooks],
          ["Fine Revenue", `$${data.dashboard.totals.fineRevenue}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Most Borrowed" text="Trending books across branches.">
          <div className="space-y-3">
            {data.dashboard.mostBorrowedBooks.map((item: any) => (
              <div key={item.bookId} className="flex items-center justify-between rounded-2xl bg-slate-100/80 px-4 py-3 dark:bg-white/5">
                <span>{item.title}</span>
                <span>{item.borrowCount} borrows</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Overdue Snapshot" text="Books requiring follow-up.">
          <div className="space-y-3">
            {data.dashboard.overdueItems.map((item: any) => {
              const book = data.books.find((candidate: any) => candidate._id === item.bookId);
              return (
                <div key={item._id} className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
                  <p className="font-medium">{book?.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Due {new Date(item.dueDate).toLocaleDateString()} • Fine ${item.fineAmount}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Catalog({ data, canWrite, actions }: { data: any; canWrite: boolean; actions: any }) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    author: "",
    category: "",
    isbn: "",
    barcode: "",
    description: "",
    coverImage: "",
    ebookUrl: "",
    publishedYear: new Date().getFullYear(),
    language: "English",
    format: "hybrid",
    tags: "",
    branchIds: data.branches.map((branch: any) => branch._id),
    totalCopies: 1,
    availableCopies: 1,
  });
  const filtered = data.books.filter((book: any) => `${book.title} ${book.author} ${book.category} ${book.isbn}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <Card title="Catalog" text="Search books, manage inventory, and access digital resources.">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, author, ISBN" />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {filtered.map((book: any) => (
            <div key={book._id} className="rounded-[1.5rem] border border-slate-200/80 p-5 dark:border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">{book.category}</p>
                  <h3 className="mt-2 text-xl font-semibold">{book.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{book.author}</p>
                </div>
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm">{book.availableCopies}/{book.totalCopies}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{book.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="outline" disabled={actions.reserveBook.isPending} onClick={() => actions.reserveBook.mutate(book._id)}>
                  {actions.reserveBook.isPending ? "Reserving..." : "Reserve"}
                </Button>
                {book.ebookUrl ? <a href={book.ebookUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 text-sm">Read eBook</a> : null}
                {canWrite ? (
                  <Button variant="destructive" disabled={actions.deleteBook.isPending} onClick={() => actions.deleteBook.mutate(book._id)}>
                    {actions.deleteBook.isPending ? "Deleting..." : "Delete"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {canWrite ? (
        <Card title="Add Book" text="Capture both physical and digital catalog details.">
          <div className="grid gap-4 md:grid-cols-2">
            {["title", "author", "category", "isbn", "barcode", "coverImage", "ebookUrl", "language"].map((key) => (
              <Input key={key} placeholder={key} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            ))}
            <Input type="number" value={form.publishedYear} onChange={(e) => setForm({ ...form, publishedYear: Number(e.target.value) })} />
            <Input type="number" value={form.totalCopies} onChange={(e) => setForm({ ...form, totalCopies: Number(e.target.value) })} />
            <Input type="number" value={form.availableCopies} onChange={(e) => setForm({ ...form, availableCopies: Number(e.target.value) })} />
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as any })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              <option value="physical">physical</option>
              <option value="digital">digital</option>
              <option value="hybrid">hybrid</option>
            </select>
            <Textarea className="md:col-span-2" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <Button
            className="mt-5"
            disabled={actions.createBook.isPending}
            onClick={() => actions.createBook.mutate({ ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) })}
          >
            {actions.createBook.isPending ? "Adding..." : "Add to catalog"}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function Circulation({ data, actions }: { data: any; actions: any }) {
  const [issue, setIssue] = useState({
    userId: data.users.find((user: any) => user.role === "student")?._id || "",
    branchId: data.branches[0]?._id || "",
    bookId: data.books[0]?._id || "",
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [scanCode, setScanCode] = useState("");

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Issue Book" text="Use role-aware circulation with due dates and member selection.">
          <div className="grid gap-4">
            <select value={issue.userId} onChange={(e) => setIssue({ ...issue, userId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              {data.users.filter((user: any) => user.role === "student").map((user: any) => <option key={user._id} value={user._id}>{user.name}</option>)}
            </select>
            <select value={issue.branchId} onChange={(e) => setIssue({ ...issue, branchId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              {data.branches.map((branch: any) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>
            <select value={issue.bookId} onChange={(e) => setIssue({ ...issue, bookId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              {data.books.map((book: any) => <option key={book._id} value={book._id}>{book.title}</option>)}
            </select>
            <Input type="date" value={issue.dueDate} onChange={(e) => setIssue({ ...issue, dueDate: e.target.value })} />
            <Button disabled={actions.issueBook.isPending} onClick={() => actions.issueBook.mutate({ ...issue, dueDate: new Date(issue.dueDate).toISOString() })}>
              {actions.issueBook.isPending ? "Issuing..." : "Issue now"}
            </Button>
          </div>
        </Card>
        <Card title="Return Book" text="Paste or scan barcode / ISBN to process returns and fines.">
          <div className="grid gap-4">
            <Input value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder="Barcode or ISBN" />
            <Button disabled={actions.returnBook.isPending || !scanCode} onClick={() => actions.returnBook.mutate({ scanCode })}>
              {actions.returnBook.isPending ? "Processing..." : "Process return"}
            </Button>
          </div>
        </Card>
      </div>
      <Card title="Transaction Ledger" text="Track issues, returns, overdue items, and fines.">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="pb-3">Book</th>
                <th className="pb-3">Member</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Due</th>
                <th className="pb-3">Fine</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((transaction: any) => {
                const book = data.books.find((candidate: any) => candidate._id === transaction.bookId);
                const user = data.users.find((candidate: any) => candidate._id === transaction.userId);
                return (
                  <tr key={transaction._id} className="border-t border-slate-200/70 dark:border-white/10">
                    <td className="py-3">{book?.title}</td>
                    <td className="py-3">{user?.name}</td>
                    <td className="py-3">{transaction.status}</td>
                    <td className="py-3">{new Date(transaction.dueDate).toLocaleDateString()}</td>
                    <td className="py-3">${transaction.fineAmount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Recommendations({ data, actions }: { data: any; actions: any }) {
  const [bookId, setBookId] = useState(data.recommendations[0]?._id || data.books[0]?._id || "");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("Helpful, well-structured, and worth recommending.");

  return (
    <div className="space-y-6">
      <Card title="Recommendations" text="Borrowing history, category affinity, and ratings guide these suggestions.">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {data.recommendations.map((book: any) => (
            <div key={book._id} className="rounded-[1.5rem] border border-slate-200/80 p-5 dark:border-white/10">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">{book.category}</p>
              <h3 className="mt-3 text-lg font-semibold">{book.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{book.author}</p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{book.description}</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Review & Rating" text="Feedback powers discovery and catalog quality signals.">
          <div className="grid gap-4">
            <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950">
              {data.books.map((book: any) => <option key={book._id} value={book._id}>{book.title}</option>)}
            </select>
            <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
            <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button disabled={actions.addReview.isPending} onClick={() => actions.addReview.mutate({ bookId, rating, comment })}>
              {actions.addReview.isPending ? "Publishing..." : "Publish review"}
            </Button>
          </div>
        </Card>
        <Card title="Recent Reviews" text="Community feedback across physical and digital titles.">
          <div className="space-y-3">
            {data.reviews.map((review: any) => {
              const book = data.books.find((candidate: any) => candidate._id === review.bookId);
              return (
                <div key={review._id} className="rounded-2xl bg-slate-100/80 p-4 dark:bg-white/5">
                  <p className="font-medium">{book?.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{review.rating}/5</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Assistant({ data, actions }: { data: any; actions: any }) {
  const [message, setMessage] = useState("Recommend software engineering books");
  const reply = actions.askAssistant.data;

  return (
    <div className="space-y-6">
      <Card title="AI Assistant" text="Ask about books, availability, overdue items, or recommendations.">
        <div className="grid gap-4">
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button className="w-fit" disabled={actions.askAssistant.isPending} onClick={() => actions.askAssistant.mutate(message)}>
            {actions.askAssistant.isPending ? "Thinking..." : "Ask assistant"}
          </Button>
        </div>
      </Card>
      <Card title="Assistant Reply" text="Context-aware answers with suggested titles.">
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{reply?.reply || "Ask a question to start the assistant."}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {(reply?.suggestedBooks || data.recommendations).map((book: any) => (
            <div key={book._id} className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
              <p className="font-medium">{book.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{book.author}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Members({ data, actions }: { data: any; actions: any }) {
  return (
    <Card title="Members & Roles" text="Manage admins, librarians, students, and branch access.">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-500 dark:text-slate-400">
            <tr>
              <th className="pb-3">Name</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Branch</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((user: any) => (
              <tr key={user._id} className="border-t border-slate-200/70 dark:border-white/10">
                <td className="py-3">{user.name}</td>
                <td className="py-3">{user.email}</td>
                <td className="py-3 capitalize">{user.role}</td>
                <td className="py-3">{data.branches.find((branch: any) => branch._id === user.branchId)?.name || "Unassigned"}</td>
                <td className="py-3">
                  <div className="flex gap-2">
                    {["student", "librarian", "admin"].map((role) => (
                      <Button
                        key={role}
                        size="sm"
                        variant="outline"
                        disabled={actions.updateRole.isPending}
                        onClick={() => actions.updateRole.mutate({ userId: user._id, role: role as "admin" | "librarian" | "student", branchId: user.branchId })}
                      >
                        {actions.updateRole.isPending ? "Updating..." : role}
                      </Button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Admin({ data, actions }: { data: any; actions: any }) {
  return (
    <div className="space-y-6">
      <Card title="Notifications" text="Email, SMS, and in-app updates generated by due dates and reservations.">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.notifications.length} notification{data.notifications.length === 1 ? "" : "s"}
          </p>
          <Button
            variant="destructive"
            size="sm"
            disabled={actions.deleteAllNotifications.isPending || data.notifications.length === 0}
            onClick={() => actions.deleteAllNotifications.mutate()}
          >
            {actions.deleteAllNotifications.isPending ? "Deleting..." : "Delete all"}
          </Button>
        </div>
        <div className="space-y-3">
          {data.notifications.map((notification: any) => (
            <div key={notification._id} className="rounded-2xl bg-slate-100/80 p-4 dark:bg-white/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{notification.channel}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actions.deleteNotification.isPending}
                  onClick={() => actions.deleteNotification.mutate(notification._id)}
                >
                  {actions.deleteNotification.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
            </div>
          ))}
          {data.notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300/80 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No notifications found.
            </div>
          ) : null}
        </div>
      </Card>
      <Card title="Audit Trail" text="Track catalog actions, circulation, and role changes.">
        <div className="space-y-3">
          {data.auditLogs.map((log: any) => (
            <div key={log._id} className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
              <p className="font-medium">{log.action}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{log.entity} • {new Date(log.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Workspace() {
  const { user, isLoading, canWrite, isAdmin, isLibrarian, isStudent } = useAuth();
  const bootstrap = useBootstrap(!!user);
  const actions = useLibraryActions();
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("theme") === "dark" ? "dark" : "light"));
  const [location, setLocation] = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (location === "/auth/login") setLocation("/");
  }, [location, setLocation]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading...</div>;
  if (!user) return <LoginScreen />;
  if (bootstrap.isLoading || !bootstrap.data) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading library data...</div>;

  const data = bootstrap.data;
  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/catalog", label: "Catalog" },
    ...(isAdmin || isLibrarian ? [{ href: "/circulation", label: "Circulation" }] : []),
    { href: "/recommendations", label: "Recommendations" },
    { href: "/assistant", label: "Assistant" },
    ...(isAdmin || isLibrarian ? [{ href: "/members", label: "Members" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8fafc,#eef2ff,#ecfeff)] text-slate-950 dark:bg-[linear-gradient(135deg,#020617,#0f172a,#111827)] dark:text-white">
      <div className="flex min-h-screen">
        <Sidebar theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <MobileSidebar theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-600 dark:text-cyan-300">LibraryHub</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight">Library Management System</h1>
                <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
                  A modern full-stack workspace for books, users, fines, reservations, reviews, analytics, and digital reading.
                </p>
              </div>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 md:hidden dark:border-white/10 dark:bg-slate-950">
                {nav.map((item) => <option key={item.href} value={item.href}>{item.label}</option>)}
              </select>
            </div>

            <Switch>
              <Route path="/"><Dashboard data={data} /></Route>
              <Route path="/catalog"><Catalog data={data} canWrite={canWrite} actions={actions} /></Route>
              {isAdmin || isLibrarian ? <Route path="/circulation"><Circulation data={data} actions={actions} /></Route> : null}
              <Route path="/recommendations"><Recommendations data={data} actions={actions} /></Route>
              <Route path="/assistant"><Assistant data={data} actions={actions} /></Route>
              {isAdmin || isLibrarian ? <Route path="/members"><Members data={data} actions={actions} /></Route> : null}
              {isAdmin ? <Route path="/admin"><Admin data={data} actions={actions} /></Route> : null}
              <Route>
                <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-8 dark:border-white/10 dark:bg-white/5">
                  <p className="text-lg font-semibold">{isStudent ? "This section is only available to admin and librarian users." : "Page not found."}</p>
                  <div className="mt-4 flex gap-4">
                    <Link href="/">Dashboard</Link>
                    <Link href="/catalog">Catalog</Link>
                  </div>
                </div>
              </Route>
            </Switch>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Workspace />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

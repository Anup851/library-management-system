import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats, useFees } from "@/hooks/use-sms";
import { Users, CheckCircle2, DollarSign, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { motion } from "framer-motion";

function StatCard({ title, value, icon: Icon, color, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="border-none shadow-lg shadow-black/5 hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <h3 className="text-2xl font-bold mt-2 font-display">{value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shadow-inner`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: fees } = useFees();
  const formatSafeDate = (value: unknown, fallback = "N/A") => {
    if (!value) return fallback;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return fallback;
    return format(d, "MMM dd, yyyy");
  };
  const formatSafeShortDate = (value: unknown) => {
    if (!value) return format(new Date(), "MMM dd");
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return format(new Date(), "MMM dd");
    return format(d, "MMM dd");
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  const chartData = fees?.slice(0, 5).map((fee: any) => ({
    name: formatSafeShortDate(fee.paymentDate),
    amount: Number(fee.amount)
  })) || [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground font-display">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">Welcome back to EduMaster Admin Portal.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Students"
            value={stats?.totalStudents || 0}
            icon={Users}
            color="bg-blue-500"
            delay={0.1}
          />
          <StatCard
            title="Present Today"
            value={stats?.presentToday || 0}
            icon={CheckCircle2}
            color="bg-emerald-500"
            delay={0.2}
          />
          <StatCard
            title="Fees Collected"
            value={`$${stats?.feesCollected || 0}`}
            icon={DollarSign}
            color="bg-violet-500"
            delay={0.3}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="h-[400px] border-none shadow-lg shadow-black/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Fee Collection Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="h-[400px] border-none shadow-lg shadow-black/5 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  Recent Fee Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {fees?.slice(0, 5).map((fee: any) => (
                    <div key={fee.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                          $
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{fee.method}</p>
                          <p className="text-xs text-muted-foreground">{formatSafeDate(fee.paymentDate)}</p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600">+${fee.amount}</span>
                    </div>
                  ))}
                  {(!fees || fees.length === 0) && (
                    <div className="p-8 text-center text-muted-foreground">No recent payments</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

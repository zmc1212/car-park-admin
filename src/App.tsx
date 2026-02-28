import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Car, 
  ParkingCircle, 
  History, 
  Settings, 
  Search, 
  Plus, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  CreditCard,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Stats {
  totalSpaces: number;
  occupiedSpaces: number;
  reservedSpaces: number;
  availableSpaces: number;
  totalRevenue: number;
  whitelistCount: number;
}

interface WhitelistEntry {
  id: number;
  plate_number: string;
  created_at: string;
  notes: string;
}

interface ExitData {
  amount: number;
  durationHalfDays: number;
  hasPackage: boolean;
  entryTime: string;
  exitTime: string;
  plateNumber: string;
}

interface Space {
  id: number;
  code: string;
  status: 'available' | 'occupied' | 'reserved';
  type: 'normal' | 'package';
}

interface Vehicle {
  id: number;
  plate_number: string;
  has_package: number;
  entry_time: string;
  space_code: string;
}

interface Log {
  id: number;
  plate_number: string;
  action: 'entry' | 'exit';
  timestamp: string;
  amount: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vehicles' | 'spaces' | 'logs' | 'whitelist'>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newPlate, setNewPlate] = useState('');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [exitData, setExitData] = useState<ExitData | null>(null);
  const [whitelistPlate, setWhitelistPlate] = useState('');
  const [whitelistNotes, setWhitelistNotes] = useState('');

  const fetchData = async () => {
    try {
      const [sRes, spRes, vRes, lRes, wRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/spaces'),
        fetch('/api/vehicles'),
        fetch('/api/logs'),
        fetch('/api/whitelist')
      ]);
      setStats(await sRes.json());
      setSpaces(await spRes.json());
      setVehicles(await vRes.json());
      setLogs(await lRes.json());
      setWhitelist(await wRes.json());
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate) return;
    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plateNumber: newPlate })
      });
      if (res.ok) {
        const data = await res.json();
        setNewPlate('');
        setShowEntryModal(false);
        fetchData();
        if (data.hasPackage) {
          alert(`套餐车辆 ${newPlate} 已识别，自动分配车位。`);
        }
      } else {
        const data = await res.json();
        alert(data.error || '入场失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const handleExit = async (plateNumber: string) => {
    try {
      const res = await fetch('/api/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plateNumber })
      });
      if (res.ok) {
        const data = await res.json();
        setExitData({ ...data, plateNumber });
        setShowPaymentModal(true);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || '离场失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const addToWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whitelistPlate) return;
    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plateNumber: whitelistPlate, notes: whitelistNotes })
      });
      if (res.ok) {
        setWhitelistPlate('');
        setWhitelistNotes('');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || '添加失败');
      }
    } catch (error) {
      alert('网络错误');
    }
  };

  const removeFromWhitelist = async (plate: string) => {
    try {
      await fetch(`/api/whitelist/${plate}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      alert('删除失败');
    }
  };

  const toggleSpaceReservation = async (spaceId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'reserved' ? 'available' : 'reserved';
    try {
      await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, status: newStatus })
      });
      fetchData();
    } catch (error) {
      alert('Update failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 text-indigo-600">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Car size={24} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">智慧车辆管理</h1>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="控制面板"
          />
          <NavItem 
            active={activeTab === 'vehicles'} 
            onClick={() => setActiveTab('vehicles')}
            icon={<Car size={20} />}
            label="在场车辆"
          />
          <NavItem 
            active={activeTab === 'spaces'} 
            onClick={() => setActiveTab('spaces')}
            icon={<ParkingCircle size={20} />}
            label="车位监控"
          />
          <NavItem 
            active={activeTab === 'whitelist'} 
            onClick={() => setActiveTab('whitelist')}
            icon={<ShieldCheck size={20} />}
            label="套餐白名单"
          />
          <NavItem 
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')}
            icon={<History size={20} />}
            label="通行日志"
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button className="flex items-center gap-3 w-full p-3 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">
            <LogOut size={20} />
            <span className="font-medium">退出系统</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-slate-800">
            {activeTab === 'dashboard' && '系统概览'}
            {activeTab === 'vehicles' && '实时在场车辆'}
            {activeTab === 'spaces' && '车位实时状态'}
            {activeTab === 'logs' && '历史通行记录'}
            {activeTab === 'whitelist' && '游客中心 - 套餐办理'}
          </h2>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="搜索车牌号..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-lg text-sm transition-all w-64"
              />
            </div>
            <button 
              onClick={() => setShowEntryModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              模拟车辆入场
            </button>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    label="总车位数" 
                    value={stats?.totalSpaces || 0} 
                    icon={<ParkingCircle className="text-blue-600" />}
                    color="blue"
                  />
                  <StatCard 
                    label="空余车位" 
                    value={stats?.availableSpaces || 0} 
                    icon={<CheckCircle2 className="text-indigo-600" />}
                    color="indigo"
                  />
                  <StatCard 
                    label="已办套餐车辆" 
                    value={stats?.whitelistCount || 0} 
                    icon={<ShieldCheck className="text-emerald-600" />}
                    color="emerald"
                  />
                  <StatCard 
                    label="累计营收" 
                    value={`¥${stats?.totalRevenue.toFixed(2) || '0.00'}`} 
                    icon={<CreditCard className="text-amber-600" />}
                    color="amber"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Recent Activity */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">最近通行记录</h3>
                      <button onClick={() => setActiveTab('logs')} className="text-indigo-600 text-sm font-medium hover:underline">查看全部</button>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {logs.slice(0, 6).map((log) => (
                        <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${log.action === 'entry' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              {log.action === 'entry' ? <Plus size={16} /> : <LogOut size={16} />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{log.plate_number}</p>
                              <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${log.action === 'entry' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {log.action === 'entry' ? '入场' : '离场'}
                            </span>
                            {log.amount > 0 && <p className="text-sm font-bold text-slate-800 mt-1">¥{log.amount}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Status */}
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-4">车位使用率</h3>
                      <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div 
                          className="absolute h-full bg-indigo-600 transition-all duration-1000"
                          style={{ width: `${((stats?.occupiedSpaces || 0) / (stats?.totalSpaces || 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 font-medium">
                        <span>已占用 {stats?.occupiedSpaces}</span>
                        <span>总计 {stats?.totalSpaces}</span>
                      </div>
                    </div>

                    <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200">
                      <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck size={24} />
                        <h3 className="font-bold">业务规则说明</h3>
                      </div>
                      <ul className="text-indigo-100 text-xs space-y-2 list-disc pl-4">
                        <li>套餐游客在系统库存保留车位，凭车牌号自动核销。</li>
                        <li>普通游客离场时需扫码支付，按每半天 ¥20 收费。</li>
                        <li>后台可实时查询并手动“临时保留”车位。</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'vehicles' && (
              <motion.div 
                key="vehicles"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">车牌号</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">类型</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">入场时间</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">分配车位</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vehicles.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded border border-slate-200">{v.plate_number}</span>
                        </td>
                        <td className="px-6 py-4">
                          {v.has_package ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full">
                              <ShieldCheck size={12} /> 套餐车辆
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">普通车辆</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {new Date(v.entry_time).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-indigo-600">{v.space_code}</span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleExit(v.plate_number)}
                            className="text-indigo-600 hover:text-indigo-700 font-bold text-sm"
                          >
                            模拟离场
                          </button>
                        </td>
                      </tr>
                    ))}
                    {vehicles.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          暂无在场车辆
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </motion.div>
            )}

            {activeTab === 'spaces' && (
              <div className="space-y-6">
                <div className="flex items-center gap-6 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-white border border-slate-200"></div> 空闲</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200"></div> 已占用</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200"></div> 临时保留</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-600"></div> 套餐专属</div>
                </div>
                <motion.div 
                  key="spaces"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-4"
                >
                  {spaces.map((space) => (
                    <div 
                      key={space.id}
                      onClick={() => space.status !== 'occupied' && toggleSpaceReservation(space.id, space.status)}
                      className={`
                        relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all
                        ${space.status === 'occupied' ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : ''}
                        ${space.status === 'available' ? 'bg-white border-slate-100 hover:border-indigo-400 shadow-sm' : ''}
                        ${space.status === 'reserved' ? 'bg-amber-50 border-amber-200' : ''}
                      `}
                    >
                      <span className="text-[10px] font-bold text-slate-400 absolute top-2 left-2">{space.code}</span>
                      {space.status === 'occupied' && <Car className="text-slate-400" size={24} />}
                      {space.status === 'available' && <ParkingCircle className="text-slate-200" size={24} />}
                      {space.status === 'reserved' && <Clock className="text-amber-500" size={24} />}
                      <span className={`text-[10px] font-bold mt-2 uppercase tracking-tighter ${
                        space.status === 'occupied' ? 'text-slate-400' : 
                        space.status === 'reserved' ? 'text-amber-600' : 'text-slate-300'
                      }`}>
                        {space.status === 'occupied' ? '已占用' : 
                         space.status === 'reserved' ? '临时保留' : '空闲'}
                      </span>
                      {space.type === 'package' && (
                        <div className="absolute -top-1 -right-1 bg-indigo-600 text-[8px] text-white px-1 rounded-sm font-bold">套餐</div>
                      )}
                    </div>
                  ))}
                </motion.div>
              </div>
            )}

            {activeTab === 'whitelist' && (
              <motion.div 
                key="whitelist"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
                  <h3 className="font-bold text-slate-800 mb-6">办理套餐登记</h3>
                  <form onSubmit={addToWhitelist} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">车牌号码</label>
                      <input 
                        type="text" 
                        value={whitelistPlate}
                        onChange={(e) => setWhitelistPlate(e.target.value.toUpperCase())}
                        placeholder="例如: 粤B88888"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">备注信息</label>
                      <textarea 
                        value={whitelistNotes}
                        onChange={(e) => setWhitelistNotes(e.target.value)}
                        placeholder="游客姓名、套餐类型等..."
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        rows={3}
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                    >
                      确认办理
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">已办理套餐列表</h3>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">车牌号</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">办理时间</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">备注</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {whitelist.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{item.plate_number}</td>
                          <td className="px-6 py-4 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.notes || '-'}</td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => removeFromWhitelist(item.plate_number)}
                              className="text-rose-600 hover:text-rose-700 text-sm font-medium"
                            >
                              注销
                            </button>
                          </td>
                        </tr>
                      ))}
                      {whitelist.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400">暂无套餐办理记录</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
            {activeTab === 'logs' && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">流水号</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">车牌号</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">动作</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">时间</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">费用</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-400">#{log.id.toString().padStart(6, '0')}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{log.plate_number}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${log.action === 'entry' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {log.action === 'entry' ? '入场' : '离场'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{log.amount > 0 ? `¥${log.amount}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Entry Modal */}
      <AnimatePresence>
        {showEntryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEntryModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-800">车辆入场登记</h3>
                  <button onClick={() => setShowEntryModal(false)} className="text-slate-400 hover:text-slate-600">
                    <Plus className="rotate-45" size={24} />
                  </button>
                </div>

                <form onSubmit={handleEntry} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">车牌号码</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={newPlate}
                      onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                      placeholder="例如: 粤B88888"
                      className="w-full px-4 py-3 bg-slate-100 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl text-lg font-bold tracking-widest transition-all outline-none"
                    />
                  </div>

                  <div className="bg-indigo-50 p-4 rounded-xl flex gap-3 border border-indigo-100">
                    <ShieldCheck className="text-indigo-600 shrink-0" size={20} />
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      系统将自动检测该车牌是否在“套餐白名单”中。如果是，将自动分配套餐车位并免除停车费。
                    </p>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    确认入场
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && exitData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8">
                <div className="text-center mb-8">
                  <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${exitData.hasPackage ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {exitData.hasPackage ? <ShieldCheck size={32} /> : <CreditCard size={32} />}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">离场结算确认</h3>
                  <p className="text-slate-500 font-bold mt-1">{exitData.plateNumber}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                    <span className="text-slate-500">入场时间</span>
                    <span className="font-medium">{new Date(exitData.entryTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                    <span className="text-slate-500">离场时间</span>
                    <span className="font-medium">{new Date(exitData.exitTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                    <span className="text-slate-500">停车时长</span>
                    <span className="font-medium">{exitData.durationHalfDays} 个半天</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                    <span className="text-slate-500">车辆类型</span>
                    <span className={`font-bold ${exitData.hasPackage ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {exitData.hasPackage ? '套餐用户 (已核销)' : '普通用户'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-lg font-bold text-slate-800">应付金额</span>
                    <span className="text-3xl font-black text-indigo-600">¥{exitData.amount.toFixed(2)}</span>
                  </div>
                </div>

                {!exitData.hasPackage && exitData.amount > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 border-2 border-slate-100 rounded-2xl flex flex-col items-center gap-2 hover:border-indigo-500 cursor-pointer transition-all">
                      <div className="w-24 h-24 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=wechat_pay" alt="WeChat Pay" className="w-20 h-20 opacity-50" referrerPolicy="no-referrer" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">微信支付</span>
                    </div>
                    <div className="p-4 border-2 border-slate-100 rounded-2xl flex flex-col items-center gap-2 hover:border-indigo-500 cursor-pointer transition-all">
                      <div className="w-24 h-24 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=alipay" alt="Alipay" className="w-20 h-20 opacity-50" referrerPolicy="no-referrer" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">支付宝支付</span>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all"
                >
                  {exitData.hasPackage ? '确认并关闭' : '完成支付并离场'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`
        flex items-center gap-3 w-full p-3 rounded-xl transition-all font-medium text-sm
        ${active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}
      `}
    >
      {icon}
      <span>{label}</span>
      {active && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
    </button>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-${color}-50`}>
          {icon}
        </div>
      </div>
      <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
      <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
    </div>
  );
}

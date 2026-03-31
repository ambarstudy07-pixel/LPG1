import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, TrendingUp, Package, Filter, Info, Search, RefreshCw, AlertCircle
} from 'lucide-react';

// Configuration for the Google Sheet
const SHEET_ID = '1-ls5UsldwA91zlDLqWQ3bU36O1eJ4OV4ym7audsB7uU';
const GID = '488899721';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgency, setSelectedAgency] = useState('All Agencies');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch and Parse CSV from Google Sheets
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(CSV_URL);
      if (!response.ok) throw new Error('Failed to fetch spreadsheet data');
      const csvText = await response.text();
      
      // Simple CSV Parser (handles basic comma separation)
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const parsedData = lines.slice(1).map((line, index) => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
        
        // Find indices based on the user-provided column names
        const getVal = (name) => {
          const idx = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
          return idx !== -1 ? values[idx] : null;
        };

        return {
          id: index,
          timestamp: getVal('Timestamp'),
          dateOfEntry: getVal('Date of Entry'),
          omcName: getVal('OMC Name'),
          agencyName: getVal('Agency Name'),
          rec14_2: Number(getVal('Domestic - 14.2 KG')) || 0,
          rec19: Number(getVal('Commercial - 19 KG')) || 0,
          rec47_5: Number(getVal('Industrial - 47.5 KG')) || 0,
          dist14_2: Number(getVal('Domestic- 14.2 KG')) || 0,
          dist19: Number(getVal('Commercial- 19 KG')) || 0,
          dist47_5: Number(getVal('Industrial- 47.5 KG')) || 0,
          // Since "Starting Stock" wasn't in the explicit list but mentioned in the prompt
          startStock: Number(getVal('Starting Stock')) || 0 
        };
      }).filter(row => row.agencyName); // Filter out empty rows

      setData(parsedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Process list of agencies for filter
  const agenciesList = useMemo(() => {
    return ['All Agencies', ...new Set(data.map(item => item.agencyName))];
  }, [data]);

  // Filter logic
  const filteredData = useMemo(() => {
    let result = data;
    if (selectedAgency !== 'All Agencies') {
      result = result.filter(item => item.agencyName === selectedAgency);
    }
    if (searchTerm) {
      result = result.filter(item => 
        item.agencyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.omcName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return result;
  }, [data, selectedAgency, searchTerm]);

  // Aggregate Calculations
  const stats = useMemo(() => {
    const total = filteredData.reduce((acc, curr) => {
      acc.rec14_2 += curr.rec14_2;
      acc.rec19 += curr.rec19;
      acc.rec47_5 += curr.rec47_5;
      acc.dist14_2 += curr.dist14_2;
      acc.dist19 += curr.dist19;
      acc.dist47_5 += curr.dist47_5;
      return acc;
    }, { rec14_2: 0, rec19: 0, rec47_5: 0, dist14_2: 0, dist19: 0, dist47_5: 0 });

    const totalRec = total.rec14_2 + total.rec19 + total.rec47_5;
    const totalDist = total.dist14_2 + total.dist19 + total.dist47_5;
    const netUsage = totalRec - totalDist;

    return { ...total, totalRec, totalDist, netUsage };
  }, [filteredData]);

  const categoryChartData = [
    { name: '14.2 KG', Received: stats.rec14_2, Distributed: stats.dist14_2 },
    { name: '19 KG', Received: stats.rec19, Distributed: stats.dist19 },
    { name: '47.5 KG', Received: stats.rec47_5, Distributed: stats.dist47_5 },
  ];

  const pieData = [
    { name: 'Domestic (14.2)', value: stats.dist14_2 },
    { name: 'Commercial (19)', value: stats.dist19 },
    { name: 'Industrial (47.5)', value: stats.dist47_5 },
  ];

  const StatCard = ({ title, value, icon: Icon, color, subtitleValue }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {subtitleValue !== undefined && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${subtitleValue >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {subtitleValue >= 0 ? 'Stock Up' : 'Stock Down'}
          </span>
        )}
      </div>
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value.toLocaleString()}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-slate-600">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-lg font-medium animate-pulse">Syncing with Google Sheets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Sync Failed</h2>
        <p className="text-slate-500 max-w-md mb-6">{error}</p>
        <button 
          onClick={fetchData}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">LPG Live Dashboard</h1>
             <button onClick={fetchData} className="p-2 hover:bg-white rounded-full transition-colors group" title="Refresh data">
                <RefreshCw className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
             </button>
          </div>
          <p className="text-slate-500">Connected to Google Sheets: {data.length} records found.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search agency/OMC..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
            >
              {agenciesList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Received (All)" value={stats.totalRec} icon={ArrowUpRight} color="bg-blue-600" />
          <StatCard title="Total Distributed (All)" value={stats.totalDist} icon={ArrowDownRight} color="bg-emerald-600" />
          <StatCard title="Net Stock Change" value={stats.netUsage} icon={TrendingUp} color="bg-amber-500" subtitleValue={stats.netUsage} />
          <StatCard title="14.2kg Outflow" value={stats.dist14_2} icon={Package} color="bg-indigo-600" />
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-6">Inflow vs Outflow Comparison</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar dataKey="Received" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="Distributed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-2">Demand Share</h2>
            <p className="text-slate-400 text-xs mb-6">Distribution mix by cylinder weight</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <h2 className="text-lg font-bold">Agency Logs</h2>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sheet Data Source</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-4">Date</th>
                  <th className="p-4">Agency / OMC</th>
                  <th className="p-4 text-center">Received (14.2 / 19 / 47.5)</th>
                  <th className="p-4 text-center">Distributed (14.2 / 19 / 47.5)</th>
                  <th className="p-4 text-right">Net Move</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => {
                  const net = (row.rec14_2 + row.rec19 + row.rec47_5) - (row.dist14_2 + row.dist19 + row.dist47_5);
                  return (
                    <tr key={row.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-600 whitespace-nowrap">{row.dateOfEntry}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{row.agencyName}</div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase">{row.omcName}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1.5">
                          <span className="text-blue-700 font-semibold">{row.rec14_2}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-blue-700 font-semibold">{row.rec19}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-blue-700 font-semibold">{row.rec47_5}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1.5">
                          <span className="text-emerald-700 font-semibold">{row.dist14_2}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-emerald-700 font-semibold">{row.dist19}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-emerald-700 font-semibold">{row.dist47_5}</span>
                        </div>
                      </td>
                      <td className={`p-4 text-sm font-black text-right ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {net > 0 ? '+' : ''}{net}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-8 flex items-center justify-between text-slate-400 text-[10px] uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <Info className="w-3 h-3" />
          <span>Real-time data from Agency Log Spreadsheet</span>
        </div>
        <span>Last Sync: {new Date().toLocaleTimeString()}</span>
      </footer>
    </div>
  );
};

export default App;

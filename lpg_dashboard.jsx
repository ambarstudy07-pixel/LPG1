import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, TrendingUp, Package, Filter, Info, Search, RefreshCw, AlertCircle, ExternalLink, Database
} from 'lucide-react';

// Configuration for your specific Google Sheet
const SHEET_ID = '1-ls5UsldwA91zlDLqWQ3bU36O1eJ4OV4ym7audsB7uU';
const GID = '488899721'; // Derived from your previous URL
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgency, setSelectedAgency] = useState('All Agencies');
  const [searchTerm, setSearchTerm] = useState('');

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Regex to handle commas inside quotes
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const headers = lines[0].split(regex).map(h => h.replace(/^"|"$/g, '').trim());

    return lines.slice(1).filter(line => line.trim() !== '').map((line, index) => {
      const values = line.split(regex).map(v => v.replace(/^"|"$/g, '').trim());
      
      const getVal = (patterns) => {
        const idx = headers.findIndex(h => 
          patterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
        );
        return idx !== -1 ? values[idx] : null;
      };

      // Map to your EXACT column names
      return {
        id: index,
        timestamp: getVal(['Timestamp']),
        dateOfEntry: getVal(['Date of Entry']),
        omcName: getVal(['OMC Name']),
        agencyName: getVal(['Agency Name']),
        // Received Column mapping (matches your provided names)
        rec14_2: Number(getVal(['Received', 'Domestic - 14.2'])) || 0,
        rec19: Number(getVal(['Received', 'Commercial - 19'])) || 0,
        rec47_5: Number(getVal(['Received', 'Industrial - 47.5'])) || 0,
        // Distributed Column mapping
        dist14_2: Number(getVal(['Distributed', 'Domestic- 14.2'])) || 0,
        dist19: Number(getVal(['Distributed', 'Commercial- 19'])) || 0,
        dist47_5: Number(getVal(['Distributed', 'Industrial- 47.5'])) || 0,
        // Starting stock (if present in sheet)
        startStock: Number(getVal(['Starting Stock', 'Opening'])) || 0 
      };
    }).filter(row => row.agencyName);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // We use a cache-busting timestamp to ensure fresh data from Google
      const response = await fetch(`${CSV_URL}&t=${Date.now()}`);
      
      if (response.status === 404) {
        throw new Error("Sheet Not Found: Ensure 'Anyone with the link can view' is enabled in Share settings.");
      }
      
      if (!response.ok) {
        throw new Error(`Connection Error (${response.status}): Could not reach the spreadsheet.`);
      }

      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      
      if (parsedData.length === 0) {
        throw new Error("Empty Data: The sheet was reached but no valid agency records were found.");
      }

      setData(parsedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const agenciesList = useMemo(() => {
    return ['All Agencies', ...new Set(data.map(item => item.agencyName))];
  }, [data]);

  const filteredData = useMemo(() => {
    let result = data;
    if (selectedAgency !== 'All Agencies') {
      result = result.filter(item => item.agencyName === selectedAgency);
    }
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.agencyName.toLowerCase().includes(lowerSearch) || 
        item.omcName.toLowerCase().includes(lowerSearch)
      );
    }
    return result;
  }, [data, selectedAgency, searchTerm]);

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
    { name: 'Domestic', value: stats.dist14_2 },
    { name: 'Commercial', value: stats.dist19 },
    { name: 'Industrial', value: stats.dist47_5 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="relative">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mb-4" />
          <Database className="w-5 h-5 text-blue-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-lg font-semibold text-slate-700 animate-pulse">Syncing Live Sheet Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-rose-100 max-w-md w-full">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Sync Failed</h2>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">{error}</p>
          <div className="space-y-3">
            <button 
              onClick={fetchData}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
            >
              <RefreshCw className="w-4 h-4" /> Retry Connection
            </button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Open Spreadsheet
            </a>
          </div>
          <div className="mt-8 p-4 bg-slate-50 rounded-lg text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Troubleshooting:</p>
            <ol className="text-xs text-slate-500 space-y-1 list-decimal ml-4">
              <li>Click "Share" in your Google Sheet.</li>
              <li>Set "General access" to <b>"Anyone with the link"</b>.</li>
              <li>Refresh this page.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
             <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">LPG Inventory Insights</h1>
             <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               Live
             </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Monitoring {data.length} records from Google Sheets</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Agency or OMC..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer font-medium"
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
            >
              {agenciesList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button 
            onClick={fetchData}
            className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-slate-400 hover:text-blue-600"
            title="Force refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <ArrowUpRight className="w-16 h-16 text-blue-600" />
            </div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Received</h3>
            <p className="text-3xl font-black text-slate-900">{stats.totalRec.toLocaleString()}</p>
            <div className="mt-4 flex gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded">D: {stats.rec14_2}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded">C: {stats.rec19}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <ArrowDownRight className="w-16 h-16 text-emerald-600" />
            </div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Distributed</h3>
            <p className="text-3xl font-black text-slate-900">{stats.totalDist.toLocaleString()}</p>
            <div className="mt-4 flex gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">D: {stats.dist14_2}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">C: {stats.dist19}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-16 h-16 text-amber-500" />
            </div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Net Stock Change</h3>
            <p className={`text-3xl font-black ${stats.netUsage >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {stats.netUsage > 0 ? '+' : ''}{stats.netUsage.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-4 font-medium italic">Difference between in/out flow</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Package className="w-16 h-16 text-indigo-600" />
            </div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Domestic Outflow</h3>
            <p className="text-3xl font-black text-slate-900">{stats.dist14_2.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-4 font-medium italic">Total 14.2 KG cylinders sold</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-6 text-slate-800">Cylinder Weight Analysis</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar dataKey="Received" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                  <Bar dataKey="Distributed" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-2 text-slate-800">Market Segment</h2>
            <p className="text-slate-400 text-xs mb-8 font-medium">Distribution by weight category</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={65} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                    {pieData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
               <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-400">Main Driver:</span>
                  <span className="text-blue-600">Domestic (14.2 KG)</span>
               </div>
            </div>
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Transactional Log</h2>
            <Database className="w-4 h-4 text-slate-300" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                  <th className="p-4 pl-6">Date of Entry</th>
                  <th className="p-4">Agency Details</th>
                  <th className="p-4 text-center">Received (D/C/I)</th>
                  <th className="p-4 text-center">Distributed (D/C/I)</th>
                  <th className="p-4 pr-6 text-right">Net Change</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => {
                  const net = (row.rec14_2 + row.rec19 + row.rec47_5) - (row.dist14_2 + row.dist19 + row.dist47_5);
                  return (
                    <tr key={row.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors group">
                      <td className="p-4 pl-6 text-sm text-slate-500 font-medium">{row.dateOfEntry}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{row.agencyName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{row.omcName} • {row.timestamp}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black">
                          <span>{row.rec14_2}</span>
                          <span className="opacity-20">|</span>
                          <span>{row.rec19}</span>
                          <span className="opacity-20">|</span>
                          <span>{row.rec47_5}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-black">
                          <span>{row.dist14_2}</span>
                          <span className="opacity-20">|</span>
                          <span>{row.dist19}</span>
                          <span className="opacity-20">|</span>
                          <span>{row.dist47_5}</span>
                        </div>
                      </td>
                      <td className={`p-4 pr-6 text-sm font-black text-right ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
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

      <footer className="max-w-7xl mx-auto mt-8 flex flex-col md:flex-row items-center justify-between text-slate-400 text-[10px] uppercase tracking-widest gap-4">
        <div className="flex items-center gap-2">
          <Info className="w-3 h-3" />
          <span>Synchronized with Google Sheets CSV Engine</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Last Check: {new Date().toLocaleTimeString()}</span>
          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded font-bold">V 2.1</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

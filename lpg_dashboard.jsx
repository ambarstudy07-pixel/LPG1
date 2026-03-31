import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, TrendingUp, Package, Filter, Info, Search, RefreshCw, AlertCircle, ExternalLink, Database, ShieldAlert
} from 'lucide-react';

// Configuration for your specific Google Sheet
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
        // Received Column mapping
        rec14_2: Number(getVal(['Received', 'Domestic - 14.2'])) || 0,
        rec19: Number(getVal(['Received', 'Commercial - 19'])) || 0,
        rec47_5: Number(getVal(['Received', 'Industrial - 47.5'])) || 0,
        // Distributed Column mapping
        dist14_2: Number(getVal(['Distributed', 'Domestic- 14.2'])) || 0,
        dist19: Number(getVal(['Distributed', 'Commercial- 19'])) || 0,
        dist47_5: Number(getVal(['Distributed', 'Industrial- 47.5'])) || 0,
        // Starting stock
        startStock: Number(getVal(['Starting Stock', 'Opening'])) || 0 
      };
    }).filter(row => row.agencyName);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use proxy-less direct fetch first with cache busting
      const response = await fetch(`${CSV_URL}&t=${Date.now()}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Access Denied (404): The spreadsheet might be private. Please check the 'Share' settings.");
        }
        throw new Error(`Connection Error (${response.status}): The server could not be reached.`);
      }

      const csvText = await response.text();
      
      // Check if we actually got the spreadsheet or an HTML login page
      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('google-signin')) {
        throw new Error("Login Required: The spreadsheet is not public. Set 'Anyone with the link' to 'Viewer' in the Share menu.");
      }

      const parsedData = parseCSV(csvText);
      
      if (parsedData.length === 0) {
        throw new Error("No Data Found: The sheet is accessible but no rows were found matching your headers.");
      }

      setData(parsedData);
    } catch (err) {
      console.error("Fetch Error:", err);
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
        <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl shadow-blue-100 flex flex-col items-center">
          <div className="relative mb-8">
            <RefreshCw className="w-16 h-16 animate-spin text-blue-500" />
            <Database className="w-6 h-6 text-blue-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Syncing Data</h2>
          <p className="text-slate-400 font-medium animate-pulse">Establishing secure connection to Sheet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-rose-100 max-w-xl w-full">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 text-center">Sync Failed</h2>
          <div className="bg-rose-50/50 border border-rose-100 text-rose-800 p-5 rounded-2xl text-sm font-semibold mb-8 text-center leading-relaxed">
            {error}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
              onClick={fetchData}
              className="flex flex-col items-center justify-center p-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all gap-2 shadow-lg shadow-blue-100"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Retry Sync</span>
            </button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              <span>Open Sheet</span>
            </a>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Info className="w-3 h-3" /> Mandatory Step
            </h4>
            <div className="space-y-4 text-xs font-medium text-slate-600">
              <div className="flex gap-3">
                <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center shrink-0">1</div>
                <p>In Google Sheets, click the <span className="font-bold text-blue-600">Share</span> button (top right).</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center shrink-0">2</div>
                <p>Change "Restricted" to <span className="font-bold text-blue-600">Anyone with the link</span>.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center shrink-0">3</div>
                <p>Ensure Role is set to <span className="font-bold text-blue-600">Viewer</span> then click Done and Retry.</p>
              </div>
            </div>
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
             <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 italic">LPG DATA <span className="text-blue-600">PRO</span></h1>
             <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               Live Sync
             </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Analyzing {data.length} transactions across agencies</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Agency Search..." 
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              className="pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer font-bold text-slate-700"
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
            >
              {agenciesList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button 
            onClick={fetchData}
            className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all text-slate-400 hover:text-blue-600"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
              <ArrowUpRight className="w-20 h-20 text-blue-600" />
            </div>
            <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Stock Inflow</h3>
            <p className="text-3xl font-black text-slate-900">{stats.totalRec.toLocaleString()}</p>
            <div className="mt-4 flex gap-2">
              <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">14.2kg: {stats.rec14_2}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
              <ArrowDownRight className="w-20 h-20 text-emerald-600" />
            </div>
            <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Stock Outflow</h3>
            <p className="text-3xl font-black text-slate-900">{stats.totalDist.toLocaleString()}</p>
            <div className="mt-4 flex gap-2">
              <span className="text-[10px] font-bold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg">14.2kg: {stats.dist14_2}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp className="w-20 h-20 text-amber-500" />
            </div>
            <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Net Movement</h3>
            <p className={`text-3xl font-black ${stats.netUsage >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {stats.netUsage > 0 ? '+' : ''}{stats.netUsage.toLocaleString()}
            </p>
            <div className="mt-4 flex gap-2">
              <span className="text-[10px] font-bold px-2 py-1 bg-amber-50 text-amber-600 rounded-lg">Balance Delta</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
              <Package className="w-20 h-20 text-indigo-600" />
            </div>
            <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Domestic Lead</h3>
            <p className="text-3xl font-black text-slate-900">{stats.dist14_2.toLocaleString()}</p>
            <div className="mt-4 flex gap-2">
              <span className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">Active Segment</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-xl font-black mb-8 text-slate-800">Operational Breakdown</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700, fontSize: 10}} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700, fontSize: 10}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px'}} />
                  <Bar dataKey="Received" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} />
                  <Bar dataKey="Distributed" fill="#10b981" radius={[10, 10, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-xl font-black mb-2 text-slate-800">Demand Share</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">Sales Concentration</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={70} outerRadius={95} paddingAngle={10} dataKey="value" stroke="none">
                    {pieData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <h2 className="text-xl font-black text-slate-800">Log History</h2>
            <Database className="w-5 h-5 text-slate-300" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">
                  <th className="p-6">Date</th>
                  <th className="p-6">Agency & OMC</th>
                  <th className="p-6 text-center">Inflow (D/C/I)</th>
                  <th className="p-6 text-center">Outflow (D/C/I)</th>
                  <th className="p-6 text-right">Net Change</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => {
                  const net = (row.rec14_2 + row.rec19 + row.rec47_5) - (row.dist14_2 + row.dist19 + row.dist47_5);
                  return (
                    <tr key={row.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors group">
                      <td className="p-6 text-sm text-slate-500 font-bold">{row.dateOfEntry}</td>
                      <td className="p-6">
                        <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{row.agencyName}</div>
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mt-1">{row.omcName} • {row.timestamp}</div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-black">
                          <span>{row.rec14_2}</span>
                          <span className="opacity-20 text-[8px]">/</span>
                          <span>{row.rec19}</span>
                          <span className="opacity-20 text-[8px]">/</span>
                          <span>{row.rec47_5}</span>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black">
                          <span>{row.dist14_2}</span>
                          <span className="opacity-20 text-[8px]">/</span>
                          <span>{row.dist19}</span>
                          <span className="opacity-20 text-[8px]">/</span>
                          <span>{row.dist47_5}</span>
                        </div>
                      </td>
                      <td className={`p-6 text-sm font-black text-right ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
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

      <footer className="max-w-7xl mx-auto mt-12 flex flex-col md:flex-row items-center justify-between text-slate-400 text-[10px] uppercase tracking-widest gap-4 font-bold">
        <div className="flex items-center gap-3">
          <Info className="w-3 h-3" />
          <span>Real-time analysis powered by Google Sheets API</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Last Sync: {new Date().toLocaleTimeString()}</span>
          <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full">v 2.5 Build Stable</span>
        </div>
      </footer>
    </div>
  );
};

export default App;


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { INITIAL_PATIENTS } from './constants';
import { Patient } from './types';
import PatientCard from './components/PatientCard';
import { getPharmacistInsight, getSafetyStockRecommendation, parsePatientImage } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [simulatedDate, setSimulatedDate] = useState('2026-01-30');
  const [searchTerm, setSearchTerm] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [aiInsight, setAiInsight] = useState<string>('분석 중...');
  const [safetyStockAi, setSafetyStockAi] = useState<string>('분석 중...');
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [isSafetyLoading, setIsSafetyLoading] = useState(false);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) await processImage(blob);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processImage = async (file: File) => {
    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      const result = await parsePatientImage(base64Data, file.type);
      if (result) {
        setQuickInput(prev => (prev ? prev + '\n' + result : result));
        setShowAddForm(true);
      } else {
        alert("이미지 분석에 실패했습니다.");
      }
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePatient = (id: number) => {
    setPatients(prev => prev.filter(p => p.id !== id));
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`선택한 ${selectedIds.length}명을 삭제하시겠습니까?`)) {
      setPatients(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      setShowManageModal(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === patients.length) setSelectedIds([]);
    else setSelectedIds(patients.map(p => p.id));
  };

  const parseSingleLine = (line: string): Patient | null => {
    try {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length < 5) return null;
      const nameMatch = parts[0].match(/([^(]+)\(([^,]+),\s*(\d+)\)/);
      if (!nameMatch) return null;
      const name = nameMatch[1].trim();
      const gender = (nameMatch[2].trim() === '여' ? '여' : '남') as '남' | '여';
      const age = parseInt(nameMatch[3]);
      const contact = parts[1].replace('연락처:', '').trim();
      const dosageTime = parts[2].replace('복용시간:', '').replace('복약시간:', '').split(',').map(t => t.trim());
      const medMatch = parts[3].replace('핵심약물:', '').match(/([^(]+)\(([^)]+)\)/);
      const keyMedication = medMatch ? medMatch[1].trim() : parts[3].replace('핵심약물:', '').trim();
      const condition = medMatch ? medMatch[2].trim() : '만성질환';
      const endDate = parts[4].replace('종료일:', '').trim();
      return { id: Math.random() + Date.now(), name, gender, age, contact, dosageTime, keyMedication, condition, endDate };
    } catch (e) { return null; }
  };

  const handleAddPatients = () => {
    if (!quickInput.trim()) return;
    const lines = quickInput.split('\n').filter(l => l.trim());
    const newPatients: Patient[] = [];
    lines.forEach(line => { const p = parseSingleLine(line); if (p) newPatients.push(p); });
    if (newPatients.length > 0) {
      setPatients(prev => [...newPatients, ...prev]);
      setQuickInput('');
      setShowAddForm(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processImage(file);
  };

  const getDiffDays = (endDateStr: string, currentDateStr: string) => {
    const endDate = new Date(endDateStr);
    const currentDate = new Date(currentDateStr);
    endDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    return Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const processedPatients = useMemo(() => {
    return patients.map(p => {
      const daysLeft = getDiffDays(p.endDate, simulatedDate);
      return { ...p, daysLeft, isUrgent: daysLeft >= 0 && daysLeft <= 3, isActive: daysLeft >= 0 };
    }).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [patients, simulatedDate]);

  const activePatients = useMemo(() => processedPatients.filter(p => p.isActive), [processedPatients]);

  const urgentList = useMemo(() => 
    processedPatients.filter(p => p.isUrgent && (p.name.includes(searchTerm) || p.keyMedication.includes(searchTerm))), 
  [processedPatients, searchTerm]);
  
  const allList = useMemo(() => 
    processedPatients.filter(p => p.name.includes(searchTerm) || p.keyMedication.includes(searchTerm)), 
  [processedPatients, searchTerm]);

  const medicationStats = useMemo(() => {
    const stats: Record<string, { totalPatients: number, totalDosesPerDay: number }> = {};
    activePatients.forEach(p => {
      if (!stats[p.keyMedication]) stats[p.keyMedication] = { totalPatients: 0, totalDosesPerDay: 0 };
      stats[p.keyMedication].totalPatients += 1;
      stats[p.keyMedication].totalDosesPerDay += p.dosageTime.length;
    });
    return stats;
  }, [activePatients]);

  const chartData = useMemo(() => {
    return Object.entries(medicationStats).map(([name, stat]) => ({ name, value: stat.totalPatients }));
  }, [medicationStats]);

  useEffect(() => {
    const fetchData = async () => {
      const urgentTargets = processedPatients.filter(p => p.isUrgent);
      setIsInsightLoading(true);
      const insight = await getPharmacistInsight(urgentTargets);
      setAiInsight(insight || "긴급 재고 확인이 필요합니다.");
      setIsInsightLoading(false);

      setIsSafetyLoading(true);
      const safety = await getSafetyStockRecommendation(medicationStats, activePatients.length);
      setSafetyStockAi(safety || "분석 결과를 불러올 수 없습니다.");
      setIsSafetyLoading(false);
    };
    fetchData();
  }, [processedPatients, medicationStats, activePatients.length]);

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-indigo-900/40 backdrop-blur-md flex items-center justify-center text-center p-6">
          <div className="bg-white p-10 rounded-3xl shadow-2xl space-y-4 max-w-sm w-full">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-bold text-slate-900">전문가 AI 정밀 분석 중</h2>
            <p className="text-sm text-slate-500">환자 리스트 이미지에서 데이터를 추출하고 분석하고 있습니다.</p>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
              <i className="fa-solid fa-prescription-bottle-medical text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">PharmStock Pro</h1>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Expert Inventory Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setShowAddForm(!showAddForm)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-100">
                <i className={`fa-solid ${showAddForm ? 'fa-xmark' : 'fa-user-plus'}`}></i>
                환자 등록
             </button>
             <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                <i className="fa-solid fa-camera text-indigo-600"></i>
                파일 분석
             </button>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
             <button onClick={() => setShowManageModal(true)} className="bg-slate-100 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-200 transition-all">
                <i className="fa-solid fa-list-check"></i>
                명단 관리
             </button>
             <div className="flex items-center bg-slate-50 rounded-xl px-4 py-2.5 gap-3 border border-slate-200 ml-2 shadow-inner">
                <i className="fa-regular fa-calendar text-indigo-500 text-xs"></i>
                <input type="date" value={simulatedDate} onChange={(e) => setSimulatedDate(e.target.value)} className="bg-transparent text-sm font-black focus:outline-none text-slate-700 cursor-pointer" />
            </div>
          </div>
        </div>
      </header>

      {showManageModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-2xl font-black text-slate-900">데이터 통합 관리</h2>
              <button onClick={() => setShowManageModal(false)} className="w-12 h-12 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors"><i className="fa-solid fa-xmark text-lg"></i></button>
            </div>
            <div className="p-6 bg-white overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <button onClick={selectAll} className="text-sm font-black text-indigo-600 hover:underline">전체 선택/해제</button>
                <p className="text-xs text-slate-400 font-bold uppercase">{patients.length}명 관리 중</p>
              </div>
              <div className="space-y-3">
                {patients.map(p => (
                  <div key={p.id} onClick={() => toggleSelect(p.id)} className={`flex items-center p-5 rounded-2xl border-2 transition-all cursor-pointer ${selectedIds.includes(p.id) ? 'bg-indigo-50 border-indigo-500 shadow-md shadow-indigo-100' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                    <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition-all ${selectedIds.includes(p.id) ? 'bg-indigo-600 border-indigo-600 scale-110 shadow-sm shadow-indigo-200' : 'bg-white border-slate-300'}`}>
                      {selectedIds.includes(p.id) && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-slate-800 text-lg">{p.name} <span className="text-sm font-medium text-slate-400">({p.gender}, {p.age}세)</span></p>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{p.keyMedication} • {p.endDate} 종료 예정</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button onClick={() => setShowManageModal(false)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black text-slate-600 hover:bg-slate-100 transition-colors">닫기</button>
              <button onClick={handleBatchDelete} disabled={selectedIds.length === 0} className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl font-black disabled:opacity-50 hover:bg-rose-700 transition-all shadow-lg shadow-rose-100">선택 데이터 삭제</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {showAddForm && (
            <div className="mb-12 animate-in fade-in slide-in-from-top-6 duration-300">
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-500 shadow-2xl shadow-indigo-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-indigo-600 flex items-center gap-3 text-lg"><i className="fa-solid fa-wand-magic-sparkles"></i> AI 추출 데이터 검토</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase">수정 후 저장이 가능합니다</p>
                    </div>
                    <textarea 
                        className="w-full p-6 rounded-2xl border border-slate-200 text-sm font-medium bg-slate-50 min-h-[200px] font-mono leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                        value={quickInput}
                        onChange={(e) => setQuickInput(e.target.value)}
                    />
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setQuickInput('')} className="px-8 py-3 text-slate-400 font-black hover:text-slate-600 transition-colors">전체 초기화</button>
                        <button onClick={handleAddPatients} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">일괄 데이터 저장</button>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className={`rounded-[2.5rem] p-8 text-white shadow-2xl transition-all duration-500 ${urgentList.length > 0 ? 'bg-rose-600 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <p className="opacity-80 text-xs font-black uppercase tracking-widest">주문 권장 (종료 3일 내)</p>
                <i className="fa-solid fa-truck-fast text-2xl opacity-50"></i>
              </div>
              <h2 className="text-6xl font-black tracking-tight">{urgentList.length} <span className="text-xl font-medium opacity-80">건</span></h2>
            </div>
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">활성 관리 환자</p>
                <h2 className="text-6xl font-black text-slate-900 mt-2 tracking-tight">{activePatients.length} <span className="text-xl font-medium text-slate-300">명</span></h2>
              </div>
              <p className="text-[11px] text-slate-400 font-bold mt-4 uppercase tracking-tighter">※ 종료일이 남은 환자 기준</p>
            </div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8 shadow-inner flex flex-col">
            <h3 className="text-xs font-black text-indigo-900 uppercase mb-5 flex items-center gap-2 tracking-widest">
              <i className="fa-solid fa-bolt text-indigo-500"></i> AI 운영 조언
            </h3>
            {isInsightLoading ? (
                <div className="space-y-3"><div className="h-3 bg-indigo-200/50 rounded-full animate-pulse"></div><div className="h-3 bg-indigo-200/50 rounded-full animate-pulse w-4/5"></div></div>
            ) : (
                <p className="text-indigo-800 text-sm leading-relaxed font-bold italic overflow-y-auto pr-2 custom-scrollbar">"{aiInsight}"</p>
            )}
          </div>
        </div>

        <div className="mb-12 max-w-3xl relative group">
            <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
            <input type="text" placeholder="환자명 또는 약물명을 입력하세요..." className="w-full pl-16 pr-8 py-5 rounded-[2rem] border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none shadow-sm transition-all text-slate-800 font-bold text-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            <div className="xl:col-span-8 space-y-16">
                <section>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-2.5 h-8 bg-rose-500 rounded-full"></div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">📦 재고 주문 긴급</h3>
                        <span className="bg-rose-100 text-rose-600 text-xs font-black px-4 py-1.5 rounded-full border border-rose-200 uppercase">{urgentList.length} CASES</span>
                    </div>
                    {urgentList.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {urgentList.map(p => <PatientCard key={p.id} patient={p} isUrgent={true} daysRemaining={p.daysLeft} onDelete={handleDeletePatient} />)}
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100 py-20 text-center text-slate-300 font-black text-lg">
                            <i className="fa-solid fa-circle-check text-5xl mb-4 block"></i>
                            긴급 주문 대상이 없습니다
                        </div>
                    )}
                </section>
                <section>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-2.5 h-8 bg-slate-300 rounded-full"></div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">👥 전체 관리 명단</h3>
                        <span className="bg-slate-100 text-slate-500 text-xs font-black px-4 py-1.5 rounded-full border border-slate-200 uppercase">{allList.length} TOTAL</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {allList.map(p => <PatientCard key={p.id} patient={p} isUrgent={p.isUrgent} daysRemaining={p.daysLeft} onDelete={handleDeletePatient} />)}
                    </div>
                </section>
            </div>

            <div className="xl:col-span-4 space-y-10">
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
                    <div className="flex items-center gap-4 mb-8 relative z-10">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <i className="fa-solid fa-microchip text-sm"></i>
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-300">Expert Inventory Report</h3>
                    </div>
                    {isSafetyLoading ? (
                        <div className="space-y-5 py-6 animate-pulse">
                            <div className="h-3.5 bg-white/10 rounded-full w-full"></div>
                            <div className="h-3.5 bg-white/10 rounded-full w-5/6"></div>
                            <div className="h-3.5 bg-white/10 rounded-full w-4/6"></div>
                            <div className="h-3.5 bg-white/10 rounded-full w-full"></div>
                        </div>
                    ) : (
                        <div className="text-[15px] leading-loose space-y-6 max-h-[700px] overflow-y-auto pr-2 font-bold text-slate-200 whitespace-pre-line tracking-tight custom-scrollbar relative z-10">
                            {safetyStockAi}
                        </div>
                    )}
                    <div className="mt-10 pt-8 border-t border-white/10 text-[11px] text-slate-500 italic font-medium relative z-10 flex items-center gap-2">
                        <i className="fa-solid fa-circle-info text-indigo-500"></i>
                        활성 환자 처방 데이터 기반 실시간 분석 결과
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 mb-10 uppercase tracking-[0.25em] flex items-center gap-3">
                        <i className="fa-solid fa-chart-simple text-indigo-500"></i> 약물별 처방 비중
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 800 }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                            <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={24}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#4f46e5' : '#94a3b8'} />
                                ))}
                            </Bar>
                        </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;

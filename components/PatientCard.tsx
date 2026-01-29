
import React from 'react';
import { Patient } from '../types';

interface PatientCardProps {
  patient: Patient;
  isUrgent: boolean;
  daysRemaining: number;
  onDelete: (id: number) => void;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient, isUrgent, daysRemaining, onDelete }) => {
  const handleOrderClick = () => {
    window.open('https://www.hmpmall.co.kr/login.do', '_blank');
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // '바로' 삭제되도록 confirm 제거
    onDelete(patient.id);
  };

  return (
    <div className={`p-5 rounded-2xl shadow-sm border transition-all relative group ${isUrgent ? 'bg-red-50 border-red-200 ring-1 ring-red-100' : 'bg-white border-slate-200'}`}>
      {/* 삭제 버튼 - 즉시 삭제 */}
      <button 
        onClick={handleDeleteClick}
        className="absolute -top-2 -right-2 w-8 h-8 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-600 hover:border-red-200 shadow-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10"
        title="즉시 삭제"
      >
        <i className="fa-solid fa-trash-can text-xs"></i>
      </button>

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            {patient.name} <span className="text-sm font-normal text-slate-500">({patient.gender}, {patient.age}세)</span>
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            <i className="fa-solid fa-phone mr-2 text-blue-500"></i>{patient.contact}
          </p>
        </div>
        {isUrgent ? (
          <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-sm">
            D-{daysRemaining <= 0 ? (daysRemaining === 0 ? 'Day' : '지남') : daysRemaining} 주문 긴급
          </span>
        ) : (
          <span className="bg-slate-100 text-slate-500 text-xs font-medium px-3 py-1 rounded-full">
            D-{daysRemaining} 여유
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/50 p-2 rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase font-bold">핵심 약물</p>
          <p className="text-sm font-semibold text-slate-700 truncate">{patient.keyMedication}</p>
          <p className="text-[10px] text-blue-500">{patient.condition}</p>
        </div>
        <div className="bg-white/50 p-2 rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase font-bold">복약 종료일</p>
          <p className="text-sm font-semibold text-slate-700">{patient.endDate}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {patient.dosageTime.map((time, idx) => (
          <span key={idx} className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded border border-blue-100 font-medium">
            {time}
          </span>
        ))}
      </div>

      <button 
        onClick={handleOrderClick}
        className={`w-full py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 ${
          isUrgent ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-100' : 'bg-slate-800 text-white hover:bg-slate-900 shadow-slate-100'
        }`}
      >
        <i className="fa-solid fa-cart-shopping mr-2"></i>
        재고 주문하기
      </button>
    </div>
  );
};

export default PatientCard;

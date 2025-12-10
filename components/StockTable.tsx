import React, { useMemo, useState } from 'react';
import { Stock } from '../types';
import { ArrowUp, ArrowDown, Search, ArrowUpDown } from 'lucide-react';

interface StockTableProps {
  data: Stock[];
  isLoading: boolean;
}

type SortField = 'name' | 'ltp' | 'changePercent' | 'volume';
type SortOrder = 'asc' | 'desc';

export const StockTable: React.FC<StockTableProps> = ({ data, isLoading }) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('changePercent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const processedData = useMemo(() => {
    let result = [...data];

    // Filter
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(lowerSearch) || 
        s.symbol.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, search, sortField, sortOrder]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl overflow-hidden flex flex-col h-full">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-gray-800 flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-900/50">
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Search Nifty 50 stocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-600"
          />
        </div>
        <div className="text-xs text-gray-500 font-mono">
          Showing {processedData.length} of {data.length} instruments
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-800/50 sticky top-0 z-10 backdrop-blur-md">
            <tr>
              <SortHeader label="Symbol" field="name" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} align="left" />
              <SortHeader label="LTP" field="ltp" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} align="right" />
              <SortHeader label="Change" field="changePercent" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} align="right" />
              <SortHeader label="Volume" field="volume" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} align="right" />
              <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right hidden md:table-cell">Open</th>
              <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right hidden md:table-cell">High</th>
              <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right hidden md:table-cell">Low</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading && data.length === 0 ? (
              // Skeleton Loading
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="p-4"><div className="h-4 bg-gray-800 rounded w-24"></div></td>
                  <td className="p-4"><div className="h-4 bg-gray-800 rounded w-16 ml-auto"></div></td>
                  <td className="p-4"><div className="h-4 bg-gray-800 rounded w-16 ml-auto"></div></td>
                  <td className="p-4"><div className="h-4 bg-gray-800 rounded w-20 ml-auto"></div></td>
                  <td className="p-4 hidden md:table-cell"><div className="h-4 bg-gray-800 rounded w-16 ml-auto"></div></td>
                  <td className="p-4 hidden md:table-cell"><div className="h-4 bg-gray-800 rounded w-16 ml-auto"></div></td>
                  <td className="p-4 hidden md:table-cell"><div className="h-4 bg-gray-800 rounded w-16 ml-auto"></div></td>
                </tr>
              ))
            ) : (
              processedData.map((stock) => (
                <StockRow key={stock.symbol} stock={stock} />
              ))
            )}
            
            {!isLoading && processedData.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No stocks found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Sub-components for cleaner code
const SortHeader = ({ label, field, currentSort, sortOrder, onSort, align = 'left' }: any) => (
  <th 
    className={`p-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group select-none text-${align}`}
    onClick={() => onSort(field)}
  >
    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      {label}
      <span className={`transition-opacity ${currentSort === field ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
        {currentSort === field && sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        {currentSort !== field && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </div>
  </th>
);

const StockRow = React.memo(({ stock }: { stock: Stock }) => {
  const isPositive = stock.change >= 0;
  const ColorClass = isPositive ? 'text-green-400' : 'text-red-400';
  const BgClass = isPositive ? 'bg-green-400/10' : 'bg-red-400/10';

  return (
    <tr className="hover:bg-gray-800/50 transition-colors group">
      <td className="p-3">
        <div className="flex flex-col">
          <span className="font-semibold text-white text-sm">{stock.name}</span>
          <span className="text-[10px] text-gray-500 font-mono hidden sm:inline-block">{stock.symbol}</span>
        </div>
      </td>
      <td className="p-3 text-right font-mono text-white text-sm">
        ₹{stock.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </td>
      <td className="p-3 text-right">
        <div className={`inline-flex items-center px-2 py-1 rounded ${BgClass} ${ColorClass} font-mono text-xs font-medium`}>
          {isPositive ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
          {Math.abs(stock.change).toFixed(2)} ({Math.abs(stock.changePercent).toFixed(2)}%)
        </div>
      </td>
      <td className="p-3 text-right font-mono text-gray-400 text-sm">
        {stock.volume.toLocaleString('en-IN')}
      </td>
      <td className="p-3 text-right font-mono text-gray-500 text-sm hidden md:table-cell">{stock.open.toFixed(2)}</td>
      <td className="p-3 text-right font-mono text-gray-500 text-sm hidden md:table-cell">{stock.high.toFixed(2)}</td>
      <td className="p-3 text-right font-mono text-gray-500 text-sm hidden md:table-cell">{stock.low.toFixed(2)}</td>
    </tr>
  );
});
export type ManagementRiskFilter = "all" | "critical" | "moderate" | "no-data";
export type ManagementStatusFilter = "all" | "pending" | "responded" | "followed-up";

export interface ManagementCounselorOption {
  id: string;
  name: string;
}

interface ManagementFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  risk: ManagementRiskFilter;
  onRiskChange: (value: ManagementRiskFilter) => void;
  status: ManagementStatusFilter;
  onStatusChange: (value: ManagementStatusFilter) => void;
  assignment?: string;
  onAssignmentChange?: (value: string) => void;
  counselors?: ManagementCounselorOption[];
}

const controlClassName = "min-w-[145px] max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function ManagementFilterBar({
  search,
  onSearchChange,
  risk,
  onRiskChange,
  status,
  onStatusChange,
  assignment,
  onAssignmentChange,
  counselors = [],
}: ManagementFilterBarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-md">
      <label className="min-w-[220px] flex-1">
        <span className="sr-only">Search user name, ID, or trigger text</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search user name, ID, or trigger text..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <label>
        <span className="sr-only">Filter by risk</span>
        <select value={risk} onChange={(event) => onRiskChange(event.target.value as ManagementRiskFilter)} className={controlClassName}>
          <option value="all">All Risks</option>
          <option value="critical">Critical Risk</option>
          <option value="moderate">Moderate Risk</option>
          <option value="no-data">No Data</option>
        </select>
      </label>

      <label>
        <span className="sr-only">Filter by status</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as ManagementStatusFilter)} className={controlClassName}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="responded">Responded</option>
          <option value="followed-up">Followed Up</option>
        </select>
      </label>

      {onAssignmentChange && assignment !== undefined && (
        <label>
          <span className="sr-only">Filter by counselor assignment</span>
          <select value={assignment} onChange={(event) => onAssignmentChange(event.target.value)} className={controlClassName}>
            <option value="all">All Counselors</option>
            <option value="unassigned">Unassigned</option>
            {counselors.map((counselor) => (
              <option key={counselor.id} value={counselor.id}>{counselor.name}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
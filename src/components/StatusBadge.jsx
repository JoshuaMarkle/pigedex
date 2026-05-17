const statusClasses = {
  home: "bg-green-100 text-green-800",
  flying: "bg-blue-100 text-blue-800",
  lost: "bg-red-100 text-red-800",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        statusClasses[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status}
    </span>
  );
}

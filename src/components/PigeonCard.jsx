import StatusBadge from "@/components/StatusBadge";
import { formatBirthday } from "@/lib/pigeons";

export default function PigeonCard({ pigeon }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{pigeon.name}</h2>

          <p className="text-sm text-muted-foreground">
            {pigeon.bandId || "Unbanded"}
          </p>
        </div>

        <StatusBadge status={pigeon.status} />
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Birthday:</span>{" "}
          {formatBirthday(pigeon)}
        </p>

        {pigeon.notes ? (
          <p className="text-muted-foreground">{pigeon.notes}</p>
        ) : null}
      </div>
    </div>
  );
}

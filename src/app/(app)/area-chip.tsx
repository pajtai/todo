import Link from "next/link";
import type { AreaOption } from "@/lib/areas";

type AreaChipProps = {
  area: AreaOption;
  href?: string;
  active?: boolean;
};

export function AreaChip({ area, href, active }: AreaChipProps) {
  return (
    <Link
      href={href ?? `/categories/${area.id}`}
      aria-current={active ? "true" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
        active ? "border-black font-medium" : "border-gray-300"
      }`}
    >
      {area.color && (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: area.color }}
        />
      )}
      {area.name}
    </Link>
  );
}

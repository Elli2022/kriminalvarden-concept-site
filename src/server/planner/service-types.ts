import type { BookingDraft } from "@/lib/planner-domain";

export type MutableBookingDraft = BookingDraft & {
  requestId?: string | null;
};

export class PlannerServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

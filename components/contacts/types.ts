import type {
  Contact as ContactRow,
  ContactAssignment as ContactAssignmentRow,
  Site as SiteRow,
} from "@/lib/types";
import type { Database } from "@/lib/types/database";

export type Contact = ContactRow;
export type ContactAssignment = ContactAssignmentRow;
export type Site = SiteRow;
export type WorkforceRow = Database["public"]["Views"]["job_workforce_contacts"]["Row"];

export type AssignedContact = ContactAssignment & { contact: Contact | null };

// A job or a project, with the people attached to it. Both tabs render the
// same shape so the view toggle is purely a data swap.
export interface ContactGroup {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  status: string | null;
  href: string;
  assigned: AssignedContact[];
  workforce: WorkforceRow[];
}

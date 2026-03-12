export type UrssafClientPayload = {
  familyId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  address: {
    addr1: string;
    addr2?: string | null;
    postcode: string;
    city: string;
    country: string;
  };
  fiscalNumber: string;
};

export type UrssafInvoicePayload = {
  invoiceId: string;
  familyUrssafCustomerId: string;
  amount: number;
  issuedAt: string;
  dueAt?: string;
  description: string;
};

export type UrssafSubmitInvoiceResult = {
  paymentId: string;
  status: "submitted" | "pending_validation" | "rejected";
};

export type UrssafPaymentStatus = {
  paymentId: string;
  status: "pending_validation" | "validated" | "rejected" | "paid";
  validatedAt?: string | null;
};
